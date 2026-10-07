import { database, resolveRuntimeEnv, withDatabaseContext, type RuntimeEnv } from "./database";
import { resolveTenant } from "./tenant";
import { createRemoteJWKSet, jwtVerify } from "jose";

type SchoolRecord = { id: string; name: string; subdomain: string; status: "trial" | "active" | "suspended"; createdAt: string; primaryColor?: string; students?: number; admins?: number };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
const badRequest = (message: string) => json({ error: message }, 400);

function platformTokenFromRequest(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer) return bearer;
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("platform_admin_session="));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice("platform_admin_session=".length));
  } catch {
    return null;
  }
}

async function isPlatformAdmin(request: Request, env: RuntimeEnv) {
  const token = platformTokenFromRequest(request);
  if (!token) return false;
  if (env.PLATFORM_ADMIN_TOKEN && token === env.PLATFORM_ADMIN_TOKEN) return true;
  if (!env.DATABASE_URL || !hasAuthConfig(env)) return false;

  try {
    const identity = await authenticateNeonToken(token, env);
    if (!identity) return false;
    const { userId, email } = identity;

    const sql = database(env);
    const users = await sql`select email, "emailVerified" as email_verified from neon_auth.user where id = ${userId} limit 1`;
    const authUser = users[0];
    if (!authUser || authUser["email_verified"] !== true || String(authUser["email"]).trim().toLowerCase() !== email) return false;
    const memberships = await withDatabaseContext(sql, { userEmail: email }, (tx) =>
      tx`
        select 1 from users u join memberships m on m.user_id = u.id
        where lower(u.email) = ${email} and m.role = 'super_admin' and m.school_id is null
        limit 1
      `,
    );
    return memberships.length > 0;
  } catch (error) {
    logTokenVerificationFailure(error, token);
    return false;
  }
}

function platformSessionCookie(token: string, request: Request, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `platform_admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/api/platform; Max-Age=${maxAge}${secure}`;
}

function validSubdomain(value: string) { return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value); }

const validPrimaryColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const maxCrestUrlLength = 700_000;
let cachedAuthJwksUrl = "";
let cachedAuthJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function authBaseUrl(env: RuntimeEnv) {
  const baseUrl = env.NEON_AUTH_BASE_URL ?? env.NEON_AUTH_URL;
  if (!baseUrl) throw new Error("Neon Auth base URL is not configured");
  return baseUrl.replace(/\/+$/, "");
}

function hasAuthConfig(env: RuntimeEnv) {
  return Boolean(env.NEON_AUTH_BASE_URL || env.NEON_AUTH_URL);
}

function authJwks(env: RuntimeEnv) {
  const normalizedUrl = env.NEON_AUTH_JWKS_URL ?? `${authBaseUrl(env)}/.well-known/jwks.json`;
  if (cachedAuthJwks && cachedAuthJwksUrl === normalizedUrl) return cachedAuthJwks;
  cachedAuthJwksUrl = normalizedUrl;
  cachedAuthJwks = createRemoteJWKSet(new URL(normalizedUrl));
  return cachedAuthJwks;
}

async function verifyNeonToken(token: string, env: RuntimeEnv) {
  const issuer = new URL(authBaseUrl(env)).origin;
  return jwtVerify(token, authJwks(env), { issuer, audience: issuer });
}

async function authenticateNeonToken(token: string, env: RuntimeEnv) {
  try {
    const verified = await verifyNeonToken(token, env);
    const userId = typeof verified.payload.sub === "string" ? verified.payload.sub : "";
    const email = typeof verified.payload["email"] === "string" ? verified.payload["email"].trim().toLowerCase() : "";
    if (userId && email) return { userId, email };
  } catch (jwtError) {
    if (!env.DATABASE_URL) throw jwtError;
    const sql = database(env);
    const sessions = await sql`
      select u.id as user_id, lower(u.email) as email
      from neon_auth.session s
      join neon_auth.user u on u.id = s."userId"
      where s.token = ${token}
        and s."expiresAt" > now()
      limit 1
    `;
    const session = sessions[0];
    if (session && typeof session["user_id"] === "string" && typeof session["email"] === "string") {
      return { userId: session["user_id"], email: session["email"] };
    }
    logTokenVerificationFailure(jwtError, token);
    return null;
  }
  return null;
}

function logTokenVerificationFailure(error: unknown, token: string) {
  const segments = token.split(".");
  console.error("Neon Auth token verification failed", {
    reason: error instanceof Error ? error.message : "Unknown verification error",
    segmentCount: segments.length,
    segmentLengths: segments.map((segment) => segment.length),
  });
}

function validCrestUrl(value: unknown): value is string | null {
  if (value == null || value === "") return true;
  if (typeof value !== "string" || value.length > maxCrestUrlLength) return false;
  if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function sendSchoolAdminInvitation(
  env: RuntimeEnv,
  recipient: string,
  contactName: string,
  schoolName: string,
  activationUrl: string,
) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return { sent: false, error: "Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL." };
  }

  const safeName = escapeHtml(contactName);
  const safeSchool = escapeHtml(schoolName);
  const safeUrl = escapeHtml(activationUrl);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [recipient],
        subject: `Your ${schoolName} workspace is ready on Klasora`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#183237"><h1 style="color:#1f5c3b">Welcome to Klasora</h1><p>Hello ${safeName},</p><p>Your school workspace for <strong>${safeSchool}</strong> has been approved.</p><p>Use the button below to activate your School Admin account. You will verify your email and choose a password.</p><p style="margin:28px 0"><a href="${safeUrl}" style="background:#1f5c3b;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:600">Activate your account</a></p><p>If the button does not work, copy this link into your browser:<br><a href="${safeUrl}">${safeUrl}</a></p></div>`,
        text: `Hello ${contactName},\n\nYour school workspace for ${schoolName} has been approved on Klasora.\n\nActivate your School Admin account, verify your email, and choose a password here:\n${activationUrl}\n`,
      }),
    });
    if (!response.ok) {
      console.error("Resend rejected the school-admin invitation", response.status);
      return { sent: false, error: "Resend could not deliver the invitation. Check your Resend sender configuration." };
    }
    return { sent: true as const };
  } catch (error) {
    console.error("Could not send school-admin invitation", error);
    return { sent: false, error: "Could not reach Resend to deliver the invitation." };
  }
}

type SchoolAdminContext = { schoolId: string; subdomain: string; role: string; userId: string; email: string };

async function requireSchoolContext(
  request: Request,
  env: RuntimeEnv,
  allowedRoles: readonly string[],
): Promise<SchoolAdminContext | Response> {
  if (!env.DATABASE_URL || !hasAuthConfig(env)) return json({ error: "Neon Auth is not configured" }, 503);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Authentication is required" }, 401);

  let userId: string;
  let email: string;
  try {
    const identity = await authenticateNeonToken(bearer, env);
    if (!identity) return json({ error: "Your sign-in session is invalid or expired. Please sign in again." }, 401);
    ({ userId, email } = identity);
  } catch (error) {
    logTokenVerificationFailure(error, bearer);
    return json({ error: "The sign-in token is invalid or expired" }, 401);
  }

  const sql = database(env);
  const authUsers = await sql`
    select id, email, "emailVerified" as email_verified
    from neon_auth.user
    where id = ${userId}
    limit 1
  `;
  const authUser = authUsers[0];
  if (!authUser || authUser["email_verified"] !== true || String(authUser["email"]).trim().toLowerCase() !== email) {
    return json({ error: "Verify your email address before using a school portal" }, 403);
  }

  const memberships = await withDatabaseContext(sql, { userEmail: email }, (tx) =>
    tx`
      select u.id as user_id, m.school_id, m.role, s.subdomain, s.status as school_status
      from users u
      join memberships m on m.user_id = u.id
      join schools s on s.id = m.school_id
      where lower(u.email) = ${email}
    `,
  );
  const querySubdomain = new URL(request.url).searchParams.get("tenant")?.trim().toLowerCase() ?? null;
  if (querySubdomain && !validSubdomain(querySubdomain)) return badRequest("Invalid tenant subdomain");
  const requestedSubdomain = resolveTenant(request, env.ROOT_DOMAIN).subdomain ?? querySubdomain;
  const schoolMemberships = memberships.filter((row) => row["school_id"] != null);
  const authorizedMemberships = schoolMemberships.filter((row) => allowedRoles.includes(String(row["role"])));
  const membership = requestedSubdomain
    ? authorizedMemberships.find((row) => row["subdomain"] === requestedSubdomain)
    : authorizedMemberships.length === 1 ? authorizedMemberships[0] : undefined;
  if (!membership) return json({ error: "This account does not have access to this school" }, 403);
  if (membership["school_status"] === "suspended") return json({ error: "This school tenant is suspended" }, 403);

  return {
    schoolId: String(membership["school_id"]),
    subdomain: String(membership["subdomain"]),
    role: String(membership["role"]),
    userId: String(membership["user_id"]),
    email,
  };
}

async function requireSchoolAdminContext(request: Request, env: RuntimeEnv): Promise<SchoolAdminContext | Response> {
  return requireSchoolContext(request, env, ["school_admin"]);
}

