import { neon } from "@neondatabase/serverless";

export type RuntimeEnv = { DATABASE_URL?: string; PLATFORM_ADMIN_TOKEN?: string; ROOT_DOMAIN?: string };

export function database(env: RuntimeEnv) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(env.DATABASE_URL);
}
