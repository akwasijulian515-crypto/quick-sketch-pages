import { createAuthClient } from "@neondatabase/neon-js/auth";

const createDefaultClient = (url: string) => createAuthClient(url) as Extract<ReturnType<typeof createAuthClient>, { signIn: unknown }>;
type NeonAuthClient = ReturnType<typeof createDefaultClient>;

const buildTimeUrl = import.meta.env["VITE_NEON_AUTH_URL"] as string | undefined;

// Live binding: other modules see the client once it has been initialised.
export let neonAuthClient: NeonAuthClient | null = buildTimeUrl ? createDefaultClient(buildTimeUrl) : null;

let initPromise: Promise<NeonAuthClient | null> | null = null;

/** Loads the auth URL from the server (NEON_AUTH_URL secret) and creates the client once. */
export function ensureNeonAuthClient(): Promise<NeonAuthClient | null> {
  if (neonAuthClient) return Promise.resolve(neonAuthClient);
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!initPromise) {
    initPromise = fetch("/api/auth/config")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { authUrl?: string | null } | null) => {
        if (payload?.authUrl) neonAuthClient = createDefaultClient(payload.authUrl);
        else initPromise = null;
        return neonAuthClient;
      })
      .catch(() => {
        initPromise = null;
        return null;
      });
  }
  return initPromise;
}

if (typeof window !== "undefined") void ensureNeonAuthClient();

export async function getNeonAccessToken() {
  const client = await ensureNeonAuthClient();
  if (!client) throw new Error("Neon Auth is not configured for this app");
  const result = await client.token();
  if (result.error || !result.data?.token) throw new Error(result.error?.message ?? "Could not create an authenticated session");
  return result.data.token;
}
