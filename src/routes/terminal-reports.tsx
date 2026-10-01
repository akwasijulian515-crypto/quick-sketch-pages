import { createFileRoute } from "@tanstack/react-router";
import { FileDown, FileText, Files, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/terminal-reports")({
  head: () => ({
    meta: [
      { title: "Terminal Reports — Harrow Green" },
      { name: "description", content: "Generate standards-based terminal reports." },
    ],
  }),
  component: TerminalReportsPage,
});

function TerminalReportsPage() {
  return (
    <SchoolShell title="Terminal reports" schoolAdmin>
      <div className="mx-auto max-w-6xl rise">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border">
              <FileText className="size-5" />
            </div>
            <h1 className="font-display text-3xl font-bold">Terminal reports</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Generate a criterion-referenced report from entered marks, attendance, learner profile, and teacher remarks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled>
              <Files />Download class reports
            </Button>
            <Button variant="outline" disabled>
              <FileDown />Download report
            </Button>
            <Button disabled>
              <FileText />Preview report
            </Button>
          </div>
        </div>

        <div className="glass-panel mt-6 rounded-lg border border-dashed border-border p-12 text-center">
          <ShieldCheck className="mx-auto size-7 text-primary/55" />
          <h2 className="mt-3 font-display text-lg font-bold">Live learner records are not connected</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Report previews and downloads will be available when student results and attendance data are connected.
          </p>
        </div>

        <section className="mt-5 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-secondary-foreground">NaCCA performance levels</p>
          <p className="mt-1">
            HP: 80%+ · P: 68–79% · AP: 54–67% · D: 40–53% · E: 39% and below. Reports are criterion-referenced, not learner rankings.
          </p>
        </section>
      </div>
    </SchoolShell>
  );
}
