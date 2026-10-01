import { useEffect, useState } from "react";

import { getNeonAccessToken, neonAuthClient } from "../auth/client";

export function usePlatformSession() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const authSession = await neonAuthClient?.getSession();
        if (authSession?.data?.session) {
          const token = await getNeonAccessToken();
          const response = await fetch("/api/auth/context", { headers: { authorization: `Bearer ${token}` } });
          const payload = await response.json().catch(() => null) as { membership?: { role?: string } } | null;
          if (response.ok && payload?.membership?.role === "super_admin") {
            if (!cancelled) setAuthenticated(true);
            return;
          }
        }
        const legacySession = await fetch("/api/platform/session");
        if (!cancelled) setAuthenticated(legacySession.ok);
      } catch {
        if (!cancelled) setSessionError("Could not verify the platform session");
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }
    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn(token: string) {
    setSessionError("");
    try {
      const response = await fetch("/api/platform/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Platform sign-in failed");
      setAuthenticated(true);
      return true;
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Platform sign-in failed");
      return false;
    }
  }

  async function signOut() {
    await neonAuthClient?.signOut().catch(() => undefined);
    await fetch("/api/platform/session", { method: "DELETE" }).catch(() => undefined);
    setAuthenticated(false);
  }

  return { authenticated, checkingSession, sessionError, setSessionError, signIn, signOut };
}