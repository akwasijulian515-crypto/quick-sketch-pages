import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Link2, Plus, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolTeamSetup } from "@/components/school-team-setup";
import { SchoolShell } from "@/components/school-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers")({
  head: () => ({ meta: [{ title: "Teachers — Klasora" }, { name: "description", content: "Manage teachers, subjects, and teaching assignments." }] }),
  component: TeachersPage,
});

type Subject = { id: string; name: string; code: string };
type Teacher = { user_id: string; display_name: string; email: string };
type TeachingRow = {
  class_id: string;
  class_name: string;
  academic_year_id: string;
  academic_year_name: string;
  class_subject_id: string | null;
  subject_id: string | null;
  subject_code: string | null;
  subject_name: string | null;
  teacher_user_id: string | null;
  teacher_name: string | null;
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

function TeachersPage() {
  const [view, setView] = useState<"teachers" | "subjects">("teachers");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<TeachingRow[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; academic_year_id: string; academic_year_name: string }[]>([]);
  const [dialog, setDialog] = useState<"subject" | "assignment" | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [assignedTeacher, setAssignedTeacher] = useState("");
  const [assignedClass, setAssignedClass] = useState("");
  const [assignedSubject, setAssignedSubject] = useState("");
  const [canManageStaff, setCanManageStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setCanManageStaff(sessionStorage.getItem("hg-role") === "school_admin");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, classResult] = await Promise.all([
        schoolApi<{
        assignments: TeachingRow[];
        teachers: Teacher[];
        subjects: Subject[];
        }>("/api/school/teaching-setup"),
        schoolApi<{ classes: { id: string; name: string; academic_year_id: string; academic_year_name: string }[] }>("/api/school/classes"),
      ]);
      setAssignments(result.assignments);
      setTeachers(result.teachers);
      setSubjects(result.subjects);
      setClasses(classResult.classes);
      setAssignedTeacher((current) => current || result.teachers[0]?.user_id || "");
      setAssignedClass((current) => current || classResult.classes[0]?.id || "");
      setAssignedSubject((current) => current || result.subjects[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load teaching setup");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const teacherRows = teachers.map((teacher) => {
    const teacherAssignments = assignments.filter((item) => item.teacher_user_id === teacher.user_id);
    return {
      teacher: teacher.display_name,
      classes: [...new Set(teacherAssignments.map((item) => item.class_name))].join(", ") || "Unassigned",
      subjects: [...new Set(teacherAssignments.map((item) => item.subject_name).filter(Boolean))].join(", ") || "No subject assigned",
      status: teacherAssignments.length ? "Assigned" : "Unassigned",
    };
  });

  async function createSubject(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<{ subject: Subject }>("/api/school/teaching-setup", {
        method: "POST",
        body: JSON.stringify({ assignment_type: "create_subject", subject_name: subjectName, subject_code: subjectCode }),
      });
      await load();
      setAssignedSubject(result.subject.id);
      setSubjectName("");
      setSubjectCode("");
      setDialog(null);
      setNotice("Subject created.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not create subject");
    } finally {
      setSaving(false);
    }
  }

  async function createAssignment(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await schoolApi("/api/school/teaching-setup", {
        method: "POST",
        body: JSON.stringify({
          assignment_type: "subject",
          class_id: assignedClass,
          subject_id: assignedSubject,
          teacher_user_id: assignedTeacher || null,
        }),
      });
      await load();
      setDialog(null);
      setNotice("Subject linked to class.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not link subject to class");
    } finally {
      setSaving(false);
    }
  }

  return <SchoolShell title="Teachers & subjects"><div className="mx-auto max-w-6xl rise">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border">{view === "teachers" ? <UsersRound className="size-5" /> : <BookOpen className="size-5" />}</div><h1 className="font-display text-3xl font-bold">Teachers & subjects</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create subjects and assign each teacher to the right class and teaching load.</p></div>{view === "teachers" ? canManageStaff ? <Button onClick={() => document.getElementById("staff-setup")?.scrollIntoView({ behavior: "smooth", block: "start" })}><Plus />Add a teacher</Button> : null : canManageStaff ? <Button onClick={() => setDialog("subject")}><Plus />Add subject</Button> : null}</div>
    {canManageStaff && <SchoolTeamSetup onDataChanged={() => void load()} />}
    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    <section className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Teachers" value={loading ? "—" : String(teachers.length)} note="Saved school teachers" /><Metric label="Subjects" value={loading ? "—" : String(subjects.length)} note="Saved school subjects" /><Metric label="Teaching assignments" value={loading ? "—" : String(assignments.filter((item) => item.class_subject_id && item.teacher_user_id).length)} note="Class, subject, and teacher links" /></section>
    <section className="glass-panel mt-4 overflow-hidden rounded-lg"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="flex rounded-md border border-input bg-background/70 p-1"><button type="button" onClick={() => setView("teachers")} className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors", view === "teachers" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Teachers & load</button><button type="button" onClick={() => setView("subjects")} className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors", view === "subjects" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Subjects</button></div>{view === "subjects" && canManageStaff && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setDialog("subject")}><Plus />Add subject</Button><Button size="sm" variant="outline" disabled={!subjects.length || !classes.length} onClick={() => setDialog("assignment")}><Link2 />Assign subject</Button></div>}</div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{(view === "teachers" ? ["Teacher", "Classes", "Subjects", "Status"] : ["Subject", "Code", "Class assignments", "Responsible teachers"]).map((column) => <th key={column} className="px-5 py-3 font-medium">{column}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{loading ? <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">Loading teaching setup...</td></tr> : view === "teachers" ? teacherRows.map((row) => <tr key={row.teacher} className="hover:bg-muted/30"><td className="px-5 py-4 font-medium">{row.teacher}</td><td className="px-5 py-4">{row.classes}</td><td className="px-5 py-4">{row.subjects}</td><td className="px-5 py-4"><Badge value={row.status} /></td></tr>) : subjects.map((subject) => { const subjectClasses = assignments.filter((item) => item.subject_id === subject.id); const classNames = [...new Set(subjectClasses.map((item) => item.class_name))]; const teacherNames = [...new Set(subjectClasses.map((item) => item.teacher_name).filter(Boolean))]; return <tr key={subject.id} className="hover:bg-muted/30"><td className="px-5 py-4 font-medium">{subject.name}</td><td className="px-5 py-4 font-mono text-xs">{subject.code}</td><td className="px-5 py-4">{classNames.join(", ") || "Not assigned"}</td><td className="px-5 py-4">{teacherNames.join(", ") || <Badge value="Needs teacher" />}</td></tr>; })}{!loading && (view === "teachers" ? teacherRows.length === 0 : subjects.length === 0) && <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">{view === "teachers" ? "No teachers have been added to this school yet." : "No subjects have been created yet."}</td></tr>}</tbody></table></div></section>
  </div>{dialog === "subject" && <SubjectDialog name={subjectName} code={subjectCode} saving={saving} setName={setSubjectName} setCode={setSubjectCode} onClose={() => setDialog(null)} onSubmit={createSubject} />}{dialog === "assignment" && <AssignmentDialog teacher={assignedTeacher} classId={assignedClass} subjectId={assignedSubject} subjects={subjects} teachers={teachers} classes={classes} saving={saving} setTeacher={setAssignedTeacher} setClass={setAssignedClass} setSubject={setAssignedSubject} onClose={() => setDialog(null)} onSubmit={createAssignment} />}</SchoolShell>;
}

function SubjectDialog({ name, code, saving, setName, setCode, onClose, onSubmit }: { name: string; code: string; saving: boolean; setName: (value: string) => void; setCode: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <Dialog title="Create subject" description="Create a school subject, then link it to one or more classes." onClose={onClose}><form onSubmit={onSubmit}><Field label="Subject name"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. French" className="input" /></Field><Field label="Subject code"><input required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="e.g. FRE" maxLength={24} className="input" /></Field><DialogActions onClose={onClose} label={saving ? "Saving..." : "Create subject"} disabled={saving} /></form></Dialog>;
}

function AssignmentDialog({ teacher, classId, subjectId, subjects, teachers, classes, saving, setTeacher, setClass, setSubject, onClose, onSubmit }: { teacher: string; classId: string; subjectId: string; subjects: Subject[]; teachers: Teacher[]; classes: { id: string; name: string; academic_year_id: string; academic_year_name: string }[]; saving: boolean; setTeacher: (value: string) => void; setClass: (value: string) => void; setSubject: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <Dialog title="Assign subject" description="Link a subject to a class and optionally assign a teacher." onClose={onClose}><form onSubmit={onSubmit}><Field label="Class"><select required value={classId} onChange={(event) => setClass(event.target.value)} className="input"><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>)}</select></Field><Field label="Subject"><select required value={subjectId} onChange={(event) => setSubject(event.target.value)} className="input"><option value="">Select subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></Field><Field label="Teacher (optional)"><select value={teacher} onChange={(event) => setTeacher(event.target.value)} className="input"><option value="">Assign later</option>{teachers.map((item) => <option key={item.user_id} value={item.user_id}>{item.display_name}</option>)}</select></Field><DialogActions onClose={onClose} label={saving ? "Saving..." : "Save assignment"} disabled={saving} /></form></Dialog>;
}

function Dialog({ title, description, children, onClose }: { title: string; description: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"><div className="glass-panel w-full max-w-md rounded-lg p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X /></Button></div>{children}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="mt-4 block text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }
function DialogActions({ onClose, label, disabled }: { onClose: () => void; label: string; disabled?: boolean }) { return <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={disabled}>Cancel</Button><Button type="submit" disabled={disabled}>{label}</Button></div>; }
function Badge({ value }: { value: string }) { return <span className={cn("rounded-full px-2 py-1 text-xs font-medium", value === "Assigned" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700")}>{value}</span>; }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
