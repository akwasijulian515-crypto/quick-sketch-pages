import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, Landmark, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { SchoolShell } from "@/components/school-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reconciliation")({
  head: () => ({ meta: [{ title: "Daily Reconciliation — Klasora" }, { name: "description", content: "Reconcile expected daily fees against attendance and review recorded school-fee collections." }] }),
  component: ReconciliationPage,
});

type Channel = { method: string; category: string; currency: string; amount: number | string; payment_count: number | string };
type CategoryTotal = { category: string; currency: string; amount: number | string; payment_count: number | string };
type CurrencyTotals = {
  currency: string;
  expected_daily: number | string;
  expected_students: number | string;
  daily_received: number | string;
  daily_payment_count: number | string;
  school_fee_received: number | string;
  school_fee_payment_count: number | string;
  other_payments_received: number | string;
  other_payment_count: number | string;
  total_received: number | string;
  variance: number | string;
};
type ReconciledPayment = {
  id: string;
  receipt_number: string | null;
  amount: number | string;
  currency: string;
  category: string;
  method: string;
  paid_at: string;
  daily_fee_date: string | null;
  first_name: string;
  last_name: string;
  admission_number: string;
};
type Reconciliation = {
  currency_totals: CurrencyTotals[];
  channels: Channel[];
  category_totals: CategoryTotal[];
  payments: ReconciledPayment[];
};

async function schoolApi<T>(path: string): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const response = await fetch(`${url.pathname}${url.search}`, { headers: { authorization: `Bearer ${token}` } });
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

