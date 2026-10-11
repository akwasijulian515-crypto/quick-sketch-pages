import { createFileRoute } from "@tanstack/react-router";
import { BookOpenCheck, CalendarDays, CreditCard, GraduationCap, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchWithNeonAuth } from "../auth/client";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/student")({
  head: () => ({ meta: [{ title: "Student Portal — Klasora" }, { name: "description", content: "Follow your learning, attendance, results, and school notices." }] }),
  component: StudentPortal,
});

type StudentPortalData = {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_name: string | null;
  term_name: string | null;
  academic_year_name: string | null;
  attendance_present: number;
  attendance_total: number;
  balance_due: number | string;
  currency: string;
  results: { subject_name: string; total_score: number | string | null; performance_level: string | null }[];
  recent_payments: {
    id: string;
    receipt_number: string | null;
    amount: number | string;
    currency: string;
    category: string;
    paid_at: string;
    status: string;
  }[];
};

async function portalApi<T>(path: string): Promise<T> {
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const response = await fetchWithNeonAuth(`${url.pathname}${url.search}`);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Could not load student records";
    throw new Error(message);
  }
  return payload as T;
}

function StudentPortal() {
  const [student, setStudent] = useState<StudentPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void portalApi<{ student: StudentPortalData }>("/api/school/portal-data")
      .then((result) => { if (!cancelled) setStudent(result.student); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load student records");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const termAverage = useMemo(() => {
    if (!student?.results.length) return null;
    const scores = student.results.map((result) => Number(result.total_score)).filter(Number.isFinite);
    return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  }, [student]);
  const attendanceRate = student && Number(student.attendance_total)
    ? Math.round((Number(student.attendance_present) / Number(student.attendance_total)) * 100)
    : null;

  return (
    <SchoolShell title="My learning" studentPortal>
      <div className="mx-auto max-w-6xl rise">
        {error && <p role="alert" className="mb-4 rounded-md border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</p>}
        {loading ? <p className="py-16 text-center text-sm text-muted-foreground">Loading your school records...</p> : !student ? (
          <section className="glass-panel rounded-lg px-5 py-12 text-center">
            <h1 className="font-display text-xl font-bold">No student record is linked</h1>
            <p className="mt-2 text-sm text-muted-foreground">Ask your school administrator to link your sign-in account to your student record.</p>
          </section>
        ) : (
          <>
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><GraduationCap className="size-5" /></div>
                <h1 className="font-display text-3xl font-bold">{student.first_name} {student.last_name}</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{student.admission_number} · {student.class_name ?? "No active class"}{student.term_name ? ` · ${student.term_name}` : ""}{student.academic_year_name ? `, ${student.academic_year_name}` : ""}</p>
              </div>
            </div>

            <section className="mt-7 grid gap-3 sm:grid-cols-3">
              <Metric label="Attendance this term" value={attendanceRate === null ? "—" : `${attendanceRate}%`} note={student.attendance_total ? `${student.attendance_present} present or late of ${student.attendance_total} recorded` : "No attendance entries yet"} />
              <Metric label="Term average" value={termAverage === null ? "—" : `${termAverage.toFixed(1)}%`} note={student.results.length ? `Across ${student.results.length} subjects` : "No grades recorded for this term"} />
              <Metric label="Fee balance" value={`${student.currency} ${Number(student.balance_due).toFixed(2)}`} note="Ask a parent or guardian to arrange payment" />
            </section>

            <section className="glass-panel mt-4 overflow-hidden rounded-lg">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div><h2 className="font-display text-lg font-bold">Term results</h2><p className="mt-1 text-xs text-muted-foreground">{student.term_name ?? "Current academic period"} · saved subject marks</p></div>
                <BookOpenCheck className="size-5 text-primary" />
              </div>
              {student.results.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No subject results are available for this term.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Subject</th><th className="px-5 py-3 font-medium">Total score</th><th className="px-5 py-3 font-medium">Performance</th></tr></thead>
                    <tbody className="divide-y divide-border/70">{student.results.map((result) => <tr key={result.subject_name}><td className="px-5 py-4 font-medium">{result.subject_name}</td><td className="px-5 py-4">{result.total_score === null ? "Not graded" : `${Number(result.total_score).toFixed(1)}%`}</td><td className="px-5 py-4">{result.performance_level ?? "—"}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="glass-panel mt-4 overflow-hidden rounded-lg">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div><h2 className="font-display text-lg font-bold">Payment history</h2><p className="mt-1 text-xs text-muted-foreground">Receipts recorded by your school.</p></div>
                <CreditCard className="size-5 text-primary" />
              </div>
              {student.recent_payments.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No payment records are available yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Receipt</th><th className="px-5 py-3 font-medium">Payment type</th><th className="px-5 py-3 font-medium">Amount</th><th className="px-5 py-3 font-medium">Status</th></tr></thead>
                    <tbody className="divide-y divide-border/70">{student.recent_payments.map((payment) => <tr key={payment.id}><td className="px-5 py-4 font-mono text-xs">{payment.receipt_number ?? "—"}</td><td className="px-5 py-4 capitalize">{payment.category.replaceAll("_", " ")}</td><td className="px-5 py-4">{payment.currency} {Number(payment.amount).toFixed(2)}</td><td className="px-5 py-4 capitalize">{payment.status}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </section>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-4" /><UserRoundCheck className="size-4" />Attendance totals include records from the active term only.</div>
          </>
        )}
      </div>
    </SchoolShell>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>;
}
