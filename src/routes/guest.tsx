import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/guest")({
  head: () => ({
    meta: [
      { title: "Guest help desk — Harrow Green" },
      { name: "description", content: "Enter your ward's name to get help from the Harrow Green front desk." },
      { property: "og:title", content: "Guest help desk — Harrow Green" },
      { property: "og:description", content: "Enter your ward's name to get help from the Harrow Green front desk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuestPage,
});

const wards: Record<string, { form: string; teacher: string; attendance: string; fees: string }> = {
  "kwame asante": { form: "Form 2B", teacher: "Mr. Okoye", attendance: "96%", fees: "Fully paid" },
  "ama boateng": { form: "Form 2B", teacher: "Mr. Okoye", attendance: "93%", fees: "GH₵ 350 outstanding" },
  "yaw mensah": { form: "Form 2B", teacher: "Mr. Okoye", attendance: "90%", fees: "Fully paid" },
};

function GuestPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const ward = wards[query.trim().toLowerCase()];

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(name);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 font-body text-foreground">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <div className="glass-panel rise relative w-full max-w-md rounded-lg p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold">Guest help desk</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your ward's full name and we'll help you.</p>
        <form onSubmit={submit} className="mt-5 flex gap-2">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kwame Asante"
            className="h-10 flex-1 rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit">Find</Button>
        </form>

        {query ? (
          ward ? (
            <div className="mt-5 space-y-2 rounded-md border border-border bg-background/60 p-4 text-sm">
              <p className="font-display text-lg font-bold">{query}</p>
              <p>Class: {ward.form} · Teacher: {ward.teacher}</p>
              <p>Term attendance: {ward.attendance}</p>
              <p>Fees: {ward.fees}</p>
              <p className="pt-2 text-xs text-muted-foreground">Need more? Visit the front office or call the school — a staff member will assist you.</p>
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">We couldn't find "{query}". Please check the spelling or ask at the front office.</p>
          )
        ) : null}

        <Button variant="ghost" className="mt-4 w-full" onClick={() => navigate({ to: "/login" })}>Back to sign in</Button>
      </div>
    </div>
  );
}
