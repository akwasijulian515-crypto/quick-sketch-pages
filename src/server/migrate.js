import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if it exists
try {
  if (typeof process.loadEnvFile === "function") {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  }
} catch {
  // Ignore env loading errors
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.includes("user:password@host")) {
  console.error("\x1b[31m[Error] DATABASE_URL is not set or still has placeholder values in your .env file.\x1b[0m");
  console.error("Please add your Neon connection string to .env:");
  console.error("DATABASE_URL=postgresql://neondb_owner:xxxx@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require\n");
  process.exit(1);
}

async function runMigration() {
  console.log("\x1b[36mConnecting to database and running migrations...\x1b[0m");
  const sql = neon(databaseUrl);

  const migrationFilePath = path.join(__dirname, "migrations", "001_initial_schema.sql");
  const fullSql = fs.readFileSync(migrationFilePath, "utf8");

  // Remove SQL comments before splitting statements
  const cleanedSql = fullSql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const statements = cleanedSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Executing ${statements.length} schema statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await sql(stmt);
    } catch (err) {
      console.error(`\x1b[31mError executing statement ${i + 1}:\x1b[0m\n${stmt}\n`, err);
      process.exit(1);
    }
  }

  console.log("\x1b[32m✔ Migration completed successfully! All tables created.\x1b[0m");
}

runMigration().catch((err) => {
  console.error("\x1b[31mMigration failed:\x1b[0m", err);
  process.exit(1);
});
