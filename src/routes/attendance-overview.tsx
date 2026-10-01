import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, ClipboardCheck } from "lucide-react";

import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/attendance-overview")({
  head: () => ({ meta: [{ title: "Attendance Overview — Klasora" }, { name: "description", content: "School Admin attendance monitoring." }] }),
  component: AttendanceOverview,
});

function AttendanceOverview() {
  return <SchoolShell title="Attendance" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><ClipboardCheck className="size-5" /></div><h1 className="font-display text-3xl font-bold">Attendance overview</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Monitor attendance across the school. Only teachers can make or edit register entries.</p></div>
    <section className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Present today" value="—" note="Live school data not connected" /><Metric label="Absent today" value="—" note="Live school data not connected" /><Metric label="Registers complete" value="—" note="Live school data not connected" /></section>
    <section className="glass-panel mt-4 overflow-hidden rounded-lg"><div className="flex items-center gap-2 border-b border-border px-5 py-4"><CircleAlert className="size-4 text-amber-600" /><p className="text-sm text-secondary-foreground">View-only access: register marking is assigned to teachers.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Class</th><th className="px-5 py-3 font-medium">Present</th><th className="px-5 py-3 font-medium">Absent</th><th className="px-5 py-3 font-medium">Register status</th></tr></thead><tbody><tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">Live attendance records are not connected yet.</td></tr></tbody></table></div></section>
  </div></SchoolShell>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
