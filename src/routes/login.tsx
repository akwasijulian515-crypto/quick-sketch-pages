import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { useTenantBranding } from "../components/tenant-branding-provider";
import { ensureNeonAuthClient, getNeonAccessToken } from "../auth/client";
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
  const { schoolName, subdomain, primaryColor, crestUrl, updateTenantBranding } =
    useTenantBranding();
  const [mode, setMode] = useState<"sign-in" | "activate" | "verify" | "reset-request" | "reset">(
    "sign-in",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("token")) {
      setMode("reset");
    } else if (params.get("mode") === "activate") {
      setMode("activate");
    }
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const neonAuthClient = await ensureNeonAuthClient();
    if (!neonAuthClient) {
      setError("Neon Auth is not configured for this environment");
      return;
    }
    if (mode === "reset-request") {
      await requestPasswordReset();
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "verify") {
        const result = await neonAuthClient.emailOtp.verifyEmail({
          email: email.trim().toLowerCase(),
          otp: verificationCode.trim(),
        });
        if (result.error) throw new Error(result.error.message);
        setMode("sign-in");
        setVerificationCode("");
        setMessage("Email verified. Sign in with your password to continue.");
        return;
      }

      if (mode === "reset") {
        if (password !== confirmPassword) throw new Error("The passwords do not match");
        const resetToken = new URLSearchParams(window.location.search).get("token");
        if (!resetToken)
          throw new Error("This password reset link is invalid or expired. Request a new link.");
        const result = await neonAuthClient.resetPassword({
          newPassword: password,
          token: resetToken,
        });
        if (result.error) throw new Error(result.error.message);
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        url.searchParams.delete("mode");
        url.searchParams.delete("error");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        setMode("sign-in");
        setPassword("");
        setConfirmPassword("");
        setMessage("Your password has been reset. Sign in with your new password.");
        return;
      }

      if (mode === "activate") {
        const eligibilityResponse = await fetch("/api/auth/eligibility", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const eligibility = (await eligibilityResponse.json().catch(() => null)) as {
          error?: string;
          eligible?: boolean;
        } | null;
        if (!eligibilityResponse.ok)
          throw new Error(eligibility?.error ?? "Could not check account eligibility");
        if (!eligibility?.eligible)
          throw new Error("This email is not attached to an approved school account yet");
        const result = await neonAuthClient.signUp.email({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
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

      const result = await neonAuthClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.error) throw new Error(result.error.message);
      const token = await getNeonAccessToken();
      const previewTenant = new URLSearchParams(window.location.search).get("tenant");
      const contextUrl = previewTenant
        ? `/api/auth/context?tenant=${encodeURIComponent(previewTenant)}`
        : "/api/auth/context";
      const response = await fetch(contextUrl, { headers: { authorization: `Bearer ${token}` } });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        membership?: {
          role?: string;
          schoolId?: string | null;
          schoolName?: string;
          subdomain?: string | null;
          primaryColor?: string;
          crestUrl?: string | null;
        };
      } | null;
      if (!response.ok || !payload?.membership?.role)
        throw new Error(payload?.error ?? "This account has no school access");

      const membership = payload.membership;
      sessionStorage.setItem("hg-role", membership.role);
      if (membership.role === "super_admin") {
        navigate({ to: "/admin" });
        return;
      }
      if (!membership.subdomain)
        throw new Error(
          "Your school portal could not be identified. Please contact your school administrator.",
        );
      sessionStorage.setItem("hg-school", membership.subdomain);
      updateTenantBranding({
        schoolName: membership.schoolName ?? schoolName,
        subdomain: membership.subdomain,
        primaryColor:
          membership.primaryColor && /^#[0-9a-f]{6}$/i.test(membership.primaryColor)
            ? membership.primaryColor
            : primaryColor,
        crestUrl: membership.crestUrl ?? null,
      });
      if (membership.role === "school_admin") navigate({ to: "/school-admin" });
      else if (membership.role === "teacher") navigate({ to: "/teacher" });
      else if (membership.role === "finance") navigate({ to: "/finance" });
      else if (membership.role === "parent") navigate({ to: "/parent" });
      else if (membership.role === "student") navigate({ to: "/student" });
      else throw new Error("This account role is not supported yet");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    const neonAuthClient = await ensureNeonAuthClient();
    if (!neonAuthClient) {
      setError("Neon Auth is not configured for this environment");
      return;
    }
    if (!email.trim()) {
      setError("Enter your approved account email first");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const resetUrl = new URL("/login", window.location.origin);
      const tenant =
        new URLSearchParams(window.location.search).get("tenant") ??
        sessionStorage.getItem("hg-school");
      if (tenant) resetUrl.searchParams.set("tenant", tenant);
      resetUrl.searchParams.set("mode", "reset");
      const result = await neonAuthClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: resetUrl.toString(),
      });
      if (result.error) throw new Error(result.error.message);
      setMessage("If this account exists, a password reset link has been sent.");
    } catch (resetError) {
      setError(
        resetError instanceof Error ? resetError.message : "Could not request a password reset",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resendVerificationCode() {
    const neonAuthClient = await ensureNeonAuthClient();
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
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Could not resend the verification code",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background font-body text-foreground lg:grid lg:grid-cols-2">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <aside
        className="relative hidden overflow-hidden p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-background/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-[28rem] rounded-full bg-background/5" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-background/15 font-display text-xl font-bold ring-1 ring-background/30">
            {crestUrl ? (
              <img src={crestUrl} alt={`${schoolName} crest`} className="size-full object-cover" />
            ) : (
              (schoolName[0] ?? "H")
            )}
          </div>
          <p className="font-display text-lg font-bold">{schoolName}</p>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Every class, mark and payment in one place.
          </h2>
          <ul className="mt-8 space-y-3 text-sm opacity-90">
            <li>— Teachers record attendance and marks</li>
            <li>— Parents follow progress and pay fees</li>
            <li>— Administrators keep the school running</li>
          </ul>
        </div>
        <p className="relative text-xs opacity-70">{subdomain} school portal</p>
      </aside>
      <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
        <div
          className="glass-panel rise relative w-full max-w-md rounded-lg p-6 sm:p-8"
          style={{ boxShadow: `0 24px 64px -32px ${primaryColor}99` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="grid size-9 place-items-center overflow-hidden rounded-md text-base font-bold text-primary-foreground"
              style={{ backgroundColor: primaryColor }}
            >
              {crestUrl ? (
                <img
                  src={crestUrl}
                  alt={`${schoolName} crest`}
                  className="size-full object-cover"
                />
              ) : (
                (schoolName[0] ?? "H")
              )}
            </div>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold">{schoolName}</p>
              <p className="text-[11px] text-muted-foreground">Portal sign in</p>
            </div>
          </div>

          <h1 className="mt-6 font-display text-2xl font-bold">
            {mode === "sign-in"
              ? "Welcome back"
              : mode === "activate"
                ? "Activate your school account"
                : mode === "verify"
                  ? "Verify your email"
                  : mode === "reset-request"
                    ? "Reset your password"
                    : "Choose a new password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "sign-in"
              ? "Sign in with the email approved for your school."
              : mode === "activate"
                ? "Use the email submitted with your school application."
                : mode === "verify"
                  ? `Enter the code sent to ${email}.`
                  : mode === "reset-request"
                    ? "Enter your approved school account email and we’ll send a password reset link if the account exists."
                    : `Set a new password for your ${schoolName} account.`}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            {mode === "activate" && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Your name
                </span>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            )}
            {mode !== "verify" && mode !== "reset" && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Email</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder={`you@${subdomain}.edu`}
                  className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            )}
            {mode === "verify" ? (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Email verification code
                </span>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ) : !["reset-request", "reset"].includes(mode) ? (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Password
                </span>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  minLength={8}
                  className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ) : mode === "reset" ? (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    New password
                  </span>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Confirm new password
                  </span>
                  <input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </>
            ) : null}
            {mode === "sign-in" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setMessage("");
                  setMode("reset-request");
                }}
                className="text-xs font-medium text-secondary-foreground underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="text-sm text-secondary-foreground">
                {message}
              </p>
            )}
            <Button
              type="submit"
              disabled={busy}
              className="w-full"
              style={{ backgroundColor: primaryColor, color: "#fff" }}
            >
              {busy
                ? "Please wait..."
                : mode === "sign-in"
                  ? "Sign in"
                  : mode === "activate"
                    ? "Create account"
                    : mode === "verify"
                      ? "Verify email"
                      : mode === "reset-request"
                        ? "Send reset link"
                        : "Reset password"}
            </Button>
          </form>
          {mode === "verify" ? (
            <Button
              variant="outline"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() => void resendVerificationCode()}
            >
              Resend verification code
            </Button>
          ) : (
            <Button
              variant="outline"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() => {
                setError("");
                setMessage("");
                setPassword("");
                setConfirmPassword("");
                setMode((current) => (current === "sign-in" ? "activate" : "sign-in"));
              }}
            >
              {mode === "sign-in"
                ? "First time? Activate your account"
                : mode === "activate"
                  ? "Already activated? Sign in"
                  : "Back to sign in"}
            </Button>
          )}
          {mode !== "reset" && (
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => navigate({ to: "/signup" })}
            >
              <Building2 />
              Register your school
            </Button>
          )}
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Access is granted only to an approved school membership.
          </p>
        </div>
      </div>
    </div>
  );
}
