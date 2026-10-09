import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, BookOpenCheck, CalendarDays, CheckCircle2, FileText, LogOut, TicketCheck, UserRoundCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getNeonAccessToken, neonAuthClient } from "../auth/client";
import { Button } from "@/components/ui/button";
import { LearnerProfileEntry } from "@/components/learner-profile-entry";
import { calculateMarkResult } from "@/lib/grade-calculations";

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

      {tab === "grades" ? <TeacherMarkEntry /> : tab === "register" ? <AttendanceRegister /> : <section className="glass-panel mt-5 rounded-lg border border-dashed border-border p-10 text-center">
        <TicketCheck className="mx-auto size-7 text-primary/55" />
        <h2 className="mt-3 font-display text-lg font-bold">Daily payment records are not connected</h2>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">Payment and coupon status is not available from this workspace yet. Check the Finance portal for supported payment workflows.</p>
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

type AttendanceStatus = "present" | "late" | "absent" | "excused";
type AttendanceClass = { id: string; name: string; academic_year_name: string; student_count: number };
type AttendanceStudent = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  status: AttendanceStatus | null;
  note: string;
};
type AttendanceDay = {
  attendance_date: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  marked_count: number;
};

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function AttendanceRegister() {
  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(() => localDateString(new Date()));
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [days, setDays] = useState<AttendanceDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedClass = classes.find((item) => item.id === classId);
  const month = date.slice(0, 7);
  const [yearNumber, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(yearNumber!, monthNumber! - 1, 1);
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: monthStart.getDay() }, () => null),
    ...Array.from({ length: new Date(yearNumber!, monthNumber!, 0).getDate() }, (_, index) => index + 1),
  ];
  const dayByDate = new Map(days.map((day) => [day.attendance_date, day]));
  const totals = days.reduce((result, day) => ({
    present: result.present + Number(day.present_count),
    late: result.late + Number(day.late_count),
    absent: result.absent + Number(day.absent_count),
    excused: result.excused + Number(day.excused_count),
    sessions: result.sessions + 1,
  }), { present: 0, late: 0, absent: 0, excused: 0, sessions: 0 });

  useEffect(() => {
    let cancelled = false;
    void teacherApi<{ classes: AttendanceClass[] }>("/api/school/attendance")
      .then((result) => {
        if (cancelled) return;
        setClasses(result.classes);
        setClassId((current) => current || result.classes[0]?.id || "");
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load assigned classes");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!classId) {
      setStudents([]);
      setDays([]);
      return;
    }
    setLoading(true);
    setError("");
    void Promise.all([
      teacherApi<{ session_id: string | null; students: AttendanceStudent[] }>(
        `/api/school/attendance?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`,
      ),
      teacherApi<{ days: AttendanceDay[] }>(
        `/api/school/attendance?class_id=${encodeURIComponent(classId)}&month=${encodeURIComponent(month)}`,
      ),
    ])
      .then(([register, monthly]) => {
        if (cancelled) return;
        setStudents(register.students);
        setDays(monthly.days);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load attendance");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [classId, date, month]);

  function setStudentStatus(studentId: string, status: AttendanceStatus) {
    setStudents((current) => current.map((student) => student.id === studentId ? { ...student, status } : student));
    setNotice("");
  }

  function setStudentNote(studentId: string, note: string) {
    setStudents((current) => current.map((student) => student.id === studentId ? { ...student, note } : student));
  }

  async function saveRegister() {
    if (!classId || students.length === 0 || students.some((student) => student.status === null)) {
      setError("Mark an attendance status for every active learner before saving.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await teacherApi<{ saved_count: number }>("/api/school/attendance", {
        method: "POST",
        body: JSON.stringify({
          class_id: classId,
          date,
          records: students.map((student) => ({
            student_id: student.id,
            status: student.status,
            note: student.note,
          })),
        }),
      });
      setNotice(`Attendance saved for ${result.saved_count} learner${result.saved_count === 1 ? "" : "s"}.`);
      const [register, monthly] = await Promise.all([
        teacherApi<{ students: AttendanceStudent[] }>(
          `/api/school/attendance?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`,
        ),
        teacherApi<{ days: AttendanceDay[] }>(
          `/api/school/attendance?class_id=${encodeURIComponent(classId)}&month=${encodeURIComponent(month)}`,
        ),
      ]);
      setStudents(register.students);
      setDays(monthly.days);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save attendance");
    } finally {
      setSaving(false);
    }
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const statusOptions: { value: AttendanceStatus; label: string; selected: string }[] = [
    { value: "present", label: "Present", selected: "bg-emerald-600 text-white" },
    { value: "late", label: "Late", selected: "bg-amber-500 text-white" },
    { value: "absent", label: "Absent", selected: "bg-rose-600 text-white" },
    { value: "excused", label: "Excused", selected: "bg-sky-600 text-white" },
  ];

  return <div className="mt-5 space-y-4">
    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Class
          <select value={classId} onChange={(event) => setClassId(event.target.value)} className="h-10 w-full min-w-64 rounded-md border border-input bg-background px-3 text-sm text-foreground">
            <option value="">Select assigned class</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Register date
          <input type="date" value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" />
        </label>
      </div>
      {error && <p role="alert" className="mt-3 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    </section>

    {!loading && classes.length === 0 ? (
      <section className="glass-panel rounded-lg border border-dashed border-border p-10 text-center">
        <UserRoundCheck className="mx-auto size-7 text-primary/55" />
        <h2 className="mt-3 font-display text-lg font-bold">No class teacher assignments yet</h2>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">Ask your School Admin to assign you as class teacher before you take attendance.</p>
      </section>
    ) : !loading && classId && students.length === 0 ? (
      <section className="glass-panel rounded-lg border border-dashed border-border p-10 text-center">
        <h2 className="font-display text-lg font-bold">No active learners for this date</h2>
        <p className="mt-1 text-sm text-muted-foreground">This class has no active enrollment records for the selected date.</p>
      </section>
    ) : (
      <section className="glass-panel overflow-hidden rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div><h2 className="font-display text-lg font-bold">{selectedClass?.name ?? "Daily register"}</h2><p className="text-xs text-muted-foreground">{date} · {students.length} active learners</p></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={loading || students.length === 0} onClick={() => setStudents((current) => current.map((student) => ({ ...student, status: "present" })))}><CheckCircle2 />Mark all present</Button>
            <Button type="button" size="sm" disabled={saving || loading || students.length === 0 || students.some((student) => student.status === null)} onClick={() => void saveRegister()}>{saving ? "Saving..." : "Save register"}</Button>
          </div>
        </div>
        {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading attendance register...</p> : (
          <>
            <div className="divide-y divide-border/70 md:hidden">
              {students.map((student) => <article key={student.id} className="p-4">
                <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{student.first_name} {student.last_name}</p><p className="font-mono text-[11px] text-muted-foreground">{student.admission_number}</p></div><span className="text-xs text-muted-foreground">{student.status ? statusOptions.find((item) => item.value === student.status)?.label : "Not marked"}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {statusOptions.map((option) => <button key={option.value} type="button" aria-pressed={student.status === option.value} onClick={() => setStudentStatus(student.id, option.value)} className={`min-h-11 rounded-md px-3 text-sm font-medium ${student.status === option.value ? option.selected : "bg-muted text-muted-foreground"}`}>{option.label}</button>)}
                </div>
                <input aria-label={`Note for ${student.first_name} ${student.last_name}`} value={student.note} maxLength={500} onChange={(event) => setStudentNote(student.id, event.target.value)} placeholder="Optional note" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </article>)}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Learner", "Attendance", "Note"].map((label) => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-border/70">{students.map((student) => <tr key={student.id}>
                  <td className="px-5 py-3"><p className="font-medium">{student.first_name} {student.last_name}</p><p className="font-mono text-[11px] text-muted-foreground">{student.admission_number}</p></td>
                  <td className="px-5 py-3"><div className="flex flex-wrap gap-1.5">{statusOptions.map((option) => <button key={option.value} type="button" aria-pressed={student.status === option.value} onClick={() => setStudentStatus(student.id, option.value)} className={`min-h-9 rounded-full px-3 text-xs font-medium ${student.status === option.value ? option.selected : "bg-muted text-muted-foreground hover:bg-muted-foreground/15"}`}>{option.label}</button>)}</div></td>
                  <td className="px-5 py-3"><input aria-label={`Note for ${student.first_name} ${student.last_name}`} value={student.note} maxLength={500} onChange={(event) => setStudentNote(student.id, event.target.value)} placeholder="Optional note" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" /></td>
                </tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </section>
    )}

    <section className="glass-panel rounded-lg p-4 sm:p-5">
      <div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" /><div><h2 className="font-display text-lg font-bold">Monthly attendance</h2><p className="text-xs text-muted-foreground">{monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })} · {totals.sessions} register day(s)</p></div></div>
      {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading monthly summary...</p> : !classId ? <p className="py-6 text-center text-sm text-muted-foreground">Select a class to view its monthly attendance.</p> : (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[["Present", totals.present], ["Late", totals.late], ["Absent", totals.absent], ["Excused", totals.excused]].map(([label, count]) => <div key={label} className="rounded-md bg-muted/60 px-2 py-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className="font-display text-lg font-bold">{count}</p></div>)}
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {weekdays.map((weekday) => <p key={weekday} className="py-1 text-[11px] font-medium text-muted-foreground">{weekday}</p>)}
            {calendarCells.map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} />;
              const calendarDate = `${month}-${String(day).padStart(2, "0")}`;
              const summary = dayByDate.get(calendarDate);
              return <button key={calendarDate} type="button" onClick={() => setDate(calendarDate)} aria-label={`${calendarDate}${summary ? `, ${summary.marked_count} marked` : ", no register"}`} className={`min-h-12 rounded-md border px-1 py-1 text-xs ${date === calendarDate ? "border-primary bg-primary text-primary-foreground" : summary ? "border-emerald-600/25 bg-emerald-600/5 text-foreground hover:bg-emerald-600/10" : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted"}`}>
                <span className="block font-medium">{day}</span>
                {summary && <span className="block truncate text-[9px]">{summary.present_count}P · {summary.absent_count}A</span>}
              </button>;
            })}
          </div>
        </>
      )}
    </section>
  </div>;
}

function TeacherMarkEntry() {
  const [activeEntryTab, setActiveEntryTab] = useState<"grades" | "profile">("grades");
  const [assignments, setAssignments] = useState<MarkAssignment[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [students, setStudents] = useState<MarkStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const markRevision = useRef(0);
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
      .then((result) => {
        if (!cancelled) {
          setStudents(result.students);
          setAutoSaveState("saved");
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load marks");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  function updateMark(studentId: string, field: typeof markFields[number][0], input: string) {
    const limit = markFields.find(([key]) => key === field)?.[2] ?? 0;
    if (input !== "" && (!/^\d{0,3}(?:\.\d{0,2})?$/.test(input) || Number(input) > limit)) return;
    markRevision.current += 1;
    setStudents((current) => current.map((student) => {
      if (student.student_id !== studentId) return student;
      const updated = { ...student, [field]: input === "" ? null : Number(input) };
      return { ...updated, ...calculateMarkResult(updated) };
    }));
    setAutoSaveState("pending");
    setError("");
    setNotice("");
  }

  const saveMarks = useCallback(async (): Promise<boolean> => {
    if (!selected || students.length === 0) return false;
    const savedRevision = markRevision.current;
    setSaving(true);
    setAutoSaveState("saving");
    setError("");
    setNotice("");
    try {
      await teacherApi("/api/school/marks", {
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
      setNotice("Marks saved. Final score and NaCCA performance level are calculated automatically.");
      setAutoSaveState(markRevision.current === savedRevision ? "saved" : "pending");
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save marks");
      setAutoSaveState("error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [selected, students]);

  useEffect(() => {
    if (autoSaveState !== "pending" || saving || !selected || students.length === 0) return;
    const timer = window.setTimeout(() => { void saveMarks(); }, 900);
    return () => window.clearTimeout(timer);
  }, [autoSaveState, saveMarks, saving, selected, students.length]);

  async function changeAssignment(nextKey: string) {
    if ((autoSaveState === "pending" || autoSaveState === "error") && !(await saveMarks())) return;
    setSelectedKey(nextKey);
  }

  const autoSaveMessage = autoSaveState === "saving" ? "Saving changes…"
    : autoSaveState === "pending" ? "Changes will save automatically…"
      : autoSaveState === "error" ? "Auto-save failed. Use Save now to retry."
        : "All changes saved";

  return <section className="glass-panel mt-5 overflow-hidden rounded-lg">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div><h2 className="font-display text-lg font-bold">Subject mark sheet</h2><p className="text-xs text-muted-foreground">Coursework totals 50 marks; half of the exam score adds the remaining 50.</p></div>
      <div className="flex flex-wrap items-center gap-3">
      <span role="status" className={`text-xs ${autoSaveState === "error" ? "text-destructive" : "text-muted-foreground"}`}>{autoSaveMessage}</span>
      <Button size="sm" variant="outline" disabled={saving || loading || !selected || students.length === 0} onClick={() => void saveMarks()}>{saving ? "Saving..." : "Save now"}</Button>
      <select aria-label="Class, subject and term" value={selectedKey} disabled={saving} onChange={(event) => void changeAssignment(event.target.value)} className="h-9 max-w-full rounded-md border border-input bg-background px-3 text-sm">
        {assignments.length === 0 && <option value="">No subject assignments available</option>}
        {assignments.map((item) => <option key={`${item.class_subject_id}:${item.term_id}`} value={`${item.class_subject_id}:${item.term_id}`}>{item.class_name} · {item.subject_name} · {item.term_name}</option>)}
      </select>
      </div>
    </div>
    <div role="tablist" aria-label="Mark sheet sections" className="flex gap-1 border-b border-border px-5">
      <button role="tab" aria-selected={activeEntryTab === "grades"} onClick={() => setActiveEntryTab("grades")} className={`border-b-2 px-3 py-2 text-sm font-medium ${activeEntryTab === "grades" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>Grades</button>
      <button role="tab" aria-selected={activeEntryTab === "profile"} onClick={() => setActiveEntryTab("profile")} className={`border-b-2 px-3 py-2 text-sm font-medium ${activeEntryTab === "profile" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>Conduct, Attitude &amp; Interest</button>
    </div>
    {error && <p role="alert" className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mx-5 mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    <div role="tabpanel" hidden={activeEntryTab !== "grades"}>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading marks...</p> : students.length === 0 ? (
      <p className="py-10 text-center text-sm text-muted-foreground">{assignments.length ? "No active students are enrolled in this class." : "Ask your School Admin to assign you to a class subject before entering marks."}</p>
    ) : <>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Student</th>{markFields.map(([, label]) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}<th className="px-4 py-3 font-medium">Final /100</th><th className="px-4 py-3 font-medium">Level</th></tr></thead>
        <tbody className="divide-y divide-border/70">{students.map((student) => <tr key={student.student_id}>
          <td className="px-4 py-3"><p className="font-medium">{student.first_name} {student.last_name}</p><p className="font-mono text-[11px] text-muted-foreground">{student.admission_number}</p></td>
          {markFields.map(([field, label, limit]) => <td key={field} className="px-3 py-3"><input aria-label={`${student.first_name} ${label}`} type="number" min="0" max={limit} step="0.01" value={student[field] ?? ""} disabled={saving} onChange={(event) => updateMark(student.student_id, field, event.target.value)} className="h-9 w-20 rounded-md border border-input bg-background px-2 text-center disabled:opacity-60" /></td>)}
          <td className="px-4 py-3 font-display">{student.total_score == null ? "Incomplete" : Number(student.total_score).toFixed(2)}</td>
          <td className="px-4 py-3">{student.performance_level ?? "—"}</td>
        </tr>)}</tbody>
      </table></div>
    </>}</div>
    <div className="px-5">
      <LearnerProfileEntry classId={selected?.class_id ?? ""} termId={selected?.term_id ?? ""} active={activeEntryTab === "profile"} />
    </div>
  </section>;
}
