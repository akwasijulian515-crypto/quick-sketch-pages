import {
  neon,
  type NeonQueryFunction,
  type NeonQueryFunctionInTransaction,
  type NeonQueryInTransaction,
} from "@neondatabase/serverless";

export type RuntimeEnv = {
  DATABASE_URL?: string | undefined;
  PLATFORM_ADMIN_TOKEN?: string | undefined;
  ROOT_DOMAIN?: string | undefined;
  NEON_AUTH_URL?: string | undefined;
  NEON_AUTH_BASE_URL?: string | undefined;
  NEON_AUTH_JWKS_URL?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  RESEND_FROM_EMAIL?: string | undefined;
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: string | undefined;
  SMTP_USERNAME?: string | undefined;
  SMTP_PASSWORD?: string | undefined;
  SMTP_FROM_EMAIL?: string | undefined;
  SMTP_FROM_NAME?: string | undefined;
};

export function resolveRuntimeEnv(env: RuntimeEnv): RuntimeEnv {
  if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(".env.local");
    } catch {
      // Hosted runtimes inject bindings directly and may not have local env files.
    }
  }
  const nodeEnv = typeof process === "undefined" ? undefined : process.env;
  return {
    DATABASE_URL: env.DATABASE_URL ?? nodeEnv?.["DATABASE_URL"],
    PLATFORM_ADMIN_TOKEN: env.PLATFORM_ADMIN_TOKEN || nodeEnv?.["PLATFORM_ADMIN_TOKEN"],
    ROOT_DOMAIN: env.ROOT_DOMAIN ?? nodeEnv?.["ROOT_DOMAIN"],
    NEON_AUTH_URL: env.NEON_AUTH_URL ?? nodeEnv?.["NEON_AUTH_URL"] ?? nodeEnv?.["VITE_NEON_AUTH_URL"],
    NEON_AUTH_BASE_URL: env.NEON_AUTH_BASE_URL ?? nodeEnv?.["NEON_AUTH_BASE_URL"] ?? env.NEON_AUTH_URL ?? nodeEnv?.["NEON_AUTH_URL"] ?? nodeEnv?.["VITE_NEON_AUTH_URL"],
    NEON_AUTH_JWKS_URL: env.NEON_AUTH_JWKS_URL ?? nodeEnv?.["NEON_AUTH_JWKS_URL"],
    RESEND_API_KEY: env.RESEND_API_KEY ?? nodeEnv?.["RESEND_API_KEY"],
    RESEND_FROM_EMAIL: env.RESEND_FROM_EMAIL ?? nodeEnv?.["RESEND_FROM_EMAIL"],
    SMTP_HOST: env.SMTP_HOST ?? nodeEnv?.["SMTP_HOST"],
    SMTP_PORT: env.SMTP_PORT ?? nodeEnv?.["SMTP_PORT"],
    SMTP_USERNAME: env.SMTP_USERNAME ?? nodeEnv?.["SMTP_USERNAME"],
    SMTP_PASSWORD: env.SMTP_PASSWORD ?? nodeEnv?.["SMTP_PASSWORD"],
    SMTP_FROM_EMAIL: env.SMTP_FROM_EMAIL ?? nodeEnv?.["SMTP_FROM_EMAIL"],
    SMTP_FROM_NAME: env.SMTP_FROM_NAME ?? nodeEnv?.["SMTP_FROM_NAME"],
  };
}

export function database(env: RuntimeEnv) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(env.DATABASE_URL);
}

export function withDatabaseContext(
  sql: NeonQueryFunction<false, false>,
  context: { schoolId?: string; userEmail?: string; platformAdmin?: boolean },
  query: (tx: NeonQueryFunctionInTransaction<false, false>) => NeonQueryInTransaction | NeonQueryInTransaction[],
) {
  return sql.transaction((tx) => {
    const queries = query(tx);
    return [
      tx`set local role klasora_runtime`,
      tx`
        select
          set_config('app.school_id', ${context.schoolId ?? ""}, true),
          set_config('app.user_email', ${context.userEmail ?? ""}, true),
          set_config('app.platform_admin', ${context.platformAdmin ? "true" : "false"}, true)
      `,
      ...(Array.isArray(queries) ? queries : [queries]),
    ];
  }).then((results) => {
    const rows = results[results.length - 1];
    if (!rows) throw new Error("Database context transaction returned no query result");
    return rows;
  });
}
