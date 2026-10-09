import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CreditCard, ReceiptText, XCircle } from "lucide-react";
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

type OtherFeePayment = Payment & {
  fee_description: string;
  class_name: string;
  recorded_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
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

function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [otherPayments, setOtherPayments] = useState<OtherFeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadPayments() {
      try {
        const [paymentResult, otherPaymentResult] = await Promise.all([
          schoolApi<{ payments: Payment[] }>("/api/school/payments"),
          schoolApi<{ payments: OtherFeePayment[] }>("/api/school/other-payments"),
        ]);
        if (!cancelled) {
          setPayments(paymentResult.payments);
          setOtherPayments(otherPaymentResult.payments);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load recorded payments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPayments();
    return () => { cancelled = true; };
  }, []);

  async function reviewPayment(payment: OtherFeePayment, action: "approve" | "reject") {
    const reason = action === "reject"
      ? window.prompt(`Why are you rejecting receipt ${payment.receipt_number}?`)
      : null;
    if (action === "reject" && reason === null) return;
    if (action === "reject" && !reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setReviewingId(payment.id);
    setError("");
    try {
      await schoolApi(`/api/school/payments/${payment.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...(action === "reject" ? { reason } : {}) }),
      });
      const result = await schoolApi<{ payments: OtherFeePayment[] }>("/api/school/other-payments");
      setOtherPayments(result.payments);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review payment");
    } finally {
      setReviewingId("");
    }
  }

  return <SchoolShell title="Payments" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><CreditCard className="size-5" /></div><h1 className="font-display text-3xl font-bold">Payments & controls</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Configure class fees and review payment records saved for this school.</p></div>
    <SchoolFeeRules />
    <section className="glass-panel mt-5 overflow-hidden rounded-lg"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Recorded payments</h2><p className="mt-1 text-xs text-muted-foreground">Latest recorded school payments.</p></div><ReceiptText className="size-5 text-primary" /></div>
      {error && <p role="alert" className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading payments...</p> : payments.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No payments have been recorded for this school yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Admission no.", "Category", "Amount", "Method", "Status", "Paid at"].map((label) => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{payments.map((payment) => <tr key={payment.id}><td className="px-5 py-3 font-medium">{payment.first_name} {payment.last_name}</td><td className="px-5 py-3 font-mono text-xs">{payment.admission_number}</td><td className="px-5 py-3 capitalize">{payment.category.replaceAll("_", " ")}</td><td className="px-5 py-3">{payment.currency} {Number(payment.amount).toFixed(2)}</td><td className="px-5 py-3 capitalize">{payment.method.replaceAll("_", " ")}</td><td className="px-5 py-3 capitalize">{payment.status}</td><td className="px-5 py-3">{new Date(payment.paid_at).toLocaleString()}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="glass-panel mt-5 overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Exam & other fee validation</h2><p className="mt-1 text-xs text-muted-foreground">Check cash counts or payment evidence before approval. The person who recorded a payment cannot approve it.</p></div><ReceiptText className="size-5 text-primary" /></div>
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading review queue...</p>
        : otherPayments.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No configured exam or other fee receipts have been recorded.</p>
          : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Fee", "Receipt", "Amount", "Recorded by", "Status / review", "Action"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-border/70">{otherPayments.map((payment) => <tr key={payment.id}>
              <td className="px-4 py-3 font-medium">{payment.first_name} {payment.last_name}<p className="font-mono text-xs text-muted-foreground">{payment.admission_number} · {payment.class_name}</p></td>
              <td className="px-4 py-3">{payment.fee_description}</td>
              <td className="px-4 py-3 font-mono text-xs">{payment.receipt_number ?? "—"}</td>
              <td className="px-4 py-3">{payment.currency} {Number(payment.amount).toFixed(2)}<p className="text-xs capitalize text-muted-foreground">{payment.method.replaceAll("_", " ")}</p></td>
              <td className="px-4 py-3">{payment.recorded_by ?? "Staff account"}</td>
              <td className="px-4 py-3 capitalize">{payment.status}{payment.reviewed_by && <p className="text-xs text-muted-foreground">{payment.reviewed_by} · {payment.reviewed_at ? new Date(payment.reviewed_at).toLocaleString() : ""}</p>}{payment.rejection_reason && <p className="max-w-48 text-xs text-destructive">{payment.rejection_reason}</p>}</td>
              <td className="px-4 py-3">{payment.status === "pending" ? <div className="flex gap-2">
                <Button size="sm" disabled={reviewingId !== ""} onClick={() => void reviewPayment(payment, "approve")}><CheckCircle2 className="mr-1 size-4" />{reviewingId === payment.id ? "Saving..." : "Approve"}</Button>
                <Button size="sm" variant="outline" disabled={reviewingId !== ""} onClick={() => void reviewPayment(payment, "reject")}><XCircle className="mr-1 size-4" />Reject</Button>
              </div> : "—"}</td>
            </tr>)}</tbody>
          </table></div>}
    </section>
  </div></SchoolShell>;
}
