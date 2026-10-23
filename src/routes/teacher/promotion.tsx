import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, GraduationCap, LockKeyhole, LogOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getNeonAccessToken, neonAuthClient } from "../../auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/teacher/promotion")({
  head: () => ({ meta: [{ title: "Class Promotion — Klasora" }, { name: "description", content: "Class teacher promotion register." }] }),
  component: PromotionPage,
});

type Decision = "promote" | "repeat" | "transfer" | "graduate";
type SchoolClass = { id: string; name: string; academic_year_id: string; academic_year_name: string; academic_year_starts_on: string };
type Term = { id: string; name: string; ends_on: string; is_closed: boolean };
type AcademicYear = { id: string; name: string; starts_on: string; terms: Term[] };
type Student = { id: string; first_name: string; last_name: string; student_id_number: string; class_id: string | null; class_name: string | null };
type SavedDecision = { student_id: string; decision: Decision; target_class_id: string | null; status: "pending" | "approved" | "rejected"; review_remark: string | null };
type DecisionDraft = { decision: Decision; target_class_id: string; teacher_remark: string };

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

function PromotionPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [saved, setSaved] = useState<SavedDecision[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DecisionDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void schoolApi<{ membership?: { role?: string } }>("/api/auth/context")
      .then((context) => {
        if (context.membership?.role !== "teacher") throw new Error("Teacher membership is required");
        if (!cancelled) setAllowed(true);
      })
      .catch(() => {
        if (!cancelled) navigate({ to: "/login" });
      });
    return () => { cancelled = true; };
  }, [navigate]);

  const loadSetup = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classResult, yearResult] = await Promise.all([
        schoolApi<{ classes: SchoolClass[] }>("/api/school/classes"),
        schoolApi<{ academic_years: AcademicYear[] }>("/api/school/academic-periods"),
      ]);
      setClasses(classResult.classes);
      setYears(yearResult.academic_years);
      setClassId((current) => current || classResult.classes[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load promotion setup");
    } finally {
      setLoading(false);
    }
  }, []);

  const activeClass = classes.find((item) => item.id === classId);
  const termThree = years.find((year) => year.id === activeClass?.academic_year_id)?.terms.find((term) => /term\s*3/i.test(term.name));
  const targetClasses = useMemo(
    () => classes.filter((item) => item.academic_year_id !== activeClass?.academic_year_id && termThree?.ends_on && item.academic_year_starts_on > termThree.ends_on),
    [activeClass?.academic_year_id, classes, termThree?.ends_on],
  );

  const loadRegister = useCallback(async () => {
    if (!classId || !termThree?.is_closed) {
      setStudents([]);
      setSaved([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [studentResult, decisionResult] = await Promise.all([
        schoolApi<{ students: Student[]; total: number }>("/api/school/students?class_id=" + encodeURIComponent(classId) + "&page=1&page_size=100"),
        schoolApi<{ decisions: SavedDecision[] }>(`/api/school/promotions?class_id=${encodeURIComponent(classId)}&term_id=${encodeURIComponent(termThree.id)}`),
      ]);
      setStudents(studentResult.students);
      setSaved(decisionResult.decisions);
      const submitted = new Set(decisionResult.decisions.map((item) => item.student_id));
      setDrafts((current) => Object.fromEntries(studentResult.students.map((student) => [
        student.id,
        current[student.id] ?? { decision: "promote", target_class_id: "", teacher_remark: "" },
      ]).filter(([id]) => !submitted.has(String(id)))));
      if (studentResult.total > studentResult.students.length) setError(`Showing the first ${studentResult.students.length} of ${studentResult.total} learners. Contact your School Admin to process the full class.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the promotion register");
    } finally {
      setLoading(false);
    }
  }, [classId, termThree?.id, termThree?.is_closed]);

  useEffect(() => { void loadSetup(); }, [loadSetup]);
  useEffect(() => { void loadRegister(); }, [loadRegister]);

  function updateDraft(studentId: string, field: keyof DecisionDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] ?? { decision: "promote", target_class_id: "", teacher_remark: "" }), [field]: value },
    }));
  }

  async function submitRegister() {
    const pendingStudents = students.filter((student) => !saved.some((item) => item.student_id === student.id));
    const decisions = pendingStudents.map((student) => {
      const draft = drafts[student.id] ?? { decision: "promote" as const, target_class_id: "", teacher_remark: "" };
      return { student_id: student.id, decision: draft.decision, target_class_id: draft.target_class_id || null, teacher_remark: draft.teacher_remark };
    });
    if (!decisions.length) return;
    if (decisions.some((item) => ["promote", "repeat"].includes(item.decision) && !item.target_class_id)) {
      setError("Choose a next-year class for every learner marked Promote or Repeat.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<{ saved_count: number }>("/api/school/promotions", {
        method: "POST",
        body: JSON.stringify({ class_id: classId, term_id: termThree?.id, decisions }),
      });
      setNotice(`${result.saved_count} decision(s) submitted for School Admin review.`);
      await loadRegister();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not submit promotion decisions");
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return null;
  return <div className="relative min-h-screen bg-background font-body text-foreground">
    <div className="pointer-events-none fixed inset-0 ambient-wash" />
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-2.5"><div className="grid size-9 place-items-center rounded-md bg-primary font-display text-base font-bold text-primary-foreground">S</div><div className="leading-tight"><p className="font-display text-[15px] font-bold">Teacher Portal</p><p className="text-[11px] text-muted-foreground">Class promotion</p></div></div>
      <Button variant="outline" size="sm" onClick={() => { void neonAuthClient?.signOut(); navigate({ to: "/login" }); }}><LogOut />Sign out</Button>
    </header>
    <main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><GraduationCap className="size-5" /></div><h1 className="font-display text-3xl font-bold">Class promotion</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Submit Term 3 placement recommendations. Enrollment changes only after School Admin approval.</p></div><Button variant="outline" onClick={() => navigate({ to: "/teacher" })}>Back to portal</Button></div>
      <section className="glass-panel mt-5 rounded-lg p-4">
        <label className="block max-w-md space-y-1 text-xs font-medium text-muted-foreground">Class<select value={classId} onChange={(event) => setClassId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>)}</select></label>
        {error && <p role="alert" className="mt-3 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      </section>
      {loading ? <div className="glass-panel mt-4 rounded-lg p-8 text-sm text-muted-foreground">Loading promotion register...</div> : !termThree?.is_closed ? (
        <div className="glass-panel mt-4 rounded-lg p-8 text-center"><LockKeyhole className="mx-auto size-7 text-amber-600" /><h2 className="mt-3 font-display text-lg font-bold">Promotion is not open</h2><p className="mt-1 text-sm text-muted-foreground">School Admin must close Term 3 for this class&apos;s academic year first.</p></div>
      ) : students.length === 0 ? (
        <div className="glass-panel mt-4 rounded-lg p-8 text-center"><h2 className="font-display text-lg font-bold">No active students in this class</h2><p className="mt-1 text-sm text-muted-foreground">Enroll learners before preparing promotion recommendations.</p></div>
      ) : <section className="glass-panel mt-4 overflow-hidden rounded-lg">
        <div className="border-b border-border px-5 py-4"><h2 className="font-display text-lg font-bold">{activeClass?.name} promotion register</h2><p className="mt-1 text-xs text-muted-foreground">Target classes must belong to a different academic year. Recommendations stay pending until an administrator reviews them.</p></div>
        <div className="divide-y divide-border/70">
          {students.map((student) => {
            const existing = saved.find((item) => item.student_id === student.id);
            const draft = drafts[student.id] ?? { decision: "promote" as const, target_class_id: "", teacher_remark: "" };
            return <div key={student.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1.1fr_1fr_1fr_1.3fr] sm:items-center sm:px-5">
              <div><p className="font-medium">{student.first_name} {student.last_name}</p><p className="font-mono text-[11px] text-muted-foreground">{student.student_id_number}</p></div>
              {existing ? <><p className="text-sm capitalize">{existing.decision} · {existing.status}</p><p className="text-xs text-muted-foreground">{existing.review_remark ?? (existing.status === "pending" ? "Awaiting School Admin review" : "Reviewed by School Admin")}</p><span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="size-4" />Submitted</span></> : <>
                <select value={draft.decision} onChange={(event) => updateDraft(student.id, "decision", event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="promote">Promote</option><option value="repeat">Repeat</option><option value="transfer">Transfer</option><option value="graduate">Graduate</option></select>
                {["promote", "repeat"].includes(draft.decision) ? <select value={draft.target_class_id} onChange={(event) => updateDraft(student.id, "target_class_id", event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Select next-year class</option>{targetClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>)}</select> : <span className="text-xs text-muted-foreground">No target class required</span>}
                <Input value={draft.teacher_remark} maxLength={2000} placeholder="Teacher remark (optional)" onChange={(event) => updateDraft(student.id, "teacher_remark", event.target.value)} />
              </>}
            </div>;
          })}
        </div>
        {students.some((student) => !saved.some((item) => item.student_id === student.id)) && <div className="flex justify-end border-t border-border px-5 py-4"><Button disabled={saving} onClick={() => void submitRegister()}>{saving ? "Submitting..." : "Submit for School Admin review"}</Button></div>}
      </section>}
    </main>
  </div>;
}
