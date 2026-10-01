import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Link2, Plus, UsersRound, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers")({
  head: () => ({ meta: [{ title: "Teachers — Klasora" }, { name: "description", content: "Manage teachers, subjects, and teaching assignments." }] }),
  component: TeachersPage,
});

type Subject = { id: string; name: string; code: string };
type Assignment = { id: string; teacher: string; className: string; subjectId: string };

const teacherNames: string[] = [];
const classes: string[] = [];
const initialSubjects: Subject[] = [];
const initialAssignments: Assignment[] = [];

function TeachersPage() {
  const [view, setView] = useState<"teachers" | "subjects">("teachers");
  const [subjects, setSubjects] = useState(initialSubjects);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [dialog, setDialog] = useState<"subject" | "assignment" | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [assignedTeacher, setAssignedTeacher] = useState("");
  const [assignedClass, setAssignedClass] = useState("");
  const [assignedSubject, setAssignedSubject] = useState("");

  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);

  function createSubject(event: FormEvent) {
    event.preventDefault();
    const name = subjectName.trim();
    const code = subjectCode.trim().toUpperCase();
    if (!name || !code || subjects.some((subject) => subject.code === code)) return;
    const id = `${code.toLowerCase()}-${subjects.length + 1}`;
    setSubjects((current) => [...current, { id, name, code }]);
    setAssignedSubject(id);
    setSubjectName(""); setSubjectCode(""); setDialog(null);
  }

  function createAssignment(event: FormEvent) {
    event.preventDefault();
    if (assignments.some((assignment) => assignment.teacher === assignedTeacher && assignment.className === assignedClass && assignment.subjectId === assignedSubject)) return;
    setAssignments((current) => [...current, { id: `assignment-${current.length + 1}`, teacher: assignedTeacher, className: assignedClass, subjectId: assignedSubject }]);
    setDialog(null);
  }

  const teacherRows = teacherNames.map((teacher) => {
    const teacherAssignments = assignments.filter((assignment) => assignment.teacher === teacher);
    return { teacher, classes: [...new Set(teacherAssignments.map((assignment) => assignment.className))].join(", ") || "Unassigned", subjects: teacherAssignments.map((assignment) => subjectById.get(assignment.subjectId)?.name ?? "Unknown").join(", ") || "No subject assigned", status: teacherAssignments.length ? "Assigned" : "Unassigned" };
  });

  return <SchoolShell title="Teachers & subjects"><div className="mx-auto max-w-6xl rise">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border">{view === "teachers" ? <UsersRound className="size-5" /> : <BookOpen className="size-5" />}</div><h1 className="font-display text-3xl font-bold">Teachers & subjects</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create subjects and assign each teacher to the right class and teaching load.</p></div><Button disabled={view === "teachers"} onClick={() => setDialog(view === "teachers" ? "assignment" : "subject")}><Plus />{view === "teachers" ? "Assign teacher" : "Add subject"}</Button></div>
    <section className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Teachers" value="—" note="Live teacher data not connected" /><Metric label="Subjects" value={String(subjects.length)} note="Subjects in this page session" /><Metric label="Teaching assignments" value="—" note="Live assignment data not connected" /></section>
    <section className="glass-panel mt-4 overflow-hidden rounded-lg"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="flex rounded-md border border-input bg-background/70 p-1"><button type="button" onClick={() => setView("teachers")} className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors", view === "teachers" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Teachers & load</button><button type="button" onClick={() => setView("subjects")} className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors", view === "subjects" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Subjects</button></div>{view === "subjects" && <Button size="sm" variant="outline" disabled={teacherNames.length === 0 || classes.length === 0 || subjects.length === 0} onClick={() => setDialog("assignment")}><Link2 />Assign subject</Button>}</div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{(view === "teachers" ? ["Teacher", "Classes", "Subjects", "Status"] : ["Subject", "Code", "Class assignments", "Responsible teachers"]).map((column) => <th key={column} className="px-5 py-3 font-medium">{column}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{view === "teachers" ? teacherRows.map((row) => <tr key={row.teacher} className="hover:bg-muted/30"><td className="px-5 py-4 font-medium">{row.teacher}</td><td className="px-5 py-4">{row.classes}</td><td className="px-5 py-4">{row.subjects}</td><td className="px-5 py-4"><Badge value={row.status} /></td></tr>) : subjects.map((subject) => { const subjectAssignments = assignments.filter((assignment) => assignment.subjectId === subject.id); return <tr key={subject.id} className="hover:bg-muted/30"><td className="px-5 py-4 font-medium">{subject.name}</td><td className="px-5 py-4 font-mono text-xs">{subject.code}</td><td className="px-5 py-4">{subjectAssignments.map((assignment) => assignment.className).join(", ") || "Not assigned"}</td><td className="px-5 py-4">{subjectAssignments.map((assignment) => assignment.teacher).join(", ") || <Badge value="Needs teacher" />}</td></tr> })}{(view === "teachers" ? teacherRows.length === 0 : subjects.length === 0) && <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">Live {view === "teachers" ? "teacher and assignment" : "subject"} data is not connected yet.</td></tr>}</tbody></table></div></section>
  </div>{dialog === "subject" && <SubjectDialog name={subjectName} code={subjectCode} setName={setSubjectName} setCode={setSubjectCode} onClose={() => setDialog(null)} onSubmit={createSubject} />}{dialog === "assignment" && <AssignmentDialog teacher={assignedTeacher} className={assignedClass} subject={assignedSubject} subjects={subjects} setTeacher={setAssignedTeacher} setClass={setAssignedClass} setSubject={setAssignedSubject} onClose={() => setDialog(null)} onSubmit={createAssignment} />}</SchoolShell>;
}

function SubjectDialog({ name, code, setName, setCode, onClose, onSubmit }: { name: string; code: string; setName: (value: string) => void; setCode: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) { return <Dialog title="Create subject" description="Subjects can then be assigned to a class and teacher." onClose={onClose}><form onSubmit={onSubmit}><Field label="Subject name"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. French" className="input" /></Field><Field label="Subject code"><input required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="e.g. FRE" maxLength={12} className="input" /></Field><DialogActions onClose={onClose} label="Create subject" /></form></Dialog>; }
function AssignmentDialog({ teacher, className, subject, subjects, setTeacher, setClass, setSubject, onClose, onSubmit }: { teacher: string; className: string; subject: string; subjects: Subject[]; setTeacher: (value: string) => void; setClass: (value: string) => void; setSubject: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) { return <Dialog title="Assign teacher" description="Connect a teacher with a subject in a particular class." onClose={onClose}><form onSubmit={onSubmit}><Field label="Teacher"><select value={teacher} onChange={(event) => setTeacher(event.target.value)} className="input">{teacherNames.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Class"><select value={className} onChange={(event) => setClass(event.target.value)} className="input">{classes.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Subject"><select value={subject} onChange={(event) => setSubject(event.target.value)} className="input">{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><DialogActions onClose={onClose} label="Save assignment" /></form></Dialog>; }
function Dialog({ title, description, children, onClose }: { title: string; description: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"><div className="glass-panel w-full max-w-md rounded-lg p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X /></Button></div>{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-4 block text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }
function DialogActions({ onClose, label }: { onClose: () => void; label: string }) { return <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{label}</Button></div>; }
function Badge({ value }: { value: string }) { return <span className={cn("rounded-full px-2 py-1 text-xs font-medium", value === "Assigned" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700")}>{value}</span>; }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
