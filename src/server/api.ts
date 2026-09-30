import { database, type RuntimeEnv } from "./database";
import { resolveTenant } from "./tenant";

type SchoolRecord = { id: string; name: string; subdomain: string; status: "trial" | "active" | "suspended"; createdAt: string };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const badRequest = (message: string) => json({ error: message }, 400);

function isPlatformAdmin(request: Request, env: RuntimeEnv) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(env.PLATFORM_ADMIN_TOKEN && token === env.PLATFORM_ADMIN_TOKEN);
}

function validSubdomain(value: string) { return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value); }

export async function handleApiRequest(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") return json({ ok: true, tenant: resolveTenant(request, env.ROOT_DOMAIN).subdomain });
  if (url.pathname === "/api/school") {
    const tenant = resolveTenant(request, env.ROOT_DOMAIN);
    const requestedSubdomain = tenant.subdomain ?? (env.ROOT_DOMAIN === "localhost" ? "harrowgreen" : null);
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
