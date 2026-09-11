import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create an account — Harrow Green School Operations" },
      { name: "description", content: "Request an account for the Harrow Green school workspace. An administrator assigns your role." },
      { property: "og:title", content: "Create an account — Harrow Green School Operations" },
      { property: "og:description", content: "Request an account for the Harrow Green school workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function Field({ label, placeholder, type = "text" }: { label: string; placeholder: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-input bg-background/70 px-3 text-sm outline-none ring-primary/30 focus:ring-2"
      />
    </label>
  );
}

function SignupPage() {
  return (
    <div className="relative grid min-h-screen place-items-center bg-background px-4 py-12 font-body text-foreground">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <div className="glass-panel rise relative w-full max-w-md rounded-xl p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-md bg-primary font-display text-base font-bold text-primary-foreground">H</div>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold">Harrow Green</p>
            <p className="text-[11px] text-muted-foreground">School Operations</p>
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          An administrator approves the request and sets your role.
        </p>

        <div className="mt-6 space-y-3">
          <Field label="Email" placeholder="you@harrowgreen.edu" type="email" />
          <Field label="Password" placeholder="At least 8 characters" type="password" />
          <Field label="Confirm password" placeholder="Repeat password" type="password" />
          <Button className="w-full">Create account</Button>
        </div>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full">Continue with Google</Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">Sign in</Link>
        </p>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Layout only — nothing is saved yet.
        </p>
      </div>
    </div>
  );
}
