import { database, resolveRuntimeEnv, type RuntimeEnv } from "./database";
import { resolveTenant } from "./tenant";

type SchoolRecord = { id: string; name: string; subdomain: string; status: "trial" | "active" | "suspended"; createdAt: string };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const badRequest = (message: string) => json({ error: message }, 400);

function isPlatformAdmin(request: Request, env: RuntimeEnv) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(env.PLATFORM_ADMIN_TOKEN && token === env.PLATFORM_ADMIN_TOKEN);
}

function validSubdomain(value: string) { return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value); }

const validPrimaryColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const maxCrestUrlLength = 700_000;

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

export async function handleApiRequest(request: Request, env: RuntimeEnv): Promise<Response> {
  env = resolveRuntimeEnv(env);
  const url = new URL(request.url);
  if (url.pathname === "/api/health") return json({ ok: true, tenant: resolveTenant(request, env.ROOT_DOMAIN).subdomain });
  if (url.pathname === "/api/school") {
    const tenant = resolveTenant(request, env.ROOT_DOMAIN);
    const previewSubdomain = env.ROOT_DOMAIN === "localhost" ? url.searchParams.get("tenant")?.trim().toLowerCase() ?? null : null;
    if (previewSubdomain && !validSubdomain(previewSubdomain)) return badRequest("Invalid tenant preview subdomain");
    const requestedSubdomain = tenant.subdomain ?? previewSubdomain ?? (env.ROOT_DOMAIN === "localhost" ? "harrowgreen" : null);
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
    if (!env.DATABASE_URL || !env.PLATFORM_ADMIN_TOKEN) return json({ error: "Platform API is not configured" }, 503);
    if (!isPlatformAdmin(request, env)) return json({ error: "Unauthorized" }, 401);

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
               inserted_school.status, inserted_school.primary_color, upserted_user.id as admin_user_id
        from inserted_school
        cross join upserted_user
        cross join approved_application
      `;
      const school = rows[0];
      if (!school) return json({ error: "Application was not found or is no longer pending" }, 404);
      return json({ school: {
        id: String(school["id"]),
        name: String(school["name"]),
        subdomain: String(school["subdomain"]),
        status: school["status"],
        primaryColor: String(school["primary_color"]),
        adminUserId: String(school["admin_user_id"]),
      } });
    } catch (error) {
      if (error instanceof Error && /unique/i.test(error.message)) return json({ error: "That school subdomain is already in use" }, 409);
      throw error;
    }
  }

  if (url.pathname !== "/api/platform/schools") return json({ error: "Not found" }, 404);
  if (!env.DATABASE_URL || !env.PLATFORM_ADMIN_TOKEN) return json({ error: "Platform API is not configured" }, 503);
  if (!isPlatformAdmin(request, env)) return json({ error: "Unauthorized" }, 401);

  const sql = database(env);
  if (request.method === "GET") {
    const rows = await sql`select id, name, subdomain, status, created_at from schools order by created_at desc limit 100`;
    return json({ schools: rows.map((row) => ({ id: String(row["id"]), name: String(row["name"]), subdomain: String(row["subdomain"]), status: row["status"], createdAt: new Date(String(row["created_at"])).toISOString() })) satisfies SchoolRecord[] });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const payload: unknown = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return badRequest("A JSON request body is required");
  const { name, subdomain } = payload as { name?: unknown; subdomain?: unknown };
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanSubdomain = typeof subdomain === "string" ? subdomain.trim().toLowerCase() : "";
  if (cleanName.length < 2 || cleanName.length > 160) return badRequest("School name must be 2–160 characters");
  if (!validSubdomain(cleanSubdomain)) return badRequest("Subdomain must use lowercase letters, numbers, and hyphens");

  try {
    const rows = await sql`insert into schools (name, subdomain) values (${cleanName}, ${cleanSubdomain}) returning id, name, subdomain, status, created_at`;
    const school = rows[0];
    if (!school) throw new Error("School insert returned no result");
    return json({ school: { id: String(school["id"]), name: String(school["name"]), subdomain: String(school["subdomain"]), status: school["status"], createdAt: new Date(String(school["created_at"])).toISOString() } satisfies SchoolRecord }, 201);
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) return json({ error: "That subdomain is already in use" }, 409);
    throw error;
  }
}
