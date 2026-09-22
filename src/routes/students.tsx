import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, GraduationCap, Plus, Search, UserRoundCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/students")({ head: () => ({ meta: [{ title: "Students — Harrow Green" }, { name: "description", content: "Manage students and monitor attendance." }] }), component: StudentsPage });

const students = [
  { name: "Abena Ofori", admission: "HGA-2B-001", className: "Form 2B", payment: "Paid", attendance: "96%" },
  { name: "Daniel Boateng", admission: "HGA-2B-002", className: "Form 2B", payment: "GH₵ 120 due", attendance: "94%" },
  { name: "Eunice Agyeman", admission: "HGA-2B-003", className: "Form 2B", payment: "Paid", attendance: "91%" },
  { name: "Gloria Mensah", admission: "HGA-2B-005", className: "Form 2B", payment: "GH₵ 80 due", attendance: "89%" },
];
const attendance = [["Form 1A", "31", "1", "Complete"], ["Form 2B", "38", "4", "Complete"], ["Form 3A", "27", "2", "Pending"]] as const;

function StudentsPage() {
  const [view, setView] = useState<"directory" | "attendance">("directory");
  const [query, setQuery] = useState("");
  const visibleStudents = students.filter((student) => `${student.name} ${student.admission}`.toLowerCase().includes(query.toLowerCase()));
  return <SchoolShell title="Students"><div className="mx-auto max-w-6xl rise">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><GraduationCap className="size-5" /></div><h1 className="font-display text-3xl font-bold">Students</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage student records and monitor school-wide attendance from one place.</p></div>{view === "directory" && <Button><Plus />Add student</Button>}</div>
    <section className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label={view === "directory" ? "Enrolled" : "Present today"} value={view === "directory" ? "484" : "468"} note={view === "directory" ? "Across 6 classes" : "96.7% attendance"} /><Metric label={view === "directory" ? "New this term" : "Absent today"} value={view === "directory" ? "18" : "16"} note={view === "directory" ? "4 added this week" : "Requires follow-up"} /><Metric label={view === "directory" ? "Records complete" : "Registers complete"} value={view === "directory" ? "96%" : "18 / 20"} note={view === "directory" ? "19 need review" : "2 classes still pending"} /></section>
    <section className="glass-panel mt-4 overflow-hidden rounded-lg"><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex rounded-md border border-input bg-background/70 p-1"><button type="button" onClick={() => setView("directory")} className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors", view === "directory" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Student directory</button><button type="button" onClick={() => setView("attendance")} className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors", view === "attendance" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Attendance overview</button></div>{view === "directory" ? <div className="flex h-9 max-w-sm flex-1 items-center gap-2 rounded-md border border-input bg-background/70 px-3"><Search className="size-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></div> : <div className="flex items-center gap-2 text-xs text-secondary-foreground"><CircleAlert className="size-4 text-amber-600" />View-only: teachers mark registers.</div>}</div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{(view === "directory" ? ["Student", "Class", "Payment", "Attendance", "Record"] : ["Class", "Present", "Absent", "Register status"]).map((column) => <th key={column} className="px-5 py-3 font-medium">{column}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{view === "directory" ? visibleStudents.map((student) => <tr key={student.admission} className="hover:bg-muted/30"><td className="px-5 py-3"><p className="font-medium">{student.name}</p><p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{student.admission}</p></td><td className="px-5 py-3">{student.className}</td><td className="px-5 py-3"><span className={cn("text-xs font-medium", student.payment === "Paid" ? "text-emerald-700" : "text-amber-700")}>{student.payment}</span></td><td className="px-5 py-3">{student.attendance}</td><td className="px-5 py-3"><Button size="sm" variant="outline">View profile</Button></td></tr>) : attendance.map(([className, present, absent, status]) => <tr key={className}><td className="px-5 py-4 font-medium">{className}</td><td className="px-5 py-4">{present}</td><td className="px-5 py-4">{absent}</td><td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 text-xs text-secondary-foreground"><UserRoundCheck className="size-3.5 text-primary" />{status}</span></td></tr>)}</tbody></table></div></section>
  </div></SchoolShell>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
