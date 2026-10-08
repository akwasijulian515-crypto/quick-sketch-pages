import { createFileRoute } from "@tanstack/react-router";
import { FileDown, FileText, Files, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SchoolShell } from "@/components/school-shell";
import { useTenantBranding } from "@/components/tenant-branding-provider";
import { downloadTerminalReports, type TerminalReportPdfData } from "@/lib/terminal-report-pdf";

export const Route = createFileRoute("/terminal-reports")({
  head: () => ({
    meta: [
      { title: "Terminal Reports — Klasora" },
      { name: "description", content: "Generate standards-based terminal reports." },
    ],
  }),
  component: TerminalReportsPage,
});

type SchoolClass = { id: string; name: string; academic_year_id: string; academic_year_name: string };
type Term = { id: string; name: string; is_current: boolean; is_closed: boolean };
type AcademicYear = { id: string; name: string; terms: Term[] };
type ReportItem = {
  subject_id: string;
  subject_name: string;
  class_test_score: number | string | null;
  project_score: number | string | null;
  homework_score: number | string | null;
  group_work_score: number | string | null;
  exam_score: number | string | null;
  total_score: number | string | null;
  performance_level: string | null;
  remark: string | null;
};
type LearnerReport = {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  school_name?: string;
  report_id: string | null;
  conduct: string | null;
  attitude: string | null;
  interest: string | null;
  attendance_present: number | null;
  attendance_total: number | null;
  teacher_remark: string | null;
  headteacher_remark: string | null;
  promotion_status: string | null;
  published_at: string | null;
  items: ReportItem[];
};
type Profile = { conduct: string; attitude: string; interest: string; teacher_remark: string; headteacher_remark: string; promotion_status: string };

async function schoolApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant && !url.searchParams.has("tenant")) url.searchParams.set("tenant", tenant);
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

