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
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  fee_description: string | null;
  class_name: string | null;
  balance_due?: number | string | null;
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
  const [collectionFeeId, setCollectionFeeId] = useState("");
  const [collectionBalances, setCollectionBalances] = useState<FeeBalance[]>([]);
  const [collectionStudentId, setCollectionStudentId] = useState("");
  const [collectionAmount, setCollectionAmount] = useState("");
  const [balances, setBalances] = useState<FeeBalance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [otherPayments, setOtherPayments] = useState<OtherFeePayment[]>([]);
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [collectionBalancesLoading, setCollectionBalancesLoading] = useState(false);
  const [recordingCollection, setRecordingCollection] = useState(false);
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
        const activeCollectionFees = result.fees.filter((fee) => fee.is_active && (schoolFeeTypes.has(fee.fee_type) || otherFeeTypes.has(fee.fee_type)));
        setFees(result.fees);
        setSelectedFeeId((current) => current || activeSchoolFees[0]?.id || "");
        setCollectionFeeId((current) => current || activeCollectionFees[0]?.id || "");
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
    setCollectionStudentId("");
    setCollectionAmount("");
    setCollectionBalances([]);
    if (!collectionFeeId) {
      setCollectionBalancesLoading(false);
      return;
    }
    setCollectionBalancesLoading(true);
    void schoolApi<{ balances: FeeBalance[] }>(`/api/school/payments?fee_id=${encodeURIComponent(collectionFeeId)}`)
      .then((result) => { if (!cancelled) setCollectionBalances(result.balances); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load learner balances");
      })
      .finally(() => { if (!cancelled) setCollectionBalancesLoading(false); });
    return () => { cancelled = true; };
  }, [collectionFeeId]);

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
  const collectionFee = fees.find((item) => item.id === collectionFeeId);
  const activeFees = fees.filter((item) => item.is_active && schoolFeeTypes.has(item.fee_type));
  const activeCollectionFees = fees.filter((item) => item.is_active && (schoolFeeTypes.has(item.fee_type) || otherFeeTypes.has(item.fee_type)));
  const collectionStudent = collectionBalances.find((item) => item.student_id === collectionStudentId);
  const collectionIsOtherFee = collectionFee ? otherFeeTypes.has(collectionFee.fee_type) : false;
  async function recordPayment() {
    const amount = Number(collectionAmount);
    if (!collectionFee || !collectionStudent || !Number.isFinite(amount) || amount <= 0 || amount > Number(collectionStudent.balance_due)) {
      setError("Choose a learner and enter an amount within the remaining fee balance.");
      return;
    }
    setRecordingCollection(true);
    setError("");
    setNotice("");
    try {
      if (collectionIsOtherFee) {
        const result = await schoolApi<{ payment: OtherFeePayment & { balance_due: number } }>("/api/school/other-payments", {
          method: "POST",
          body: JSON.stringify({ student_id: collectionStudent.student_id, fee_id: collectionFeeId, amount, method }),
        });
        const { balance_due, ...payment } = result.payment;
        setOtherPayments((current) => [payment, ...current.filter((item) => item.id !== payment.id)].slice(0, 200));
        setCollectionBalances((current) => current.map((item) => item.student_id === collectionStudent.student_id
          ? { ...item, pending_amount: Number(item.pending_amount) + amount, balance_due: Number(balance_due) }
          : item));
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
          feeCategory: "other_fee",
          balanceDue: Number(balance_due),
        });
        setNotice(`Pending receipt ${payment.receipt_number} downloaded. School-admin validation is required.`);
      } else {
        const result = await schoolApi<{ balance_due: number; payment: { receipt_number: string } }>("/api/school/payments", {
          method: "POST",
          body: JSON.stringify({ student_id: collectionStudent.student_id, fee_id: collectionFeeId, amount, method }),
        });
        downloadPaymentReceipt({
          schoolName,
          primaryColor,
          receiptNumber: result.payment.receipt_number,
          studentName: `${collectionStudent.first_name} ${collectionStudent.last_name}`,
          admissionNumber: collectionStudent.admission_number,
          className: collectionStudent.class_name,
          feeDescription: collectionFee.description,
          amount,
          currency: collectionStudent.currency,
          method,
          paidAt: new Date().toISOString(),
          status: "pending",
          feeCategory: "school_fee",
          balanceDue: Number(result.balance_due),
        });
        setNotice(`Payment recorded as pending validation. Remaining balance: ${collectionStudent.currency} ${result.balance_due.toFixed(2)}. Receipt ${result.payment.receipt_number} downloaded.`);
        await loadOtherPayments();
      }
      setCollectionAmount("");
      setCollectionStudentId("");
      const balanceResult = await schoolApi<{ balances: FeeBalance[] }>(`/api/school/payments?fee_id=${encodeURIComponent(collectionFeeId)}`);
      setCollectionBalances(balanceResult.balances);
      if (selectedFeeId === collectionFeeId) setBalances(balanceResult.balances);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not record fee payment");
    } finally {
      setRecordingCollection(false);
    }
  }

  return <SchoolShell title="Finance" finance><div className="mx-auto max-w-6xl rise">
    <div>
      <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Wallet className="size-5" /></div>
      <h1 className="font-display text-3xl font-bold">Finance desk</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Record configured fee collections, print numbered receipts, and track remaining balances. School, exam, and other-fee receipts remain pending until a different school admin validates them.</p>
    </div>

    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

    <section className="glass-panel mt-5 rounded-lg p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-bold">Record a fee & issue receipt</h2><p className="mt-1 text-sm text-muted-foreground">Choose any configured fee, learner, amount, and payment method. Every school-fee, exam, and other-fee receipt remains pending until an admin validates it.</p></div>
        <ReceiptText className="size-5 shrink-0 text-primary" />
      </div>
      {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading configured fees...</p>
        : activeCollectionFees.length === 0 ? <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No active school, examination, or other fee rules are configured. Ask a School Admin to configure them first.</p>
          : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">Configured fee
              <select value={collectionFeeId} onChange={(event) => setCollectionFeeId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {activeCollectionFees.map((item) => <option key={item.id} value={item.id}>{item.class_name} · {item.description} · {item.academic_year_name}{item.term_name ? ` · ${item.term_name}` : ""} · {item.currency} {Number(item.amount).toFixed(2)}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">Learner
              <select value={collectionStudentId} onChange={(event) => setCollectionStudentId(event.target.value)} disabled={collectionBalancesLoading} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="">{collectionBalancesLoading ? "Loading learners..." : "Choose a learner"}</option>
                {collectionBalances.filter((item) => Number(item.balance_due) > 0).map((item) => <option key={item.student_id} value={item.student_id}>{item.first_name} {item.last_name} · {item.admission_number} · due {item.currency} {Number(item.balance_due).toFixed(2)}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Amount
              <input type="number" min="0.01" max={collectionStudent?.balance_due ?? 0} step="0.01" value={collectionAmount} onChange={(event) => setCollectionAmount(event.target.value)} disabled={!collectionStudent || recordingCollection} className="h-10 w-full rounded-md border border-input bg-background px-3 text-right text-sm text-foreground disabled:opacity-60" />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Payment method
              <select value={method} onChange={(event) => setMethod(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="cash">Cash</option><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option></select>
            </label>
            <div className="flex items-end sm:col-span-2 lg:col-span-5">
              <Button disabled={!collectionStudent || !collectionAmount || Number(collectionAmount) > Number(collectionStudent?.balance_due ?? 0) || recordingCollection} onClick={() => void recordPayment()}>{recordingCollection ? "Recording..." : collectionIsOtherFee ? "Record & download pending receipt" : "Record & download receipt"}</Button>
              {collectionStudent && collectionFee && <p className="ml-3 pb-2 text-xs text-muted-foreground">Remaining balance: {collectionStudent.currency} {Number(collectionStudent.balance_due).toFixed(2)}{collectionIsOtherFee && Number(collectionStudent.pending_amount) > 0 ? ` · pending ${collectionStudent.currency} ${Number(collectionStudent.pending_amount).toFixed(2)}` : ""}</p>}
            </div>
          </div>}
    </section>

    <section className="glass-panel mt-5 overflow-hidden rounded-lg">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Pending validation receipts</h2><p className="mt-1 text-xs text-muted-foreground">Download or print each receipt, including school-fee, exam, and other-fee collections. It remains pending until a school admin validates it.</p></div><Download className="size-5 text-primary" /></div>
      {otherPayments.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No receipts awaiting school-admin validation.</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Fee", "Receipt", "Amount", "Method", "Status", "Received", ""].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-border/70">{otherPayments.map((payment) => <tr key={payment.id}>
            <td className="px-4 py-3 font-medium">{payment.first_name} {payment.last_name}<p className="font-mono text-xs text-muted-foreground">{payment.admission_number} · {payment.class_name}</p></td>
            <td className="px-4 py-3">{payment.fee_description}<p className="text-xs capitalize text-muted-foreground">{payment.category.replaceAll("_", " ")}</p></td>
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
              feeCategory: payment.category === "school_fee" ? "school_fee" : "other_fee",
              balanceDue: payment.balance_due == null ? undefined : Number(payment.balance_due),
            })}><Download className="mr-2 size-4" />Download receipt</Button></td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    <section className="glass-panel mt-5 rounded-lg p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold">School fee balances</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Review original, paid, and remaining tuition or PTA amounts. Record collections in the single form above.</p>
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
        : activeFees.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No active tuition or PTA fee rules are configured. Ask the School Admin to set up the fee schedule first.</p>
          : balancesLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading student balances...</p>
            : balances.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No active students are currently enrolled in this fee’s class.</p>
              : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {balances.map((student) => {
                  const remaining = Number(student.balance_due);
                  const settled = remaining <= 0;
                  return <article key={student.student_id} className="rounded-lg border border-border bg-background/60 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{student.first_name} {student.last_name}</h3>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{student.admission_number} · {student.class_name}</p>
                      </div>
                      <span className={settled ? "shrink-0 rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-medium text-emerald-700" : "shrink-0 rounded-full bg-amber-600/10 px-2.5 py-1 text-xs font-medium text-amber-800"}>{settled ? "Paid" : "Balance due"}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs sm:grid-cols-4">
                      <div><dt className="text-muted-foreground">Original</dt><dd className="mt-1 font-medium">{student.currency} {Number(student.original_amount).toFixed(2)}</dd></div>
                      <div><dt className="text-muted-foreground">Paid</dt><dd className="mt-1 font-medium">{student.currency} {Number(student.paid_amount).toFixed(2)}</dd></div>
                      <div><dt className="text-muted-foreground">Pending</dt><dd className="mt-1 font-medium">{student.currency} {Number(student.pending_amount).toFixed(2)}</dd></div>
                      <div><dt className="text-muted-foreground">Remaining</dt><dd className="mt-1 font-semibold">{student.currency} {remaining.toFixed(2)}</dd></div>
                    </dl>
                  </article>;
                })}
              </div>}
    </section>

    <section className="glass-panel mt-5 overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Recent school payments</h2><p className="mt-1 text-xs text-muted-foreground">Recorded school-fee payments appear in Daily Reconciliation.</p></div><ReceiptText className="size-5 text-primary" /></div>
      {payments.filter((payment) => payment.category === "school_fee").length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No school-fee payments have been recorded yet.</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Student", "Fee", "Receipt", "Amount", "Method", "Paid at", ""].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-border/70">        {payments.filter((payment) => payment.category === "school_fee").slice(0, 30).map((payment) => <tr key={payment.id}><td className="px-5 py-3 font-medium">{payment.first_name} {payment.last_name}<p className="font-mono text-xs text-muted-foreground">{payment.admission_number}</p></td><td className="px-5 py-3">{payment.fee_description ?? "School fee"}</td><td className="px-5 py-3 font-mono text-xs">{payment.receipt_number ?? "—"}</td><td className="px-5 py-3">{payment.currency} {Number(payment.amount).toFixed(2)}</td><td className="px-5 py-3 capitalize">{payment.method.replaceAll("_", " ")}</td><td className="px-5 py-3">{new Date(payment.paid_at).toLocaleString()}</td><td className="px-5 py-3"><Button size="sm" variant="outline" onClick={() => downloadPaymentReceipt({ schoolName, primaryColor, receiptNumber: payment.receipt_number ?? payment.id, studentName: `${payment.first_name} ${payment.last_name}`, admissionNumber: payment.admission_number, className: payment.class_name ?? "—", feeDescription: payment.fee_description ?? "School fee", amount: Number(payment.amount), currency: payment.currency, method: payment.method, paidAt: payment.paid_at, status: payment.status, feeCategory: "school_fee" })}><Download className="mr-2 size-4" />Download receipt</Button></td></tr>)}</tbody></table></div>}
    </section>
  </div></SchoolShell>;
}
