import { createFileRoute } from "@tanstack/react-router";
import { Download, ReceiptText, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";
import { useTenantBranding } from "@/components/tenant-branding-provider";
import { downloadPaymentReceipt } from "@/lib/payment-receipt-pdf";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance — Klasora" }, { name: "description", content: "Record school and other fees, print receipts, and track learner balances." }] }),
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
  pending_amount: number | string;
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
type OtherFeePayment = Payment & {
  student_id: string;
  fee_description: string;
  class_name: string;
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

const schoolFeeTypes = new Set(["tuition", "pta"]);
const otherFeeTypes = new Set(["exam", "other"]);

function FinancePage() {
  const { schoolName, primaryColor } = useTenantBranding();
  const [fees, setFees] = useState<FeeRule[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [selectedOtherFeeId, setSelectedOtherFeeId] = useState("");
  const [balances, setBalances] = useState<FeeBalance[]>([]);
  const [otherBalances, setOtherBalances] = useState<FeeBalance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [otherPayments, setOtherPayments] = useState<OtherFeePayment[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [otherStudentId, setOtherStudentId] = useState("");
  const [otherAmount, setOtherAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [otherBalancesLoading, setOtherBalancesLoading] = useState(false);
  const [recordingStudent, setRecordingStudent] = useState("");
  const [recordingOtherFee, setRecordingOtherFee] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPayments = useCallback(async () => {
    const result = await schoolApi<{ payments: Payment[] }>("/api/school/payments");
    setPayments(result.payments);
  }, []);
  const loadOtherPayments = useCallback(async () => {
    const result = await schoolApi<{ payments: OtherFeePayment[] }>("/api/school/other-payments");
    setOtherPayments(result.payments);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void schoolApi<{ fees: FeeRule[] }>("/api/school/fees")
      .then((result) => {
        if (cancelled) return;
        const activeSchoolFees = result.fees.filter((fee) => fee.is_active && schoolFeeTypes.has(fee.fee_type));
        const activeOtherFees = result.fees.filter((fee) => fee.is_active && otherFeeTypes.has(fee.fee_type));
        setFees(result.fees);
        setSelectedFeeId((current) => current || activeSchoolFees[0]?.id || "");
        setSelectedOtherFeeId((current) => current || activeOtherFees[0]?.id || "");
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load fee rules");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    void loadPayments().catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load recorded payments");
    });
    void loadOtherPayments().catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load other-fee receipts");
    });
    return () => { cancelled = true; };
  }, [loadOtherPayments, loadPayments]);

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

  useEffect(() => {
    let cancelled = false;
    if (!selectedOtherFeeId) {
      setOtherBalances([]);
      setOtherStudentId("");
      setOtherBalancesLoading(false);
      return;
    }
    setOtherBalances([]);
    setOtherStudentId("");
    setOtherAmount("");
    setOtherBalancesLoading(true);
    void schoolApi<{ balances: FeeBalance[] }>(`/api/school/payments?fee_id=${encodeURIComponent(selectedOtherFeeId)}`)
      .then((result) => {
        if (cancelled) return;
        setOtherBalances(result.balances);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load other-fee balances");
      })
      .finally(() => { if (!cancelled) setOtherBalancesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedOtherFeeId]);

  const fee = fees.find((item) => item.id === selectedFeeId);
  const activeFees = fees.filter((item) => item.is_active && schoolFeeTypes.has(item.fee_type));
  const activeOtherFees = fees.filter((item) => item.is_active && otherFeeTypes.has(item.fee_type));
  const otherFee = activeOtherFees.find((item) => item.id === selectedOtherFeeId);
  const otherStudent = otherBalances.find((item) => item.student_id === otherStudentId);

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

  async function recordOtherFeePayment() {
    const amount = Number(otherAmount);
    if (!otherStudent || !selectedOtherFeeId || !Number.isFinite(amount) || amount <= 0 || amount > Number(otherStudent.balance_due)) {
      setError("Choose a learner and enter an amount within the remaining configured fee balance.");
      return;
    }
    setRecordingOtherFee(true);
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<{ payment: OtherFeePayment & { balance_due: number } }>("/api/school/other-payments", {
        method: "POST",
        body: JSON.stringify({ student_id: otherStudent.student_id, fee_id: selectedOtherFeeId, amount, method }),
      });
      const { balance_due, ...payment } = result.payment;
      setOtherPayments((current) => [payment, ...current.filter((item) => item.id !== payment.id)].slice(0, 200));
      setOtherBalances((current) => current.map((item) => item.student_id === otherStudent.student_id
        ? { ...item, pending_amount: Number(item.pending_amount) + amount, balance_due: Number(balance_due) }
        : item));
      setNotice(`Payment recorded. Receipt ${payment.receipt_number} is pending school-admin validation.`);
      setOtherAmount("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not record other-fee payment");
    } finally {
      setRecordingOtherFee(false);
    }
  }

  return <SchoolShell title="Finance" finance><div className="mx-auto max-w-6xl rise">
    <div>
      <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Wallet className="size-5" /></div>
      <h1 className="font-display text-3xl font-bold">Finance desk</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Record configured fee collections, print numbered receipts, and track remaining balances. Exam and other fee receipts require independent school-admin validation.</p>
    </div>

    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

    <section className="glass-panel mt-5 rounded-lg p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-bold">Other fee collection & receipts</h2><p className="mt-1 text-sm text-muted-foreground">Record a configured exam or other fee. The numbered receipt is printable immediately and clearly marked pending until an admin validates it.</p></div>
        <ReceiptText className="size-5 shrink-0 text-primary" />
      </div>
      {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading configured fees...</p>
        : activeOtherFees.length === 0 ? <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No active examination or other fee rules are configured. Ask a School Admin to configure them first.</p>
          : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-2">Configured fee
              <select value={selectedOtherFeeId} onChange={(event) => setSelectedOtherFeeId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {activeOtherFees.map((item) => <option key={item.id} value={item.id}>{item.class_name} · {item.description} · {item.academic_year_name}{item.term_name ? ` · ${item.term_name}` : ""} · {item.currency} {Number(item.amount).toFixed(2)}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-2">Learner
              <select value={otherStudentId} onChange={(event) => setOtherStudentId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="">Choose a learner</option>
                {!otherBalancesLoading && otherBalances.filter((item) => Number(item.balance_due) > 0).map((item) => <option key={item.student_id} value={item.student_id}>{item.first_name} {item.last_name} · {item.admission_number} · due {item.currency} {Number(item.balance_due).toFixed(2)}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Amount
              <input type="number" min="0.01" max={otherStudent?.balance_due ?? 0} step="0.01" value={otherAmount} onChange={(event) => setOtherAmount(event.target.value)} disabled={!otherStudent || recordingOtherFee} className="h-10 w-full rounded-md border border-input bg-background px-3 text-right text-sm text-foreground disabled:opacity-60" />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Payment method
              <select value={method} onChange={(event) => setMethod(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select>
            </label>
            <div className="flex items-end sm:col-span-2 lg:col-span-5">
              <Button disabled={!otherStudent || !otherAmount || recordingOtherFee} onClick={() => void recordOtherFeePayment()}>{recordingOtherFee ? "Recording..." : "Record & issue pending receipt"}</Button>
              {otherStudent && otherFee && <p className="ml-3 pb-2 text-xs text-muted-foreground">Remaining after pending collections: {otherStudent.currency} {Number(otherStudent.balance_due).toFixed(2)}{Number(otherStudent.pending_amount) > 0 ? ` · pending ${otherStudent.currency} ${Number(otherStudent.pending_amount).toFixed(2)}` : ""}</p>}
            </div>
          </div>}
    </section>

    <section className="glass-panel mt-5 overflow-hidden rounded-lg">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Other-fee receipts</h2><p className="mt-1 text-xs text-muted-foreground">Download or print the numbered receipt; its status shows whether an admin has validated the collection.</p></div><Download className="size-5 text-primary" /></div>
      {otherPayments.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No examination or other-fee payments have been recorded yet.</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Fee", "Receipt", "Amount", "Method", "Status", "Received", ""].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-border/70">{otherPayments.map((payment) => <tr key={payment.id}>
            <td className="px-4 py-3 font-medium">{payment.first_name} {payment.last_name}<p className="font-mono text-xs text-muted-foreground">{payment.admission_number} · {payment.class_name}</p></td>
            <td className="px-4 py-3">{payment.fee_description}</td>
            <td className="px-4 py-3 font-mono text-xs">{payment.receipt_number ?? "—"}</td>
            <td className="px-4 py-3">{payment.currency} {Number(payment.amount).toFixed(2)}</td>
            <td className="px-4 py-3 capitalize">{payment.method.replaceAll("_", " ")}</td>
            <td className="px-4 py-3"><span className={payment.status === "verified" ? "text-emerald-700" : payment.status === "voided" ? "text-destructive" : "text-amber-700"}>{payment.status === "verified" ? "Validated" : payment.status === "voided" ? "Rejected" : "Pending validation"}</span>{payment.rejection_reason && <p className="max-w-48 text-xs text-muted-foreground">{payment.rejection_reason}</p>}</td>
            <td className="px-4 py-3">{new Date(payment.paid_at).toLocaleString()}</td>
            <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => downloadPaymentReceipt({
              schoolName,
              primaryColor,
              receiptNumber: payment.receipt_number ?? payment.id,
              studentName: `${payment.first_name} ${payment.last_name}`,
              admissionNumber: payment.admission_number,
              className: payment.class_name,
              feeDescription: payment.fee_description,
              amount: Number(payment.amount),
              currency: payment.currency,
              method: payment.method,
              paidAt: payment.paid_at,
              status: payment.status,
            })}><Download className="mr-2 size-4" />Download receipt</Button></td>
          </tr>)}</tbody>
        </table></div>}
    </section>

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
