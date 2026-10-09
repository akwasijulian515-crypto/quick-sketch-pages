import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, CheckCircle2, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/daily-payments")({
  head: () => ({ meta: [{ title: "Daily Payments — Klasora" }, { name: "description", content: "Daily-fee payment register for Finance." }] }),
  component: DailyPaymentsPage,
});

type DailyStudent = {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_id: string;
  class_name: string;
  academic_year_name: string;
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
  const [recordingStudents, setRecordingStudents] = useState<Set<string>>(() => new Set());
  const [classFilter, setClassFilter] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeDate = useRef(date);
  activeDate.current = date;

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

  const classes = useMemo(() => Array.from(new Map(students.map((student) => [
    student.class_id,
    { id: student.class_id, name: student.class_name, year: student.academic_year_name },
  ])).values()).sort((a, b) => a.name.localeCompare(b.name) || a.year.localeCompare(b.year)), [students]);
  const visible = useMemo(() => students
    .filter((student) => classFilter === "all" || student.class_id === classFilter)
    .sort((a, b) => a.class_name.localeCompare(b.class_name) || a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)),
  [students, classFilter]);
  const selectedClass = classes.find((item) => item.id === classFilter);
  const paidCount = visible.filter((student) => student.payment_id).length;
  const dueStudents = visible.filter((student) => student.attendance_status === "present" || student.attendance_status === "late");
  const paidStudents = visible.filter((student) => student.payment_id);

  async function markPaid(student: DailyStudent) {
    const paymentDate = date;
    setRecordingStudents((current) => new Set(current).add(student.student_id));
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<{ payment: { id: string; method: string; coupon_code: string } }>("/api/school/daily-payments", {
        method: "POST",
        body: JSON.stringify({ student_id: student.student_id, date: paymentDate, method }),
      });
      setNotice(`${student.first_name} ${student.last_name} marked paid (${student.currency} ${Number(student.fee_amount).toFixed(2)}). Daily clearance ${result.payment.coupon_code}.`);
      if (activeDate.current === paymentDate) {
        setStudents((current) => current.map((item) => item.student_id === student.student_id
          ? { ...item, payment_id: result.payment.id, method: result.payment.method, coupon_code: result.payment.coupon_code }
          : item));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not record daily-fee payment");
    } finally {
      setRecordingStudents((current) => {
        const next = new Set(current);
        next.delete(student.student_id);
        return next;
      });
    }
  }

  return <SchoolShell title="Daily payments" finance><div className="mx-auto max-w-6xl rise">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Wallet className="size-5" /></div><h1 className="font-display text-3xl font-bold">Daily payments</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Mark each learner’s configured daily fee as paid. Recorded collections and attendance feed directly into Daily Reconciliation.</p></div>
      <label className="space-y-1 text-xs font-medium text-muted-foreground">Payment date<input type="date" max={localDateString(new Date())} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" /></label>
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <label className="space-y-1 text-xs font-medium text-muted-foreground">Class
        <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:w-56">
          <option value="all">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.year}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-md bg-secondary px-2.5 py-1 text-secondary-foreground ring-1 ring-border">{paidCount} paid</span>
        <span className="rounded-md bg-muted px-2.5 py-1 text-muted-foreground">{visible.length - paidCount} unpaid</span>
        <label className="ml-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">Method
          <select value={method} onChange={(event) => setMethod(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select>
        </label>
      </div>
    </div>
    <section className="mt-4 grid gap-3 sm:grid-cols-3">
      <Metric label="Expected from present / late" value={loading ? "—" : formatDailyTotals(dueStudents)} />
      <Metric label="Daily fees received" value={loading ? "—" : formatDailyTotals(paidStudents)} />
      <Metric label="Students on daily-fee register" value={loading ? "—" : String(visible.length)} />
    </section>
    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    <section className="glass-panel mt-4 overflow-hidden rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div><h2 className="font-display text-lg font-bold">Daily-fee register</h2><p className="mt-1 text-xs text-muted-foreground">{date} · {visible.length} learners{selectedClass ? ` in ${selectedClass.name} · ${selectedClass.year}` : ""}. One collection per student per day. Daily clearance is not an official receipt.</p></div>
        <Banknote className="size-5 text-primary" />
      </div>
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading daily-fee register...</p>
        : visible.length === 0 ? <div className="px-5 py-10 text-center"><p className="text-sm text-muted-foreground">No active learners with a daily fee configured for this date.</p><Button className="mt-3" size="sm" variant="outline" asChild><Link to="/finance">Review fee schedule</Link></Button></div>
          : <>
            <div className="divide-y divide-border/70 md:hidden">
              {visible.map((student) => <article key={student.student_id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{student.first_name} {student.last_name}</p><p className="text-xs text-muted-foreground">{student.admission_number} · {student.class_name}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{student.attendance_status ?? "Attendance not marked"} · {student.currency} {Number(student.fee_amount).toFixed(2)}</p></div>
                {student.payment_id ? <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="size-4" />Paid</span> : <Button size="sm" disabled={recordingStudents.has(student.student_id)} onClick={() => void markPaid(student)}>{recordingStudents.has(student.student_id) ? "Recording..." : "Mark paid"}</Button>}
              </article>)}
            </div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Class", "Attendance", "Daily fee", "Collection status", ""].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-border/70">{visible.map((student) => <tr key={student.student_id}>
                <td className="px-5 py-3 font-medium">{student.first_name} {student.last_name}<p className="font-mono text-xs text-muted-foreground">{student.admission_number}</p></td>
                <td className="px-5 py-3">{student.class_name}</td>
                <td className="px-5 py-3 capitalize">{student.attendance_status ?? "Not marked"}</td>
                <td className="px-5 py-3">{student.currency} {Number(student.fee_amount).toFixed(2)}</td>
                <td className="px-5 py-3">{student.payment_id ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="size-4" />Paid · {student.method?.replaceAll("_", " ")}</span> : "Not paid"}</td>
                <td className="px-5 py-3">{student.payment_id ? <span className="font-mono text-xs text-muted-foreground">{student.coupon_code ?? "Recorded"}</span> : <Button size="sm" disabled={recordingStudents.has(student.student_id)} onClick={() => void markPaid(student)}>{recordingStudents.has(student.student_id) ? "Recording..." : "Mark paid"}</Button>}</td>
              </tr>)}</tbody>
            </table></div>
          </>}
    </section>
  </div></SchoolShell>;
}

function formatDailyTotals(students: DailyStudent[]) {
  const totals = new Map<string, number>();
  for (const student of students) totals.set(student.currency, (totals.get(student.currency) ?? 0) + Number(student.fee_amount));
  return totals.size ? Array.from(totals, ([currency, total]) => `${currency} ${total.toFixed(2)}`).join(" · ") : "—";
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></article>;
}
