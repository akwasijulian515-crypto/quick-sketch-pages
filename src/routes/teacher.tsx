import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, BookOpenCheck, FileText, LogOut, TicketCheck, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { getNeonAccessToken, neonAuthClient } from "../auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher Portal — Klasora" },
      { name: "description", content: "Teacher mark entry and school tools." },
    ],
  }),
  component: TeacherPortal,
});

type TeacherTab = "register" | "grades" | "coupons";

function TeacherPortal() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState<TeacherTab>("register");

  useEffect(() => {
    let cancelled = false;
    async function verifyTeacher() {
      try {
        const token = await getNeonAccessToken();
        const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
        const endpoint = tenant ? `/api/auth/context?tenant=${encodeURIComponent(tenant)}` : "/api/auth/context";
        const response = await fetch(endpoint, { headers: { authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => null) as { membership?: { role?: string } } | null;
        if (!response.ok || payload?.membership?.role !== "teacher") throw new Error("Teacher membership is required");
        if (!cancelled) setAllowed(true);
      } catch {
        if (!cancelled) window.location.assign(`/login${window.location.search}`);
      }
    }
    void verifyTeacher();
    return () => { cancelled = true; };
  }, []);

  if (!allowed) return null;
  return <div className="relative min-h-screen bg-background font-body text-foreground">
    <div className="pointer-events-none fixed inset-0 ambient-wash" />
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-2.5"><div className="grid size-9 place-items-center rounded-md bg-primary font-display text-base font-bold text-primary-foreground">S</div><div className="leading-tight"><p className="font-display text-[15px] font-bold">Teacher Portal</p><p className="text-[11px] text-muted-foreground">School workspace</p></div></div>
      <Button variant="outline" size="sm" onClick={() => { void neonAuthClient?.signOut(); navigate({ to: "/login" }); }}><LogOut />Sign out</Button>
    </header>
    <main className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div><h1 className="font-display text-2xl font-bold sm:text-3xl">Teacher workspace</h1><p className="mt-1 text-sm text-muted-foreground">Use your assigned classes and subjects to manage school records.</p></div>
        <div className="flex flex-wrap gap-2">
          {([
            ["register", "Register", UserRoundCheck],
            ["grades", "Grades", BookOpenCheck],
            ["coupons", "Coupons", TicketCheck],
          ] as const).map(([id, label, Icon]) => <Button key={id} variant={tab === id ? "default" : "outline"} size="sm" onClick={() => setTab(id)}><Icon />{label}</Button>)}
          <Button asChild size="sm" variant="outline"><Link to="/terminal-reports"><FileText />Reports</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/teacher/promotion"><ArrowUpRight />Promotion</Link></Button>
        </div>
      </div>

      {tab === "grades" ? <TeacherMarkEntry /> : <section className="glass-panel mt-5 rounded-lg border border-dashed border-border p-10 text-center">
        {tab === "register" ? <UserRoundCheck className="mx-auto size-7 text-primary/55" /> : <TicketCheck className="mx-auto size-7 text-primary/55" />}
        <h2 className="mt-3 font-display text-lg font-bold">{tab === "register" ? "Attendance records are not connected" : "Daily payment records are not connected"}</h2>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{tab === "register" ? "No attendance sessions or learner records are being shown here yet. Connect the attendance workflow before taking a register." : "Payment and coupon status is not available from this workspace yet. Check the Finance portal for supported payment workflows."}</p>
      </section>}
    </main>
  </div>;
}

type MarkAssignment = {
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

type MarkStudent = {
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

const markFields = [
  ["class_test_score", "Test /10", 10],
  ["project_score", "Project /20", 20],
  ["homework_score", "Homework /10", 10],
  ["group_work_score", "Group /10", 10],
  ["exam_score", "Exam /100", 100],
] as const;

async function teacherApi<T>(path: string, init?: RequestInit): Promise<T> {
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

function TeacherMarkEntry() {
  const [assignments, setAssignments] = useState<MarkAssignment[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [students, setStudents] = useState<MarkStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = assignments.find((item) => `${item.class_subject_id}:${item.term_id}` === selectedKey);

  useEffect(() => {
    let cancelled = false;
    void teacherApi<{ assignments: MarkAssignment[] }>("/api/school/marks")
      .then((result) => {
        if (cancelled) return;
        setAssignments(result.assignments);
        const first = result.assignments[0];
        if (first) setSelectedKey(`${first.class_subject_id}:${first.term_id}`);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load teacher assignments");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      setStudents([]);
      return;
    }
    setLoading(true);
    setError("");
    void teacherApi<{ students: MarkStudent[] }>(
      `/api/school/marks?class_subject_id=${encodeURIComponent(selected.class_subject_id)}&term_id=${encodeURIComponent(selected.term_id)}`,
    )
      .then((result) => { if (!cancelled) setStudents(result.students); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load marks");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  function updateMark(studentId: string, field: typeof markFields[number][0], input: string) {
    const limit = markFields.find(([key]) => key === field)?.[2] ?? 0;
    if (input !== "" && (!/^\d{0,3}(?:\.\d{0,2})?$/.test(input) || Number(input) > limit)) return;
    setStudents((current) => current.map((student) => student.student_id === studentId
      ? { ...student, [field]: input === "" ? null : Number(input), total_score: null, performance_level: null }
      : student));
    setNotice("");
  }

  async function saveMarks() {
    if (!selected || students.length === 0) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await teacherApi("/api/school/marks", {
        method: "PUT",
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
      const refreshed = await teacherApi<{ students: MarkStudent[] }>(
        `/api/school/marks?class_subject_id=${encodeURIComponent(selected.class_subject_id)}&term_id=${encodeURIComponent(selected.term_id)}`,
      );
      setStudents(refreshed.students);
      setNotice("Marks saved. Final score and NaCCA performance level are calculated automatically.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save marks");
    } finally {
      setSaving(false);
    }
  }

  return <section className="glass-panel mt-5 overflow-hidden rounded-lg">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div><h2 className="font-display text-lg font-bold">Subject mark sheet</h2><p className="text-xs text-muted-foreground">Coursework totals 50 marks; half of the exam score adds the remaining 50.</p></div>
      <select aria-label="Class, subject and term" value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} className="h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm">
        {assignments.length === 0 && <option value="">No subject assignments available</option>}
        {assignments.map((item) => <option key={`${item.class_subject_id}:${item.term_id}`} value={`${item.class_subject_id}:${item.term_id}`}>{item.class_name} · {item.subject_name} · {item.term_name}</option>)}
      </select>
    </div>
    {error && <p role="alert" className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mx-5 mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading marks...</p> : students.length === 0 ? (
      <p className="py-10 text-center text-sm text-muted-foreground">{assignments.length ? "No active students are enrolled in this class." : "Ask your School Admin to assign you to a class subject before entering marks."}</p>
    ) : <>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Student</th>{markFields.map(([, label]) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}<th className="px-4 py-3 font-medium">Final /100</th><th className="px-4 py-3 font-medium">Level</th></tr></thead>
        <tbody className="divide-y divide-border/70">{students.map((student) => <tr key={student.student_id}>
          <td className="px-4 py-3"><p className="font-medium">{student.first_name} {student.last_name}</p><p className="font-mono text-[11px] text-muted-foreground">{student.admission_number}</p></td>
          {markFields.map(([field, label, limit]) => <td key={field} className="px-3 py-3"><input aria-label={`${student.first_name} ${label}`} type="number" min="0" max={limit} step="0.01" value={student[field] ?? ""} onChange={(event) => updateMark(student.student_id, field, event.target.value)} className="h-9 w-20 rounded-md border border-input bg-background px-2 text-center" /></td>)}
          <td className="px-4 py-3 font-display">{student.total_score == null ? "Incomplete" : Number(student.total_score).toFixed(2)}</td>
          <td className="px-4 py-3">{student.performance_level ?? "—"}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="flex justify-end border-t border-border px-5 py-4"><Button disabled={saving} onClick={() => void saveMarks()}>{saving ? "Saving..." : "Save marks"}</Button></div>
    </>}
  </section>;
}
