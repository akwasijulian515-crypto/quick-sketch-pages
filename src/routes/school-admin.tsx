import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, ChevronRight, FileText, Link2, Plus, Search, ShieldCheck, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SchoolShell } from "@/components/school-shell";
import { SchoolFeeRules } from "@/components/school-fee-rules";
import { SchoolPromotionReview } from "@/components/school-promotion-review";

export const Route = createFileRoute("/school-admin")({
  head: () => ({ meta: [{ title: "School Admin — Klasora" }, { name: "description", content: "Manage users, invitations, and terminal reports." }] }),
  component: SchoolAdminPage,
});

type SchoolClass = {
  id: string;
  name: string;
  grade_level: string;
  academic_year_id: string;
  academic_year_name: string;
  term_id: string | null;
  term_name: string | null;
  student_count: number;
};

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number: string;
  status: "active" | "inactive";
  class_id: string | null;
  class_name: string | null;
};

type AcademicYear = {
  id: string;
  name: string;
  is_current: boolean;
  terms: { id: string; name: string; is_current: boolean }[];
};

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
    const error = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "The school request failed";
    throw new Error(error);
  }
  return payload as T;
}

function SchoolAdminPage() {
  return <SchoolShell title="School Admin" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><UsersRound className="size-5" /></div><h1 className="font-display text-3xl font-bold">School administration</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage your school&apos;s people, access, and terminal reporting. Attendance remains a teacher responsibility.</p></div></div>
    <section className="mt-7 grid gap-3 sm:grid-cols-3"><Card label="Active users" value="—" note="Live school data not connected" /><Card label="Pending invites" value="—" note="Live school data not connected" /><Card label="Terminal reports" value="—" note="Live school data not connected" /></section>
    <DirectoryManager />
    <SchoolFeeRules />
    <SchoolPromotionReview />
    <section className="mt-4 grid gap-4 lg:grid-cols-3"><article className="glass-panel rounded-lg p-5"><Link2 className="size-5 text-primary" /><h2 className="mt-3 font-display text-lg font-bold">Role signup links</h2><p className="mt-1 text-sm text-muted-foreground">Invitation links are unavailable until a signup workflow is connected.</p><Button className="mt-5" variant="outline" disabled><Link2 />Create invitation link</Button></article><article className="glass-panel rounded-lg p-5"><FileText className="size-5 text-primary" /><h2 className="mt-3 font-display text-lg font-bold">Terminal reports</h2><p className="mt-1 text-sm text-muted-foreground">Generate, review, and publish student terminal reports for the current term.</p><Button className="mt-5" variant="outline" asChild><Link to="/terminal-reports"><FileText />Open report centre</Link></Button></article><article className="glass-panel rounded-lg p-5"><ShieldCheck className="size-5 text-primary" /><h2 className="mt-3 font-display text-lg font-bold">Daily reconciliation</h2><p className="mt-1 text-sm text-muted-foreground">Review gateway-verified payments, attendance exceptions, and close the collection day.</p><Button className="mt-5" variant="outline" asChild><Link to="/reconciliation"><ShieldCheck />Open controls</Link></Button></article></section>
  </div></SchoolShell>;
}

