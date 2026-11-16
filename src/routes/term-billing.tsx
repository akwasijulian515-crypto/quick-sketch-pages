import { createFileRoute } from "@tanstack/react-router";

import { SchoolShell } from "@/components/school-shell";
import { TermBillingWorkspace } from "@/components/term-billing-workspace";

export const Route = createFileRoute("/term-billing")({
  head: () => ({
    meta: [
      { title: "Term billing — Klasora" },
      {
        name: "description",
        content: "Preview and generate locked term fee bills for enrolled learners.",
      },
    ],
  }),
  component: TermBillingPage,
});

function TermBillingPage() {
  return (
    <SchoolShell title="Term billing" finance>
      <div className="mx-auto max-w-6xl rise">
        <div className="mb-5">
          <h1 className="font-display text-3xl font-bold">Term billing</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Preview term charges, resolve pending payments, and generate locked bills for the
            selected class and term.
          </p>
        </div>
        <TermBillingWorkspace />
      </div>
    </SchoolShell>
  );
}
