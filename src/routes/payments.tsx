import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { SchoolFeeRules } from "@/components/school-fee-rules";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "Payments — Klasora" }, { name: "description", content: "Manage class fee rules and review recorded payments." }] }),
  component: PaymentsPage,
});

type Payment = {
  id: string;
  receipt_number: string | null;
  amount: number | string;
  currency: string;
  category: string;
  method: string;
  status: string;
  paid_at: string;
  first_name: string;
  last_name: string;
  admission_number: string;
};

function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadPayments() {
      try {
        const token = await getNeonAccessToken();
        const url = new URL("/api/school/payments", window.location.origin);
        const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
        if (tenant) url.searchParams.set("tenant", tenant);
        const response = await fetch(`${url.pathname}${url.search}`, { headers: { authorization: `Bearer ${token}` } });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Could not load recorded payments";
          throw new Error(message);
        }
        if (!cancelled) setPayments((payload as { payments: Payment[] }).payments);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load recorded payments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPayments();
    return () => { cancelled = true; };
  }, []);

  return <SchoolShell title="Payments" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><CreditCard className="size-5" /></div><h1 className="font-display text-3xl font-bold">Payments & controls</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Configure class fees and review payment records saved for this school.</p></div>
    <SchoolFeeRules />
    <section className="glass-panel mt-5 overflow-hidden rounded-lg"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Recorded payments</h2><p className="mt-1 text-xs text-muted-foreground">Latest recorded school payments.</p></div><ReceiptText className="size-5 text-primary" /></div>
      {error && <p role="alert" className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading payments...</p> : payments.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No payments have been recorded for this school yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Admission no.", "Category", "Amount", "Method", "Status", "Paid at"].map((label) => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{payments.map((payment) => <tr key={payment.id}><td className="px-5 py-3 font-medium">{payment.first_name} {payment.last_name}</td><td className="px-5 py-3 font-mono text-xs">{payment.admission_number}</td><td className="px-5 py-3 capitalize">{payment.category.replaceAll("_", " ")}</td><td className="px-5 py-3">{payment.currency} {Number(payment.amount).toFixed(2)}</td><td className="px-5 py-3 capitalize">{payment.method.replaceAll("_", " ")}</td><td className="px-5 py-3 capitalize">{payment.status}</td><td className="px-5 py-3">{new Date(payment.paid_at).toLocaleString()}</td></tr>)}</tbody></table></div>}
    </section>
  </div></SchoolShell>;
}
