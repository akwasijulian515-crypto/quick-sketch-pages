import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance — Klasora" }, { name: "description", content: "Record school-fee payments and review learner balances." }] }),
  component: FinancePage,
});

type FeeRule = {
  id: string;
  class_name: string;
  academic_year_name: string;
  term_name: string | null;
  fee_type: string;
  description: string;
  amount: number | string;
  currency: string;
  is_active: boolean;
};
type FeeBalance = {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_name: string;
  original_amount: number | string;
  paid_amount: number | string;
  balance_due: number | string;
  currency: string;
};
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

const schoolFeeTypes = new Set(["tuition", "pta", "exam", "other"]);

function FinancePage() {
  const [fees, setFees] = useState<FeeRule[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [balances, setBalances] = useState<FeeBalance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [recordingStudent, setRecordingStudent] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPayments = useCallback(async () => {
    const result = await schoolApi<{ payments: Payment[] }>("/api/school/payments");
    setPayments(result.payments);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void schoolApi<{ fees: FeeRule[] }>("/api/school/fees")
      .then((result) => {
        if (cancelled) return;
        const activeSchoolFees = result.fees.filter((fee) => fee.is_active && schoolFeeTypes.has(fee.fee_type));
        setFees(result.fees);
        setSelectedFeeId((current) => current || activeSchoolFees[0]?.id || "");
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load fee rules");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    void loadPayments().catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load recorded payments");
    });
    return () => { cancelled = true; };
  }, [loadPayments]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedFeeId) {
      setBalances([]);
      return;
    }
    setBalancesLoading(true);
    void schoolApi<{ balances: FeeBalance[] }>(`/api/school/payments?fee_id=${encodeURIComponent(selectedFeeId)}`)
      .then((result) => { if (!cancelled) setBalances(result.balances); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load student balances");
      })
      .finally(() => { if (!cancelled) setBalancesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedFeeId]);

  const fee = fees.find((item) => item.id === selectedFeeId);
  const activeFees = fees.filter((item) => item.is_active && schoolFeeTypes.has(item.fee_type));

  async function recordPayment(student: FeeBalance) {
    const amount = Number(amounts[student.student_id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    setRecordingStudent(student.student_id);
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<{ balance_due: number; payment: { receipt_number: string } }>("/api/school/payments", {
        method: "POST",
        body: JSON.stringify({ student_id: student.student_id, fee_id: selectedFeeId, amount, method }),
      });
      setNotice(`Payment recorded. Remaining balance: ${student.currency} ${result.balance_due.toFixed(2)}. Receipt ${result.payment.receipt_number}.`);
      setAmounts((current) => ({ ...current, [student.student_id]: "" }));
      const [balanceResult] = await Promise.all([
        schoolApi<{ balances: FeeBalance[] }>(`/api/school/payments?fee_id=${encodeURIComponent(selectedFeeId)}`),
        loadPayments(),
      ]);
      setBalances(balanceResult.balances);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not record payment");
    } finally {
      setRecordingStudent("");
    }
  }

  return <SchoolShell title="Finance" finance><div className="mx-auto max-w-6xl rise">
    <div>
      <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Wallet className="size-5" /></div>
      <h1 className="font-display text-3xl font-bold">Finance desk</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Record school-fee instalments against the configured class fee and track each learner’s remaining balance.</p>
    </div>

    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

    <section className="glass-panel mt-5 rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="w-full space-y-1 text-xs font-medium text-muted-foreground sm:max-w-2xl">School fee · class · academic period
          <select value={selectedFeeId} onChange={(event) => setSelectedFeeId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
            <option value="">Select a configured school fee</option>
            {activeFees.map((item) => <option key={item.id} value={item.id}>{item.class_name} · {item.description} · {item.academic_year_name}{item.term_name ? ` · ${item.term_name}` : ""} · {item.currency} {Number(item.amount).toFixed(2)}</option>)}
          </select>
        </label>
        {fee && <p className="text-sm text-muted-foreground">Original fee: <strong className="text-foreground">{fee.currency} {Number(fee.amount).toFixed(2)}</strong></p>}
      </div>
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading school fee rules...</p>
        : activeFees.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No active tuition, PTA, examination, or other school-fee rules are configured. Ask the School Admin to set up the fee schedule first.</p>
          : balancesLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading student balances...</p>
            : balances.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No active students are currently enrolled in this fee’s class.</p>
              : <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Original fee", "Paid to date", "Remaining", "Payment amount", "Method", ""].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-border/70">{balances.map((student) => {
                    const remaining = Number(student.balance_due);
                    return <tr key={student.student_id}>
                      <td className="px-4 py-3"><p className="font-medium">{student.first_name} {student.last_name}</p><p className="font-mono text-xs text-muted-foreground">{student.admission_number} · {student.class_name}</p></td>
                      <td className="px-4 py-3">{student.currency} {Number(student.original_amount).toFixed(2)}</td>
                      <td className="px-4 py-3">{student.currency} {Number(student.paid_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 font-semibold">{student.currency} {remaining.toFixed(2)}</td>
                      <td className="px-4 py-3"><input aria-label={`Payment amount for ${student.first_name} ${student.last_name}`} type="number" min="0.01" max={remaining} step="0.01" value={amounts[student.student_id] ?? ""} onChange={(event) => setAmounts((current) => ({ ...current, [student.student_id]: event.target.value }))} disabled={remaining <= 0 || recordingStudent !== ""} className="h-9 w-32 rounded-md border border-input bg-background px-2 text-right disabled:opacity-60" /></td>
                      <td className="px-4 py-3"><select aria-label="Payment method" value={method} onChange={(event) => setMethod(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select></td>
                      <td className="px-4 py-3"><Button size="sm" disabled={remaining <= 0 || recordingStudent !== "" || !amounts[student.student_id]} onClick={() => void recordPayment(student)}>{recordingStudent === student.student_id ? "Recording..." : remaining <= 0 ? "Paid" : "Record payment"}</Button></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>}
    </section>

    <section className="glass-panel mt-5 overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Recent school payments</h2><p className="mt-1 text-xs text-muted-foreground">Recorded school-fee payments appear in Daily Reconciliation.</p></div><ReceiptText className="size-5 text-primary" /></div>
      {payments.filter((payment) => payment.category === "school_fee").length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No school-fee payments have been recorded yet.</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Receipt", "Amount", "Method", "Paid at"].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{payments.filter((payment) => payment.category === "school_fee").slice(0, 30).map((payment) => <tr key={payment.id}><td className="px-5 py-3 font-medium">{payment.first_name} {payment.last_name}<p className="font-mono text-xs text-muted-foreground">{payment.admission_number}</p></td><td className="px-5 py-3 font-mono text-xs">{payment.receipt_number ?? "—"}</td><td className="px-5 py-3">{payment.currency} {Number(payment.amount).toFixed(2)}</td><td className="px-5 py-3 capitalize">{payment.method.replaceAll("_", " ")}</td><td className="px-5 py-3">{new Date(payment.paid_at).toLocaleString()}</td></tr>)}</tbody></table></div>}
    </section>
  </div></SchoolShell>;
}
