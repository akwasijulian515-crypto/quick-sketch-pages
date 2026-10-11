import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ClipboardCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchWithNeonAuth } from "../auth/client";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/attendance")({
  head: () => ({ meta: [
    { title: "Attendance — Klasora" },
    { name: "description", content: "Review attendance records for your school." },
  ]}),
  component: Attendance,
});

type AttendanceSummary = {
  date: string;
  classes: { id: string; name: string; present_count: number; late_count: number; absent_count: number; student_count: number; marked_count: number }[];
};

function Attendance() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AttendanceSummary["classes"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      const params = new URLSearchParams({ date });
      const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
      if (tenant) params.set("tenant", tenant);
      const response = await fetchWithNeonAuth(`/api/school/attendance?${params}`);
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Could not load attendance";
        throw new Error(message);
      }
      const result = payload as AttendanceSummary;
      if (!cancelled) setRows(result.classes ?? []);
    })().catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load attendance");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const total = rows.reduce((acc, row) => ({
    present: acc.present + Number(row.present_count),
    late: acc.late + Number(row.late_count),
    absent: acc.absent + Number(row.absent_count),
    marked: acc.marked + Number(row.marked_count),
    students: acc.students + Number(row.student_count),
  }), { present: 0, late: 0, absent: 0, marked: 0, students: 0 });

  return (
    <SchoolShell title="Attendance" schoolAdmin>
      <div className="mx-auto max-w-6xl rise">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-[11px] uppercase tracking-[0.18em] text-primary">School attendance</p><h1 className="mt-1 font-display text-3xl">Attendance</h1><p className="mt-2 text-sm text-muted-foreground">Daily attendance saved by class. Teachers manage the register from their class workspace.</p></div>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Attendance date<input aria-label="Attendance date" className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </header>

        {error && <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary icon={Users} label="Students" value={loading ? "—" : String(total.students)} />
          <Summary icon={ClipboardCheck} label="Present" value={loading ? "—" : String(total.present)} />
          <Summary icon={CalendarDays} label="Late" value={loading ? "—" : String(total.late)} />
          <Summary icon={Users} label="Absent" value={loading ? "—" : String(total.absent)} />
        </section>

        <section className="glass-panel mt-4 overflow-hidden rounded-lg">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Class register summary</h2><p className="mt-1 text-xs text-muted-foreground">{total.marked} of {total.students} active students marked</p></div><Link className="text-xs font-semibold text-primary hover:underline" to="/attendance-overview">Detailed overview</Link></div>
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading attendance...</p> : rows.length === 0 ? <p className="px-5 py-9 text-center text-sm text-muted-foreground">No attendance has been recorded for this date.</p> : <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <article key={row.id} className="rounded-md border border-border bg-card p-4"><h3 className="font-semibold">{row.name}</h3><p className="mt-1 text-xs text-muted-foreground">{row.marked_count} of {row.student_count} students marked</p><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded bg-emerald-500/10 p-2"><strong className="block text-base text-emerald-700 dark:text-emerald-400">{row.present_count}</strong>Present</div><div className="rounded bg-amber-500/10 p-2"><strong className="block text-base text-amber-700 dark:text-amber-400">{row.late_count}</strong>Late</div><div className="rounded bg-rose-500/10 p-2"><strong className="block text-base text-rose-700 dark:text-rose-400">{row.absent_count}</strong>Absent</div></div></article>)}</div>}
        </section>
      </div>
    </SchoolShell>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <article className="glass-panel rounded-lg p-5"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /><h2 className="text-xs font-semibold">{label}</h2></div><p className="mt-3 font-display text-3xl">{value}</p></article>;
}
