import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, GraduationCap, ReceiptText, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/parent")({
  head: () => ({ meta: [{ title: "Parent Portal — Klasora" }, { name: "description", content: "Follow your children’s learning, attendance, and fees." }] }),
  component: ParentPortal,
});

type Child = {
  id: string;
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
  mark_count: number;
  term_average: number | string | null;
};
type Payment = {
  id: string;
  student_name: string;
  receipt_number: string | null;
  amount: number | string;
  currency: string;
  category: string;
  paid_at: string;
  status: string;
};

async function portalApi<T>(path: string): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const response = await fetch(`${url.pathname}${url.search}`, { headers: { authorization: `Bearer ${token}` } });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Could not load family records";
    throw new Error(message);
  }
  return payload as T;
}

function ParentPortal() {
  const [children, setChildren] = useState<Child[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void portalApi<{ children: Child[]; recent_payments: Payment[] }>("/api/school/portal-data")
      .then((result) => {
        if (cancelled) return;
        setChildren(result.children);
        setPayments(result.recent_payments);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load family records");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const outstandingBalance = useMemo(
    () => children.reduce((sum, child) => sum + Number(child.balance_due), 0),
    [children],
  );
  const currency = children[0]?.currency ?? "GHS";

  return (
    <SchoolShell title="My children" parentPortal>
      <div className="mx-auto max-w-6xl rise">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><GraduationCap className="size-5" /></div>
            <h1 className="font-display text-3xl font-bold">Your family</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">View linked learners&apos; school records, attendance, results, and payment history.</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            <CreditCard className="size-4" /> Contact the school to make or arrange a payment.
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-md border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</p>}
        <section className="mt-7 grid gap-3 sm:grid-cols-3">
          <Metric label="Linked children" value={loading ? "—" : String(children.length)} note={loading ? "Loading" : "From your linked guardian account"} />
          <Metric label="Outstanding fees" value={loading ? "—" : `${currency} ${outstandingBalance.toFixed(2)}`} note="Across linked children" />
          <Metric label="Recent payments" value={loading ? "—" : String(payments.length)} note="Saved school payment records" />
        </section>

        {loading ? <p className="py-12 text-center text-sm text-muted-foreground">Loading children&apos;s records...</p> : children.length === 0 ? (
          <section className="glass-panel mt-4 rounded-lg px-5 py-12 text-center">
            <h2 className="font-display text-lg font-bold">No learner records are linked yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Ask the school administrator to link your verified email to the guardian record.</p>
          </section>
        ) : (
          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            {children.map((child) => {
              const attendanceRate = Number(child.attendance_total)
                ? Math.round((Number(child.attendance_present) / Number(child.attendance_total)) * 100)
                : null;
              return (
                <article key={child.id} className="glass-panel rounded-lg p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold">{child.first_name} {child.last_name}</h2>
                      <p className="text-xs text-muted-foreground">{child.admission_number} · {child.class_name ?? "No active class"}{child.term_name ? ` · ${child.term_name}` : ""}</p>
                    </div>
                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700">{child.currency} {Number(child.balance_due).toFixed(2)} due</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <SmallStat icon={UserRoundCheck} label="Attendance this term" value={attendanceRate === null ? "No entries" : `${attendanceRate}% (${child.attendance_present}/${child.attendance_total})`} />
                    <SmallStat icon={GraduationCap} label="Term average" value={child.term_average === null ? "No grades" : `${Number(child.term_average).toFixed(1)}%`} />
                  </div>
                  {child.academic_year_name && <p className="mt-4 text-xs text-muted-foreground">Academic year: {child.academic_year_name}</p>}
                </article>
              );
            })}
          </section>
        )}

        <section className="glass-panel mt-4 overflow-hidden rounded-lg">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div><h2 className="font-display text-lg font-bold">Recent payment activity</h2><p className="mt-1 text-xs text-muted-foreground">Only payments recorded against your linked children are shown.</p></div>
            <ReceiptText className="size-5 text-primary" />
          </div>
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading payment history...</p> : payments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No payment records are available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Receipt</th><th className="px-5 py-3 font-medium">Child</th><th className="px-5 py-3 font-medium">Payment</th><th className="px-5 py-3 font-medium">Amount</th><th className="px-5 py-3 font-medium">Status</th></tr></thead>
                <tbody className="divide-y divide-border/70">{payments.map((payment) => <tr key={payment.id}><td className="px-5 py-4 font-mono text-xs">{payment.receipt_number ?? "—"}</td><td className="px-5 py-4 font-medium">{payment.student_name}</td><td className="px-5 py-4 capitalize">{payment.category.replaceAll("_", " ")}</td><td className="px-5 py-4">{payment.currency} {Number(payment.amount).toFixed(2)}</td><td className="px-5 py-4 capitalize">{payment.status}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </SchoolShell>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>;
}

function SmallStat({ icon: Icon, label, value }: { icon: typeof UserRoundCheck; label: string; value: string }) {
  return <div className="rounded-md bg-secondary/45 p-3"><Icon className="size-4 text-primary" /><p className="mt-2 text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-display text-lg">{value}</p></div>;
}