function DirectoryManager() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [classYearId, setClassYearId] = useState("");
  const [rosterClass, setRosterClass] = useState<SchoolClass | null>(null);
  const [roster, setRoster] = useState<Student[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const pageSize = 10;

  const loadClasses = useCallback(async () => {
    const result = await schoolApi<{ classes: SchoolClass[] }>("/api/school/classes");
    setClasses(result.classes);
  }, []);

  const loadAcademicYears = useCallback(async () => {
    const result = await schoolApi<{ academic_years: AcademicYear[] }>("/api/school/academic-periods");
    setAcademicYears(result.academic_years);
  }, []);

  const loadStudents = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search.trim()) params.set("search", search.trim());
    if (classFilter) params.set("class_id", classFilter);
    const result = await schoolApi<{ students: Student[]; total: number }>(`/api/school/students?${params}`);
    setStudents(result.students);
    setTotal(result.total);
  }, [page, search, classFilter]);

  const reloadDirectory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadClasses(), loadAcademicYears(), loadStudents()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load school records");
    } finally {
      setLoading(false);
    }
  }, [loadAcademicYears, loadClasses, loadStudents]);

  useEffect(() => {
    void reloadDirectory();
  }, [reloadDirectory]);

  useEffect(() => {
    setPage(1);
  }, [search, classFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStudents().catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load students");
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [loadStudents]);

  async function submitClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await schoolApi("/api/school/classes", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("class_name"),
          grade_level: form.get("grade_level"),
          academic_year_id: form.get("academic_year_id") || null,
          term_id: form.get("term_id") || null,
        }),
      });
      setClassDialogOpen(false);
      setNotice("Class created.");
      await Promise.all([loadClasses(), loadAcademicYears()]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not create class");
    } finally {
      setSaving(false);
    }
  }

  async function submitStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await schoolApi("/api/school/students", {
        method: "POST",
        body: JSON.stringify({
          first_name: form.get("first_name"),
          last_name: form.get("last_name"),
          student_id_number: form.get("student_id_number"),
          class_id: form.get("class_id") || null,
          guardian: {
            full_name: form.get("guardian_name"),
            phone: form.get("guardian_phone"),
            email: form.get("guardian_email"),
          },
        }),
      });
      setStudentDialogOpen(false);
      setPage(1);
      setNotice("Student added.");
      await Promise.all([loadClasses(), loadStudents()]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not add student");
    } finally {
      setSaving(false);
    }
  }

  async function openRoster(schoolClass: SchoolClass) {
    setRosterClass(schoolClass);
    setRoster([]);
    setRosterLoading(true);
    setError("");
    try {
      const result = await schoolApi<{ students: Student[] }>(`/api/school/classes/${encodeURIComponent(schoolClass.id)}/roster`);
      setRoster(result.students);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load class roster");
    } finally {
      setRosterLoading(false);
    }
  }

  const filteredYears = academicYears;
  const currentYear = filteredYears.find((year) => year.is_current) ?? filteredYears[0];
  const selectedYear = filteredYears.find((year) => year.id === classYearId) ?? currentYear;
  const visibleYears = filteredYears.length ? filteredYears : [];
  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  return <section className="mt-7 space-y-4">
    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    <article className="glass-panel rounded-lg p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><BookOpen className="size-5 text-primary" /><h2 className="font-display text-xl font-bold">Classes</h2></div><p className="mt-1 text-sm text-muted-foreground">Create classes for your academic years and review their rosters.</p></div>
        <Button onClick={() => setClassDialogOpen(true)}><Plus />Add Class</Button>
      </div>
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading classes...</p> : classes.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No classes created yet. Click &apos;Add Class&apos; to start</p> : <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Class</th><th className="px-3 py-2 font-medium">Grade level</th><th className="px-3 py-2 font-medium">Academic year</th><th className="px-3 py-2 font-medium">Term</th><th className="px-3 py-2 text-right font-medium">Students</th><th className="px-3 py-2" /></tr></thead>
          <tbody className="divide-y divide-border/70">{classes.map((item) => <tr key={item.id}><td className="px-3 py-3 font-medium">{item.name}</td><td className="px-3 py-3">{item.grade_level}</td><td className="px-3 py-3">{item.academic_year_name}</td><td className="px-3 py-3">{item.term_name ?? "—"}</td><td className="px-3 py-3 text-right tabular-nums">{Number(item.student_count)}</td><td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => void openRoster(item)}>Roster</Button></td></tr>)}</tbody>
        </table>
      </div>}
    </article>

    <article className="glass-panel rounded-lg p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><UsersRound className="size-5 text-primary" /><h2 className="font-display text-xl font-bold">Students</h2></div><p className="mt-1 text-sm text-muted-foreground">Search, filter, and manage your school&apos;s student directory.</p></div>
        <Button onClick={() => setStudentDialogOpen(true)}><Plus />Add Student</Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students..." className="pl-9" aria-label="Search students" /></label>
        <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label="Filter students by class" className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading students...</p> : students.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No students enrolled yet.</p> : <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Student</th><th className="px-3 py-2 font-medium">Student ID</th><th className="px-3 py-2 font-medium">Class</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-border/70">{students.map((student) => <tr key={student.id}><td className="px-3 py-3 font-medium">{student.first_name} {student.last_name}</td><td className="px-3 py-3">{student.student_id_number}</td><td className="px-3 py-3">{student.class_name ?? "Unassigned"}</td><td className="px-3 py-3"><span className={student.status === "active" ? "rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700" : "rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"}>{student.status}</span></td></tr>)}</tbody>
        </table>
      </div>}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : "0 students"}</span>
        <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page"><ChevronLeft /></Button><span>Page {page} of {maxPage}</span><Button size="sm" variant="outline" disabled={page >= maxPage || loading} onClick={() => setPage((current) => current + 1)} aria-label="Next page"><ChevronRight /></Button></div>
      </div>
    </article>

    <Dialog open={classDialogOpen} onOpenChange={(open) => { setClassYearId(""); setClassDialogOpen(open); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add class</DialogTitle><DialogDescription>Choose a class name, grade level, and academic period.</DialogDescription></DialogHeader>
        <form onSubmit={(event) => void submitClass(event)} className="space-y-4">
          <FormField label="Class name"><Input name="class_name" required minLength={2} maxLength={100} placeholder="Form 1A" /></FormField>
          <FormField label="Grade level"><Input name="grade_level" maxLength={100} placeholder="Form 1" /></FormField>
          <FormField label="Academic year"><select name="academic_year_id" value={classYearId} onChange={(event) => setClassYearId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Current or create initial year automatically</option>{visibleYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.is_current ? " (Current)" : ""}</option>)}</select></FormField>
          <FormField label="Academic term"><select name="term_id" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Current or create initial term automatically</option>{(selectedYear?.terms ?? []).map((term) => <option key={term.id} value={term.id}>{term.name}{term.is_current ? " (Current)" : ""}</option>)}</select></FormField>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create class"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add student</DialogTitle><DialogDescription>Add a student record and optionally assign a class and guardian contact.</DialogDescription></DialogHeader>
        <form onSubmit={(event) => void submitStudent(event)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><FormField label="First name"><Input name="first_name" required maxLength={100} autoComplete="given-name" /></FormField><FormField label="Last name"><Input name="last_name" required maxLength={100} autoComplete="family-name" /></FormField></div>
          <FormField label="Student ID / Index number"><Input name="student_id_number" required maxLength={64} /></FormField>
          <FormField label="Class assignment"><select name="class_id" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Unassigned</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField>
          <div className="border-t border-border/70 pt-3"><h3 className="text-sm font-medium">Guardian contact (optional)</h3><div className="mt-3 space-y-3"><FormField label="Guardian name"><Input name="guardian_name" maxLength={160} autoComplete="name" /></FormField><div className="grid gap-3 sm:grid-cols-2"><FormField label="Phone"><Input name="guardian_phone" maxLength={40} type="tel" autoComplete="tel" /></FormField><FormField label="Email"><Input name="guardian_email" maxLength={254} type="email" autoComplete="email" /></FormField></div></div></div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add student"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={rosterClass !== null} onOpenChange={(open) => { if (!open) setRosterClass(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{rosterClass ? `${rosterClass.name} roster` : "Class roster"}</DialogTitle><DialogDescription>Active students currently assigned to this class.</DialogDescription></DialogHeader>
        {rosterLoading ? <p className="py-5 text-sm text-muted-foreground">Loading roster...</p> : roster.length ? <ul className="max-h-72 divide-y divide-border overflow-y-auto">{roster.map((student) => <li key={student.id} className="flex justify-between gap-3 py-3 text-sm"><span>{student.first_name} {student.last_name}</span><span className="text-muted-foreground">{student.student_id_number}</span></li>)}</ul> : <p className="py-5 text-sm text-muted-foreground">No active students are enrolled in this class yet.</p>}
      </DialogContent>
    </Dialog>
  </section>;
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function Card({ label, value, note }: { label: string; value: string; note: string }) { return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
