import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, FileText, Printer, RefreshCw, ShieldCheck } from "lucide-react";

import { getNeonAccessToken, getNeonSessionCredential } from "../auth/client";
import { Button } from "@/components/ui/button";
import { useTenantBranding } from "@/components/tenant-branding-provider";

type SchoolClass = { id: string; name: string; academic_year_id: string; academic_year_name: string };
type Term = { id: string; name: string; is_current: boolean };
type AcademicYear = { id: string; name: string; is_current: boolean; terms: Term[] };
type BillFeeLine = {
  description: string;
  amount: number | string;
  billable_amount?: number | string;
  currency: string;
  invoice_id: string | null;
};
type DailyLine = { date: string; amount: number | string; class_id: string };
type BillPreview = {
  student_id: string;
  name: string;
  admission_number: string | null;
  class_name: string;
  target_term_id: string;
  source_term_id: string | null;
  is_new_admission: boolean;
  currency: string;
  existing_base: number | string;
  new_base: number | string;
  existing_arrears: number | string;
  prior_arrears: number | string;
  daily_arrears: number | string;
  pending_payment_count: number;
  adjustment: number | string;
  total_amount_due: number | string;
  line_items: { fees: BillFeeLine[]; daily: DailyLine[] };
};

async function schoolApi<T>(path: string, init?: RequestInit): Promise<T> {
  const tenant =
    new URLSearchParams(window.location.search).get("tenant") ??
    sessionStorage.getItem("hg-school");
  const url = new URL(path, window.location.origin);
  if (tenant) url.searchParams.set("tenant", tenant);
  const token = await getNeonAccessToken();
  const send = (credential: string) => {
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${credential}`);
    if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(`${url.pathname}${url.search}`, { ...init, headers });
  };
  let response = await send(token);
  if (response.status === 401) {
    const credential = await getNeonSessionCredential();
    if (credential !== token) response = await send(credential);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "The term billing request failed";
    throw new Error(message);
  }
  return payload as T;
}

const money = (value: number | string) => Number(value || 0).toFixed(2);

export function TermBillingWorkspace() {
  const { schoolName, primaryColor } = useTenantBranding();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [billType, setBillType] = useState<"standard" | "admission">("standard");
  const [bills, setBills] = useState<BillPreview[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [blockedByPending, setBlockedByPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setError("");
    try {
      const [classResult, yearResult] = await Promise.all([
        schoolApi<{ classes: SchoolClass[] }>("/api/school/classes"),
        schoolApi<{ academic_years: AcademicYear[] }>("/api/school/academic-periods"),
      ]);
      setClasses(classResult.classes);
      setYears(yearResult.academic_years);
      const initialYear =
        yearResult.academic_years.find((year) => year.is_current) ?? yearResult.academic_years[0];
      const initialClass =
        classResult.classes.find((item) => item.academic_year_id === initialYear?.id) ??
        classResult.classes[0];
      const classYear =
        yearResult.academic_years.find((year) => year.id === initialClass?.academic_year_id) ??
        initialYear;
      setClassId((current) => current || initialClass?.id || "");
      const initialTerm = classYear?.terms.find((term) => term.is_current) ?? classYear?.terms[0];
      setTermId((current) => current || initialTerm?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load billing periods");
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const selectedClass = classes.find((item) => item.id === classId);
  const selectedYear = years.find((year) => year.id === selectedClass?.academic_year_id);
  const terms = useMemo(() => selectedYear?.terms ?? [], [selectedYear]);
  const endpointRoot = billType === "admission" ? "/api/school/admission-fees" : "/api/school/term-billing";
  const pendingCount = bills.reduce((total, bill) => total + Number(bill.pending_payment_count), 0);

  async function loadPreview() {
    if (!classId || !termId) {
      setError("Choose a class and target term first.");
      return;
    }
    setPreviewing(true);
    setError("");
    setNotice("");
    setGenerated(false);
    try {
      const result = await schoolApi<{
        bills: BillPreview[];
        blocked_by_pending_payments: boolean;
        locked?: boolean;
      }>(`${endpointRoot}/preview`, {
        method: "POST",
        body: JSON.stringify({
          class_id: classId,
          target_term_id: termId,
          adjustments: Object.entries(adjustments)
            .filter(([, amount]) => amount !== "" && Number(amount) !== 0)
            .map(([student_id, amount]) => ({ student_id, amount: Number(amount) })),
        }),
      });
      setBills(result.bills);
      setBlockedByPending(result.blocked_by_pending_payments);
      setGenerated(result.locked === true);
      if (result.locked) setNotice("These bills are already generated and locked. Printing is still available.");
    } catch (previewError) {
      setBills([]);
      setBlockedByPending(false);
      setError(previewError instanceof Error ? previewError.message : "Could not preview term bills");
    } finally {
      setPreviewing(false);
    }
  }

  async function generateBills() {
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<{ generated_count: number }>(`${endpointRoot}/generate`, {
        method: "POST",
        body: JSON.stringify({
          class_id: classId,
          target_term_id: termId,
          adjustments: Object.entries(adjustments)
            .filter(([, amount]) => amount !== "" && Number(amount) !== 0)
            .map(([student_id, amount]) => ({ student_id, amount: Number(amount) })),
        }),
      });
      setGenerated(true);
      setNotice(`${result.generated_count} learner bills generated and locked for this term.`);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Could not generate term bills");
    } finally {
      setGenerating(false);
    }
  }

  function updateAdjustment(studentId: string, value: string) {
    setAdjustments((current) => ({ ...current, [studentId]: value }));
    setGenerated(false);
  }

  return (
    <section className="term-billing-workspace glass-panel mt-5 overflow-hidden rounded-lg">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <FileText className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Term billing workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Preview fees and arrears before generating a locked bill for enrolled learners.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadOptions()} disabled={loadingOptions}>
          <RefreshCw className="mr-2 size-4" />
          Refresh periods
        </Button>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Target class
            <select
              value={classId}
              onChange={(event) => {
                const nextClass = classes.find((item) => item.id === event.target.value);
                setClassId(event.target.value);
                setTermId(nextClass ? years.find((year) => year.id === nextClass.academic_year_id)?.terms[0]?.id ?? "" : "");
                setBills([]);
                setAdjustments({});
                setGenerated(false);
              }}
              disabled={loadingOptions}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">Choose class</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Target term
            <select
              value={termId}
              onChange={(event) => {
                setTermId(event.target.value);
                setBills([]);
                setAdjustments({});
                setGenerated(false);
              }}
              disabled={loadingOptions || terms.length === 0}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">Choose term</option>
              {terms.map((term) => <option key={term.id} value={term.id}>{term.name}{term.is_current ? " · Current" : ""}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Bill type
            <select
              value={billType}
              onChange={(event) => {
                setBillType(event.target.value as "standard" | "admission");
                setBills([]);
                setAdjustments({});
                setGenerated(false);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="standard">Standard term bill</option>
              <option value="admission">New-admission bill</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button type="button" className="w-full" onClick={() => void loadPreview()} disabled={loadingOptions || previewing || !classId || !termId}>
              {previewing ? "Preparing preview..." : "Preview bills"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Only active learners enrolled in the selected class during the target term are included.
          New-admission fee rules are generated separately from standard bills.
        </p>

        {bills.length > 0 && (
          <>
            <div className="flex flex-col gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm">
                {blockedByPending ? <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" /> : <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />}
                <p>
                  {blockedByPending
                    ? `${pendingCount} pending payment(s) must be reviewed before bills can be generated.`
                    : `${bills.length} learner bill(s) ready for review.`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 size-4" />Print bill sheets
                </Button>
                <Button type="button" size="sm" onClick={() => void generateBills()} disabled={generating || blockedByPending || generated}>
                  {generating ? "Generating..." : generated ? "Bills locked" : "Generate & lock"}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>{["Learner", "Base / existing due", "Prior arrears", "Daily arrears", "Adjustment", "Total due"].map((heading) => <th key={heading} className="px-3 py-2 font-medium">{heading}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {bills.map((bill) => {
                    const base = Number(bill.existing_base) + Number(bill.new_base);
                    const currentAdjustment = adjustments[bill.student_id] ?? String(bill.adjustment ?? 0);
                    const shownTotal = Number(bill.total_amount_due) - Number(bill.adjustment) + (Number(currentAdjustment) || 0);
                    return (
                      <tr key={bill.student_id}>
                        <td className="px-3 py-3">
                          <span className="font-medium">{bill.name}</span>
                          <p className="font-mono text-xs text-muted-foreground">{bill.admission_number ?? "No admission number"} · {bill.class_name}</p>
                          {bill.is_new_admission && <span className="mt-1 inline-block rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-800">New admission</span>}
                          {bill.pending_payment_count > 0 && <span className="ml-1 inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-800">{bill.pending_payment_count} pending</span>}
                        </td>
                        <td className="px-3 py-3">{bill.currency} {money(base)}
                          <p className="text-xs text-muted-foreground">{money(bill.existing_base)} existing · {money(bill.new_base)} new</p>
                        </td>
                        <td className="px-3 py-3">{bill.currency} {money(Number(bill.existing_arrears) + Number(bill.prior_arrears))}</td>
                        <td className="px-3 py-3">{bill.currency} {money(bill.daily_arrears)}</td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            step="0.01"
                            min={-Number(bill.new_base)}
                            value={currentAdjustment}
                            onChange={(event) => updateAdjustment(bill.student_id, event.target.value)}
                            disabled={generated}
                            aria-label={`Adjustment for ${bill.name}`}
                            className="h-9 w-28 rounded-md border border-input bg-background px-2 text-right tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-3 font-semibold tabular-nums">{bill.currency} {money(shownTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="term-billing-print-area hidden">
              {bills.map((bill) => {
                const shownAdjustment = Number(adjustments[bill.student_id] ?? bill.adjustment ?? 0);
                const shownTotal = Number(bill.total_amount_due) - Number(bill.adjustment) + shownAdjustment;
                return (
                  <article className="term-billing-sheet" key={`print-${bill.student_id}`}>
                    <div className="term-billing-print-heading" style={{ borderColor: primaryColor }}>
                      <p className="text-xs uppercase tracking-widest">Official term bill</p>
                      <h1 style={{ color: primaryColor }}>{schoolName}</h1>
                      <p>{selectedClass?.name} · {selectedYear?.name} · {terms.find((term) => term.id === termId)?.name}</p>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-gray-300 pb-3">
                      <div><h2 className="text-lg font-bold">{bill.name}</h2><p>{bill.admission_number ?? "No admission number"} · {bill.class_name}</p></div>
                      <span className="rounded border border-gray-400 px-2 py-1 text-xs uppercase">{billType === "admission" ? "Admission bill" : "Term bill"}</span>
                    </div>
                    <table className="mt-3 w-full text-sm">
                      <tbody>
                        {bill.line_items.fees.map((item) => <tr key={`${bill.student_id}-${item.description}`}><td className="py-1">{item.description}{item.invoice_id ? " (existing invoice balance)" : ""}</td><td className="py-1 text-right">{bill.currency} {money(item.billable_amount ?? item.amount)}</td></tr>)}
                        {Number(bill.prior_arrears) > 0 && <tr><td className="py-1">Prior-term unpaid balances</td><td className="py-1 text-right">{bill.currency} {money(bill.prior_arrears)}</td></tr>}
                        {Number(bill.daily_arrears) > 0 && <tr><td className="py-1">Unpaid daily attendance fees</td><td className="py-1 text-right">{bill.currency} {money(bill.daily_arrears)}</td></tr>}
                        {shownAdjustment !== 0 && <tr><td className="py-1">Adjustment</td><td className="py-1 text-right">{bill.currency} {money(shownAdjustment)}</td></tr>}
                        <tr className="border-t border-gray-400 font-bold"><td className="py-2">Total amount due</td><td className="py-2 text-right">{bill.currency} {money(shownTotal)}</td></tr>
                      </tbody>
                    </table>
                    <p className="mt-6 text-xs text-gray-600">Please contact the school office if you have a question about this bill.</p>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
