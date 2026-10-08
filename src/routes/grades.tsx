import { createFileRoute } from "@tanstack/react-router";
import { BookOpenCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/grades")({
  head: () => ({ meta: [{ title: "Grades — Klasora" }, { name: "description", content: "Enter and review student grades by assigned subject." }] }),
  component: GradesPage,
});

type MarkField = "class_test_score" | "project_score" | "homework_score" | "group_work_score" | "exam_score";
type Assignment = {
  class_subject_id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  academic_year_id: string;
  academic_year_name: string;
  term_id: string;
  term_name: string;
};
type StudentMark = {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_test_score: number | null;
  project_score: number | null;
  homework_score: number | null;
  group_work_score: number | null;
  exam_score: number | null;
  total_score: number | null;
  performance_level: string | null;
};
const fields: { key: MarkField; label: string; max: number }[] = [
  { key: "class_test_score", label: "Test /10", max: 10 },
  { key: "project_score", label: "Project /20", max: 20 },
  { key: "homework_score", label: "Homework /10", max: 10 },
  { key: "group_work_score", label: "Group /10", max: 10 },
  { key: "exam_score", label: "Exam /100", max: 100 },
];

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

function GradesPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selection, setSelection] = useState("");
  const [students, setStudents] = useState<StudentMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = useMemo(() => assignments.find((item) => `${item.class_subject_id}:${item.term_id}` === selection), [assignments, selection]);

  useEffect(() => {
    let cancelled = false;
    void schoolApi<{ assignments: Assignment[] }>("/api/school/marks")
      .then((result) => {
        if (cancelled) return;
        setAssignments(result.assignments);
        const current = result.assignments[0];
        if (current) setSelection(`${current.class_subject_id}:${current.term_id}`);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load grade setup");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loadStudents = useCallback(async () => {
    if (!selected) {
      setStudents([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ class_subject_id: selected.class_subject_id, term_id: selected.term_id });
      const result = await schoolApi<{ students: StudentMark[] }>(`/api/school/marks?${query}`);
      setStudents(result.students);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load student grades");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { void loadStudents(); }, [loadStudents]);

  function updateMark(studentId: string, field: MarkField, value: string, max: number) {
    const score = value === "" ? null : Number(value);
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > max)) return;
    setStudents((current) => current.map((student) => student.student_id === studentId ? { ...student, [field]: score } : student));
    setNotice("");
  }

  async function save() {
    if (!selected || students.length === 0) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<{ saved: number }>("/api/school/marks", {
        method: "POST",
        body: JSON.stringify({
          class_subject_id: selected.class_subject_id,
          term_id: selected.term_id,
          marks: students.map((student) => ({
            student_id: student.student_id,
            class_test_score: student.class_test_score,
            project_score: student.project_score,
            homework_score: student.homework_score,
            group_work_score: student.group_work_score,
            exam_score: student.exam_score,
          })),
        }),
      });
      setNotice(`Grades saved for ${result.saved} student${result.saved === 1 ? "" : "s"}.`);
      await loadStudents();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save grades");
    } finally {
      setSaving(false);
    }
  }

  return <SchoolShell title="Grades" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><BookOpenCheck className="size-5" /></div><h1 className="font-display text-3xl font-bold">Grades</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Enter scores for subjects linked to classes and review saved results by term.</p></div>
    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    <section className="glass-panel mt-5 rounded-lg p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="space-y-1 text-xs font-medium text-muted-foreground">Class · subject · term<select value={selection} onChange={(event) => setSelection(event.target.value)} className="h-10 w-full min-w-64 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Select a subject assignment</option>{assignments.map((item) => <option key={`${item.class_subject_id}:${item.term_id}`} value={`${item.class_subject_id}:${item.term_id}`}>{item.class_name} · {item.subject_name} · {item.academic_year_name} {item.term_name}</option>)}</select></label><Button onClick={() => void save()} disabled={saving || loading || !selected || students.length === 0}>{saving ? "Saving..." : "Save grades"}</Button></div></section>
    <section className="glass-panel mt-4 overflow-hidden rounded-lg">{loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading grades...</p> : !assignments.length ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No class subjects are configured yet. Create a subject and link it to a class in Teachers.</p> : !students.length ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No active students are enrolled in this class and term.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Student</th>{fields.map((field) => <th key={field.key} className="px-3 py-3 font-medium">{field.label}</th>)}<th className="px-4 py-3 font-medium">Final /100</th><th className="px-4 py-3 font-medium">Level</th></tr></thead><tbody className="divide-y divide-border/70">{students.map((student) => <tr key={student.student_id}><td className="px-4 py-3"><p className="font-medium">{student.first_name} {student.last_name}</p><p className="font-mono text-xs text-muted-foreground">{student.admission_number}</p></td>{fields.map((field) => <td key={field.key} className="px-3 py-3"><input aria-label={`${student.first_name} ${field.label}`} type="number" min="0" max={field.max} step="0.01" value={student[field.key] ?? ""} onChange={(event) => updateMark(student.student_id, field.key, event.target.value, field.max)} className="h-9 w-20 rounded-md border border-input bg-background px-2 text-center" /></td>)}<td className="px-4 py-3">{student.total_score ?? "—"}</td><td className="px-4 py-3">{student.performance_level ?? "—"}</td></tr>)}</tbody></table></div>}</section>
  </div></SchoolShell>;
}
