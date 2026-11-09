import { useEffect, useState } from "react";

import {
  ensureNeonAuthClient,
  getNeonAccessToken,
  invalidateNeonAccessToken,
} from "../auth/client";

export function usePlatformSession() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const neonAuthClient = await ensureNeonAuthClient();
        const authSession = await neonAuthClient?.getSession();
        if (authSession?.data?.session) {
          const token = await getNeonAccessToken();
          const response = await fetch("/api/auth/context", {
            headers: { authorization: `Bearer ${token}` },
          });
          const payload = (await response.json().catch(() => null)) as {
            membership?: { role?: string };
          } | null;
          if (response.ok && payload?.membership?.role === "super_admin") {
            if (!cancelled) {
              setAuthenticated(true);
              setExpiresAt(null);
            }
            return;
          }
        }
        const legacySession = await fetch("/api/platform/session");
        const payload = (await legacySession.json().catch(() => null)) as {
          error?: string;
          code?: string;
          expiresAt?: number | null;
        } | null;
        if (!cancelled) {
          setAuthenticated(legacySession.ok);
          setExpiresAt(legacySession.ok ? (payload?.expiresAt ?? null) : null);
          if (payload?.code === "PLATFORM_SESSION_EXPIRED")
            setSessionError("Your Super Admin session expired. Enter the platform token again.");
        }
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

  useEffect(() => {
    function expireSession() {
      setAuthenticated(false);
      setExpiresAt(null);
      setSessionError("Your Super Admin session expired. Enter the platform token again.");
      void fetch("/api/platform/session", { method: "DELETE" }).catch(() => undefined);
    }

    window.addEventListener("platform-session-expired", expireSession);
    return () => window.removeEventListener("platform-session-expired", expireSession);
  }, []);

  useEffect(() => {
    if (!authenticated || expiresAt === null) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      window.dispatchEvent(new Event("platform-session-expired"));
      return;
    }
    const timer = window.setTimeout(
      () => window.dispatchEvent(new Event("platform-session-expired")),
      remaining,
    );
    return () => window.clearTimeout(timer);
  }, [authenticated, expiresAt]);

  async function signIn(token: string) {
    setSessionError("");
    try {
      const response = await fetch("/api/platform/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        expiresAt?: number | null;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Platform sign-in failed");
      setAuthenticated(true);
      setExpiresAt(payload?.expiresAt ?? null);
      return true;
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Platform sign-in failed");
      return false;
    }
  }

  async function signOut() {
    invalidateNeonAccessToken();
    await (await ensureNeonAuthClient())?.signOut().catch(() => undefined);
    await fetch("/api/platform/session", { method: "DELETE" }).catch(() => undefined);
    setAuthenticated(false);
    setExpiresAt(null);
    setSessionError("");
  }

  return {
    authenticated,
    checkingSession,
    sessionError,
    setSessionError,
    signIn,
    signOut,
    expiresAt,
  };
}
