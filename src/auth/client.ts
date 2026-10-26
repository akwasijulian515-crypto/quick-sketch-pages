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

let accessTokenPromise: Promise<string> | null = null;

function asJwt(value: unknown) {
  if (typeof value !== "string") return null;
  const token = value.trim().replace(/^Bearer\s+/i, "").trim();
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? token : null;
}

function asSessionCredential(value: unknown) {
  if (typeof value !== "string") return null;
  const token = value.trim().replace(/^Bearer\s+/i, "").trim();
  return /^[\x21-\x7e]{1,4096}$/.test(token) ? token : null;
}

async function loadNeonAccessToken() {
  const client = await ensureNeonAuthClient();
  if (!client) throw new Error("Neon Auth is not configured for this app");

  let tokenError: unknown;
  try {
    const tokenResult = await client.token();
    if (tokenResult.error) tokenError = tokenResult.error;
    else {
      const token = asJwt(tokenResult.data?.token);
      if (token) return token;
    }
  } catch (error) {
    tokenError = error;
  }

  const sessionResult = await client.getSession();
  if (sessionResult.error) throw new Error(sessionResult.error.message);
  const sessionToken = asSessionCredential(sessionResult.data?.session?.token);
  if (sessionToken) return sessionToken;

  if (tokenError instanceof Error) throw new Error(tokenError.message);
  throw new Error("Neon Auth did not return a usable session credential. Please sign out and sign in again.");
}

export async function getNeonSessionCredential() {
  const client = await ensureNeonAuthClient();
  if (!client) throw new Error("Neon Auth is not configured for this app");
  const sessionResult = await client.getSession();
  if (sessionResult.error) throw new Error(sessionResult.error.message);
  const sessionToken = asSessionCredential(sessionResult.data?.session?.token);
  if (!sessionToken) {
    throw new Error("Neon Auth did not return an active session. Please sign in again.");
  }
  return sessionToken;
}

export function getNeonAccessToken() {
  if (!accessTokenPromise) {
    accessTokenPromise = loadNeonAccessToken().finally(() => {
      accessTokenPromise = null;
    });
  }
  return accessTokenPromise;
}

export async function requestSchoolPasswordReset(email: string) {
  const client = await ensureNeonAuthClient();
  if (!client) throw new Error("Neon Auth is not configured for this app");

  const tenant =
    new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  const resetUrl = new URL("/login", window.location.origin);
  if (tenant) resetUrl.searchParams.set("tenant", tenant);
  resetUrl.searchParams.set("mode", "reset");

  const result = await client.requestPasswordReset({
    email: email.trim().toLowerCase(),
    redirectTo: resetUrl.toString(),
  });
  if (result.error) throw new Error(result.error.message ?? "Could not send the password reset email");
}

export async function fetchWithNeonAuth(input: RequestInfo | URL, init?: RequestInit) {
  const accessToken = await getNeonAccessToken();
  const requestWithCredential = (credential: string) => {
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${credential}`);
    return fetch(input, { ...init, headers });
  };

  let response = await requestWithCredential(accessToken);
  if (response.status === 401) {
    const sessionCredential = await getNeonSessionCredential();
    if (sessionCredential !== accessToken) response = await requestWithCredential(sessionCredential);
  }
  return response;
}
