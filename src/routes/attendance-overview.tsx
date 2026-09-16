import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, ClipboardCheck, UserRoundCheck } from "lucide-react";

import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/attendance-overview")({
  head: () => ({ meta: [{ title: "Attendance Overview — Harrow Green" }, { name: "description", content: "School Admin attendance monitoring." }] }),
  component: AttendanceOverview,
});

function AttendanceOverview() {
  return <SchoolShell title="Attendance" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><ClipboardCheck className="size-5" /></div><h1 className="font-display text-3xl font-bold">Attendance overview</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Monitor attendance across the school. Only teachers can make or edit register entries.</p></div>
    <section className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Present today" value="468" note="96.7% of enrolled students" /><Metric label="Absent today" value="16" note="Requires follow-up" /><Metric label="Registers complete" value="18 / 20" note="2 classes still pending" /></section>
    <section className="glass-panel mt-4 overflow-hidden rounded-lg"><div className="flex items-center gap-2 border-b border-border px-5 py-4"><CircleAlert className="size-4 text-amber-600" /><p className="text-sm text-secondary-foreground">View-only access: register marking is assigned to teachers.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Class</th><th className="px-5 py-3 font-medium">Present</th><th className="px-5 py-3 font-medium">Absent</th><th className="px-5 py-3 font-medium">Register status</th></tr></thead><tbody className="divide-y divide-border/70">{[["Form 1A", "31", "1", "Complete"], ["Form 2B", "38", "4", "Complete"], ["Form 3A", "27", "2", "Pending"]].map(([className, present, absent, status]) => <tr key={className}><td className="px-5 py-4 font-medium">{className}</td><td className="px-5 py-4">{present}</td><td className="px-5 py-4">{absent}</td><td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 text-xs text-secondary-foreground"><UserRoundCheck className="size-3.5 text-primary" />{status}</span></td></tr>)}</tbody></table></div></section>
  </div></SchoolShell>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
