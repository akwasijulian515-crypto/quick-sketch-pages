// Runs every database/migrations/*.sql file once, in name order.
// Applied files are tracked in schema_migrations. Usage: npm run db:migrate
import { Pool, neonConfig } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f) && typeof process.loadEnvFile === "function") process.loadEnvFile(f);
}
const url = process.env.DATABASE_URL;
if (!url || url.includes("user:password@host")) {
  console.error("DATABASE_URL is missing. Add your Neon connection string to .env");
  process.exit(1);
}
neonConfig.webSocketConstructor = globalThis.WebSocket; // Node 22+

const dir = path.resolve("database/migrations");
const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const { rows } = await client.query("select name from schema_migrations");
  const done = new Set(rows.map((r) => r.name));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    console.log(`Applying ${file}...`);
    await client.query("begin");
    try {
      await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
      await client.query("insert into schema_migrations(name) values ($1)", [file]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log("Database is up to date.");
} finally {
  client.release();
  await pool.end();
}
