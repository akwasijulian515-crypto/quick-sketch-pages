import { database, resolveRuntimeEnv, type RuntimeEnv } from "./database";
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
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!userId || !email) return false;

    const sql = database(env);
    const users = await sql`select email, "emailVerified" as email_verified from neon_auth.user where id = ${userId} limit 1`;
    const authUser = users[0];
    if (!authUser || authUser["email_verified"] !== true || String(authUser["email"]).trim().toLowerCase() !== email) return false;
    const memberships = await sql`
      select 1 from users u join memberships m on m.user_id = u.id
      where lower(u.email) = ${email} and m.role = 'super_admin' and m.school_id is null
      limit 1
    `;
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

export async function handleApiRequest(request: Request, env: RuntimeEnv): Promise<Response> {
  env = resolveRuntimeEnv(env);
  const url = new URL(request.url);
  if (url.pathname === "/api/health") return json({ ok: true, tenant: resolveTenant(request, env.ROOT_DOMAIN).subdomain });
  if (url.pathname === "/api/platform/session") {
    if (!env.PLATFORM_ADMIN_TOKEN && !env.NEON_AUTH_URL) return json({ error: "Platform API is not configured" }, 503);
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

  if (url.pathname === "/api/auth/eligibility") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!env.DATABASE_URL) return json({ error: "Database is not configured" }, 503);
    const payload: unknown = await request.json().catch(() => null);
    const email = payload && typeof payload === "object" && "email" in payload && typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Enter a valid email address");

    const sql = database(env);
    const rows = await sql`
      select m.role, s.status as school_status
      from users u
      join memberships m on m.user_id = u.id
      left join schools s on s.id = m.school_id
      where lower(u.email) = ${email}
    `;
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
      tokenEmail = typeof verified.payload.email === "string" ? verified.payload.email.trim().toLowerCase() : "";
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

    const memberships = await sql`
      select m.role, m.school_id, s.name as school_name, s.subdomain, s.status as school_status,
             coalesce(s.primary_color, '#1f5c3b') as primary_color, s.crest_url
      from users u
      join memberships m on m.user_id = u.id
      left join schools s on s.id = m.school_id
      where lower(u.email) = ${tokenEmail}
    `;
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

    return json({
      user: { email: tokenEmail },
      membership: {
        role: String(selectedMembership["role"]),
        schoolId: String(selectedMembership["school_id"]),
        schoolName: String(selectedMembership["school_name"]),
        subdomain: String(selectedMembership["subdomain"]),
        status: selectedMembership["school_status"],
        primaryColor: String(selectedMembership["primary_color"]),
        crestUrl: selectedMembership["crest_url"] ? String(selectedMembership["crest_url"]) : null,
      },
    });
  }

  if (url.pathname === "/api/onboarding/applications") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!env.DATABASE_URL) return json({ error: "Database is not configured" }, 503);

    const payload: unknown = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
    const application = payload as Record<string, unknown>;
    const schoolName = typeof application.schoolName === "string" ? application.schoolName.trim() : "";
    const requestedSubdomain = typeof application.subdomain === "string" ? application.subdomain.trim().toLowerCase() : "";
    const contactName = typeof application.contactName === "string" ? application.contactName.trim() : "";
    const contactEmail = typeof application.email === "string" ? application.email.trim().toLowerCase() : "";
    const contactPhone = typeof application.phone === "string" ? application.phone.trim() : "";
    const primaryColor = typeof application.primaryColor === "string" ? application.primaryColor : "";
    const crestUrl = application.crestUrl ?? null;

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
      const rows = await sql`
        with pending_application as materialized (
          select id, school_name, requested_subdomain, contact_name, contact_email, contact_phone, primary_color, crest_url
          from school_onboarding_applications
          where id = ${applicationId}::uuid and status = 'pending'
          for update
        ),
        inserted_school as (
          insert into schools (name, subdomain, status, primary_color, crest_url, contact_email, contact_phone)
          select school_name, requested_subdomain, 'trial', primary_color, crest_url, contact_email, contact_phone
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
      `;
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
    const rows = await sql`
      select s.id, s.name, s.subdomain, s.status, s.created_at,
             coalesce(s.primary_color, '#1f5c3b') as primary_color,
             (select count(*)::int from students st where st.school_id = s.id) as student_count,
             (select count(*)::int from memberships m where m.school_id = s.id and m.role = 'school_admin') as admin_count
      from schools s
      order by s.created_at desc
      limit 100
    `;
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
