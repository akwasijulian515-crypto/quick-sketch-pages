import { neon } from "@neondatabase/serverless";

export type RuntimeEnv = {
  DATABASE_URL?: string;
  PLATFORM_ADMIN_TOKEN?: string;
  ROOT_DOMAIN?: string;
  NEON_AUTH_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
};

export function resolveRuntimeEnv(env: RuntimeEnv): RuntimeEnv {
  if (typeof process !== "undefined" && typeof process.loadEnvFile === "function" && !process.env["NEON_AUTH_URL"] && !process.env["VITE_NEON_AUTH_URL"]) {
    try {
      process.loadEnvFile(".env.local");
    } catch {
      // Hosted runtimes inject bindings directly and may not have local env files.
    }
  }
  const nodeEnv = typeof process === "undefined" ? undefined : process.env;
  return {
    DATABASE_URL: env.DATABASE_URL ?? nodeEnv?.["DATABASE_URL"],
    PLATFORM_ADMIN_TOKEN: env.PLATFORM_ADMIN_TOKEN ?? nodeEnv?.["PLATFORM_ADMIN_TOKEN"],
    ROOT_DOMAIN: env.ROOT_DOMAIN ?? nodeEnv?.["ROOT_DOMAIN"],
    NEON_AUTH_URL: env.NEON_AUTH_URL ?? nodeEnv?.["NEON_AUTH_URL"] ?? nodeEnv?.["VITE_NEON_AUTH_URL"],
    RESEND_API_KEY: env.RESEND_API_KEY ?? nodeEnv?.["RESEND_API_KEY"],
    RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL ?? nodeEnv?.["RESEND_FROM_EMAIL"],
  };
}

export function database(env: RuntimeEnv) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(env.DATABASE_URL);
}