function ReconciliationPage() {
  const [date, setDate] = useState(() => localDateString(new Date()));
  const [data, setData] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void schoolApi<Reconciliation>(`/api/school/reconciliation?date=${encodeURIComponent(date)}`)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load reconciliation");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const currencyTotals = data?.currency_totals ?? [];
  const varianceOpen = currencyTotals.some((total) => Math.abs(Number(total.variance)) > 0.009);
  const outstanding = currencyTotals.filter((total) => Number(total.variance) > 0);
  const excess = currencyTotals.filter((total) => Number(total.variance) < -0.009);
  const expectedStudents = currencyTotals.reduce((sum, total) => sum + Number(total.expected_students), 0);
  const dailyPaymentCount = currencyTotals.reduce((sum, total) => sum + Number(total.daily_payment_count), 0);
  const schoolFeePaymentCount = currencyTotals.reduce((sum, total) => sum + Number(total.school_fee_payment_count), 0);
  const otherPaymentCount = currencyTotals.reduce((sum, total) => sum + Number(total.other_payment_count), 0);

  return <SchoolShell title="Daily reconciliation" finance><div className="mx-auto max-w-6xl rise">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><ShieldCheck className="size-5" /></div><h1 className="font-display text-3xl font-bold">Daily reconciliation</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Expected daily fees are calculated from learners marked present or late. School-fee instalments are reported separately, not counted against the daily-fee variance.</p></div>
      <label className="space-y-1 text-xs font-medium text-muted-foreground">Reconciliation date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" /></label>
    </div>
    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Metric label="Expected daily fees" value={loading ? "—" : totals(currencyTotals, "expected_daily")} note={`${expectedStudents} learners marked present or late`} />
      <Metric label="Daily fees received" value={loading ? "—" : totals(currencyTotals, "daily_received")} note={`${dailyPaymentCount} daily-fee payments`} />
      <Metric label="Daily-fee variance" value={loading ? "—" : totals(currencyTotals, "variance")} note={outstanding.length ? "Expected daily fees not yet collected" : excess.length ? "Collections exceed attendance-based expected fees" : "Daily fee collection is reconciled"} tone={varianceOpen ? "warning" : undefined} />
      <Metric label="School-fee payments" value={loading ? "—" : totals(currencyTotals, "school_fee_received")} note={`${schoolFeePaymentCount} instalments collected today`} />
      <Metric label="Other payments" value={loading ? "—" : totals(currencyTotals, "other_payments_received")} note={`${otherPaymentCount} examination / other payment(s)`} />
      <Metric label="Total received" value={loading ? "—" : totals(currencyTotals, "total_received")} note="Daily fees + school fees + other payments" />
    </section>

    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <article className="glass-panel rounded-lg p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">Payment categories before total</h2><p className="mt-1 text-xs text-muted-foreground">Review every category separately before the collected total.</p></div><Landmark className="size-5 text-primary" /></div>
        {loading ? <p className="mt-5 text-sm text-muted-foreground">Loading payment categories...</p>
          : !data?.category_totals.length && !currencyTotals.length ? <p className="mt-5 text-sm text-muted-foreground">No expected fees or verified payments for this date.</p>
            : <div className="mt-4 divide-y divide-border/70">
              {!data?.category_totals.length && <p className="py-3 text-sm text-muted-foreground">No payments have been recorded yet.</p>}
              {data?.category_totals.map((item) => <div key={`${item.category}:${item.currency}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div><p className="font-medium capitalize">{item.category.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{Number(item.payment_count)} payment(s)</p></div>
                <p className="font-semibold">{money(Number(item.amount), item.currency)}</p>
              </div>)}
              {currencyTotals.map((total) => <div key={`total:${total.currency}`} className="flex items-center justify-between gap-3 border-t-2 border-border py-3 text-sm font-bold">
                <p>Total received ({total.currency})</p>
                <p>{money(Number(total.total_received), total.currency)}</p>
              </div>)}
            </div>}
      </article>
      <article className="glass-panel rounded-lg p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">Collections by channel</h2><p className="mt-1 text-xs text-muted-foreground">Verified staff-recorded collections for this date.</p></div><Landmark className="size-5 text-primary" /></div>
        {loading ? <p className="mt-5 text-sm text-muted-foreground">Loading channel totals...</p>
          : !data?.channels.length ? <p className="mt-5 text-sm text-muted-foreground">No verified collections recorded for this date.</p>
            : <div className="mt-4 divide-y divide-border/70">{data.channels.map((channel) => <div key={`${channel.category}:${channel.method}`} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div><p className="font-medium capitalize">{channel.method.replaceAll("_", " ")}</p><p className="text-xs capitalize text-muted-foreground">{channel.category.replaceAll("_", " ")} · {Number(channel.payment_count)} payment(s)</p></div>
              <p className="font-semibold">{money(Number(channel.amount), channel.currency)}</p>
            </div>)}</div>}
      </article>
      <article className="glass-panel rounded-lg p-5 lg:col-span-2">
        <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">Reconciliation notes</h2><p className="mt-1 text-xs text-muted-foreground">Use daily attendance to calculate expected amounts; recorded receipts remain separate by fee category.</p></div><CircleAlert className="size-5 text-primary" /></div>
        <div className={cn("mt-5 rounded-md px-3 py-3 text-sm", variance > 0 ? "bg-amber-500/10 text-amber-800" : "bg-emerald-500/10 text-emerald-800")}>
          {loading ? "Calculating the day’s totals..." : outstanding.length
            ? `${totals(outstanding, "variance")} of expected daily fees remain uncollected. School-fee instalments are excluded from this variance.`
            : excess.length
              ? `Daily-fee payments exceed attendance-based expected fees by ${totals(excess.map((row) => ({ ...row, variance: Math.abs(Number(row.variance)) })), "variance")}. Review any collections for learners without a present or late mark.`
              : "Expected daily fees are fully collected or no daily fee was expected. School-fee instalments are reconciled separately."}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Expected daily fees include only students with a present or late attendance mark and an active daily-fee rule for the date. Payments are counted once, by their recorded fee category.</p>
      </article>
    </section>

    <section className="glass-panel mt-4 overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Verified collections</h2><p className="mt-1 text-xs text-muted-foreground">Daily-fee and school-fee collections recorded on the selected date.</p></div></div>
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading payment records...</p>
        : !data?.payments.length ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No verified payments were recorded on this date.</p>
          : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Category", "Receipt / clearance", "Amount", "Method", "Recorded at"].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-border/70">{data.payments.map((payment) => <tr key={payment.id}>
              <td className="px-5 py-3 font-medium">{payment.first_name} {payment.last_name}<p className="font-mono text-xs text-muted-foreground">{payment.admission_number}</p></td>
              <td className="px-5 py-3 capitalize">{payment.category.replaceAll("_", " ")}</td>
              <td className="px-5 py-3 font-mono text-xs">{payment.receipt_number ?? "Daily clearance"}</td>
              <td className="px-5 py-3">{money(Number(payment.amount), payment.currency)}</td>
              <td className="px-5 py-3 capitalize">{payment.method.replaceAll("_", " ")}</td>
              <td className="px-5 py-3">{new Date(payment.paid_at).toLocaleString()}</td>
            </tr>)}</tbody>
          </table></div>}
    </section>
  </div></SchoolShell>;
}

function money(value: number, currency: string) {
  return `${currency} ${value.toFixed(2)}`;
}

function totals(rows: CurrencyTotals[], field: "expected_daily" | "daily_received" | "school_fee_received" | "other_payments_received" | "total_received" | "variance") {
  return rows.length
    ? rows.map((row) => money(Number(row[field]), row.currency)).join(" · ")
    : "—";
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "warning" }) {
  return <article className={cn("glass-panel rounded-lg p-5", tone === "warning" && "ring-1 ring-amber-500/25")}><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={cn("mt-2 font-display text-2xl font-bold", tone === "warning" && "text-amber-700")}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></article>;
}
