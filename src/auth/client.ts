import { createAuthClient } from "@neondatabase/neon-js/auth";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

export const neonAuthClient = authUrl ? createAuthClient(authUrl) : null;

export async function getNeonAccessToken() {
  if (!neonAuthClient) throw new Error("Neon Auth is not configured for this app");
  const result = await neonAuthClient.token();
  if (result.error || !result.data?.token) throw new Error(result.error?.message ?? "Could not create an authenticated session");
  return result.data.token;
}