function uuidOrNull(value: unknown): value is string | null {
  return value === null || value === undefined || (typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export async function handleApiRequest(request: Request, env: RuntimeEnv): Promise<Response> {
  env = resolveRuntimeEnv(env);
  const url = new URL(request.url);
  if (url.pathname === "/api/health") return json({ ok: true, tenant: resolveTenant(request, env.ROOT_DOMAIN).subdomain });
  if (url.pathname === "/api/auth/config" && request.method === "GET") {
    return json({ authUrl: env.NEON_AUTH_URL ?? null, rootDomain: env.ROOT_DOMAIN ?? null });
  }
  if (url.pathname === "/api/platform/session") {
    if (!env.PLATFORM_ADMIN_TOKEN && !hasAuthConfig(env)) {
      // Not configured yet: treat as signed out so the page shows its sign-in form instead of crashing.
      if (request.method === "GET" || request.method === "DELETE") return json({ authenticated: false, error: "Platform sign-in is not set up yet" }, 401);
      return json({ error: "Platform sign-in is not set up yet. Add the PLATFORM_ADMIN_TOKEN secret." }, 503);
    }
    if (request.method === "GET") {
      return await isPlatformAdmin(request, env) ? json({ authenticated: true }) : json({ error: "Unauthorized" }, 401);
    }
    if (request.method === "DELETE") {
      return json({ authenticated: false }, 200, { "set-cookie": platformSessionCookie("", request, 0) });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const payload: unknown = await request.json().catch(() => null);
    const token = payload && typeof payload === "object" && "token" in payload && typeof payload.token === "string"
      ? payload.token
      : "";
    if (!token || token !== env.PLATFORM_ADMIN_TOKEN) return json({ error: "Unauthorized" }, 401);
    return json({ authenticated: true }, 200, { "set-cookie": platformSessionCookie(token, request, 8 * 60 * 60) });
  }
  if (url.pathname === "/api/school") {
    const tenant = resolveTenant(request, env.ROOT_DOMAIN);
    const querySubdomain = url.searchParams.get("tenant")?.trim().toLowerCase() ?? null;
    if (querySubdomain && !validSubdomain(querySubdomain)) return badRequest("Invalid tenant subdomain");
    const requestedSubdomain = tenant.subdomain ?? querySubdomain ?? (env.ROOT_DOMAIN === "localhost" ? "harrowgreen" : null);
    if (!requestedSubdomain) return json({ school: null });

    const sql = database(env);
    const rows = await sql`select id, name, subdomain, status, coalesce(primary_color, '#1f5c3b') as primary_color, crest_url from schools where subdomain = ${requestedSubdomain} limit 1`;
    const school = rows[0];
    return json({
      school: school
        ? {
            id: String(school["id"]),
            name: String(school["name"]),
            subdomain: String(school["subdomain"]),
            status: school["status"],
            primaryColor: String(school["primary_color"]),
            crestUrl: school["crest_url"] ? String(school["crest_url"]) : null,
          }
        : null,
    });
  }

  const classRosterMatch = url.pathname.match(/^\/api\/school\/classes\/([0-9a-f-]+)\/roster$/i);
  const termCloseMatch = url.pathname.match(/^\/api\/school\/terms\/([0-9a-f-]+)\/close$/i);
  const studentProfileMatch = url.pathname.match(/^\/api\/school\/students\/([0-9a-f-]+)$/i);
  const workflowRoles: Record<string, Record<string, readonly string[]>> = {
    "/api/school/classes": { GET: ["school_admin", "teacher"], POST: ["school_admin"] },
    "/api/school/students": { GET: ["school_admin", "teacher"] },
    "/api/school/attendance": { GET: ["school_admin", "teacher"], POST: ["teacher"] },
    "/api/school/fees": { GET: ["school_admin", "finance"], POST: ["school_admin"] },
    "/api/school/marks": { GET: ["school_admin", "teacher"], PUT: ["school_admin", "teacher"] },
    "/api/school/terminal-reports": { GET: ["school_admin", "teacher"], POST: ["school_admin", "teacher"] },
    "/api/school/promotions": { GET: ["school_admin", "teacher"], POST: ["teacher"], PATCH: ["school_admin"] },
    "/api/school/academic-periods": { GET: ["school_admin", "teacher"], POST: ["school_admin"] },
    "/api/school/terms": { POST: ["school_admin"] },
    "/api/school/team": { GET: ["school_admin"], POST: ["school_admin"] },
    "/api/school/teaching-setup": { GET: ["school_admin"], POST: ["school_admin"] },
  };
  const workflowMethodRoles = workflowRoles[url.pathname]?.[request.method]
    ?? (studentProfileMatch && ["GET", "PATCH"].includes(request.method) ? ["school_admin"] : undefined)
    ?? (classRosterMatch && request.method === "GET" ? ["school_admin", "teacher"] : undefined)
    ?? (termCloseMatch && request.method === "POST" ? ["school_admin"] : undefined);
  const schoolDataRoute = url.pathname === "/api/school/classes"
    || url.pathname === "/api/school/students"
    || url.pathname === "/api/school/academic-periods"
    || url.pathname === "/api/school/terms"
    || url.pathname === "/api/school/team"
    || url.pathname === "/api/school/teaching-setup"
    || studentProfileMatch !== null
    || classRosterMatch !== null
    || termCloseMatch !== null
    || workflowMethodRoles !== undefined;
  if (schoolDataRoute) {
    const isGet = request.method === "GET";
    const isCreate = request.method === "POST" && (url.pathname === "/api/school/classes" || url.pathname === "/api/school/students");
    const isWorkflowMethod = workflowMethodRoles !== undefined;
    if (!isGet && !isCreate && !isWorkflowMethod) return json({ error: "Method not allowed" }, 405);

    const school = isWorkflowMethod
      ? await requireSchoolContext(request, env, workflowMethodRoles)
      : await requireSchoolAdminContext(request, env);
    if (school instanceof Response) return school;
    const sql = database(env);

    if (studentProfileMatch) {
      if (!uuidOrNull(studentProfileMatch[1])) return badRequest("Invalid student ID");
      if (request.method === "PATCH") {
        const payload: unknown = await request.json().catch(() => null);
        if (!payload || typeof payload !== "object" || typeof payload["active"] !== "boolean") {
          return badRequest("Choose whether the student should be active");
        }
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            update students
            set active = ${payload["active"]}
            where id = ${studentProfileMatch[1]}::uuid
              and school_id = ${school.schoolId}::uuid
            returning id, first_name, last_name, admission_number as student_id_number,
                      case when active then 'active' else 'inactive' end as status
          `,
        );
        if (!rows[0]) return json({ error: "Student not found" }, 404);
        return json({ student: rows[0] });
      }
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          select st.id, st.first_name, st.last_name,
                 st.admission_number as student_id_number,
                 case when st.active then 'active' else 'inactive' end as status,
                 st.date_of_birth, st.gender, st.address, st.emergency_contact,
                 st.medical_notes, c.name as class_name,
                 g.full_name as guardian_name, g.phone as guardian_phone,
                 sg.relationship as guardian_relationship
          from students st
          left join lateral (
            select e.class_id
            from class_enrollments e
            where e.school_id = st.school_id and e.student_id = st.id and e.ends_on is null
            order by e.starts_on desc
            limit 1
          ) enrollment on true
          left join classes c on c.id = enrollment.class_id and c.school_id = st.school_id
          left join student_guardians sg
            on sg.student_id = st.id and sg.school_id = st.school_id and sg.is_primary
          left join guardians g on g.id = sg.guardian_id and g.school_id = sg.school_id
          where st.id = ${studentProfileMatch[1]}::uuid
            and st.school_id = ${school.schoolId}::uuid
          limit 1
        `,
      );
      if (!rows[0]) return json({ error: "Student not found" }, 404);
      return json({ student: rows[0] });
    }

    if (termCloseMatch) {
      if (!uuidOrNull(termCloseMatch[1])) return badRequest("Invalid term ID");
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          update terms
          set is_closed = true, closed_at = now(), closed_by_user_id = ${school.userId}::uuid
          where id = ${termCloseMatch[1]}::uuid and school_id = ${school.schoolId}::uuid
            and lower(name) like '%term 3%' and not is_closed
          returning id, name, is_closed, closed_at
        `,
      );
      if (!rows[0]) return json({ error: "Term not found, already closed, or it is not Term 3" }, 409);
      return json({ term: rows[0] });
    }

    if (url.pathname === "/api/school/attendance") {
      const classId = url.searchParams.get("class_id")?.trim() || null;
      if (classId && !uuidOrNull(classId)) return badRequest("Invalid class ID");

      if (request.method === "GET") {
        if (!classId) {
          const attendanceDate = url.searchParams.get("date")?.trim() || new Date().toISOString().slice(0, 10);
          if (!validIsoDate(attendanceDate)) return badRequest("Enter a valid attendance date");
          const classes = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
            tx`
              select c.id, c.name, ay.name as academic_year_name,
                     (select count(*)::int
                      from class_enrollments e
                      join students st on st.id = e.student_id and st.school_id = e.school_id
                      where e.school_id = c.school_id and e.class_id = c.id
                        and e.starts_on <= ${attendanceDate}::date
                        and (e.ends_on is null or e.ends_on >= ${attendanceDate}::date)
                        and st.active) as student_count,
                     coalesce(attendance.present_count, 0)::int as present_count,
                     coalesce(attendance.late_count, 0)::int as late_count,
                     coalesce(attendance.absent_count, 0)::int as absent_count,
                     coalesce(attendance.excused_count, 0)::int as excused_count,
                     coalesce(attendance.marked_count, 0)::int as marked_count
              from classes c
              join academic_years ay on ay.id = c.academic_year_id and ay.school_id = c.school_id
              left join lateral (
                select count(*) filter (where r.status = 'present') as present_count,
                       count(*) filter (where r.status = 'late') as late_count,
                       count(*) filter (where r.status = 'absent') as absent_count,
                       count(*) filter (where r.status = 'excused') as excused_count,
                       count(r.id) as marked_count
                from attendance_sessions s
                left join attendance_records r
                  on r.attendance_session_id = s.id and r.school_id = s.school_id
                where s.school_id = c.school_id and s.class_id = c.id
                  and s.attendance_date = ${attendanceDate}::date
              ) attendance on true
              where c.school_id = ${school.schoolId}::uuid
                and (
                  ${school.role === "school_admin"}
                  or c.class_teacher_id in (
                    select sp.id from staff_profiles sp
                    where sp.school_id = c.school_id and sp.user_id = ${school.userId}::uuid
                  )
                )
              order by ay.is_current desc, ay.starts_on desc, c.name
            `,
          );
          return json({ classes });
        }

        const authorized = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            select 1 from classes c
            where c.id = ${classId}::uuid and c.school_id = ${school.schoolId}::uuid
              and (
                ${school.role === "school_admin"}
                or c.class_teacher_id in (
                  select sp.id from staff_profiles sp
                  where sp.school_id = c.school_id and sp.user_id = ${school.userId}::uuid
                )
              )
          `,
        );
        if (!authorized.length) return json({ error: "You are not assigned as class teacher for this class" }, 403);

        const month = url.searchParams.get("month")?.trim() || null;
        if (month) {
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return badRequest("Month must use YYYY-MM format");
          const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
            tx`
              with authorized_class as materialized (
                select c.id, c.school_id
                from classes c
                where c.id = ${classId}::uuid and c.school_id = ${school.schoolId}::uuid
                  and (
                    ${school.role === "school_admin"}
                    or c.class_teacher_id in (
                      select sp.id from staff_profiles sp
                      where sp.school_id = c.school_id and sp.user_id = ${school.userId}::uuid
                    )
                  )
              )
              select s.attendance_date,
                     count(*) filter (where r.status = 'present')::int as present_count,
                     count(*) filter (where r.status = 'late')::int as late_count,
                     count(*) filter (where r.status = 'absent')::int as absent_count,
                     count(*) filter (where r.status = 'excused')::int as excused_count,
                     count(r.id)::int as marked_count
              from authorized_class c
              join attendance_sessions s on s.class_id = c.id and s.school_id = c.school_id
              left join attendance_records r on r.attendance_session_id = s.id and r.school_id = s.school_id
              where s.attendance_date >= (${month} || '-01')::date
                and s.attendance_date < ((${month} || '-01')::date + interval '1 month')
              group by s.attendance_date
              order by s.attendance_date
            `,
          );
          return json({ days: rows });
        }

        const attendanceDate = url.searchParams.get("date")?.trim() || "";
        if (!validIsoDate(attendanceDate)) {
          return badRequest("Enter a valid attendance date");
        }
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            with authorized_class as materialized (
              select c.id, c.school_id
              from classes c
              where c.id = ${classId}::uuid and c.school_id = ${school.schoolId}::uuid
                and (
                  ${school.role === "school_admin"}
                  or c.class_teacher_id in (
                    select sp.id from staff_profiles sp
                    where sp.school_id = c.school_id and sp.user_id = ${school.userId}::uuid
                  )
                )
            )
            select s.id as session_id, st.id as student_id,
                   st.first_name, st.last_name, st.admission_number,
                   r.status, r.note
            from authorized_class c
            join class_enrollments e on e.class_id = c.id and e.school_id = c.school_id
              and e.starts_on <= ${attendanceDate}::date
              and (e.ends_on is null or e.ends_on >= ${attendanceDate}::date)
            join students st on st.id = e.student_id and st.school_id = e.school_id and st.active
            left join attendance_sessions s on s.class_id = c.id and s.school_id = c.school_id
              and s.attendance_date = ${attendanceDate}::date
            left join attendance_records r on r.attendance_session_id = s.id
              and r.student_id = st.id and r.school_id = st.school_id
            order by st.last_name, st.first_name, st.admission_number
          `,
        );
        return json({
          session_id: rows[0]?.["session_id"] ?? null,
          students: rows.map((row) => ({
            id: String(row["student_id"]),
            first_name: String(row["first_name"]),
            last_name: String(row["last_name"]),
            admission_number: String(row["admission_number"]),
            status: row["status"] == null ? null : String(row["status"]),
            note: row["note"] == null ? "" : String(row["note"]),
          })),
        });
      }

      const payload: unknown = await request.json().catch(() => null);
      if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
      const body = payload as Record<string, unknown>;
      const attendanceDate = typeof body["date"] === "string" ? body["date"] : "";
      const records = body["records"];
      if (!classId) return badRequest("Choose a valid class");
      if (!validIsoDate(attendanceDate)) {
        return badRequest("Enter a valid attendance date");
      }
      if (!Array.isArray(records) || records.length < 1 || records.length > 500) return badRequest("Submit between 1 and 500 attendance records");
      const studentIds = new Set<string>();
      for (const entry of records) {
        if (!entry || typeof entry !== "object") return badRequest("Every attendance record must be an object");
        const record = entry as Record<string, unknown>;
        const studentId = record["student_id"];
        const note = record["note"];
        if (!uuidOrNull(studentId) || !studentId || studentIds.has(studentId)) return badRequest("Every student must have a valid, unique ID");
        studentIds.add(studentId);
        if (!["present", "late", "absent", "excused"].includes(String(record["status"]))) return badRequest("Choose present, late, absent, or excused for each learner");
        if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 500)) return badRequest("Attendance notes must be at most 500 characters");
      }

      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          with authorized_class as materialized (
            select c.id, c.school_id, c.class_teacher_id
            from classes c
            where c.id = ${classId}::uuid and c.school_id = ${school.schoolId}::uuid
              and c.class_teacher_id in (
                select sp.id from staff_profiles sp
                where sp.school_id = c.school_id and sp.user_id = ${school.userId}::uuid
              )
          ),
          roster as materialized (
            select e.student_id
            from authorized_class c
            join class_enrollments e on e.class_id = c.id and e.school_id = c.school_id
              and e.starts_on <= ${attendanceDate}::date
              and (e.ends_on is null or e.ends_on >= ${attendanceDate}::date)
            join students st on st.id = e.student_id and st.school_id = e.school_id and st.active
          ),
          input_records as (
            select * from jsonb_to_recordset(${JSON.stringify(records)}::jsonb) as x(
              student_id uuid, status text, note text
            )
          ),
          valid_roster as (
            select count(*)::int as roster_count
            from roster r
            join input_records i on i.student_id = r.student_id
          ),
          created_session as (
            insert into attendance_sessions (school_id, class_id, attendance_date, taken_by_staff_id)
            select c.school_id, c.id, ${attendanceDate}::date, c.class_teacher_id
            from authorized_class c
            where (select roster_count from valid_roster) = ${records.length}
              and (select count(*) from input_records) = ${records.length}
            on conflict (class_id, attendance_date) do update
              set taken_by_staff_id = excluded.taken_by_staff_id
            returning id, school_id
          ),
          saved_records as (
            insert into attendance_records (school_id, attendance_session_id, student_id, status, note, marked_at)
            select c.school_id, s.id, i.student_id, i.status::attendance_status, nullif(i.note, ''), now()
            from created_session s
            join authorized_class c on c.school_id = s.school_id
            join roster r on true
            join input_records i on i.student_id = r.student_id
            on conflict (attendance_session_id, student_id) do update
              set status = excluded.status, note = excluded.note, marked_at = now()
            returning student_id
          )
          select (select count(*)::int from authorized_class) as authorized_count,
                 (select count(*)::int from roster) as roster_count,
                 (select count(*)::int from saved_records) as saved_count,
                 (select id from created_session limit 1) as session_id
        `,
      );
      if (!Number(rows[0]?.["authorized_count"] ?? 0)) return json({ error: "You are not assigned as class teacher for this class" }, 403);
      if (Number(rows[0]?.["roster_count"] ?? 0) !== records.length
        || Number(rows[0]?.["saved_count"] ?? 0) !== records.length) {
        return json({ error: "Attendance was not saved. Refresh the class roster and mark every currently enrolled student." }, 409);
      }
      return json({ session_id: rows[0]?.["session_id"], saved_count: Number(rows[0]?.["saved_count"] ?? 0) });
    }

    if (url.pathname === "/api/school/fees") {
      if (request.method === "GET") {
        const classId = url.searchParams.get("class_id")?.trim() || null;
        const yearId = url.searchParams.get("academic_year_id")?.trim() || null;
        if ((classId && !uuidOrNull(classId)) || (yearId && !uuidOrNull(yearId))) return badRequest("Invalid class or academic year ID");
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            select f.id, f.class_id, c.name as class_name, f.academic_year_id,
                   ay.name as academic_year_name, f.term_id, t.name as term_name,
                   f.fee_type, f.description, f.amount, f.currency, f.is_active
            from class_fees f
            join classes c on c.id = f.class_id and c.school_id = f.school_id
            join academic_years ay on ay.id = f.academic_year_id and ay.school_id = f.school_id
            left join terms t on t.id = f.term_id and t.school_id = f.school_id
            where f.school_id = ${school.schoolId}::uuid
              and (${classId}::uuid is null or f.class_id = ${classId}::uuid)
              and (${yearId}::uuid is null or f.academic_year_id = ${yearId}::uuid)
            order by ay.starts_on desc, c.name, f.fee_type
          `,
        );
        return json({ fees: rows });
      }

      const payload: unknown = await request.json().catch(() => null);
      if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
      const body = payload as Record<string, unknown>;
      const classId = body["class_id"];
      const yearId = body["academic_year_id"];
      const termId = body["term_id"] ?? null;
      const feeType = body["fee_type"];
      const description = typeof body["description"] === "string" ? body["description"].trim() : "";
      const amount = typeof body["amount"] === "number" ? body["amount"] : Number(body["amount"]);
      const currency = typeof body["currency"] === "string" ? body["currency"].trim().toUpperCase() : "GHS";
      if (!uuidOrNull(classId) || !classId || !uuidOrNull(yearId) || !yearId || !uuidOrNull(termId)) return badRequest("Choose a valid class, academic year, and term");
      if (!["daily", "tuition", "pta", "exam", "other"].includes(String(feeType))) return badRequest("Choose a valid fee type");
      if (feeType === "daily" && termId) return badRequest("Daily fees apply to the whole academic year and cannot be term-specific");
      if (description.length < 2 || description.length > 160) return badRequest("Fee description must be 2–160 characters");
      if (!Number.isFinite(amount) || amount < 0 || amount > 99_999_999.99) return badRequest("Enter a valid non-negative fee amount");
      if (!/^[A-Z]{3}$/.test(currency)) return badRequest("Currency must be a three-letter code");

      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          insert into class_fees
            (school_id, class_id, academic_year_id, term_id, fee_type, description, amount, currency)
          values
            (${school.schoolId}::uuid, ${classId}::uuid, ${yearId}::uuid, ${termId}::uuid,
             ${feeType}, ${description}, ${amount}, ${currency})
          on conflict (school_id, class_id, academic_year_id, term_id, fee_type)
          do update set description = excluded.description, amount = excluded.amount,
                        currency = excluded.currency, is_active = true
          returning id, class_id, academic_year_id, term_id, fee_type, description, amount, currency, is_active
        `,
      );
      return json({ fee: rows[0] }, 201);
    }

    if (url.pathname === "/api/school/marks") {
      if (request.method === "GET") {
        const classId = url.searchParams.get("class_id")?.trim() || null;
        const termId = url.searchParams.get("term_id")?.trim() || null;
        const classSubjectId = url.searchParams.get("class_subject_id")?.trim() || null;
        if ([classId, termId, classSubjectId].some((id) => id && !uuidOrNull(id))) return badRequest("Invalid class, term, or subject assignment ID");

        const assignments = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            select cs.id as class_subject_id, c.id as class_id, c.name as class_name,
                   cs.subject_id, s.name as subject_name, c.academic_year_id,
                   ay.name as academic_year_name, t.id as term_id, t.name as term_name
            from class_subjects cs
            join classes c on c.id = cs.class_id and c.school_id = cs.school_id
            join subjects s on s.id = cs.subject_id and s.school_id = cs.school_id
            join academic_years ay on ay.id = c.academic_year_id and ay.school_id = c.school_id
            join terms t on t.academic_year_id = ay.id and t.school_id = ay.school_id
            where cs.school_id = ${school.schoolId}::uuid
              and (${classId}::uuid is null or c.id = ${classId}::uuid)
              and (${termId}::uuid is null or t.id = ${termId}::uuid)
              and (
                ${school.role === "school_admin"}
                or exists (
                  select 1 from teaching_assignments ta
                  join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                  where ta.school_id = cs.school_id and ta.class_subject_id = cs.id
                    and ta.academic_year_id = c.academic_year_id and sp.user_id = ${school.userId}::uuid
                )
              )
            order by ay.starts_on desc, c.name, s.name, t.starts_on
          `,
        );
        if (!classSubjectId || !termId) return json({ assignments });

        const selected = assignments.find((row) => String(row["class_subject_id"]) === classSubjectId && String(row["term_id"]) === termId);
        if (!selected) return json({ error: "That subject is not assigned to this class and term" }, 404);
        const students = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            select st.id as student_id, st.first_name, st.last_name, st.admission_number,
                   m.class_test_score, m.project_score, m.homework_score, m.group_work_score,
                   m.exam_score, m.total_score, m.performance_level
            from class_enrollments e
            join students st on st.id = e.student_id and st.school_id = e.school_id and st.active
            left join subject_term_marks m
              on m.school_id = st.school_id and m.student_id = st.id
             and m.class_subject_id = ${classSubjectId}::uuid and m.term_id = ${termId}::uuid
            where e.school_id = ${school.schoolId}::uuid
              and e.class_id = ${selected["class_id"]}::uuid and e.ends_on is null
            order by st.last_name, st.first_name, st.admission_number
          `,
        );
        return json({ assignments, students });
      }

      const payload: unknown = await request.json().catch(() => null);
      if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
      const body = payload as Record<string, unknown>;
      const classSubjectId = body["class_subject_id"];
      const termId = body["term_id"];
      const marks = body["marks"];
      if (!uuidOrNull(classSubjectId) || !classSubjectId || !uuidOrNull(termId) || !termId) return badRequest("Choose a valid subject assignment and term");
      if (!Array.isArray(marks) || marks.length < 1 || marks.length > 200) return badRequest("Submit between 1 and 200 student mark rows");
      const seenStudents = new Set<string>();
      for (const row of marks) {
        if (!row || typeof row !== "object") return badRequest("Every mark row must be an object");
        const mark = row as Record<string, unknown>;
        if (!uuidOrNull(mark["student_id"]) || !mark["student_id"] || seenStudents.has(mark["student_id"])) return badRequest("Each student must have a valid, unique ID");
        seenStudents.add(mark["student_id"]);
        for (const [field, limit] of [["class_test_score", 10], ["project_score", 20], ["homework_score", 10], ["group_work_score", 10], ["exam_score", 100]] as const) {
          const value = mark[field];
          if (value !== null && value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > limit)) {
            return badRequest(`Invalid ${field.replaceAll("_", " ")}; it must be between 0 and ${limit}`);
          }
        }
      }

      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          with input_marks as (
            select * from jsonb_to_recordset(${JSON.stringify(marks)}::jsonb) as x(
              student_id uuid, class_test_score numeric, project_score numeric,
              homework_score numeric, group_work_score numeric, exam_score numeric
            )
          ),
          saved as (
            insert into subject_term_marks
              (school_id, student_id, class_subject_id, term_id, class_test_score,
               project_score, homework_score, group_work_score, exam_score, updated_by_user_id)
            select ${school.schoolId}::uuid, input.student_id, cs.id, term.id,
                   input.class_test_score, input.project_score, input.homework_score,
                   input.group_work_score, input.exam_score, ${school.userId}::uuid
            from input_marks input
            join class_subjects cs on cs.id = ${classSubjectId}::uuid and cs.school_id = ${school.schoolId}::uuid
            join classes c on c.id = cs.class_id and c.school_id = cs.school_id
            join students st on st.id = input.student_id and st.school_id = cs.school_id and st.active
            join terms term on term.id = ${termId}::uuid and term.school_id = c.school_id
              and term.academic_year_id = c.academic_year_id
            join class_enrollments e on e.student_id = input.student_id
              and e.class_id = c.id and e.school_id = c.school_id and e.ends_on is null
            where (
              ${school.role === "school_admin"}
              or exists (
                select 1 from teaching_assignments ta
                join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                where ta.school_id = cs.school_id and ta.class_subject_id = cs.id
                  and ta.academic_year_id = c.academic_year_id and sp.user_id = ${school.userId}::uuid
              )
            )
            on conflict (student_id, class_subject_id, term_id) do update
              set class_test_score = excluded.class_test_score,
                  project_score = excluded.project_score,
                  homework_score = excluded.homework_score,
                  group_work_score = excluded.group_work_score,
                  exam_score = excluded.exam_score,
                  updated_by_user_id = excluded.updated_by_user_id
            returning student_id
          )
          select student_id from saved
        `,
      );
      if (rows.length !== marks.length) return json({ error: "Some students are not currently enrolled in that class, or the subject is not assigned to your account" }, 400);
      return json({ saved: rows.length });
    }

    if (url.pathname === "/api/school/terminal-reports") {
      if (request.method === "GET") {
        const classId = url.searchParams.get("class_id")?.trim() || null;
        const termId = url.searchParams.get("term_id")?.trim() || null;
        if (!uuidOrNull(classId) || !uuidOrNull(termId) || !classId || !termId) return badRequest("Choose a valid class and term");
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            select st.id as student_id, st.first_name, st.last_name, st.admission_number,
                   (select name from schools where id = st.school_id) as school_name,
                   r.id as report_id, r.conduct, r.attitude, r.interest,
                   r.attendance_present, r.attendance_total, r.teacher_remark,
                   r.headteacher_remark, r.promotion_status, r.published_at,
                   coalesce((
                     select jsonb_agg(jsonb_build_object(
                       'subject_id', i.subject_id, 'subject_name', s.name,
                       'class_test_score', i.class_test_score, 'project_score', i.project_score,
                       'homework_score', i.homework_score, 'group_work_score', i.group_work_score,
                       'exam_score', i.exam_score, 'total_score', i.total_score,
                       'performance_level', i.performance_level, 'remark', i.remark
                     ) order by s.name)
                     from terminal_report_items i join subjects s on s.id = i.subject_id and s.school_id = i.school_id
                     where i.report_id = r.id and i.school_id = st.school_id
                   ), '[]'::jsonb) as items
            from class_enrollments e
            join students st on st.id = e.student_id and st.school_id = e.school_id
            join classes c on c.id = e.class_id and c.school_id = e.school_id
            left join terminal_reports r on r.student_id = st.id and r.term_id = ${termId}::uuid and r.school_id = st.school_id
            where e.school_id = ${school.schoolId}::uuid and c.id = ${classId}::uuid
              and e.ends_on is null
              and exists (select 1 from terms t where t.id = ${termId}::uuid
                and t.school_id = c.school_id and t.academic_year_id = c.academic_year_id)
              and (
                ${school.role === "school_admin"}
                or c.class_teacher_id in (select id from staff_profiles where school_id = c.school_id and user_id = ${school.userId}::uuid)
                or exists (
                  select 1 from teaching_assignments ta
                  join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                  where ta.school_id = c.school_id and ta.academic_year_id = c.academic_year_id
                    and ta.class_subject_id in (select cs.id from class_subjects cs where cs.school_id = c.school_id and cs.class_id = c.id)
                    and sp.user_id = ${school.userId}::uuid
                )
              )
            order by st.last_name, st.first_name, st.admission_number
          `,
        );
        return json({ reports: rows });
      }

      const payload: unknown = await request.json().catch(() => null);
      if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
      const body = payload as Record<string, unknown>;
      const classId = body["class_id"];
      const termId = body["term_id"];
      const profiles = body["profiles"] ?? [];
      const publish = body["publish"] === true;
      if (!uuidOrNull(classId) || !classId || !uuidOrNull(termId) || !termId) return badRequest("Choose a valid class and term");
      if (publish && school.role !== "school_admin") return json({ error: "Only a School Admin can publish terminal reports" }, 403);
      if (!Array.isArray(profiles) || profiles.length > 200) return badRequest("Invalid report profile list");
      const seenStudents = new Set<string>();
      for (const row of profiles) {
        if (!row || typeof row !== "object") return badRequest("Every learner report must be an object");
        const profile = row as Record<string, unknown>;
        if (!uuidOrNull(profile["student_id"]) || !profile["student_id"] || seenStudents.has(profile["student_id"])) return badRequest("Each report must have a valid, unique student ID");
        seenStudents.add(profile["student_id"]);
        for (const field of ["conduct", "attitude", "interest", "teacher_remark", "headteacher_remark"] as const) {
          const value = profile[field];
          if (value !== undefined && value !== null && (typeof value !== "string" || value.length > (field.endsWith("remark") ? 2000 : 80))) {
            return badRequest(`${field.replaceAll("_", " ")} is too long`);
          }
        }
        const promotion = profile["promotion_status"];
        if (promotion !== undefined && promotion !== null && promotion !== "" && !["promote", "repeat", "transfer", "graduate"].includes(String(promotion))) {
          return badRequest("Invalid promotion decision");
        }
      }
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) => [
        tx`
          with report_students as (
            select e.student_id, e.school_id, c.id as class_id
            from class_enrollments e
            join classes c on c.id = e.class_id and c.school_id = e.school_id
            join terms t on t.id = ${termId}::uuid and t.school_id = c.school_id
              and t.academic_year_id = c.academic_year_id
            where e.school_id = ${school.schoolId}::uuid and c.id = ${classId}::uuid and e.ends_on is null
              and (
                ${school.role === "school_admin"}
                or c.class_teacher_id in (select id from staff_profiles where school_id = c.school_id and user_id = ${school.userId}::uuid)
                or exists (
                  select 1 from teaching_assignments ta
                  join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                  where ta.school_id = c.school_id and ta.academic_year_id = c.academic_year_id
                    and ta.class_subject_id in (select cs.id from class_subjects cs where cs.school_id = c.school_id and cs.class_id = c.id)
                    and sp.user_id = ${school.userId}::uuid
                )
              )
          ),
          input_profiles as (
            select * from jsonb_to_recordset(${JSON.stringify(profiles)}::jsonb) as x(
              student_id uuid, conduct text, attitude text, interest text,
              teacher_remark text, headteacher_remark text, promotion_status text
            )
          )
          insert into terminal_reports
            (school_id, student_id, term_id, generated_by_staff_id, conduct, attitude, interest,
             attendance_present, attendance_total, teacher_remark, headteacher_remark, promotion_status, published_at)
          select rs.school_id, rs.student_id, ${termId}::uuid,
                 (select id from staff_profiles where school_id = rs.school_id and user_id = ${school.userId}::uuid limit 1),
                 ip.conduct, ip.attitude, ip.interest,
                 (select count(*)::int from attendance_records ar
                  join attendance_sessions ase on ase.id = ar.attendance_session_id and ase.school_id = ar.school_id
                  where ar.school_id = rs.school_id and ar.student_id = rs.student_id
                    and ase.class_id = rs.class_id and ase.attendance_date between t.starts_on and t.ends_on
                    and ar.status in ('present', 'late')),
                 (select count(*)::int from attendance_sessions ase
                  where ase.school_id = rs.school_id and ase.class_id = rs.class_id
                    and ase.attendance_date between t.starts_on and t.ends_on),
                 ip.teacher_remark,
                 case when ${school.role === "school_admin"} then ip.headteacher_remark else null end,
                 nullif(ip.promotion_status, ''),
                 case when ${publish} then now() else null end
          from report_students rs
          join terms t on t.id = ${termId}::uuid and t.school_id = rs.school_id
          left join input_profiles ip on ip.student_id = rs.student_id
          on conflict (student_id, term_id) do update
            set conduct = coalesce(excluded.conduct, terminal_reports.conduct),
                attitude = coalesce(excluded.attitude, terminal_reports.attitude),
                interest = coalesce(excluded.interest, terminal_reports.interest),
                attendance_present = excluded.attendance_present,
                attendance_total = excluded.attendance_total,
                teacher_remark = coalesce(excluded.teacher_remark, terminal_reports.teacher_remark),
                headteacher_remark = coalesce(excluded.headteacher_remark, terminal_reports.headteacher_remark),
                promotion_status = coalesce(excluded.promotion_status, terminal_reports.promotion_status),
                published_at = case when ${publish} then coalesce(terminal_reports.published_at, now()) else terminal_reports.published_at end
            where terminal_reports.published_at is null
               or (${school.role === "school_admin"} and ${publish})
        `,
        tx`
          delete from terminal_report_items i
          using terminal_reports r, class_enrollments e, classes c
          where i.report_id = r.id and i.school_id = ${school.schoolId}::uuid
            and r.school_id = i.school_id and r.student_id = e.student_id
            and r.term_id = ${termId}::uuid and e.school_id = r.school_id
            and e.ends_on is null and e.class_id = c.id and c.school_id = e.school_id
            and c.id = ${classId}::uuid
            and (r.published_at is null or (${school.role === "school_admin"} and ${publish}))
            and (
              ${school.role === "school_admin"}
              or c.class_teacher_id in (select id from staff_profiles where school_id = c.school_id and user_id = ${school.userId}::uuid)
              or exists (
                select 1 from teaching_assignments ta
                join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                join class_subjects cs on cs.id = ta.class_subject_id and cs.school_id = ta.school_id
                where ta.school_id = c.school_id and ta.academic_year_id = c.academic_year_id
                  and cs.class_id = c.id and cs.subject_id = i.subject_id
                  and sp.user_id = ${school.userId}::uuid
              )
            )
        `,
        tx`
          insert into terminal_report_items
            (school_id, report_id, subject_id, class_test_score, project_score, homework_score,
             group_work_score, exam_score, total_score, performance_level)
          select r.school_id, r.id, cs.subject_id, m.class_test_score, m.project_score,
                 m.homework_score, m.group_work_score, m.exam_score, m.total_score, m.performance_level
          from terminal_reports r
          join class_enrollments e on e.student_id = r.student_id and e.school_id = r.school_id
            and e.ends_on is null
          join classes c on c.id = e.class_id and c.school_id = e.school_id and c.id = ${classId}::uuid
          join subject_term_marks m on m.student_id = r.student_id and m.school_id = r.school_id
            and m.term_id = ${termId}::uuid and m.total_score is not null
          join class_subjects cs on cs.id = m.class_subject_id and cs.school_id = m.school_id and cs.class_id = c.id
          where r.school_id = ${school.schoolId}::uuid and r.term_id = ${termId}::uuid
            and (r.published_at is null or (${school.role === "school_admin"} and ${publish}))
            and (
              ${school.role === "school_admin"}
              or c.class_teacher_id in (select id from staff_profiles where school_id = c.school_id and user_id = ${school.userId}::uuid)
              or exists (
                select 1 from teaching_assignments ta
                join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                where ta.school_id = c.school_id and ta.academic_year_id = c.academic_year_id
                  and ta.class_subject_id = cs.id and sp.user_id = ${school.userId}::uuid
              )
            )
          on conflict (report_id, subject_id) do update
            set class_test_score = excluded.class_test_score,
                project_score = excluded.project_score,
                homework_score = excluded.homework_score,
                group_work_score = excluded.group_work_score,
                exam_score = excluded.exam_score,
                total_score = excluded.total_score,
                performance_level = excluded.performance_level
        `,
        tx`
          select count(*)::int as saved_count
          from terminal_reports r
          join class_enrollments e on e.student_id = r.student_id and e.school_id = r.school_id and e.ends_on is null
          join classes c on c.id = e.class_id and c.school_id = e.school_id and c.id = ${classId}::uuid
          where r.school_id = ${school.schoolId}::uuid and r.term_id = ${termId}::uuid
            and (r.published_at is null or (${school.role === "school_admin"} and ${publish}))
            and (
              ${school.role === "school_admin"}
              or c.class_teacher_id in (select id from staff_profiles where school_id = c.school_id and user_id = ${school.userId}::uuid)
              or exists (
                select 1 from teaching_assignments ta
                join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                where ta.school_id = c.school_id and ta.academic_year_id = c.academic_year_id
                  and ta.class_subject_id in (select cs.id from class_subjects cs where cs.school_id = c.school_id and cs.class_id = c.id)
                  and sp.user_id = ${school.userId}::uuid
              )
            )
        `,
      ]);
      if (!Number(rows[0]?.["saved_count"] ?? 0)) return json({ error: "No authorized active students were found for that class and term" }, 400);
      return json({ saved_count: Number(rows[0]?.["saved_count"] ?? 0), published: publish });
    }

    if (url.pathname === "/api/school/promotions") {
      if (request.method === "GET") {
        const classId = url.searchParams.get("class_id")?.trim() || null;
        const termId = url.searchParams.get("term_id")?.trim() || null;
        if ([classId, termId].some((id) => id && !uuidOrNull(id))) return badRequest("Invalid class or term ID");
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            select d.id, d.student_id, st.first_name, st.last_name, st.admission_number,
                   d.from_class_id, c.name as from_class_name, d.term_id, t.name as term_name,
                   d.decision, d.target_class_id, target.name as target_class_name,
                   d.teacher_remark, d.status, d.submitted_at, d.reviewed_at, d.review_remark
            from promotion_decisions d
            join students st on st.id = d.student_id and st.school_id = d.school_id
            join classes c on c.id = d.from_class_id and c.school_id = d.school_id
            join terms t on t.id = d.term_id and t.school_id = d.school_id
            left join classes target on target.id = d.target_class_id and target.school_id = d.school_id
            where d.school_id = ${school.schoolId}::uuid
              and (${classId}::uuid is null or d.from_class_id = ${classId}::uuid)
              and (${termId}::uuid is null or d.term_id = ${termId}::uuid)
              and (
                ${school.role === "school_admin"}
                or c.class_teacher_id in (select id from staff_profiles where school_id = c.school_id and user_id = ${school.userId}::uuid)
                or exists (
                  select 1 from teaching_assignments ta
                  join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                  where ta.school_id = c.school_id and ta.academic_year_id = c.academic_year_id
                    and ta.class_subject_id in (select cs.id from class_subjects cs where cs.school_id = c.school_id and cs.class_id = c.id)
                    and sp.user_id = ${school.userId}::uuid
                )
              )
            order by d.status, c.name, st.last_name, st.first_name
          `,
        );
        return json({ decisions: rows });
      }

      if (request.method === "PATCH") {
        const payload: unknown = await request.json().catch(() => null);
        if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
        const body = payload as Record<string, unknown>;
        const id = body["id"];
        const action = body["action"];
        const reviewRemark = typeof body["review_remark"] === "string" ? body["review_remark"].trim() : "";
        if (!uuidOrNull(id) || !id) return badRequest("Invalid promotion decision ID");
        if (action !== "approve" && action !== "reject") return badRequest("Action must be approve or reject");
        if (reviewRemark.length > 2000) return badRequest("Review remark must be at most 2000 characters");
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            with selected as materialized (
              select d.id, d.school_id, d.student_id, d.from_class_id, d.target_class_id,
                     d.decision, d.term_id, t.ends_on as term_ends_on
              from promotion_decisions d
              join terms t on t.id = d.term_id and t.school_id = d.school_id
              where d.id = ${id}::uuid and d.school_id = ${school.schoolId}::uuid and d.status = 'pending'
              for update of d
            ),
            closed_enrollment as (
              update class_enrollments e
              set ends_on = greatest(current_date, s.term_ends_on)
              from selected s
              where ${action === "approve"} and e.school_id = s.school_id
                and e.student_id = s.student_id and e.class_id = s.from_class_id and e.ends_on is null
                and (
                  s.decision not in ('promote', 'repeat')
                  or exists (
                    select 1 from classes target
                    join academic_years target_year on target_year.id = target.academic_year_id
                      and target_year.school_id = target.school_id
                    join terms source_term on source_term.id = s.term_id and source_term.school_id = s.school_id
                    where target.school_id = s.school_id and target.id = s.target_class_id
                      and target_year.starts_on > source_term.ends_on
                  )
                )
              returning e.school_id, e.student_id, s.target_class_id, s.decision, s.term_ends_on
            ),
            created_enrollment as (
              insert into class_enrollments (school_id, class_id, student_id, starts_on)
              select ce.school_id, ce.target_class_id, ce.student_id, greatest(current_date, target_year.starts_on)
              from closed_enrollment ce
              join classes target on target.id = ce.target_class_id and target.school_id = ce.school_id
              join academic_years target_year on target_year.id = target.academic_year_id and target_year.school_id = target.school_id
              where ce.target_class_id is not null and ce.decision in ('promote', 'repeat')
                and target_year.starts_on > ce.term_ends_on
              returning id
            ),
            reviewed as (
              update promotion_decisions d
              set status = ${action === "approve" ? "approved" : "rejected"},
                  reviewed_by_user_id = ${school.userId}::uuid,
                  reviewed_at = now(),
                  review_remark = nullif(${reviewRemark}, '')
              from selected s
              where d.id = s.id
                and (${action === "reject"} or exists (select 1 from closed_enrollment))
                and (s.decision not in ('promote', 'repeat') or ${action === "reject"} or exists (select 1 from created_enrollment))
              returning d.id, d.status
            )
            select id, status from reviewed
          `,
        );
        if (!rows[0]) return json({ error: "Decision not found, already reviewed, or its active enrollment/target class is invalid" }, 409);
        return json({ decision: rows[0] });
      }

      const payload: unknown = await request.json().catch(() => null);
      if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
      const body = payload as Record<string, unknown>;
      const classId = body["class_id"];
      const termId = body["term_id"];
      const decisions = body["decisions"];
      if (!uuidOrNull(classId) || !classId || !uuidOrNull(termId) || !termId) return badRequest("Choose a valid class and term");
      if (!Array.isArray(decisions) || decisions.length < 1 || decisions.length > 200) return badRequest("Submit between 1 and 200 promotion decisions");
      const students = new Set<string>();
      for (const value of decisions) {
        if (!value || typeof value !== "object") return badRequest("Each decision must be an object");
        const decision = value as Record<string, unknown>;
        if (!uuidOrNull(decision["student_id"]) || !decision["student_id"] || students.has(decision["student_id"])) return badRequest("Each student must have a valid, unique ID");
        students.add(decision["student_id"]);
        if (!["promote", "repeat", "transfer", "graduate"].includes(String(decision["decision"]))) return badRequest("Invalid promotion decision");
        if (!uuidOrNull(decision["target_class_id"])) return badRequest("Invalid target class ID");
        if (["promote", "repeat"].includes(String(decision["decision"])) !== Boolean(decision["target_class_id"])) return badRequest("Promote and repeat decisions need a next-year target class");
        if (typeof decision["teacher_remark"] === "string" && decision["teacher_remark"].length > 2000) return badRequest("Teacher remark must be at most 2000 characters");
      }
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          with input_decisions as (
            select * from jsonb_to_recordset(${JSON.stringify(decisions)}::jsonb) as x(
              student_id uuid, decision text, target_class_id uuid, teacher_remark text
            )
          ),
          inserted as (
            insert into promotion_decisions
              (school_id, student_id, from_class_id, term_id, decision, target_class_id, teacher_remark, submitted_by_user_id)
            select c.school_id, e.student_id, c.id, t.id, i.decision, i.target_class_id, i.teacher_remark, ${school.userId}::uuid
            from input_decisions i
            join classes c on c.id = ${classId}::uuid and c.school_id = ${school.schoolId}::uuid
            join terms t on t.id = ${termId}::uuid and t.school_id = c.school_id
              and t.academic_year_id = c.academic_year_id and t.is_closed and lower(t.name) like '%term 3%'
            join class_enrollments e on e.student_id = i.student_id and e.class_id = c.id
              and e.school_id = c.school_id and e.ends_on is null
            left join classes target on target.id = i.target_class_id and target.school_id = c.school_id
              and target.academic_year_id <> c.academic_year_id
            left join academic_years target_year on target_year.id = target.academic_year_id
              and target_year.school_id = target.school_id
            where (
              c.class_teacher_id in (select id from staff_profiles where school_id = c.school_id and user_id = ${school.userId}::uuid)
              or exists (
                select 1 from teaching_assignments ta
                join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                where ta.school_id = c.school_id and ta.academic_year_id = c.academic_year_id
                  and ta.class_subject_id in (select cs.id from class_subjects cs where cs.school_id = c.school_id and cs.class_id = c.id)
                  and sp.user_id = ${school.userId}::uuid
              )
            )
              and (
                (i.decision in ('promote', 'repeat') and target.id is not null and target_year.starts_on > t.ends_on)
                or (i.decision in ('transfer', 'graduate') and i.target_class_id is null)
              )
            on conflict (student_id, term_id) do nothing
            returning id
          )
          select (select count(*)::int from inserted) as saved_count
        `,
      );
      if (Number(rows[0]?.["saved_count"] ?? 0) !== decisions.length) return json({ error: "Could not submit all decisions. Confirm each learner is enrolled, the target class belongs to an academic year after Term 3, and you are assigned to this class." }, 400);
      return json({ saved_count: Number(rows[0]?.["saved_count"] ?? 0), status: "pending" }, 201);
    }

    if (url.pathname === "/api/school/academic-periods") {
      if (request.method === "POST") {
        const payload: unknown = await request.json().catch(() => null);
        if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
        const body = payload as Record<string, unknown>;
        const name = typeof body["name"] === "string" ? body["name"].trim() : "";
        const startsOn = typeof body["starts_on"] === "string" ? body["starts_on"] : "";
        const endsOn = typeof body["ends_on"] === "string" ? body["ends_on"] : "";
        const isCurrent = body["is_current"] === true;
        if (name.length < 2 || name.length > 80) return badRequest("Academic year name must be 2–80 characters");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || startsOn >= endsOn) {
          return badRequest("Enter valid academic year start and end dates");
        }
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            with cleared_current as (
              update academic_years set is_current = false
              where school_id = ${school.schoolId}::uuid and is_current and ${isCurrent}
              returning id
            ),
            inserted as (
              insert into academic_years (school_id, name, starts_on, ends_on, is_current)
              select ${school.schoolId}::uuid, ${name}, ${startsOn}::date, ${endsOn}::date, ${isCurrent}
              where not ${isCurrent} or (select count(*) >= 0 from cleared_current)
              returning id, name, starts_on, ends_on, is_current
            )
            select * from inserted
          `,
        );
        if (!rows[0]) return json({ error: "Academic year already exists or could not be created" }, 409);
        return json({ academic_year: rows[0] }, 201);
      }

      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          select
            ay.id as academic_year_id,
            ay.name as academic_year_name,
            ay.starts_on as academic_year_starts_on,
            ay.is_current,
            t.id as term_id,
            t.name as term_name,
            t.ends_on as term_ends_on,
            (current_date between t.starts_on and t.ends_on) as term_is_current,
            t.is_closed as term_is_closed
          from academic_years ay
          left join terms t on t.academic_year_id = ay.id and t.school_id = ay.school_id
          where ay.school_id = ${school.schoolId}::uuid
          order by ay.is_current desc, ay.starts_on desc, t.starts_on asc
        `,
      );
      const years = new Map<string, { id: string; name: string; starts_on: string; is_current: boolean; terms: { id: string; name: string; ends_on: string; is_current: boolean; is_closed: boolean }[] }>();
      for (const row of rows) {
        const yearId = String(row["academic_year_id"]);
        let year = years.get(yearId);
        if (!year) {
          year = { id: yearId, name: String(row["academic_year_name"]), starts_on: String(row["academic_year_starts_on"]), is_current: row["is_current"] === true, terms: [] };
          years.set(yearId, year);
        }
        if (row["term_id"] != null) {
          year.terms.push({
            id: String(row["term_id"]),
            name: String(row["term_name"]),
            ends_on: String(row["term_ends_on"]),
            is_current: row["term_is_current"] === true,
            is_closed: row["term_is_closed"] === true,
          });
        }
      }
      return json({ academic_years: [...years.values()] });
    }

    if (url.pathname === "/api/school/terms" && request.method === "POST") {
      const payload: unknown = await request.json().catch(() => null);
      if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
      const body = payload as Record<string, unknown>;
      const academicYearId = body["academic_year_id"];
      const name = typeof body["name"] === "string" ? body["name"].trim() : "";
      const startsOn = typeof body["starts_on"] === "string" ? body["starts_on"] : "";
      const endsOn = typeof body["ends_on"] === "string" ? body["ends_on"] : "";
      if (!uuidOrNull(academicYearId) || !academicYearId) return badRequest("Choose a valid academic year");
      if (name.length < 2 || name.length > 80) return badRequest("Term name must be 2–80 characters");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || startsOn >= endsOn) {
        return badRequest("Enter valid term start and end dates");
      }
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          insert into terms (school_id, academic_year_id, name, starts_on, ends_on)
          select ${school.schoolId}::uuid, ay.id, ${name}, ${startsOn}::date, ${endsOn}::date
          from academic_years ay
          where ay.id = ${academicYearId}::uuid and ay.school_id = ${school.schoolId}::uuid
            and ${startsOn}::date >= ay.starts_on and ${endsOn}::date <= ay.ends_on
            and not exists (
              select 1 from terms existing
              where existing.school_id = ay.school_id and existing.academic_year_id = ay.id
                and existing.starts_on < ${endsOn}::date and existing.ends_on > ${startsOn}::date
            )
          returning id, academic_year_id, name, starts_on, ends_on
        `,
      );
      if (!rows[0]) return json({ error: "Academic year not found, term name already exists, or dates are outside the year/overlap another term" }, 409);
      return json({ term: rows[0] }, 201);
    }

    if (url.pathname === "/api/school/team") {
      if (request.method === "GET") {
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            select u.id as user_id, u.email, u.display_name, m.role, sp.id as staff_profile_id
            from memberships m join users u on u.id = m.user_id
            left join staff_profiles sp on sp.user_id = u.id and sp.school_id = m.school_id
            where m.school_id = ${school.schoolId}::uuid and m.role in ('school_admin', 'teacher', 'finance')
            order by m.role, u.display_name
          `,
        );
        return json({ team: rows });
      }

      const payload: unknown = await request.json().catch(() => null);
      if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
      const body = payload as Record<string, unknown>;
      const name = typeof body["name"] === "string" ? body["name"].trim() : "";
      const email = typeof body["email"] === "string" ? body["email"].trim().toLowerCase() : "";
      const role = body["role"];
      if (name.length < 2 || name.length > 160) return badRequest("Name must be 2–160 characters");
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Enter a valid email address");
      if (role !== "teacher" && role !== "finance") return badRequest("Choose teacher or finance");
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          with app_user as (
            insert into users (email, display_name) values (${email}, ${name})
            on conflict (email) do update set display_name = excluded.display_name
            returning id, email, display_name
          ),
          member as (
            insert into memberships (user_id, school_id, role)
            select id, ${school.schoolId}::uuid, ${role}::membership_role from app_user
            on conflict (user_id, school_id, role) do nothing
            returning user_id
          ),
          staff as (
            insert into staff_profiles (school_id, user_id, job_title)
            select ${school.schoolId}::uuid, id, 'Teacher' from app_user where ${role} = 'teacher'
            on conflict (school_id, user_id) do update set job_title = coalesce(staff_profiles.job_title, excluded.job_title)
            returning id
          )
          select app_user.id as user_id, app_user.email, app_user.display_name, ${role} as role
          from app_user
        `,
      );
      if (!rows[0]) return json({ error: "Could not add this school member" }, 409);
      const activationUrl = new URL("/login", request.url);
      activationUrl.searchParams.set("tenant", school.subdomain);
      activationUrl.searchParams.set("mode", "activate");
      return json({ member: rows[0], activation_url: activationUrl.toString() }, 201);
    }

    if (url.pathname === "/api/school/teaching-setup") {
      if (request.method === "GET") {
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            select c.id as class_id, c.name as class_name, c.academic_year_id, ay.name as academic_year_name,
                   class_teacher_user.display_name as class_teacher_name,
                   cs.id as class_subject_id, s.id as subject_id, s.code as subject_code, s.name as subject_name,
                   sp.user_id as teacher_user_id, u.display_name as teacher_name, u.email as teacher_email
            from classes c
            join academic_years ay on ay.id = c.academic_year_id and ay.school_id = c.school_id
            left join class_subjects cs on cs.class_id = c.id and cs.school_id = c.school_id
            left join subjects s on s.id = cs.subject_id and s.school_id = cs.school_id
            left join teaching_assignments ta on ta.class_subject_id = cs.id
              and ta.school_id = cs.school_id and ta.academic_year_id = c.academic_year_id
            left join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
            left join users u on u.id = sp.user_id
            left join staff_profiles class_teacher on class_teacher.id = c.class_teacher_id and class_teacher.school_id = c.school_id
            left join users class_teacher_user on class_teacher_user.id = class_teacher.user_id
            where c.school_id = ${school.schoolId}::uuid
            order by ay.starts_on desc, c.name, s.name
          `,
        );
        const team = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            select u.id as user_id, u.email, u.display_name, sp.id as staff_profile_id
            from memberships m join users u on u.id = m.user_id
            join staff_profiles sp on sp.user_id = u.id and sp.school_id = m.school_id
            where m.school_id = ${school.schoolId}::uuid and m.role = 'teacher'
            order by u.display_name
          `,
        );
        return json({ assignments: rows, teachers: team });
      }

      const payload: unknown = await request.json().catch(() => null);
      if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
      const body = payload as Record<string, unknown>;
      const classId = body["class_id"];
      const teacherId = body["teacher_user_id"];
      const assignmentType = body["assignment_type"] === "class_teacher" ? "class_teacher" : "subject";
      if (!uuidOrNull(classId) || !classId || !uuidOrNull(teacherId) || !teacherId) return badRequest("Choose a valid class and teacher");
      if (assignmentType === "class_teacher") {
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            with selected_class as materialized (
              select id, school_id
              from classes
              where id = ${classId}::uuid and school_id = ${school.schoolId}::uuid
            ),
            selected_teacher as materialized (
              select u.id
              from users u
              join memberships m on m.user_id = u.id
              where u.id = ${teacherId}::uuid
                and m.school_id = ${school.schoolId}::uuid
                and m.role = 'teacher'
            ),
            saved_staff as (
              insert into staff_profiles (school_id, user_id, job_title)
              select ${school.schoolId}::uuid, teacher.id, 'Teacher'
              from selected_class cross join selected_teacher teacher
              on conflict (school_id, user_id)
                do update set job_title = coalesce(staff_profiles.job_title, excluded.job_title)
              returning id, school_id
            ),
            assigned_class as (
              update classes c
              set class_teacher_id = staff.id
              from selected_class sc
              cross join saved_staff staff
              where c.id = sc.id and c.school_id = sc.school_id
              returning c.id, c.class_teacher_id
            )
            select id as class_id, class_teacher_id from assigned_class
          `,
        );
        if (!rows[0]) return json({ error: "Could not assign this teacher to the class" }, 400);
        return json({ class_teacher: rows[0] });
      }

      const code = typeof body["subject_code"] === "string" ? body["subject_code"].trim().toUpperCase() : "";
      const subjectName = typeof body["subject_name"] === "string" ? body["subject_name"].trim() : "";
      if (code.length < 1 || code.length > 24 || !/^[A-Z0-9-]+$/.test(code)) return badRequest("Subject code must use letters, numbers, or hyphens");
      if (subjectName.length < 2 || subjectName.length > 120) return badRequest("Subject name must be 2–120 characters");
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          with selected_class as materialized (
            select id, school_id, academic_year_id from classes
            where id = ${classId}::uuid and school_id = ${school.schoolId}::uuid
          ),
          selected_teacher as materialized (
            select u.id, u.email from users u join memberships m on m.user_id = u.id
            where u.id = ${teacherId}::uuid and m.school_id = ${school.schoolId}::uuid and m.role = 'teacher'
          ),
          saved_subject as (
            insert into subjects (school_id, code, name)
            select ${school.schoolId}::uuid, ${code}, ${subjectName}
            from selected_class cross join selected_teacher
            on conflict (school_id, code) do update set name = excluded.name
            returning id, code, name
          ),
          saved_class_subject as (
            insert into class_subjects (school_id, class_id, subject_id)
            select c.school_id, c.id, s.id from selected_class c cross join saved_subject s
            on conflict (class_id, subject_id) do update set class_id = excluded.class_id
            returning id, school_id, class_id
          ),
          saved_staff as (
            insert into staff_profiles (school_id, user_id, job_title)
            select ${school.schoolId}::uuid, teacher.id, 'Teacher'
            from selected_class cross join selected_teacher teacher
            on conflict (school_id, user_id) do update set job_title = coalesce(staff_profiles.job_title, excluded.job_title)
            returning id, school_id
          ),
          saved_assignment as (
            insert into teaching_assignments (school_id, staff_profile_id, class_subject_id, academic_year_id)
            select cs.school_id, sp.id, cs.id, c.academic_year_id
            from saved_class_subject cs join selected_class c on c.id = cs.class_id and c.school_id = cs.school_id
            cross join saved_staff sp
            on conflict (staff_profile_id, class_subject_id, academic_year_id)
              do update set is_primary_teacher = teaching_assignments.is_primary_teacher
            returning id
          )
          select id from saved_assignment
        `,
      );
      if (!rows[0]) return json({ error: "Could not assign this subject and teacher to the class" }, 400);
      return json({ assignment: rows[0] }, 201);
    }

    if (url.pathname === "/api/school/classes" && request.method === "GET") {
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          select c.id, c.name, c.form_level as grade_level,
                 ay.id as academic_year_id, ay.name as academic_year_name, ay.starts_on as academic_year_starts_on,
                 t.id as term_id, t.name as term_name,
                 (select count(*)::int
                  from class_enrollments e
                  join students st on st.id = e.student_id and st.school_id = e.school_id
                  where e.school_id = c.school_id
                    and e.class_id = c.id
                    and e.ends_on is null
                    and st.active) as student_count
          from classes c
          join academic_years ay on ay.id = c.academic_year_id and ay.school_id = c.school_id
          left join terms t on t.id = c.term_id and t.school_id = c.school_id
          where c.school_id = ${school.schoolId}::uuid
            and (
              ${school.role === "school_admin"}
              or c.class_teacher_id in (select id from staff_profiles where school_id = c.school_id and user_id = ${school.userId}::uuid)
              or exists (
                select 1 from teaching_assignments ta
                join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                where ta.school_id = c.school_id and ta.academic_year_id = c.academic_year_id
                  and ta.class_subject_id in (select cs.id from class_subjects cs where cs.school_id = c.school_id and cs.class_id = c.id)
                  and sp.user_id = ${school.userId}::uuid
              )
            )
          order by ay.is_current desc, ay.starts_on desc, c.name
        `,
      );
      return json({ classes: rows });
    }

    if (url.pathname === "/api/school/classes" && request.method === "POST") {
      const payload: unknown = await request.json().catch(() => null);
      if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
      const body = payload as Record<string, unknown>;
      const name = typeof body["name"] === "string" ? body["name"].trim() : "";
      const gradeLevel = typeof body["grade_level"] === "string" ? body["grade_level"].trim() : "";
      if (name.length < 2 || name.length > 100) return badRequest("Class name must be 2–100 characters");
      if (gradeLevel.length > 100) return badRequest("Grade level must be at most 100 characters");
      if (!uuidOrNull(body["academic_year_id"]) || !uuidOrNull(body["term_id"])) {
        return badRequest("Academic year and term must be valid IDs");
      }

      const academicYearId = typeof body["academic_year_id"] === "string" ? body["academic_year_id"] : null;
      const termId = typeof body["term_id"] === "string" ? body["term_id"] : null;
      const now = new Date();
      const yearStart = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
      const defaultYearName = `${yearStart}/${yearStart + 1}`;
      const defaultYearStart = `${yearStart}-09-01`;
      const defaultYearEnd = `${yearStart + 1}-08-31`;
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          with requested_year as (
            select id, school_id, name, starts_on, ends_on from academic_years
            where school_id = ${school.schoolId}::uuid and id = ${academicYearId}::uuid
              and ${academicYearId}::uuid is not null
          ),
          current_year as (
            select id, school_id, name, starts_on, ends_on from academic_years
            where school_id = ${school.schoolId}::uuid and is_current
              and ${academicYearId}::uuid is null
          ),
          fallback_year as (
            select id, school_id, name, starts_on, ends_on from academic_years
            where school_id = ${school.schoolId}::uuid
              and ${academicYearId}::uuid is null
              and not exists (select 1 from current_year)
            order by starts_on desc
            limit 1
          ),
          inserted_year as (
            insert into academic_years (school_id, name, starts_on, ends_on, is_current)
            select ${school.schoolId}::uuid, ${defaultYearName}, ${defaultYearStart}::date, ${defaultYearEnd}::date, true
            where ${academicYearId}::uuid is null
              and not exists (select 1 from academic_years where school_id = ${school.schoolId}::uuid)
            on conflict (school_id, name) do update
              set is_current = academic_years.is_current
            returning id, school_id, name, starts_on, ends_on
          ),
          selected_year as (
            select id, school_id, name, starts_on, ends_on from requested_year
            union all select id, school_id, name, starts_on, ends_on from current_year
            union all select id, school_id, name, starts_on, ends_on from fallback_year
            union all select id, school_id, name, starts_on, ends_on from inserted_year
          ),
          requested_term as (
            select t.id, t.school_id, t.academic_year_id, t.name
            from terms t
            join selected_year y on y.id = t.academic_year_id and y.school_id = t.school_id
            where t.id = ${termId}::uuid and ${termId}::uuid is not null
          ),
          current_term as (
            select t.id, t.school_id, t.academic_year_id, t.name
            from terms t
            join selected_year y on y.id = t.academic_year_id and y.school_id = t.school_id
            where ${termId}::uuid is null and current_date between t.starts_on and t.ends_on
            order by t.starts_on
            limit 1
          ),
          fallback_term as (
            select t.id, t.school_id, t.academic_year_id, t.name
            from terms t
            join selected_year y on y.id = t.academic_year_id and y.school_id = t.school_id
            where ${termId}::uuid is null and not exists (select 1 from current_term)
            order by t.starts_on
            limit 1
          ),
          inserted_term as (
            insert into terms (school_id, academic_year_id, name, starts_on, ends_on)
            select y.school_id, y.id, 'Term 1', y.starts_on, y.ends_on
            from selected_year y
            where ${termId}::uuid is null
              and not exists (select 1 from terms t where t.school_id = y.school_id and t.academic_year_id = y.id)
            on conflict (academic_year_id, name) do update
              set name = terms.name
            returning id, school_id, academic_year_id, name
          ),
          selected_term as (
            select id, school_id, academic_year_id, name from requested_term
            union all select id, school_id, academic_year_id, name from current_term
            union all select id, school_id, academic_year_id, name from fallback_term
            union all select id, school_id, academic_year_id, name from inserted_term
          ),
          inserted_class as (
            insert into classes (school_id, academic_year_id, term_id, name, form_level)
            select y.school_id, y.id, t.id, ${name}, ${gradeLevel || name}
            from selected_year y
            join selected_term t on t.school_id = y.school_id and t.academic_year_id = y.id
            on conflict (academic_year_id, name) do nothing
            returning id, school_id, academic_year_id, term_id, name, form_level
          )
          select c.id, c.name, c.form_level as grade_level,
                 y.id as academic_year_id, y.name as academic_year_name,
                 t.id as term_id, t.name as term_name, 0::int as student_count
          from inserted_class c
          join selected_year y on y.id = c.academic_year_id and y.school_id = c.school_id
          join selected_term t on t.id = c.term_id and t.school_id = c.school_id
        `,
      );
      if (!rows[0]) return json({ error: "Could not create class. Check the selected year and term, and ensure its name is unique for that year." }, 409);
      return json({ class: rows[0] }, 201);
    }

    if (url.pathname === "/api/school/students" && request.method === "GET") {
      const search = url.searchParams.get("search")?.trim().slice(0, 100) ?? "";
      const classId = url.searchParams.get("class_id")?.trim() || null;
      if (classId && !uuidOrNull(classId)) return badRequest("Invalid class ID");
      const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
      const pageSize = Number.parseInt(url.searchParams.get("page_size") ?? "20", 10);
      if (!Number.isInteger(page) || page < 1 || page > 100_000) return badRequest("Page must be a positive integer");
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return badRequest("Page size must be between 1 and 100");
      const offset = (page - 1) * pageSize;
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          with current_enrollment as (
            select distinct on (e.student_id) e.student_id, e.class_id
            from class_enrollments e
            where e.school_id = ${school.schoolId}::uuid and e.ends_on is null
            order by e.student_id, e.starts_on desc
          ),
          filtered_students as materialized (
            select st.id, st.first_name, st.last_name, st.admission_number,
                   case when st.active then 'active' else 'inactive' end as status,
                   e.class_id, c.name as class_name
            from students st
            left join current_enrollment e on e.student_id = st.id
            left join classes c on c.id = e.class_id and c.school_id = st.school_id
            where st.school_id = ${school.schoolId}::uuid
              and (${search} = '' or position(lower(${search}) in lower(st.first_name || ' ' || st.last_name || ' ' || st.admission_number)) > 0)
              and (${classId}::uuid is null or e.class_id = ${classId}::uuid)
              and (
                ${school.role === "school_admin"}
                or exists (
                  select 1 from classes authorized_class
                  where authorized_class.id = e.class_id and authorized_class.school_id = st.school_id
                    and (
                      authorized_class.class_teacher_id in (select id from staff_profiles where school_id = authorized_class.school_id and user_id = ${school.userId}::uuid)
                      or exists (
                        select 1 from teaching_assignments ta
                        join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                        where ta.school_id = authorized_class.school_id and ta.academic_year_id = authorized_class.academic_year_id
                          and ta.class_subject_id in (select cs.id from class_subjects cs where cs.school_id = authorized_class.school_id and cs.class_id = authorized_class.id)
                          and sp.user_id = ${school.userId}::uuid
                      )
                    )
                )
              )
          ),
          page_rows as (
            select * from filtered_students
            order by last_name, first_name, admission_number
            limit ${pageSize} offset ${offset}
          )
          select (select count(*)::int from filtered_students) as total,
                 coalesce((
                   select jsonb_agg(jsonb_build_object(
                     'id', id, 'first_name', first_name, 'last_name', last_name,
                     'student_id_number', admission_number, 'status', status,
                     'class_id', class_id, 'class_name', class_name
                   ) order by last_name, first_name, admission_number)
                   from page_rows
                 ), '[]'::jsonb) as students
        `,
      );
      const studentRows = rows[0]?.["students"];
      if (!Array.isArray(studentRows)) throw new Error("Student query returned an invalid page");
      return json({ students: studentRows, total: Number(rows[0]?.["total"] ?? 0), page, page_size: pageSize });
    }

    if (url.pathname === "/api/school/students" && request.method === "POST") {
      const payload: unknown = await request.json().catch(() => null);
      if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
      const body = payload as Record<string, unknown>;
      const fullName = typeof body["full_name"] === "string" ? body["full_name"].trim() : "";
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const firstName = typeof body["first_name"] === "string" ? body["first_name"].trim() : nameParts[0] ?? "";
      const lastName = typeof body["last_name"] === "string" ? body["last_name"].trim() : nameParts.slice(1).join(" ");
      const studentIdNumber = typeof body["student_id_number"] === "string" ? body["student_id_number"].trim() : "";
      const classId = body["class_id"] == null ? null : body["class_id"];
      if (firstName.length < 1 || firstName.length > 100) return badRequest("First name must be 1–100 characters");
      if (lastName.length < 1 || lastName.length > 100) return badRequest("Enter both a first and last name");
      if (studentIdNumber.length > 64) return badRequest("Student ID must be at most 64 characters");
      if (!uuidOrNull(classId)) return badRequest("Invalid class ID");

      const dateOfBirth = typeof body["date_of_birth"] === "string" ? body["date_of_birth"].trim() : "";
      const gender = typeof body["gender"] === "string" ? body["gender"].trim() : "";
      const address = typeof body["address"] === "string" ? body["address"].trim() : "";
      const emergencyContact = typeof body["emergency_contact"] === "string" ? body["emergency_contact"].trim() : "";
      const medicalNotes = typeof body["medical_notes"] === "string" ? body["medical_notes"].trim() : "";
      if (dateOfBirth && !validIsoDate(dateOfBirth)) return badRequest("Enter a valid date of birth");
      if (gender.length > 40) return badRequest("Gender must be at most 40 characters");
      if (address.length > 1000) return badRequest("Address must be at most 1000 characters");
      if (emergencyContact.length > 40) return badRequest("Emergency contact must be at most 40 characters");
      if (medicalNotes.length > 2000) return badRequest("Medical notes must be at most 2000 characters");

      const guardian = body["guardian"] && typeof body["guardian"] === "object"
        ? body["guardian"] as Record<string, unknown>
        : {};
      const guardianName = typeof guardian["full_name"] === "string" ? guardian["full_name"].trim() : "";
      const guardianPhone = typeof guardian["phone"] === "string" ? guardian["phone"].trim() : "";
      const guardianEmail = typeof guardian["email"] === "string" ? guardian["email"].trim().toLowerCase() : "";
      const guardianRelationship = typeof guardian["relationship"] === "string" ? guardian["relationship"].trim() : "parent";
      if (guardianName.length > 160 || guardianPhone.length > 40 || guardianEmail.length > 254 || guardianRelationship.length > 60) {
        return badRequest("Guardian contact information is too long");
      }
      if (guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) return badRequest("Enter a valid guardian email address");

      try {
        const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
          tx`
            with requested_class as (
              select id, school_id from classes
              where id = ${classId}::uuid and school_id = ${school.schoolId}::uuid
                and ${classId}::uuid is not null
            ),
            inserted_student as (
              insert into students (
                school_id, admission_number, first_name, last_name,
                date_of_birth, gender, address, emergency_contact, medical_notes
              )
              select ${school.schoolId}::uuid,
                     coalesce(nullif(${studentIdNumber}, ''), 'KLS-' || upper(substr(gen_random_uuid()::text, 1, 12))),
                     ${firstName}, ${lastName}, nullif(${dateOfBirth}, '')::date,
                     nullif(${gender}, ''), nullif(${address}, ''),
                     nullif(${emergencyContact}, ''), nullif(${medicalNotes}, '')
              where ${classId}::uuid is null or exists (select 1 from requested_class)
              returning id, school_id, admission_number, first_name, last_name, active
            ),
            inserted_enrollment as (
              insert into class_enrollments (school_id, class_id, student_id)
              select c.school_id, c.id, st.id
              from requested_class c
              cross join inserted_student st
              returning class_id, student_id
            ),
            inserted_guardian as (
              insert into guardians (school_id, full_name, phone, email)
              select st.school_id, ${guardianName}, nullif(${guardianPhone}, ''), nullif(${guardianEmail}, '')
              from inserted_student st
              where ${Boolean(guardianName || guardianPhone || guardianEmail)}
              on conflict (school_id, email) do update
                set full_name = excluded.full_name,
                    phone = coalesce(excluded.phone, guardians.phone)
              returning id
            ),
            linked_guardian as (
              insert into student_guardians (school_id, student_id, guardian_id, relationship, is_primary)
              select st.school_id, st.id, g.id, ${guardianRelationship || "parent"}, true
              from inserted_student st
              cross join inserted_guardian g
              on conflict (student_id, guardian_id) do update
                set relationship = excluded.relationship, is_primary = true
              returning student_id
            )
            select st.id, st.first_name, st.last_name, st.admission_number as student_id_number,
                   case when st.active then 'active' else 'inactive' end as status,
                   e.class_id, c.name as class_name
            from inserted_student st
            left join inserted_enrollment e on e.student_id = st.id
            left join classes c on c.id = e.class_id and c.school_id = st.school_id
          `,
        );
        if (!rows[0]) return json({ error: classId ? "The selected class does not exist in this school" : "Student could not be created" }, 400);
        return json({ student: rows[0] }, 201);
      } catch (error) {
        if (error instanceof Error && /students_school_id_admission_number_key|duplicate key/i.test(error.message)) {
          return json({ error: "That student ID is already in use at this school" }, 409);
        }
        throw error;
      }
    }

    if (classRosterMatch) {
      if (!uuidOrNull(classRosterMatch[1])) return badRequest("Invalid class ID");
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          select c.id as class_id,
                 coalesce(jsonb_agg(jsonb_build_object(
                   'id', st.id, 'first_name', st.first_name, 'last_name', st.last_name,
                   'student_id_number', st.admission_number
                 ) order by st.last_name, st.first_name) filter (where st.id is not null), '[]'::jsonb) as students
          from classes c
          left join class_enrollments e
            on e.class_id = c.id and e.school_id = c.school_id and e.ends_on is null
          left join students st
            on st.id = e.student_id and st.school_id = e.school_id and st.active
          where c.id = ${classRosterMatch[1]}::uuid and c.school_id = ${school.schoolId}::uuid
            and (
              ${school.role === "school_admin"}
              or c.class_teacher_id in (
                select sp.id from staff_profiles sp
                where sp.school_id = c.school_id and sp.user_id = ${school.userId}::uuid
              )
              or exists (
                select 1 from teaching_assignments ta
                join staff_profiles sp on sp.id = ta.staff_profile_id and sp.school_id = ta.school_id
                where ta.school_id = c.school_id and ta.academic_year_id = c.academic_year_id
                  and ta.class_subject_id in (
                    select cs.id from class_subjects cs
                    where cs.school_id = c.school_id and cs.class_id = c.id
                  )
                  and sp.user_id = ${school.userId}::uuid
              )
            )
          group by c.id
        `,
      );
      if (!rows[0]) return json({ error: "Class not found or you are not assigned to it" }, 404);
      return json({ class_id: String(rows[0]["class_id"]), students: rows[0]["students"] });
    }
  }

  if (url.pathname === "/api/auth/eligibility") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!env.DATABASE_URL) return json({ error: "Database is not configured" }, 503);
    const payload: unknown = await request.json().catch(() => null);
    const email = payload && typeof payload === "object" && "email" in payload && typeof payload["email"] === "string"
      ? payload["email"].trim().toLowerCase()
      : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Enter a valid email address");

    const sql = database(env);
    const rows = await withDatabaseContext(sql, { userEmail: email }, (tx) =>
      tx`
        select m.role, s.status as school_status
        from users u
        join memberships m on m.user_id = u.id
        left join schools s on s.id = m.school_id
        where lower(u.email) = ${email}
      `,
    );
    const eligible = rows.some((row) => row["role"] === "super_admin" || row["school_status"] === "trial" || row["school_status"] === "active");
    return json({ eligible });
  }

  if (url.pathname === "/api/auth/context") {
    if (!env.DATABASE_URL || !hasAuthConfig(env)) return json({ error: "Neon Auth is not configured" }, 503);
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!bearer) return json({ error: "Authentication is required" }, 401);

    let authUserId: string;
    let tokenEmail: string;
    try {
      const identity = await authenticateNeonToken(bearer, env);
      if (!identity) return json({ error: "Your sign-in session is invalid or expired. Please sign in again." }, 401);
      ({ userId: authUserId, email: tokenEmail } = identity);
    } catch (error) {
      logTokenVerificationFailure(error, bearer);
      return json({ error: "The sign-in token is invalid or expired" }, 401);
    }

    const sql = database(env);
    const authUsers = await sql`
      select id, email, "emailVerified" as email_verified
      from neon_auth.user
      where id = ${authUserId}
      limit 1
    `;
    const authUser = authUsers[0];
    if (!authUser || authUser["email_verified"] !== true || String(authUser["email"]).trim().toLowerCase() !== tokenEmail) {
      return json({ error: "Verify your email address before using a school portal" }, 403);
    }

    const memberships = await withDatabaseContext(sql, { userEmail: tokenEmail }, (tx) =>
      tx`
        select m.role, m.school_id, s.name as school_name, s.subdomain, s.status as school_status,
               coalesce(s.primary_color, '#1f5c3b') as primary_color, s.crest_url
        from users u
        join memberships m on m.user_id = u.id
        left join schools s on s.id = m.school_id
        where lower(u.email) = ${tokenEmail}
      `,
    );
    const platformAdmin = memberships.find((row) => row["role"] === "super_admin" && row["school_id"] == null);
    if (platformAdmin) return json({ user: { email: tokenEmail }, membership: { role: "super_admin", schoolId: null } });

    const tenant = resolveTenant(request, env.ROOT_DOMAIN);
    const querySubdomain = url.searchParams.get("tenant")?.trim().toLowerCase() ?? null;
    if (querySubdomain && !validSubdomain(querySubdomain)) return badRequest("Invalid tenant subdomain");
    const requestedSubdomain = tenant.subdomain ?? querySubdomain;
    const schoolMemberships = memberships.filter((row) => row["school_id"] != null);
    const selectedMembership = requestedSubdomain
      ? schoolMemberships.find((row) => row["subdomain"] === requestedSubdomain)
      : schoolMemberships.length === 1 ? schoolMemberships[0] : undefined;
    if (!selectedMembership) return json({ error: "This account does not have access to this school" }, 403);
    if (selectedMembership["school_status"] === "suspended") return json({ error: "This school tenant is suspended" }, 403);
    const schoolId = String(selectedMembership["school_id"]);
    const scopedMemberships = await withDatabaseContext(sql, { schoolId, userEmail: tokenEmail }, (tx) =>
      tx`
        select m.role, m.school_id, s.name as school_name, s.subdomain, s.status as school_status,
               coalesce(s.primary_color, '#1f5c3b') as primary_color, s.crest_url
        from users u
        join memberships m on m.user_id = u.id
        join schools s on s.id = m.school_id
        where lower(u.email) = ${tokenEmail} and m.school_id = ${schoolId}::uuid
        limit 1
      `,
    );
    const tenantMembership = scopedMemberships[0];
    if (!tenantMembership) return json({ error: "This account does not have access to this school" }, 403);
    if (tenantMembership["school_status"] === "suspended") return json({ error: "This school tenant is suspended" }, 403);

    return json({
      user: { email: tokenEmail },
      membership: {
        role: String(tenantMembership["role"]),
        schoolId: String(tenantMembership["school_id"]),
        schoolName: String(tenantMembership["school_name"]),
        subdomain: String(tenantMembership["subdomain"]),
        status: tenantMembership["school_status"],
        primaryColor: String(tenantMembership["primary_color"]),
        crestUrl: tenantMembership["crest_url"] ? String(tenantMembership["crest_url"]) : null,
      },
    });
  }

  if (url.pathname === "/api/onboarding/applications") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!env.DATABASE_URL) return json({ error: "Database is not configured" }, 503);

    const payload: unknown = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
    const application = payload as Record<string, unknown>;
    const schoolName = typeof application["schoolName"] === "string" ? application["schoolName"].trim() : "";
    const requestedSubdomain = typeof application["subdomain"] === "string" ? application["subdomain"].trim().toLowerCase() : "";
    const contactName = typeof application["contactName"] === "string" ? application["contactName"].trim() : "";
    const contactEmail = typeof application["email"] === "string" ? application["email"].trim().toLowerCase() : "";
    const contactPhone = typeof application["phone"] === "string" ? application["phone"].trim() : "";
    const primaryColor = typeof application["primaryColor"] === "string" ? application["primaryColor"] : "";
    const crestUrl = application["crestUrl"] ?? null;

    if (schoolName.length < 2 || schoolName.length > 160) return badRequest("School name must be 2–160 characters");
    if (!validSubdomain(requestedSubdomain)) return badRequest("Subdomain must use lowercase letters, numbers, and hyphens");
    if (contactName.length < 2 || contactName.length > 160) return badRequest("Contact name must be 2–160 characters");
    if (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return badRequest("Enter a valid contact email");
    if (contactPhone.length > 40) return badRequest("Phone number must be 40 characters or fewer");
    if (!validPrimaryColor(primaryColor)) return badRequest("Primary colour must be a six-digit hex value");
    if (!validCrestUrl(crestUrl)) return badRequest("Crest must be an HTTPS URL or a supported image under 512 KB");

    const sql = database(env);
    try {
      const rows = await sql`
        insert into school_onboarding_applications
          (school_name, requested_subdomain, contact_name, contact_email, contact_phone, primary_color, crest_url)
        values
          (${schoolName}, ${requestedSubdomain}, ${contactName}, ${contactEmail}, ${contactPhone || null}, ${primaryColor}, ${typeof crestUrl === "string" ? crestUrl : null})
        returning id, created_at
      `;
      const saved = rows[0];
      if (!saved) throw new Error("Application insert returned no result");
      return json({ application: { id: String(saved["id"]), submittedAt: new Date(String(saved["created_at"])).toISOString() } }, 201);
    } catch (error) {
      if (error instanceof Error && /unique/i.test(error.message)) return json({ error: "That subdomain already has an application or school" }, 409);
      throw error;
    }
  }

  if (url.pathname === "/api/platform/applications" || url.pathname.startsWith("/api/platform/applications/")) {
    if (!env.DATABASE_URL || (!env.PLATFORM_ADMIN_TOKEN && !hasAuthConfig(env))) return json({ error: "Platform API is not configured" }, 503);
    if (!await isPlatformAdmin(request, env)) return json({ error: "Unauthorized" }, 401);

    const sql = database(env);
    if (url.pathname === "/api/platform/applications" && request.method === "GET") {
      const rows = await sql`
        select id, school_name, requested_subdomain, contact_name, contact_email, contact_phone,
               primary_color, crest_url, status, created_at
        from school_onboarding_applications
        where status = 'pending'
        order by created_at desc
      `;
      return json({ applications: rows.map((row) => ({
        id: String(row["id"]),
        schoolName: String(row["school_name"]),
        subdomain: String(row["requested_subdomain"]),
        applicant: String(row["contact_name"]),
        email: String(row["contact_email"]),
        phone: row["contact_phone"] ? String(row["contact_phone"]) : null,
        color: String(row["primary_color"]),
        crestUrl: row["crest_url"] ? String(row["crest_url"]) : null,
        status: String(row["status"]),
        submitted: new Date(String(row["created_at"])).toISOString(),
      })) });
    }

    const approveMatch = url.pathname.match(/^\/api\/platform\/applications\/([0-9a-f-]+)\/approve$/i);
    if (!approveMatch) return json({ error: "Not found" }, 404);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    try {
      const applicationId = approveMatch[1];
      const schoolId = crypto.randomUUID();
      const rows = await withDatabaseContext(sql, { schoolId, platformAdmin: true }, (tx) =>
        tx`
          with pending_application as materialized (
            select id, school_name, requested_subdomain, contact_name, contact_email, contact_phone, primary_color, crest_url
            from school_onboarding_applications
            where id = ${applicationId}::uuid and status = 'pending'
            for update
          ),
          inserted_school as (
            insert into schools (id, name, subdomain, status, primary_color, crest_url, contact_email, contact_phone)
            select ${schoolId}::uuid, school_name, requested_subdomain, 'trial', primary_color, crest_url, contact_email, contact_phone
            from pending_application
            returning id, name, subdomain, status, primary_color
          ),
          upserted_user as (
            insert into users (email, display_name)
            select contact_email, contact_name from pending_application
            on conflict (email) do update set display_name = users.display_name
            returning id
          ),
          inserted_membership as (
            insert into memberships (user_id, school_id, role)
            select upserted_user.id, inserted_school.id, 'school_admin'
            from upserted_user cross join inserted_school
            on conflict (user_id, school_id, role) do nothing
            returning id
          ),
          approved_application as (
            update school_onboarding_applications
            set status = 'approved'
            where id = ${applicationId}::uuid and status = 'pending'
              and exists (select 1 from inserted_membership)
            returning id
          )
          select inserted_school.id, inserted_school.name, inserted_school.subdomain,
                 inserted_school.status, inserted_school.primary_color, upserted_user.id as admin_user_id,
                 pending_application.contact_email as admin_email,
                 pending_application.contact_name
          from inserted_school
          cross join upserted_user
          cross join approved_application
          cross join pending_application
        `,
      );
      const school = rows[0];
      if (!school) return json({ error: "Application was not found or is no longer pending" }, 404);
      const subdomain = String(school["subdomain"]);
      const activationUrl = env.ROOT_DOMAIN && env.ROOT_DOMAIN !== "localhost"
        ? new URL(`https://${subdomain}.${env.ROOT_DOMAIN}/login`)
        : new URL("/login", request.url);
      activationUrl.searchParams.set("tenant", subdomain);
      activationUrl.searchParams.set("mode", "activate");
      const tenantLoginUrl = activationUrl.toString();
      const invitation = typeof rows[0]?.["admin_email"] === "string"
        ? await sendSchoolAdminInvitation(
          env,
          String(rows[0]["admin_email"]),
          String(rows[0]["contact_name"]),
          String(school["name"]),
          tenantLoginUrl,
        )
        : { sent: false, error: "The approved application has no contact email, so the invitation cannot be sent." };
      return json({ school: {
        id: String(school["id"]),
        name: String(school["name"]),
        subdomain,
        status: school["status"],
        primaryColor: String(school["primary_color"]),
        adminUserId: String(school["admin_user_id"]),
        tenantLoginUrl,
      }, invitation });
    } catch (error) {
      if (error instanceof Error && /unique/i.test(error.message)) return json({ error: "That school subdomain is already in use" }, 409);
      throw error;
    }
  }

  const schoolStatusMatch = url.pathname.match(/^\/api\/platform\/schools\/([0-9a-f-]+)\/status$/i);
  const schoolDeleteMatch = url.pathname.match(/^\/api\/platform\/schools\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (url.pathname !== "/api/platform/schools" && !schoolStatusMatch && !schoolDeleteMatch) return json({ error: "Not found" }, 404);
  if (!env.DATABASE_URL || (!env.PLATFORM_ADMIN_TOKEN && !hasAuthConfig(env))) return json({ error: "Platform API is not configured" }, 503);
  if (!await isPlatformAdmin(request, env)) return json({ error: "Unauthorized" }, 401);

  const sql = database(env);
  if (schoolDeleteMatch) {
    if (request.method !== "DELETE") return json({ error: "Method not allowed" }, 405);
    const rows = await sql`
      with deleted_school as (
        delete from schools
        where id = ${schoolDeleteMatch[1]}::uuid
        returning id, subdomain
      ),
      deleted_application as (
        delete from school_onboarding_applications application
        using deleted_school school
        where application.requested_subdomain = school.subdomain
        returning application.id
      )
      select id, subdomain from deleted_school
    `;
    const deletedSchool = rows[0];
    if (!deletedSchool) return json({ error: "School not found" }, 404);
    return json({ deleted: true, school: { id: String(deletedSchool["id"]), subdomain: String(deletedSchool["subdomain"]) } });
  }
  if (schoolStatusMatch) {
    if (request.method !== "PATCH") return json({ error: "Method not allowed" }, 405);
    const payload: unknown = await request.json().catch(() => null);
    const status = payload && typeof payload === "object" && "status" in payload ? payload.status : null;
    if (status !== "trial" && status !== "active" && status !== "suspended") return badRequest("Status must be trial, active, or suspended");
    const rows = await sql`
      update schools set status = ${status}
      where id = ${schoolStatusMatch[1]}::uuid
      returning id, name, subdomain, status, created_at, primary_color
    `;
    const school = rows[0];
    if (!school) return json({ error: "School not found" }, 404);
    return json({ school: {
      id: String(school["id"]),
      name: String(school["name"]),
      subdomain: String(school["subdomain"]),
      status: school["status"],
      createdAt: new Date(String(school["created_at"])).toISOString(),
      primaryColor: String(school["primary_color"]),
    } });
  }
  if (request.method === "GET") {
    const rows = await withDatabaseContext(sql, { platformAdmin: true }, (tx) =>
      tx`
        select s.id, s.name, s.subdomain, s.status, s.created_at,
               coalesce(s.primary_color, '#1f5c3b') as primary_color,
               (select count(*)::int from students st where st.school_id = s.id) as student_count,
               (select count(*)::int from memberships m where m.school_id = s.id and m.role = 'school_admin') as admin_count
        from schools s
        order by s.created_at desc
        limit 100
      `,
    );
    return json({ schools: rows.map((row) => ({
      id: String(row["id"]),
      name: String(row["name"]),
      subdomain: String(row["subdomain"]),
      status: row["status"],
      createdAt: new Date(String(row["created_at"])).toISOString(),
      primaryColor: String(row["primary_color"]),
      students: Number(row["student_count"]),
      admins: Number(row["admin_count"]),
    })) satisfies SchoolRecord[] });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
  const { name, subdomain, primaryColor: requestedColor } = payload as { name?: unknown; subdomain?: unknown; primaryColor?: unknown };
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanSubdomain = typeof subdomain === "string" ? subdomain.trim().toLowerCase() : "";
  const primaryColor = typeof requestedColor === "string" ? requestedColor : "#1f5c3b";
  if (cleanName.length < 2 || cleanName.length > 160) return badRequest("School name must be 2–160 characters");
  if (!validSubdomain(cleanSubdomain)) return badRequest("Subdomain must use lowercase letters, numbers, and hyphens");
  if (!validPrimaryColor(primaryColor)) return badRequest("Primary colour must be a six-digit hex value");

  try {
    const rows = await sql`insert into schools (name, subdomain, primary_color) values (${cleanName}, ${cleanSubdomain}, ${primaryColor}) returning id, name, subdomain, status, created_at, primary_color`;
    const school = rows[0];
    if (!school) throw new Error("School insert returned no result");
    return json({ school: { id: String(school["id"]), name: String(school["name"]), subdomain: String(school["subdomain"]), status: school["status"], createdAt: new Date(String(school["created_at"])).toISOString(), primaryColor: String(school["primary_color"]) } satisfies SchoolRecord }, 201);
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) return json({ error: "That subdomain is already in use" }, 409);
    throw error;
  }
}