function TerminalReportsPage() {
  const { primaryColor } = useTenantBranding();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [reports, setReports] = useState<LearnerReport[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSetup = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classResult, yearResult, context] = await Promise.all([
        schoolApi<{ classes: SchoolClass[] }>("/api/school/classes"),
        schoolApi<{ academic_years: AcademicYear[] }>("/api/school/academic-periods"),
        schoolApi<{ membership?: { role?: string } }>("/api/auth/context"),
      ]);
      setClasses(classResult.classes);
      setYears(yearResult.academic_years);
      setCanPublish(context.membership?.role === "school_admin");
      setClassId((current) => current || classResult.classes[0]?.id || "");
      const currentYear = yearResult.academic_years.find((year) => year.terms.some((term) => term.is_current))
        ?? yearResult.academic_years[0];
      const currentTerm = currentYear?.terms.find((term) => term.is_current) ?? currentYear?.terms[0];
      setTermId((current) => current || currentTerm?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load report setup");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    if (!classId || !termId) {
      setReports([]);
      setProfiles({});
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await schoolApi<{ reports: LearnerReport[] }>(
        `/api/school/terminal-reports?class_id=${encodeURIComponent(classId)}&term_id=${encodeURIComponent(termId)}`,
      );
      setReports(result.reports);
      setProfiles(Object.fromEntries(result.reports.map((report) => [
        report.student_id,
        {
          conduct: report.conduct ?? "",
          attitude: report.attitude ?? "",
          interest: report.interest ?? "",
          teacher_remark: report.teacher_remark ?? "",
          headteacher_remark: report.headteacher_remark ?? "",
          promotion_status: report.promotion_status ?? "",
        },
      ])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load learner reports");
    } finally {
      setLoading(false);
    }
  }, [classId, termId]);

  useEffect(() => { void loadSetup(); }, [loadSetup]);
  useEffect(() => { void loadReports(); }, [loadReports]);

  function updateProfile(studentId: string, field: keyof Profile, value: string) {
    setProfiles((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] ?? { conduct: "", attitude: "", interest: "", teacher_remark: "", headteacher_remark: "", promotion_status: "" }), [field]: value },
    }));
  }

  async function save(publish: boolean) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<{ saved_count: number; published: boolean }>("/api/school/terminal-reports", {
        method: "POST",
        body: JSON.stringify({
          class_id: classId,
          term_id: termId,
          publish,
          profiles: reports.map((report) => ({ student_id: report.student_id, ...profiles[report.student_id] })),
        }),
      });
      setNotice(publish ? `${result.saved_count} report(s) published.` : `${result.saved_count} report(s) saved as drafts.`);
      await loadReports();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save reports");
    } finally {
      setSaving(false);
    }
  }

  const selectedClass = classes.find((item) => item.id === classId);
  const availableTerms = years.flatMap((year) => year.terms.map((term) => ({ ...term, year_name: year.name })));
  const selectedTerm = availableTerms.find((term) => term.id === termId);
  const exportReports: TerminalReportPdfData[] = reports.map((report) => ({
    schoolName: report.school_name ?? "School",
    primaryColor,
    student: `${report.first_name} ${report.last_name}`,
    admission: report.admission_number,
    className: selectedClass?.name ?? "",
    term: `${selectedTerm?.year_name ?? ""} ${selectedTerm?.name ?? ""}`.trim(),
    attendance: `${report.attendance_present ?? 0} / ${report.attendance_total ?? 0} days`,
    conduct: profiles[report.student_id]?.conduct ?? "",
    attitude: profiles[report.student_id]?.attitude ?? "",
    interest: profiles[report.student_id]?.interest ?? "",
    teacherRemark: profiles[report.student_id]?.teacher_remark ?? "",
    promotionStatus: profiles[report.student_id]?.promotion_status ?? "",
    results: report.items.map((item) => ({
      subject: item.subject_name,
      score: Number(item.total_score ?? 0),
      teacher: "",
      remark: item.remark ?? "",
    })),
  }));

  return (
    <SchoolShell title="Terminal reports" schoolAdminOrTeacher>
      <div className="mx-auto max-w-6xl rise">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><FileText className="size-5" /></div>
            <h1 className="font-display text-3xl font-bold">Terminal reports</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review marks and attendance, add learner profiles and remarks, then save drafts or publish reports.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!reports.length || loading} onClick={() => downloadTerminalReports(exportReports)}><Files />Download class reports</Button>
            <Button variant="outline" disabled={reports.length !== 1 || loading} onClick={() => downloadTerminalReports(exportReports.slice(0, 1))}><FileDown />Download report</Button>
          </div>
        </div>

        <section className="glass-panel mt-6 rounded-lg p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Class
              <select value={classId} onChange={(event) => setClassId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="">Select a class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Academic term
              <select value={termId} onChange={(event) => setTermId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="">Select a term</option>{availableTerms.map((item) => <option key={item.id} value={item.id}>{item.year_name} · {item.name}{item.is_closed ? " · closed" : ""}</option>)}
              </select>
            </label>
          </div>
          {error && <p role="alert" className="mt-3 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="mt-3 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
        </section>

        {loading ? <div className="glass-panel mt-4 rounded-lg p-8 text-sm text-muted-foreground">Loading report data...</div> : reports.length === 0 ? (
          <div className="glass-panel mt-4 rounded-lg border border-dashed border-border p-12 text-center">
            <ShieldCheck className="mx-auto size-7 text-primary/55" />
            <h2 className="mt-3 font-display text-lg font-bold">{classId && termId ? "No active students in this class" : "Select a class and term"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{classId && termId ? "Reports will appear when students are enrolled in this class." : "Choose the records you want to prepare reports for."}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {reports.map((report) => {
              const profile = profiles[report.student_id] ?? { conduct: "", attitude: "", interest: "", teacher_remark: "", headteacher_remark: "", promotion_status: "" };
              return <article key={report.student_id} className="glass-panel rounded-lg p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h2 className="font-display text-lg font-bold">{report.first_name} {report.last_name}</h2><p className="font-mono text-xs text-muted-foreground">{report.admission_number}</p></div>
                  <p className="text-xs text-muted-foreground">{report.attendance_present ?? 0} / {report.attendance_total ?? 0} attendance days{report.published_at ? " · Published" : report.report_id ? " · Draft saved" : ""}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(["conduct", "attitude", "interest"] as const).map((field) => <label key={field} className="space-y-1 text-xs font-medium capitalize text-muted-foreground">{field}<Input value={profile[field]} maxLength={80} onChange={(event) => updateProfile(report.student_id, field, event.target.value)} /></label>)}
                </div>
                <p className="mt-4 text-xs font-semibold text-secondary-foreground">Subject results</p>
                {report.items.length ? <ul className="mt-2 divide-y divide-border/70 rounded-md border border-border">
                  {report.items.map((item) => <li key={item.subject_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"><span>{item.subject_name}</span><span className="text-muted-foreground">{Number(item.total_score).toFixed(1)} / 100 · {item.performance_level ?? "Not graded"}</span></li>)}
                </ul> : <p className="mt-2 rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">No complete subject marks have been entered for this term.</p>}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-muted-foreground">Teacher remark<textarea value={profile.teacher_remark} maxLength={2000} onChange={(event) => updateProfile(report.student_id, "teacher_remark", event.target.value)} className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" /></label>
                  {canPublish && <label className="space-y-1 text-xs font-medium text-muted-foreground">Headteacher remark<textarea value={profile.headteacher_remark} maxLength={2000} onChange={(event) => updateProfile(report.student_id, "headteacher_remark", event.target.value)} className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" /></label>}
                </div>
              </article>;
            })}
            <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => void save(false)}>{saving ? "Saving..." : "Save drafts"}</Button>{canPublish && <Button disabled={saving} onClick={() => void save(true)}>{saving ? "Publishing..." : "Publish reports"}</Button>}</div>
          </div>
        )}

        <section className="mt-5 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground"><p className="font-medium text-secondary-foreground">NaCCA performance levels</p><p className="mt-1">HP: 80%+ · P: 68–79% · AP: 54–67% · D: 40–53% · E: 39% and below.</p></section>
      </div>
    </SchoolShell>
  );
}
