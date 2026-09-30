import { neon } from "@neondatabase/serverless";

export type RuntimeEnv = { DATABASE_URL?: string; PLATFORM_ADMIN_TOKEN?: string; ROOT_DOMAIN?: string };

export function resolveRuntimeEnv(env: RuntimeEnv): RuntimeEnv {
  const nodeEnv = typeof process === "undefined" ? undefined : process.env;
  return {
    DATABASE_URL: env.DATABASE_URL ?? nodeEnv?.["DATABASE_URL"],
    PLATFORM_ADMIN_TOKEN: env.PLATFORM_ADMIN_TOKEN ?? nodeEnv?.["PLATFORM_ADMIN_TOKEN"],
    ROOT_DOMAIN: env.ROOT_DOMAIN ?? nodeEnv?.["ROOT_DOMAIN"],
  };
}

export function database(env: RuntimeEnv) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(env.DATABASE_URL);
}
