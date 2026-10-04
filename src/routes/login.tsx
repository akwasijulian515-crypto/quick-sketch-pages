import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { useTenantBranding } from "../components/tenant-branding-provider";
import { getNeonAccessToken, neonAuthClient } from "../auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Klasora" },
      { name: "description", content: "Sign in to your school's Klasora portal." },
      { property: "og:title", content: "Sign in — Klasora" },
      { property: "og:description", content: "Sign in to your school's Klasora portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { schoolName, subdomain, primaryColor, crestUrl } = useTenantBranding();
  const [mode, setMode] = useState<"sign-in" | "activate" | "verify">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "activate") {
      setMode("activate");
    }
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!neonAuthClient) {
      setError("Neon Auth is not configured for this environment");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "verify") {
        const result = await neonAuthClient.emailOtp.verifyEmail({ email: email.trim().toLowerCase(), otp: verificationCode.trim() });
        if (result.error) throw new Error(result.error.message);
        setMode("sign-in");
        setVerificationCode("");
        setMessage("Email verified. Sign in with your password to continue.");
        return;
      }

      if (mode === "activate") {
        const eligibilityResponse = await fetch("/api/auth/eligibility", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const eligibility = await eligibilityResponse.json().catch(() => null) as { error?: string; eligible?: boolean } | null;
        if (!eligibilityResponse.ok) throw new Error(eligibility?.error ?? "Could not check account eligibility");
        if (!eligibility?.eligible) throw new Error("This email is not attached to an approved school account yet");
        const result = await neonAuthClient.signUp.email({ name: name.trim(), email: email.trim().toLowerCase(), password });
        if (result.error) throw new Error(result.error.message);
        if (!result.data.user.emailVerified) {
          setMode("verify");
          setMessage("Enter the verification code sent to your email.");
          return;
        }
        setMode("sign-in");
        setMessage("Account created. Check your email to verify it, then sign in to continue.");
        return;
      }

      const result = await neonAuthClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (result.error) throw new Error(result.error.message);
      const token = await getNeonAccessToken();
      const previewTenant = new URLSearchParams(window.location.search).get("tenant");
      const contextUrl = previewTenant ? `/api/auth/context?tenant=${encodeURIComponent(previewTenant)}` : "/api/auth/context";
      const response = await fetch(contextUrl, { headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null) as { error?: string; membership?: { role?: string; schoolId?: string | null; subdomain?: string | null } } | null;
      if (!response.ok || !payload?.membership?.role) throw new Error(payload?.error ?? "This account has no school access");

      sessionStorage.setItem("hg-role", payload.membership.role);
      if (payload.membership.role === "super_admin") {
        navigate({ to: "/admin" });
        return;
      }
      if (payload.membership.subdomain) sessionStorage.setItem("hg-school", payload.membership.subdomain);
      if (payload.membership.role === "school_admin") navigate({ to: "/school-admin" });
      else if (payload.membership.role === "teacher") navigate({ to: "/teacher" });
      else if (payload.membership.role === "finance") navigate({ to: "/finance" });
      else if (payload.membership.role === "parent") navigate({ to: "/parent" });
      else if (payload.membership.role === "student") navigate({ to: "/student" });
      else throw new Error("This account role is not supported yet");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    if (!neonAuthClient || !email.trim()) {
      setError("Enter your approved account email first");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await neonAuthClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/login`,
      });
      if (result.error) throw new Error(result.error.message);
      setMessage("If this account exists, a password reset link has been sent.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not request a password reset");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerificationCode() {
    if (!neonAuthClient || !email.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await neonAuthClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: "email-verification",
      });
      if (result.error) throw new Error(result.error.message);
      setMessage("A new verification code has been sent.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not resend the verification code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background font-body text-foreground lg:grid lg:grid-cols-2">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <aside className="relative hidden overflow-hidden p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between" style={{ backgroundColor: primaryColor }}>
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-background/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-[28rem] rounded-full bg-background/5" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-background/15 font-display text-xl font-bold ring-1 ring-background/30">
            {crestUrl ? <img src={crestUrl} alt={`${schoolName} crest`} className="size-full object-cover" /> : (schoolName[0] ?? "H")}
          </div>
          <p className="font-display text-lg font-bold">{schoolName}</p>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">Every class, mark and payment in one place.</h2>
          <ul className="mt-8 space-y-3 text-sm opacity-90">
            <li>— Teachers record attendance and marks</li>
            <li>— Parents follow progress and pay fees</li>
            <li>— Administrators keep the school running</li>
          </ul>
        </div>
        <p className="relative text-xs opacity-70">{subdomain} school portal</p>
      </aside>
      <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <div className="glass-panel rise relative w-full max-w-md rounded-lg p-6 sm:p-8" style={{ boxShadow: `0 24px 64px -32px ${primaryColor}99` }}>
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center overflow-hidden rounded-md text-base font-bold text-primary-foreground" style={{ backgroundColor: primaryColor }}>
            {crestUrl ? <img src={crestUrl} alt={`${schoolName} crest`} className="size-full object-cover" /> : (schoolName[0] ?? "H")}
          </div>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold">{schoolName}</p>
            <p className="text-[11px] text-muted-foreground">Portal sign in</p>
          </div>
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold">{mode === "sign-in" ? "Welcome back" : mode === "activate" ? "Activate your school account" : "Verify your email"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{mode === "sign-in" ? "Sign in with the email approved for your school." : mode === "activate" ? "Use the email submitted with your school application." : `Enter the code sent to ${email}.`}</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {mode === "activate" && <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">Your name</span><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>}
          {mode !== "verify" && <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Email</span>
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder={`you@${subdomain}.edu`} className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>}
          {mode === "verify" ? <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-muted-foreground">Email verification code</span><input required inputMode="numeric" autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label> : <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Password</span>
            <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>}
          {mode === "sign-in" && <button type="button" disabled={busy} onClick={() => void requestPasswordReset()} className="text-xs font-medium text-secondary-foreground underline-offset-4 hover:underline">Forgot password?</button>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {message && <p role="status" className="text-sm text-secondary-foreground">{message}</p>}
          <Button type="submit" disabled={busy} className="w-full" style={{ backgroundColor: primaryColor, color: "#fff" }}>{busy ? "Please wait..." : mode === "sign-in" ? "Sign in" : mode === "activate" ? "Create account" : "Verify email"}</Button>
        </form>
        {mode === "verify" ? <Button variant="outline" className="mt-3 w-full" disabled={busy} onClick={() => void resendVerificationCode()}>Resend verification code</Button> : <Button variant="outline" className="mt-3 w-full" onClick={() => { setError(""); setMessage(""); setMode((current) => current === "sign-in" ? "activate" : "sign-in"); }}>{mode === "sign-in" ? "First time? Activate your account" : "Already activated? Sign in"}</Button>}
        <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate({ to: "/signup" })}><Building2 />Register your school</Button>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">Access is granted only to an approved school membership.</p>
      </div>
      </div>
    </div>
  );
}
