import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, Download, FileText, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";
import { useTenantBranding } from "@/components/tenant-branding-provider";
import { downloadFinancialRecordsPdf } from "@/lib/student-record-pdf";

export const Route = createFileRoute("/student-finances")({
  head: () => ({ meta: [{ title: "Student Financial Records — Klasora" }, { name: "description", content: "Review a learner's daily and other fee payments by term or across all time." }] }),
  component: StudentFinancesPage,
});

type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number: string;
  class_name: string | null;
};

type AcademicYear = {
  id: string;
  name: string;
  terms: { id: string; name: string }[];
};

type FinancialRecord = {
  id: string;
  receipt_number: string | null;
  amount: number | string;
  currency: string;
  category: string;
  method: string;
  status: string;
  paid_at: string;
  daily_fee_date: string | null;
  first_name: string;
  last_name: string;
  admission_number: string;
  fee_description: string;
  class_name: string | null;
  term_name: string | null;
  academic_year_name: string | null;
};

type CurrencyTotal = {
  currency: string;
  payment_count: number;
  verified_count: number;
  pending_count: number;
  verified_amount: number | string;
  pending_amount: number | string;
};

type SchoolFeeBalance = {
  fee_description: string;
  term_name: string;
  academic_year_name: string;
  currency: string;
  arrears_sources: string | null;
  base_amount_due: number | string;
  arrears_amount: number | string;
  paid_amount: number | string;
  pending_amount: number | string;
  balance_due: number | string;
};

type FinancialReport = {
  records: FinancialRecord[];
  totals: CurrencyTotal[];
  fee_balances: SchoolFeeBalance[];
  total_count: number;
  page: number;
  page_size: number;
  page_count: number;
};

