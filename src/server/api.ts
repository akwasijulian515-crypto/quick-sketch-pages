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
  if (!env.DATABASE_URL || !env.NEON_AUTH_URL) return false;

  try {
    const { payload } = await jwtVerify(token, authJwks(env.NEON_AUTH_URL));
    const userId = typeof payload.sub === "string" ? payload.sub : "";
    const email = typeof payload["email"] === "string" ? payload["email"].trim().toLowerCase() : "";
    if (!userId || !email) return false;

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
  } catch {
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

function authJwks(authUrl: string) {
  const normalizedUrl = authUrl.replace(/\/+$/, "");
  if (cachedAuthJwks && cachedAuthJwksUrl === normalizedUrl) return cachedAuthJwks;
  cachedAuthJwksUrl = normalizedUrl;
  cachedAuthJwks = createRemoteJWKSet(new URL(`${normalizedUrl}/.well-known/jwks.json`));
  return cachedAuthJwks;
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

type SchoolAdminContext = { schoolId: string; subdomain: string };

async function requireSchoolAdminContext(request: Request, env: RuntimeEnv): Promise<SchoolAdminContext | Response> {
  if (!env.DATABASE_URL || !env.NEON_AUTH_URL) return json({ error: "Neon Auth is not configured" }, 503);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Authentication is required" }, 401);

  let userId: string;
  let email: string;
  try {
    const verified = await jwtVerify(bearer, authJwks(env.NEON_AUTH_URL));
    userId = typeof verified.payload.sub === "string" ? verified.payload.sub : "";
    email = typeof verified.payload["email"] === "string" ? verified.payload["email"].trim().toLowerCase() : "";
    if (!userId || !email) return json({ error: "The sign-in token is missing user identity" }, 401);
  } catch {
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
      select m.school_id, m.role, s.subdomain, s.status as school_status
      from users u
      join memberships m on m.user_id = u.id
      join schools s on s.id = m.school_id
      where lower(u.email) = ${email}
        and m.role = 'school_admin'
    `,
  );
  const querySubdomain = new URL(request.url).searchParams.get("tenant")?.trim().toLowerCase() ?? null;
  if (querySubdomain && !validSubdomain(querySubdomain)) return badRequest("Invalid tenant subdomain");
  const requestedSubdomain = resolveTenant(request, env.ROOT_DOMAIN).subdomain ?? querySubdomain;
  const schoolMemberships = memberships.filter((row) => row["school_id"] != null);
  const membership = requestedSubdomain
    ? schoolMemberships.find((row) => row["subdomain"] === requestedSubdomain)
    : schoolMemberships.length === 1 ? schoolMemberships[0] : undefined;
  if (!membership) return json({ error: "This account does not have access to this school" }, 403);
  if (membership["school_status"] === "suspended") return json({ error: "This school tenant is suspended" }, 403);

  return { schoolId: String(membership["school_id"]), subdomain: String(membership["subdomain"]) };
}

function uuidOrNull(value: unknown): value is string | null {
  return value === null || value === undefined || (typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function handleApiRequest(request: Request, env: RuntimeEnv): Promise<Response> {
  env = resolveRuntimeEnv(env);
  const url = new URL(request.url);
  if (url.pathname === "/api/health") return json({ ok: true, tenant: resolveTenant(request, env.ROOT_DOMAIN).subdomain });
  if (url.pathname === "/api/platform/session") {
    if (!env.PLATFORM_ADMIN_TOKEN && !env.NEON_AUTH_URL) {
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
  const schoolDataRoute = url.pathname === "/api/school/classes"
    || url.pathname === "/api/school/students"
    || url.pathname === "/api/school/academic-periods"
    || classRosterMatch !== null;
  if (schoolDataRoute) {
    const isGet = request.method === "GET";
    const isCreate = request.method === "POST" && (url.pathname === "/api/school/classes" || url.pathname === "/api/school/students");
    if (!isGet && !isCreate) return json({ error: "Method not allowed" }, 405);

    const school = await requireSchoolAdminContext(request, env);
    if (school instanceof Response) return school;
    const sql = database(env);

    if (url.pathname === "/api/school/academic-periods") {
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          select
            ay.id as academic_year_id,
            ay.name as academic_year_name,
            ay.is_current,
            t.id as term_id,
            t.name as term_name,
            (current_date between t.starts_on and t.ends_on) as term_is_current
          from academic_years ay
          left join terms t on t.academic_year_id = ay.id and t.school_id = ay.school_id
          where ay.school_id = ${school.schoolId}::uuid
          order by ay.is_current desc, ay.starts_on desc, t.starts_on asc
        `,
      );
      const years = new Map<string, { id: string; name: string; is_current: boolean; terms: { id: string; name: string; is_current: boolean }[] }>();
      for (const row of rows) {
        const yearId = String(row["academic_year_id"]);
        let year = years.get(yearId);
        if (!year) {
          year = { id: yearId, name: String(row["academic_year_name"]), is_current: row["is_current"] === true, terms: [] };
          years.set(yearId, year);
        }
        if (row["term_id"] != null) {
          year.terms.push({
            id: String(row["term_id"]),
            name: String(row["term_name"]),
            is_current: row["term_is_current"] === true,
          });
        }
      }
      return json({ academic_years: [...years.values()] });
    }

    if (url.pathname === "/api/school/classes" && request.method === "GET") {
      const rows = await withDatabaseContext(sql, { schoolId: school.schoolId }, (tx) =>
        tx`
          select c.id, c.name, c.form_level as grade_level,
                 ay.id as academic_year_id, ay.name as academic_year_name,
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
      const firstName = typeof body["first_name"] === "string" ? body["first_name"].trim() : "";
      const lastName = typeof body["last_name"] === "string" ? body["last_name"].trim() : "";
      const studentIdNumber = typeof body["student_id_number"] === "string" ? body["student_id_number"].trim() : "";
      const classId = body["class_id"] == null ? null : body["class_id"];
      if (firstName.length < 1 || firstName.length > 100) return badRequest("First name must be 1–100 characters");
      if (lastName.length < 1 || lastName.length > 100) return badRequest("Last name must be 1–100 characters");
      if (studentIdNumber.length < 1 || studentIdNumber.length > 64) return badRequest("Student ID must be 1–64 characters");
      if (!uuidOrNull(classId)) return badRequest("Invalid class ID");

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
              insert into students (school_id, admission_number, first_name, last_name)
              select ${school.schoolId}::uuid, ${studentIdNumber}, ${firstName}, ${lastName}
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
          group by c.id
        `,
      );
      if (!rows[0]) return json({ error: "Class not found" }, 404);
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
    if (!env.DATABASE_URL || !env.NEON_AUTH_URL) return json({ error: "Neon Auth is not configured" }, 503);
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!bearer) return json({ error: "Authentication is required" }, 401);

    let authUserId: string;
    let tokenEmail: string;
    try {
      const verified = await jwtVerify(bearer, authJwks(env.NEON_AUTH_URL));
      authUserId = typeof verified.payload.sub === "string" ? verified.payload.sub : "";
      tokenEmail = typeof verified.payload["email"] === "string" ? verified.payload["email"].trim().toLowerCase() : "";
      if (!authUserId || !tokenEmail) return json({ error: "The sign-in token is missing user identity" }, 401);
    } catch {
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
    if (!env.DATABASE_URL || (!env.PLATFORM_ADMIN_TOKEN && !env.NEON_AUTH_URL)) return json({ error: "Platform API is not configured" }, 503);
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
  if (url.pathname !== "/api/platform/schools" && !schoolStatusMatch) return json({ error: "Not found" }, 404);
  if (!env.DATABASE_URL || (!env.PLATFORM_ADMIN_TOKEN && !env.NEON_AUTH_URL)) return json({ error: "Platform API is not configured" }, 503);
  if (!await isPlatformAdmin(request, env)) return json({ error: "Unauthorized" }, 401);

  const sql = database(env);
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
