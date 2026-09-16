import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GraduationCap, HeartHandshake, ShieldCheck, UserRoundCheck, Wallet } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Harrow Green" },
      { name: "description", content: "Sign in to your Harrow Green school portal." },
      { property: "og:title", content: "Sign in — Harrow Green" },
      { property: "og:description", content: "Sign in to your Harrow Green school portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

const roles = [
  { label: "Teacher", icon: UserRoundCheck, ready: true, note: "Register, grades & coupons" },
  { label: "Student", icon: GraduationCap, ready: false, note: "Coming soon" },
  { label: "Parent", icon: HeartHandshake, ready: true, note: "Children, fees & updates" },
  { label: "Finance", icon: Wallet, ready: true, note: "Payments & receipts" },
  { label: "School Admin", icon: ShieldCheck, ready: true, note: "Users & terminal reports" },
];

function LoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState("Teacher");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    sessionStorage.setItem("hg-role", role.toLowerCase());
    navigate({ to: role === "School Admin" ? "/school-admin" : role === "Finance" ? "/finance" : role === "Parent" ? "/parent" : "/teacher" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 font-body text-foreground">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <div className="glass-panel rise relative w-full max-w-md rounded-lg p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-md bg-primary font-display text-base font-bold text-primary-foreground">H</div>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold">Harrow Green</p>
            <p className="text-[11px] text-muted-foreground">Portal sign in</p>
          </div>
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose your role and sign in to continue.</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {roles.map(({ label, icon: Icon, ready, note }) => (
            <button
              key={label}
              type="button"
              disabled={!ready}
              onClick={() => setRole(label)}
              className={cn(
                "flex items-start gap-2.5 rounded-md border border-border p-3 text-left transition-colors",
                role === label ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "bg-background/60",
                !ready && "cursor-not-allowed opacity-45",
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-secondary-foreground" />
              <span className="leading-tight">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-[11px] text-muted-foreground">{note}</span>
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Email</span>
            <input required type="email" placeholder="you@harrowgreen.edu" className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Password</span>
            <input required type="password" placeholder="••••••••" className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <Button type="submit" className="w-full">Sign in as {role}</Button>
        </form>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">Front-end preview only — no real accounts yet.</p>
      </div>
    </div>
  );
}