async function schoolApi<T>(path: string): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const response = await fetch(`${url.pathname}${url.search}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "The school request failed";
    throw new Error(message);
  }
  return payload as T;
}

function StudentFinancesPage() {
  const { schoolName, primaryColor } = useTenantBranding();
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [termId, setTermId] = useState("");
  const [includeDaily, setIncludeDaily] = useState(true);
  const [includeSchool, setIncludeSchool] = useState(true);
  const [includeOther, setIncludeOther] = useState(true);
  const [exportType, setExportType] = useState("financial");
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const selectedTerm = academicYears
    .flatMap((year) => year.terms.map((term) => ({ ...term, yearName: year.name })))
    .find((term) => term.id === termId);

  useEffect(() => {
    let cancelled = false;
    void schoolApi<{ academic_years: AcademicYear[] }>("/api/school/academic-periods")
      .then((result) => { if (!cancelled) setAcademicYears(result.academic_years); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load academic terms");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setStudentsLoading(true);
      const params = new URLSearchParams({ search: studentSearch.trim(), page: "1", page_size: "100" });
      void schoolApi<{ students: StudentOption[] }>(`/api/school/students?${params}`)
        .then((result) => { if (!cancelled) setStudents(result.students); })
        .catch((loadError: unknown) => {
          if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not search students");
        })
        .finally(() => { if (!cancelled) setStudentsLoading(false); });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [studentSearch]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedStudentId || (!includeDaily && !includeSchool && !includeOther)) {
      setReport(null);
      setReportLoading(false);
      return;
    }
    setReportLoading(true);
    setError("");
    const params = new URLSearchParams({
      student_id: selectedStudentId,
      types: [
        includeDaily ? "daily" : "",
        includeSchool ? "school" : "",
        includeOther ? "other" : "",
      ].filter(Boolean).join(","),
      page: String(page),
      page_size: "50",
    });
    if (termId) params.set("term_id", termId);
    void schoolApi<FinancialReport>(`/api/school/student-financial-records?${params}`)
      .then((result) => { if (!cancelled) setReport(result); })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setReport(null);
          setError(loadError instanceof Error ? loadError.message : "Could not load student financial records");
        }
      })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [includeDaily, includeOther, includeSchool, page, selectedStudentId, termId]);

  function chooseStudent(studentId: string) {
    setSelectedStudentId(studentId);
    setPage(1);
  }

  async function downloadFinancialRecords() {
    if (!selectedStudent) return;
    setExporting(true);
    setError("");
    try {
      const typesByExport: Record<string, string> = {
        daily: "daily",
        school: "school",
        both: "daily,school",
        financial: "daily,school,other",
      };
      const records: FinancialRecord[] = [];
      let totals: CurrencyTotal[] = [];
      let feeBalances: SchoolFeeBalance[] = [];
      let pageNumber = 1;
      let pageCount = 1;
      do {
        const params = new URLSearchParams({
          student_id: selectedStudent.id,
          types: typesByExport[exportType] ?? typesByExport.financial!,
          page: String(pageNumber),
          page_size: "100",
        });
        if (termId) params.set("term_id", termId);
        const result = await schoolApi<FinancialReport>(`/api/school/student-financial-records?${params}`);
        records.push(...result.records);
        if (pageNumber === 1) {
          totals = result.totals;
          feeBalances = result.fee_balances;
        }
        pageCount = result.page_count;
        pageNumber += 1;
      } while (pageNumber <= pageCount);
      downloadFinancialRecordsPdf({
        schoolName,
        primaryColor,
        studentName: `${selectedStudent.first_name} ${selectedStudent.last_name}`,
        admissionNumber: selectedStudent.student_id_number,
        className: selectedStudent.class_name,
        termName: selectedTerm ? `${selectedTerm.yearName} · ${selectedTerm.name}` : "All terms",
        records,
        totals,
        feeBalances,
      });
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download financial records");
    } finally {
      setExporting(false);
    }
  }

  return <SchoolShell title="Financial records" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div>
      <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><FileText className="size-5" /></div>
      <h1 className="font-display text-3xl font-bold">Student financial records</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review daily payments, term-based school fees, and examination/other fees for one term or across all time. School-fee arrears are shown separately and are carried forward only for tuition and PTA fees.</p>
    </div>

    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

    <section className="glass-panel mt-5 grid gap-4 rounded-lg p-4 sm:grid-cols-2 sm:p-5">
      <div>
        <label htmlFor="student-search" className="text-xs font-medium text-muted-foreground">Find student</label>
        <div className="mt-1 flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            id="student-search"
            type="search"
            value={studentSearch}
            onChange={(event) => {
              setStudentSearch(event.target.value);
              chooseStudent("");
            }}
            placeholder="Search name or admission number"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          aria-label="Select a student"
          value={selectedStudentId}
          onChange={(event) => chooseStudent(event.target.value)}
          disabled={studentsLoading}
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-60"
        >
          <option value="">{studentsLoading ? "Searching students..." : "Choose a student"}</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.first_name} {student.last_name} · {student.student_id_number}{student.class_name ? ` · ${student.class_name}` : ""}
            </option>
          ))}
        </select>
      </div>

      <label className="space-y-1 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-2"><CalendarDays className="size-4" />Academic term</span>
        <select value={termId} onChange={(event) => { setTermId(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
          <option value="">All time · all terms</option>
          {academicYears.flatMap((year) => year.terms.map((term) => (
            <option key={term.id} value={term.id}>{year.name} · {term.name}</option>
          )))}
        </select>
      </label>

      <fieldset className="sm:col-span-2">
        <legend className="text-xs font-medium text-muted-foreground">Payment types</legend>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeDaily} onChange={(event) => { setIncludeDaily(event.target.checked); setPage(1); }} />
            Daily payments
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeSchool} onChange={(event) => { setIncludeSchool(event.target.checked); setPage(1); }} />
            School fees
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeOther} onChange={(event) => { setIncludeOther(event.target.checked); setPage(1); }} />
            Examination and other fees
          </label>
        </div>
        {!includeDaily && !includeSchool && !includeOther && <p className="mt-2 text-xs text-destructive">Select at least one payment type.</p>}
      </fieldset>
      <div className="sm:col-span-2 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1 text-xs font-medium text-muted-foreground">
          Financial-record PDF
          <select value={exportType} onChange={(event) => setExportType(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:max-w-sm">
            <option value="daily">Daily payments only</option>
            <option value="school">School fees only</option>
            <option value="both">Daily payments and school fees</option>
            <option value="financial">Financial records only (all payment types)</option>
          </select>
        </label>
        <Button type="button" variant="outline" disabled={!selectedStudent || exporting} onClick={() => void downloadFinancialRecords()}>
          <Download className="mr-2 size-4" />{exporting ? "Preparing PDF..." : "Download financial PDF"}
        </Button>
      </div>
    </section>

    {selectedStudent && <div className="mt-5 flex items-center gap-3 rounded-lg border border-border bg-background/60 px-4 py-3">
      <Banknote className="size-5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="truncate font-semibold">{selectedStudent.first_name} {selectedStudent.last_name}</p>
        <p className="text-xs text-muted-foreground">{selectedStudent.student_id_number}{selectedStudent.class_name ? ` · ${selectedStudent.class_name}` : ""}</p>
      </div>
      <span className="ml-auto text-sm text-muted-foreground">{report?.total_count ?? 0} record(s)</span>
    </div>}

    {report?.totals.length ? <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {report.totals.map((total) => (
        <article key={total.currency} className="glass-panel rounded-lg p-4">
          <h2 className="text-sm font-semibold">{total.currency} summary</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <p><span className="block text-xs text-muted-foreground">Verified</span><span className="font-semibold">{total.currency} {Number(total.verified_amount).toFixed(2)}</span></p>
            <p><span className="block text-xs text-muted-foreground">Pending</span><span className="font-semibold">{total.currency} {Number(total.pending_amount).toFixed(2)}</span></p>
            <p><span className="block text-xs text-muted-foreground">Verified payments</span><span>{total.verified_count}</span></p>
            <p><span className="block text-xs text-muted-foreground">Pending payments</span><span>{total.pending_count}</span></p>
          </div>
        </article>
      ))}
    </section> : null}

    {includeSchool && selectedStudentId && <section className="glass-panel mt-4 rounded-lg p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold">School-fee balances</h2>
      <p className="mt-1 text-xs text-muted-foreground">Unpaid tuition and PTA from an ended term appears here as arrears in the following term. Daily payments are excluded.</p>
      {!report || reportLoading ? <p className="py-5 text-center text-sm text-muted-foreground">Loading school-fee balances...</p>
        : report.fee_balances.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">No term-based school-fee balances match this student and term.</p>
          : <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {report.fee_balances.map((balance, index) => <article key={`${balance.academic_year_name}-${balance.term_name}-${balance.fee_description}-${index}`} className="rounded-md border border-border bg-background/60 p-4">
              <h3 className="font-semibold">{balance.fee_description}</h3>
              <p className="text-xs text-muted-foreground">{balance.academic_year_name} · {balance.term_name}</p>
              {balance.arrears_sources && <p className="mt-2 text-xs text-muted-foreground">Carried from: {balance.arrears_sources}</p>}
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-muted-foreground">Current term</dt><dd>{balance.currency} {Number(balance.base_amount_due).toFixed(2)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Arrears</dt><dd>{balance.currency} {Number(balance.arrears_amount).toFixed(2)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Paid</dt><dd>{balance.currency} {Number(balance.paid_amount).toFixed(2)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Balance due</dt><dd className="font-semibold">{balance.currency} {Number(balance.balance_due).toFixed(2)}</dd></div>
              </dl>
            </article>)}
          </div>}
    </section>}

    <section className="glass-panel mt-4 overflow-hidden rounded-lg">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div><h2 className="font-display text-lg font-bold">Payment history</h2><p className="mt-1 text-xs text-muted-foreground">Entries are sorted newest first and retain their recorded status.</p></div>
        <FileText className="size-5 shrink-0 text-primary" />
      </div>
      {!selectedStudentId ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">Choose a student to view their financial records.</p>
        : !includeDaily && !includeSchool && !includeOther ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">Choose at least one payment type.</p>
          : reportLoading ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">Loading financial records...</p>
            : !report?.records.length ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No payment records match the selected student, payment types, and term.</p>
              : <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Date", "Category", "Fee / class", "Term", "Receipt", "Amount", "Method", "Status"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-border/70">
                    {report.records.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3">{record.daily_fee_date ? new Date(`${record.daily_fee_date}T00:00:00`).toLocaleDateString() : new Date(record.paid_at).toLocaleString()}</td>
                        <td className="px-4 py-3 capitalize">{record.category.replaceAll("_", " ")}</td>
                        <td className="px-4 py-3">{record.fee_description}{record.class_name && <p className="text-xs text-muted-foreground">{record.class_name}</p>}</td>
                        <td className="px-4 py-3">{record.term_name ? `${record.academic_year_name ?? ""} · ${record.term_name}` : "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{record.receipt_number ?? "—"}</td>
                        <td className="px-4 py-3">{record.currency} {Number(record.amount).toFixed(2)}</td>
                        <td className="px-4 py-3 capitalize">{record.method.replaceAll("_", " ")}</td>
                        <td className="px-4 py-3 capitalize">{record.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
      {report && report.page_count > 1 && <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
        <span className="text-muted-foreground">Page {report.page} of {report.page_count}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1 || reportLoading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 disabled:opacity-50"><ChevronLeft className="size-4" />Previous</button>
          <button type="button" disabled={page >= report.page_count || reportLoading} onClick={() => setPage((current) => Math.min(report.page_count, current + 1))} className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 disabled:opacity-50">Next<ChevronRight className="size-4" /></button>
        </div>
      </div>}
    </section>
  </div></SchoolShell>;
}
