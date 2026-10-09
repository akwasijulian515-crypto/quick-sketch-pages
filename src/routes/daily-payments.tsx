import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/daily-payments")({
  head: () => ({ meta: [{ title: "Daily Payments — Klasora" }, { name: "description", content: "Record and review daily-fee collections." }] }),
  component: DailyPaymentsPage,
});

type DailyStudent = {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_name: string;
  fee_amount: number | string;
  currency: string;
  attendance_status: string | null;
  payment_id: string | null;
  method: string | null;
  paid_at: string | null;
  coupon_code: string | null;
};

async function schoolApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${url.pathname}${url.search}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "The school request failed";
    throw new Error(message);
  }
  return payload as T;
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function DailyPaymentsPage() {
  const [date, setDate] = useState(() => localDateString(new Date()));
  const [students, setStudents] = useState<DailyStudent[]>([]);
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(true);
  const [recordingStudent, setRecordingStudent] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await schoolApi<{ students: DailyStudent[] }>(`/api/school/daily-payments?date=${encodeURIComponent(date)}`);
      setStudents(result.students);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load daily-fee roster");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void loadStudents(); }, [loadStudents]);

  async function markPaid(student: DailyStudent) {
    setRecordingStudent(student.student_id);
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<{ payment: { coupon_code: string } }>("/api/school/daily-payments", {
        method: "POST",
        body: JSON.stringify({ student_id: student.student_id, date, method }),
      });
      setNotice(`${student.first_name} ${student.last_name} marked paid (${student.currency} ${Number(student.fee_amount).toFixed(2)}). Daily clearance ${result.payment.coupon_code}.`);
      await loadStudents();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not record daily-fee payment");
    } finally {
      setRecordingStudent("");
    }
  }

  return <SchoolShell title="Daily payments" finance><div className="mx-auto max-w-6xl rise">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Wallet className="size-5" /></div><h1 className="font-display text-3xl font-bold">Daily payments</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Mark each learner’s configured daily fee as paid. Recorded collections and attendance feed directly into Daily Reconciliation.</p></div>
      <label className="space-y-1 text-xs font-medium text-muted-foreground">Payment date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" /></label>
    </div>
    <section className="mt-5 grid gap-3 sm:grid-cols-3">
      <Metric label="Expected from present / late" value={loading ? "—" : formatDailyTotals(students.filter((student) => student.attendance_status === "present" || student.attendance_status === "late"))} />
      <Metric label="Daily fees received" value={loading ? "—" : formatDailyTotals(students.filter((student) => student.payment_id))} />
      <Metric label="Students on daily-fee register" value={loading ? "—" : String(students.length)} />
    </section>
    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    <section className="glass-panel mt-4 overflow-hidden rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div><h2 className="font-display text-lg font-bold">Daily-fee register</h2><p className="mt-1 text-xs text-muted-foreground">One collection per student per day. Marking paid also creates a daily clearance code, not an official receipt.</p></div>
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">Payment method<select value={method} onChange={(event) => setMethod(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></label>
      </div>
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading daily-fee register...</p>
        : students.length === 0 ? <div className="px-5 py-10 text-center"><p className="text-sm text-muted-foreground">No active learners with a daily fee configured for this date.</p><Button className="mt-3" size="sm" variant="outline" asChild><Link to="/finance">Review fee schedule</Link></Button></div>
          : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Class", "Attendance", "Daily fee", "Collection status", ""].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-border/70">{students.map((student) => <tr key={student.student_id}>
              <td className="px-5 py-3 font-medium">{student.first_name} {student.last_name}<p className="font-mono text-xs text-muted-foreground">{student.admission_number}</p></td>
              <td className="px-5 py-3">{student.class_name}</td>
              <td className="px-5 py-3 capitalize">{student.attendance_status ?? "Not marked"}</td>
              <td className="px-5 py-3">{student.currency} {Number(student.fee_amount).toFixed(2)}</td>
              <td className="px-5 py-3">{student.payment_id ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="size-4" />Paid · {student.method?.replaceAll("_", " ")}</span> : "Not paid"}</td>
              <td className="px-5 py-3">{student.payment_id ? <span className="font-mono text-xs text-muted-foreground">{student.coupon_code ?? "Recorded"}</span> : <Button size="sm" disabled={recordingStudent !== ""} onClick={() => void markPaid(student)}>{recordingStudent === student.student_id ? "Recording..." : "Mark paid"}</Button>}</td>
            </tr>)}</tbody>
          </table></div>}
    </section>
  </div></SchoolShell>;
}

function formatDailyTotals(students: DailyStudent[]) {
  const totals = new Map<string, number>();
  for (const student of students) {
    totals.set(student.currency, (totals.get(student.currency) ?? 0) + Number(student.fee_amount));
  }
  return totals.size ? Array.from(totals, ([currency, total]) => `${currency} ${total.toFixed(2)}`).join(" · ") : "—";
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></article>;
}
