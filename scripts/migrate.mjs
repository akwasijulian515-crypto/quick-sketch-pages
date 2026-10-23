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
  const legacySchemaMigrations = [
    "001_multi_tenant.sql",
    "002_school_operations.sql",
    "003_teaching_assignments.sql",
    "004_gateway_payment_integrity.sql",
    "005_reconciliation_exceptions.sql",
    "006_school_onboarding.sql",
    "007_daily_fee_coupons.sql",
  ];
  if (!done.has("0001_init.sql") && legacySchemaMigrations.every((name) => done.has(name))) {
    await client.query("insert into schema_migrations(name) values ($1) on conflict do nothing", ["0001_init.sql"]);
    done.add("0001_init.sql");
    console.log("Recognized the existing legacy schema as 0001_init.sql.");
  }
  const migrationFiles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => {
      const aSeed = a.toLowerCase().includes("seed");
      const bSeed = b.toLowerCase().includes("seed");
      if (aSeed !== bSeed) return aSeed ? 1 : -1;

      const aNumber = Number.parseInt(a.split("_")[0] ?? "0", 10);
      const bNumber = Number.parseInt(b.split("_")[0] ?? "0", 10);
      return aNumber - bNumber || a.localeCompare(b);
    });
  for (const file of migrationFiles) {
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
