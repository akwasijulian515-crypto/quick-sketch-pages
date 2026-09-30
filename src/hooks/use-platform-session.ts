import { useEffect, useState } from "react";

export function usePlatformSession() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/platform/session")
      .then((response) => {
        if (!cancelled) setAuthenticated(response.ok);
      })
      .catch(() => {
        if (!cancelled) setSessionError("Could not verify the platform session");
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
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
    await fetch("/api/platform/session", { method: "DELETE" }).catch(() => undefined);
    setAuthenticated(false);
  }

  return { authenticated, checkingSession, sessionError, setSessionError, signIn, signOut };
}