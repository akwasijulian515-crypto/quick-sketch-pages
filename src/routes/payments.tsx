import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CreditCard, Download, ReceiptText, Wallet, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { SchoolFeeRules } from "@/components/school-fee-rules";
import { SchoolShell } from "@/components/school-shell";
import { useTenantBranding } from "@/components/tenant-branding-provider";
import { Button } from "@/components/ui/button";
import { downloadPaymentReceipt } from "@/lib/payment-receipt-pdf";

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
  fee_description: string | null;
  class_name: string | null;
  balance_due?: number | string | null;
  first_name: string;
  last_name: string;
  admission_number: string;
};

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

type OtherFeePayment = Payment & {
  fee_description: string;
  class_name: string;
  recorded_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
};

type ReviewTab = "pending" | "verified" | "rejected";

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
  const { schoolName, primaryColor } = useTenantBranding();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [otherPayments, setOtherPayments] = useState<OtherFeePayment[]>([]);
  const [schoolFees, setSchoolFees] = useState<FeeRule[]>([]);
  const [selectedSchoolFeeId, setSelectedSchoolFeeId] = useState("");
  const [feeBalances, setFeeBalances] = useState<FeeBalance[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(true);
  const [feeBalancesLoading, setFeeBalancesLoading] = useState(false);
  const [recordingSchoolFee, setRecordingSchoolFee] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("pending");
  const [error, setError] = useState("");
  const [schoolFeeError, setSchoolFeeError] = useState("");
  const [notice, setNotice] = useState("");
  const [newReceipt, setNewReceipt] = useState<{
    receiptNumber: string;
    studentName: string;
    admissionNumber: string;
    className: string;
    feeDescription: string;
    amount: number;
    balanceDue: number;
    currency: string;
    paidAt: string;
    method: string;
    status: string;
  } | null>(null);
  const pendingOtherPayments = otherPayments.filter((payment) => payment.status === "pending");
  const verifiedOtherPayments = otherPayments.filter((payment) => payment.status === "verified");
  const rejectedOtherPayments = otherPayments.filter((payment) => payment.status === "voided");
  const visibleReviewPayments = reviewTab === "pending"
    ? pendingOtherPayments
    : reviewTab === "verified"
      ? verifiedOtherPayments
      : rejectedOtherPayments;
  const fee = schoolFees.find((item) => item.id === selectedSchoolFeeId);
  const student = feeBalances.find((item) => item.student_id === selectedStudentId);

  async function refreshPayments() {
    const result = await schoolApi<{ payments: Payment[] }>("/api/school/payments");
    setPayments(result.payments);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadPayments() {
      try {
        const [paymentResult, otherPaymentResult, feeResult] = await Promise.all([
          schoolApi<{ payments: Payment[] }>("/api/school/payments"),
          schoolApi<{ payments: OtherFeePayment[] }>("/api/school/other-payments"),
          schoolApi<{ fees: FeeRule[] }>("/api/school/fees"),
        ]);
        if (!cancelled) {
          setPayments(paymentResult.payments);
          setOtherPayments(otherPaymentResult.payments);
          const activeFees = feeResult.fees.filter((item) => item.is_active && ["tuition", "pta"].includes(item.fee_type));
          setSchoolFees(activeFees);
          setSelectedSchoolFeeId((current) => current || activeFees[0]?.id || "");
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

  useEffect(() => {
    let cancelled = false;
    setSelectedStudentId("");
    setAmount("");
    setFeeBalances([]);
    if (!selectedSchoolFeeId) {
      setFeeBalancesLoading(false);
      return;
    }
    setFeeBalancesLoading(true);
    void schoolApi<{ balances: FeeBalance[] }>(`/api/school/payments?fee_id=${encodeURIComponent(selectedSchoolFeeId)}`)
      .then((result) => { if (!cancelled) setFeeBalances(result.balances); })
      .catch((loadError) => {
        if (!cancelled) setSchoolFeeError(loadError instanceof Error ? loadError.message : "Could not load fee balances");
      })
      .finally(() => { if (!cancelled) setFeeBalancesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSchoolFeeId]);

  async function recordSchoolFeePayment() {
    const paymentAmount = Number(amount);
    if (!fee || !student || !Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > Number(student.balance_due)) {
      setSchoolFeeError("Choose a learner and enter an amount within the remaining school-fee balance.");
      return;
    }
    setRecordingSchoolFee(true);
    setSchoolFeeError("");
    setNotice("");
    setNewReceipt(null);
    try {
      const result = await schoolApi<{
        payment: { receipt_number: string; paid_at: string; status: string };
        balance_due: number;
      }>("/api/school/payments", {
        method: "POST",
        body: JSON.stringify({ student_id: student.student_id, fee_id: selectedSchoolFeeId, amount: paymentAmount, method }),
      });
      setNewReceipt({
        receiptNumber: result.payment.receipt_number,
        studentName: `${student.first_name} ${student.last_name}`,
        admissionNumber: student.admission_number,
        className: student.class_name,
        feeDescription: fee.description,
        amount: paymentAmount,
        currency: student.currency,
        paidAt: result.payment.paid_at,
        method,
        status: result.payment.status,
        balanceDue: Number(result.balance_due),
      });
      setNotice(result.payment.status === "verified"
        ? `Payment recorded and verified. Receipt ${result.payment.receipt_number} is ready to download.`
        : `Payment recorded as pending validation. Receipt ${result.payment.receipt_number} is ready to download.`);
      setSelectedStudentId("");
      setAmount("");
      try {
        const [balanceResult] = await Promise.all([
          schoolApi<{ balances: FeeBalance[] }>(`/api/school/payments?fee_id=${encodeURIComponent(selectedSchoolFeeId)}`),
          refreshPayments(),
          schoolApi<{ payments: OtherFeePayment[] }>("/api/school/other-payments").then((pendingResult) => setOtherPayments(pendingResult.payments)),
        ]);
        setFeeBalances(balanceResult.balances);
      } catch (refreshError) {
        setSchoolFeeError(`Payment was recorded, but the lists could not refresh: ${refreshError instanceof Error ? refreshError.message : "Refresh failed"}`);
      }
    } catch (saveError) {
      setSchoolFeeError(saveError instanceof Error ? saveError.message : "Could not record school-fee payment");
    } finally {
      setRecordingSchoolFee(false);
    }
  }

  function downloadNewReceipt() {
    if (!newReceipt) return;
    downloadPaymentReceipt({
      schoolName,
      primaryColor,
      ...newReceipt,
      feeCategory: "school_fee",
    });
  }

  function downloadExistingReceipt(payment: Payment) {
    downloadPaymentReceipt({
      schoolName,
      primaryColor,
      receiptNumber: payment.receipt_number ?? payment.id,
      studentName: `${payment.first_name} ${payment.last_name}`,
      admissionNumber: payment.admission_number,
      className: payment.class_name ?? "—",
      feeDescription: payment.fee_description ?? "School fee",
      amount: Number(payment.amount),
      currency: payment.currency,
      method: payment.method,
      paidAt: payment.paid_at,
      status: payment.status,
      feeCategory: "school_fee",
      balanceDue: payment.balance_due == null ? undefined : Number(payment.balance_due),
    });
  }

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
      try {
        const [reviewResult, paymentResult] = await Promise.all([
          schoolApi<{ payments: OtherFeePayment[] }>("/api/school/other-payments"),
          schoolApi<{ payments: Payment[] }>("/api/school/payments"),
        ]);
        setOtherPayments(reviewResult.payments);
        setPayments(paymentResult.payments);
      } catch (refreshError) {
        setError(`Payment was reviewed, but the lists could not refresh: ${refreshError instanceof Error ? refreshError.message : "Refresh failed"}`);
      }
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review payment");
    } finally {
      setReviewingId("");
    }
  }

  function downloadReviewReceipt(payment: OtherFeePayment) {
    downloadPaymentReceipt({
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
      feeCategory: payment.category === "school_fee" ? "school_fee" : "other_fee",
      balanceDue: payment.balance_due == null ? undefined : Number(payment.balance_due),
    });
  }

  return <SchoolShell title="Payments" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><CreditCard className="size-5" /></div><h1 className="font-display text-3xl font-bold">Payments & controls</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Record school-fee collections, validate Finance receipts independently, and manage this school’s fee rules.</p></div>
    <section className="glass-panel mt-5 overflow-hidden rounded-lg border-amber-600/30">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Payment validation</h2><p className="mt-1 text-xs text-muted-foreground">Validate school, exam, or other-fee receipts. A different school admin must review the payment; the recorder cannot approve their own receipt.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">{pendingOtherPayments.length} pending</span></div>
      <div role="tablist" aria-label="Payment review status" className="flex gap-2 border-b border-border px-5 py-3">
        {([
          ["pending", "Pending", pendingOtherPayments.length],
          ["verified", "Verified", verifiedOtherPayments.length],
          ["rejected", "Rejected", rejectedOtherPayments.length],
        ] as const).map(([tab, label, count]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={reviewTab === tab}
            onClick={() => setReviewTab(tab)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${reviewTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {label} <span className="ml-1 opacity-80">({count})</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading review queue...</p>
        : visibleReviewPayments.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">{reviewTab === "pending" ? "No payments need verification right now." : `No ${reviewTab} payments.`}</p>
          : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Fee type", "Fee", "Receipt", "Amount", "Recorded by", "Status / review", "Action"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-border/70">{visibleReviewPayments.map((payment) => <tr key={payment.id} className={payment.status === "pending" ? "bg-amber-50/40" : ""}>
              <td className="px-4 py-3 font-medium">{payment.first_name} {payment.last_name}<p className="font-mono text-xs text-muted-foreground">{payment.admission_number} · {payment.class_name}</p></td>
              <td className="px-4 py-3 capitalize">{payment.category.replaceAll("_", " ")}</td>
              <td className="px-4 py-3">{payment.fee_description}</td>
              <td className="px-4 py-3 font-mono text-xs">{payment.receipt_number ?? "—"}</td>
              <td className="px-4 py-3">{payment.currency} {Number(payment.amount).toFixed(2)}<p className="text-xs capitalize text-muted-foreground">{payment.method.replaceAll("_", " ")}</p></td>
              <td className="px-4 py-3">{payment.recorded_by ?? "Staff account"}</td>
              <td className="px-4 py-3 capitalize">{payment.status}{payment.reviewed_by && <p className="text-xs text-muted-foreground">{payment.reviewed_by} · {payment.reviewed_at ? new Date(payment.reviewed_at).toLocaleString() : ""}</p>}{payment.rejection_reason && <p className="max-w-48 text-xs text-destructive">{payment.rejection_reason}</p>}</td>
              <td className="px-4 py-3"><div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadReviewReceipt(payment)}><Download className="mr-1 size-4" />Receipt</Button>
                {payment.status === "pending" && <>
                  <Button size="sm" disabled={reviewingId !== ""} onClick={() => void reviewPayment(payment, "approve")}><CheckCircle2 className="mr-1 size-4" />{reviewingId === payment.id ? "Saving..." : "Approve"}</Button>
                  <Button size="sm" variant="outline" disabled={reviewingId !== ""} onClick={() => void reviewPayment(payment, "reject")}><XCircle className="mr-1 size-4" />Reject</Button>
                </>}
              </div></td>
            </tr>)}</tbody>
          </table></div>}
    </section>
    <section className="glass-panel mt-5 rounded-lg p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 className="font-display text-lg font-bold">Record school-fee payment</h2><p className="mt-1 text-sm text-muted-foreground">Payments recorded by a school administrator are verified immediately. Finance-recorded payments remain pending until independently validated. The receipt shows the remaining balance.</p></div>
            <Wallet className="size-5 shrink-0 text-primary" />
          </div>
          {schoolFees.length === 0 ? <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No active tuition or PTA fee rules are configured. Create one below before recording a school-fee payment.</p>
            : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">Configured school fee
                <select value={selectedSchoolFeeId} onChange={(event) => setSelectedSchoolFeeId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  {schoolFees.map((item) => <option key={item.id} value={item.id}>{item.class_name} · {item.description} · {item.academic_year_name}{item.term_name ? ` · ${item.term_name}` : ""} · ${item.currency} ${Number(item.amount).toFixed(2)}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">Learner
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} disabled={feeBalancesLoading} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  <option value="">{feeBalancesLoading ? "Loading learners..." : "Choose a learner"}</option>
                  {feeBalances.filter((item) => Number(item.balance_due) > 0).map((item) => <option key={item.student_id} value={item.student_id}>{item.first_name} {item.last_name} · {item.admission_number} · due {item.currency} {Number(item.balance_due).toFixed(2)}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">Amount
                <input type="number" min="0.01" max={student?.balance_due ?? 0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!student || recordingSchoolFee} className="h-10 w-full rounded-md border border-input bg-background px-3 text-right text-sm text-foreground disabled:opacity-60" />
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">Payment method
                <select value={method} onChange={(event) => setMethod(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select>
              </label>
              <div className="flex items-end sm:col-span-2 lg:col-span-5">
                <Button disabled={!student || !amount || Number(amount) > Number(student?.balance_due ?? 0) || recordingSchoolFee} onClick={() => void recordSchoolFeePayment()}>{recordingSchoolFee ? "Recording..." : "Record school-fee payment"}</Button>
                {student && <p className="ml-3 pb-2 text-xs text-muted-foreground">Remaining after payment: {student.currency} {Math.max(0, Number(student.balance_due) - (Number(amount) || 0)).toFixed(2)}</p>}
              </div>
            </div>}
      {!feeBalancesLoading && selectedSchoolFeeId && feeBalances.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No active learners are enrolled in the selected fee’s class.</p>}
      {feeBalances.length > 0 && <div className="mt-5">
        <h3 className="mb-3 text-sm font-semibold">Learner balances <span className="font-normal text-muted-foreground">· select a tile to record payment</span></h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {feeBalances.map((learner) => {
            const remaining = Number(learner.balance_due);
            const selected = learner.student_id === selectedStudentId;
            const settled = remaining <= 0;
            return <button
              key={learner.student_id}
              type="button"
              onClick={() => {
                setSelectedStudentId(learner.student_id);
                setAmount("");
              }}
              className={`rounded-lg border p-4 text-left shadow-sm transition-colors ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-background/60 hover:border-primary/40"} ${settled ? "opacity-80" : ""}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{learner.first_name} {learner.last_name}</span>
                  <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{learner.admission_number} · {learner.class_name}</span>
                </span>
                <span className={settled ? "shrink-0 rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-medium text-emerald-700" : "shrink-0 rounded-full bg-amber-600/10 px-2.5 py-1 text-xs font-medium text-amber-800"}>{settled ? "Paid" : "Balance due"}</span>
              </span>
              <span className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs sm:grid-cols-4">
                <span><span className="block text-muted-foreground">Original</span><span className="mt-1 block font-medium">{learner.currency} {Number(learner.original_amount).toFixed(2)}</span></span>
                <span><span className="block text-muted-foreground">Paid</span><span className="mt-1 block font-medium">{learner.currency} {Number(learner.paid_amount).toFixed(2)}</span></span>
                <span><span className="block text-muted-foreground">Pending</span><span className="mt-1 block font-medium">{learner.currency} {Number(learner.pending_amount).toFixed(2)}</span></span>
                <span><span className="block text-muted-foreground">Remaining</span><span className="mt-1 block font-semibold">{learner.currency} {remaining.toFixed(2)}</span></span>
              </span>
            </button>;
          })}
        </div>
      </div>}
          {schoolFeeError && <p role="alert" className="mt-3 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{schoolFeeError}</p>}
          {notice && <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800"><span>{notice}</span>{newReceipt && <Button size="sm" variant="outline" onClick={downloadNewReceipt}><Download className="mr-2 size-4" />Download receipt PDF</Button>}</div>}
    </section>
    <SchoolFeeRules />
    <section className="glass-panel mt-5 overflow-hidden rounded-lg"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Recorded payments</h2><p className="mt-1 text-xs text-muted-foreground">Latest verified school payments. Download a receipt again whenever needed.</p></div><ReceiptText className="size-5 text-primary" /></div>
          {error && <p role="alert" className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
          {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading payments...</p> : payments.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No payments have been recorded for this school yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Admission no.", "Fee", "Category", "Amount", "Method", "Status", "Paid at", ""].map((label) => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{payments.map((payment) => <tr key={payment.id}><td className="px-5 py-3 font-medium">{payment.first_name} {payment.last_name}</td><td className="px-5 py-3 font-mono text-xs">{payment.admission_number}</td><td className="px-5 py-3">{payment.fee_description ?? "—"}{payment.class_name && <p className="text-xs text-muted-foreground">{payment.class_name}</p>}</td><td className="px-5 py-3 capitalize">{payment.category.replaceAll("_", " ")}</td><td className="px-5 py-3">{payment.currency} {Number(payment.amount).toFixed(2)}</td><td className="px-5 py-3 capitalize">{payment.method.replaceAll("_", " ")}</td><td className="px-5 py-3 capitalize">{payment.status}</td><td className="px-5 py-3">{new Date(payment.paid_at).toLocaleString()}</td><td className="px-5 py-3">{payment.category === "school_fee" && payment.status === "verified" && <Button size="sm" variant="outline" onClick={() => downloadExistingReceipt(payment)}><Download className="mr-2 size-4" />Receipt</Button>}</td></tr>)}</tbody></table></div>}
    </section>
  </div></SchoolShell>;
}
