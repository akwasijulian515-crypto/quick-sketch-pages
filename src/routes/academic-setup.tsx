import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/academic-setup")({
  head: () => ({
    meta: [
      { title: "Academic Setup — Klasora" },
      { name: "description", content: "Set the school year, terms, calendar, and promotion window." },
    ],
  }),
  component: AcademicSetupPage,
});

function AcademicSetupPage() {
  return (
    <SchoolShell title="Academic setup" schoolAdmin>
      <div className="mx-auto max-w-6xl rise">
        <div>
          <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border">
            <CalendarDays className="size-5" />
          </div>
          <h1 className="font-display text-3xl font-bold">Academic setup</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage the school year, teaching terms, non-school days, and the promotion window.
          </p>
        </div>
        <section className="glass-panel mt-6 rounded-lg border border-dashed border-border p-12 text-center">
          <h2 className="font-display text-lg font-bold">Live academic configuration is not connected</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            School-year dates, term status, calendar closures, and promotion settings will appear here when connected to your school records.
          </p>
        </section>
      </div>
    </SchoolShell>
  );
}
