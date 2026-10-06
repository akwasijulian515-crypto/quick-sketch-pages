import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthVanillaAdapter } from "@neondatabase/neon-js/auth/vanilla/adapters";

const createDefaultClient = (url: string) =>
  createAuthClient(url, {
    adapter: BetterAuthVanillaAdapter({ fetchOptions: { credentials: "include" } }),
  }) as Extract<ReturnType<typeof createAuthClient>, { signIn: unknown }>;
type NeonAuthClient = ReturnType<typeof createDefaultClient>;

const buildTimeUrl = import.meta.env["VITE_NEON_AUTH_URL"] as string | undefined;

export let neonAuthClient: NeonAuthClient | null = buildTimeUrl ? createDefaultClient(buildTimeUrl) : null;

let initPromise: Promise<NeonAuthClient | null> | null = null;

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

  const sessionResult = await client.getSession();
  if (sessionResult.error) throw new Error(sessionResult.error.message);

  let token = sessionResult.data?.session?.token;
  if (typeof token !== "string" || !token) {
    const tokenResult = await client.token();
    if (tokenResult.error) throw new Error(tokenResult.error.message);
    token = tokenResult.data?.token;
  }

  if (typeof token !== "string" || !token) {
    throw new Error("Neon Auth did not return a valid session. Please sign in again.");
  }

  return token;
}
