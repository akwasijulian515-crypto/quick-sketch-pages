import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  BookOpenCheck,
  Link2,
  Plus,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolTeamSetup } from "@/components/school-team-setup";
import { SchoolShell } from "@/components/school-shell";
import { useTenantBranding } from "@/components/tenant-branding-provider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: search["view"] === "subjects" ? ("subjects" as const) : ("teachers" as const),
  }),
  head: () => ({
    meta: [
      { title: "Teachers — Klasora" },
      { name: "description", content: "Manage teachers, subjects, and teaching assignments." },
    ],
  }),
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
  const tenant =
    new URLSearchParams(window.location.search).get("tenant") ??
    sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${url.pathname}${url.search}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "The school request failed";
    throw new Error(message);
  }
  return payload as T;
}

function TeachersPage() {
  const { view } = Route.useSearch();
  const navigate = useNavigate();
  const { schoolName, crestUrl } = useTenantBranding();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<TeachingRow[]>([]);
  const [classes, setClasses] = useState<
    { id: string; name: string; academic_year_id: string; academic_year_name: string }[]
  >([]);
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
        schoolApi<{
          classes: {
            id: string;
            name: string;
            academic_year_id: string;
            academic_year_name: string;
          }[];
        }>("/api/school/classes"),
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

  useEffect(() => {
    void load();
  }, [load]);

  const teacherRows = teachers.map((teacher) => {
    const teacherAssignments = assignments.filter(
      (item) => item.teacher_user_id === teacher.user_id,
    );
    return {
      teacher: teacher.display_name,
      email: teacher.email,
      classes:
        [...new Set(teacherAssignments.map((item) => item.class_name))].join(", ") || "Unassigned",
      subjects:
        [...new Set(teacherAssignments.map((item) => item.subject_name).filter(Boolean))].join(
          ", ",
        ) || "No subject assigned",
      load: teacherAssignments.length,
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
        body: JSON.stringify({
          assignment_type: "create_subject",
          subject_name: subjectName,
          subject_code: subjectCode,
        }),
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

  const assignedCount = assignments.filter(
    (item) => item.class_subject_id && item.teacher_user_id,
  ).length;
  const activeViewTitle = view === "teachers" ? "Teachers & load" : "Subjects";

  return (
    <SchoolShell title="Teachers & subjects">
      <div className="mx-auto max-w-6xl rise">
        <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-950 px-6 py-7 text-primary-foreground shadow-xl sm:px-8 sm:py-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 -z-10 size-72 rounded-full border-[32px] border-primary-foreground/5"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 right-40 -z-10 size-56 rounded-full bg-emerald-300/10 blur-3xl"
          />
          <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 py-1.5 pl-1.5 pr-3 backdrop-blur">
                <span className="grid size-8 place-items-center overflow-hidden rounded-full bg-primary-foreground/15 text-sm font-bold">
                  {crestUrl ? (
                    <img
                      src={crestUrl}
                      alt={`${schoolName} crest`}
                      className="size-full object-cover"
                    />
                  ) : (
                    schoolName.slice(0, 1)
                  )}
                </span>
                <span className="max-w-[15rem] truncate text-xs font-semibold">{schoolName}</span>
                <span className="size-1 rounded-full bg-emerald-300" />
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary-foreground/65">
                  Workspace
                </span>
              </div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <Sparkles className="size-3.5" /> Faculty & curriculum
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Teachers & subjects
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75 sm:text-base">
                Bring your teaching team and class curriculum together. See who teaches what, and
                keep every assignment easy to find.
              </p>
            </div>
            {canManageStaff &&
              (view === "teachers" ? (
                <Button
                  variant="secondary"
                  className="shrink-0 bg-background text-foreground hover:bg-background/90"
                  onClick={() =>
                    document
                      .getElementById("staff-setup")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  <Plus />
                  Add a teacher
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="shrink-0 bg-background text-foreground hover:bg-background/90"
                  onClick={() => setDialog("subject")}
                >
                  <Plus />
                  Add subject
                </Button>
              ))}
          </div>
          <div className="relative mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-primary-foreground/15 pt-4 text-xs text-primary-foreground/65">
            <span className="inline-flex items-center gap-2">
              <BookOpenCheck className="size-4 text-emerald-200" />A clear view of your teaching
              load
            </span>
            <span className="hidden size-1 rounded-full bg-primary-foreground/35 sm:block" />
            <span>
              Currently viewing{" "}
              <strong className="font-semibold text-primary-foreground">{activeViewTitle}</strong>
            </span>
          </div>
        </section>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800"
          >
            {notice}
          </p>
        )}

        <section aria-label="Teaching overview" className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric
            icon={<UsersRound />}
            label="Teachers"
            value={loading ? "—" : String(teachers.length)}
            note="Active in your school"
          />
          <Metric
            icon={<BookOpen />}
            label="Subjects"
            value={loading ? "—" : String(subjects.length)}
            note="Available in the curriculum"
          />
          <Metric
            icon={<Link2 />}
            label="Teaching assignments"
            value={loading ? "—" : String(assignedCount)}
            note="Teacher-to-class links"
          />
        </section>

        {canManageStaff && view === "teachers" && (
          <SchoolTeamSetup onDataChanged={() => void load()} />
        )}

        <section className="glass-panel mt-5 overflow-hidden rounded-2xl">
          <div className="flex flex-col gap-4 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold">
                  {view === "teachers" ? "Teaching team" : "Subject directory"}
                </h2>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                  {loading ? "…" : view === "teachers" ? teacherRows.length : subjects.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {view === "teachers"
                  ? "Review each teacher’s classes and subject load."
                  : "Explore the subjects and see how they’re connected to classes."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="tablist"
                aria-label="Teachers and subjects"
                className="inline-flex rounded-xl border border-border bg-muted/50 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "teachers"}
                  onClick={() =>
                    void navigate({
                      to: "/teachers",
                      search: { view: "teachers" },
                      resetScroll: false,
                    })
                  }
                  className={cn(
                    "rounded-lg px-3.5 py-2 text-xs font-semibold transition-all",
                    view === "teachers"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Teachers & load
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "subjects"}
                  onClick={() =>
                    void navigate({
                      to: "/teachers",
                      search: { view: "subjects" },
                      resetScroll: false,
                    })
                  }
                  className={cn(
                    "rounded-lg px-3.5 py-2 text-xs font-semibold transition-all",
                    view === "subjects"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Subjects
                </button>
              </div>
              {view === "subjects" && canManageStaff && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!subjects.length || !classes.length}
                  onClick={() => setDialog("assignment")}
                >
                  <Link2 />
                  Assign subject
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  {(view === "teachers"
                    ? ["Teacher", "Classes", "Subjects", "Status"]
                    : ["Subject", "Code", "Class assignments", "Responsible teachers"]
                  ).map((column) => (
                    <th key={column} className="px-5 py-3.5 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-12 text-center text-sm text-muted-foreground"
                    >
                      Loading teaching setup...
                    </td>
                  </tr>
                ) : view === "teachers" ? (
                  teacherRows.map((row) => (
                    <tr key={row.teacher} className="transition-colors hover:bg-muted/25">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                            {row.teacher.slice(0, 1)}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">{row.teacher}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {row.email}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{row.classes}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                          {row.subjects}
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
                            {row.load} {row.load === 1 ? "subject" : "subjects"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge value={row.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  subjects.map((subject) => {
                    const subjectClasses = assignments.filter(
                      (item) => item.subject_id === subject.id,
                    );
                    const classNames = [...new Set(subjectClasses.map((item) => item.class_name))];
                    const teacherNames = [
                      ...new Set(subjectClasses.map((item) => item.teacher_name).filter(Boolean)),
                    ];
                    return (
                      <tr key={subject.id} className="transition-colors hover:bg-muted/25">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                              <BookOpen className="size-4" />
                            </span>
                            <span className="font-semibold">{subject.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs font-medium">
                            {subject.code}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {classNames.length ? (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              {classNames.join(", ")}
                            </span>
                          ) : (
                            <Badge value="Not assigned" />
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {teacherNames.length ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                {teacherNames[0].slice(0, 1)}
                              </span>
                              {teacherNames.join(", ")}
                            </span>
                          ) : (
                            <Badge value="Needs teacher" />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                {!loading &&
                  (view === "teachers" ? teacherRows.length === 0 : subjects.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-5 py-0">
                        <div className="mx-auto flex max-w-lg flex-col items-center py-14 text-center">
                          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                            <BookOpen className="size-6" />
                          </span>
                          <h3 className="mt-4 font-display text-lg font-bold">
                            {view === "teachers"
                              ? "Your teaching team starts here"
                              : "Your subject directory is ready to grow"}
                          </h3>
                          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                            {view === "teachers"
                              ? "Add staff and assign their teaching load to keep every class covered."
                              : "Add your school’s subjects, then connect them to classes and teachers."}
                          </p>
                          {canManageStaff && (
                            <Button
                              className="mt-5"
                              onClick={() =>
                                view === "teachers"
                                  ? document
                                      .getElementById("staff-setup")
                                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                                  : setDialog("subject")
                              }
                            >
                              <Plus />
                              {view === "teachers" ? "Set up your team" : "Create first subject"}
                              <ArrowUpRight className="ml-1" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {dialog === "subject" && (
        <SubjectDialog
          name={subjectName}
          code={subjectCode}
          saving={saving}
          setName={setSubjectName}
          setCode={setSubjectCode}
          onClose={() => setDialog(null)}
          onSubmit={createSubject}
        />
      )}
      {dialog === "assignment" && (
        <AssignmentDialog
          teacher={assignedTeacher}
          classId={assignedClass}
          subjectId={assignedSubject}
          subjects={subjects}
          teachers={teachers}
          classes={classes}
          saving={saving}
          setTeacher={setAssignedTeacher}
          setClass={setAssignedClass}
          setSubject={setAssignedSubject}
          onClose={() => setDialog(null)}
          onSubmit={createAssignment}
        />
      )}
    </SchoolShell>
  );
}

function SubjectDialog({
  name,
  code,
  saving,
  setName,
  setCode,
  onClose,
  onSubmit,
}: {
  name: string;
  code: string;
  saving: boolean;
  setName: (value: string) => void;
  setCode: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Dialog
      title="Create subject"
      description="Create a school subject, then link it to one or more classes."
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <Field label="Subject name">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. French"
            className="input"
          />
        </Field>
        <Field label="Subject code">
          <input
            required
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="e.g. FRE"
            maxLength={24}
            className="input"
          />
        </Field>
        <DialogActions
          onClose={onClose}
          label={saving ? "Saving..." : "Create subject"}
          disabled={saving}
        />
      </form>
    </Dialog>
  );
}

function AssignmentDialog({
  teacher,
  classId,
  subjectId,
  subjects,
  teachers,
  classes,
  saving,
  setTeacher,
  setClass,
  setSubject,
  onClose,
  onSubmit,
}: {
  teacher: string;
  classId: string;
  subjectId: string;
  subjects: Subject[];
  teachers: Teacher[];
  classes: { id: string; name: string; academic_year_id: string; academic_year_name: string }[];
  saving: boolean;
  setTeacher: (value: string) => void;
  setClass: (value: string) => void;
  setSubject: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Dialog
      title="Assign subject"
      description="Link a subject to a class and optionally assign a teacher."
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <Field label="Class">
          <select
            required
            value={classId}
            onChange={(event) => setClass(event.target.value)}
            className="input"
          >
            <option value="">Select class</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.academic_year_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject">
          <select
            required
            value={subjectId}
            onChange={(event) => setSubject(event.target.value)}
            className="input"
          >
            <option value="">Select subject</option>
            {subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Teacher (optional)">
          <select
            value={teacher}
            onChange={(event) => setTeacher(event.target.value)}
            className="input"
          >
            <option value="">Assign later</option>
            {teachers.map((item) => (
              <option key={item.user_id} value={item.user_id}>
                {item.display_name}
              </option>
            ))}
          </select>
        </Field>
        <DialogActions
          onClose={onClose}
          label={saving ? "Saving..." : "Save assignment"}
          disabled={saving}
        />
      </form>
    </Dialog>
  );
}

function Dialog({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-lg p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-4 block text-sm">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function DialogActions({
  onClose,
  label,
  disabled,
}: {
  onClose: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onClose} disabled={disabled}>
        Cancel
      </Button>
      <Button type="submit" disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-xs font-medium",
        value === "Assigned"
          ? "bg-emerald-500/10 text-emerald-700"
          : "bg-amber-500/10 text-amber-700",
      )}
    >
      {value}
    </span>
  );
}
function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="glass-panel group rounded-2xl p-4 transition-transform duration-200 hover:-translate-y-0.5 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </article>
  );
}
