import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { fetchWithNeonAuth } from "../auth/client";
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
import { Switch } from "@/components/ui/switch";
import { SchoolFeeRules } from "@/components/school-fee-rules";
import { SchoolPromotionReview } from "@/components/school-promotion-review";
import { PortalAccountSetup } from "@/components/portal-account-setup";

export const Route = createFileRoute("/school-admin")({
  head: () => ({
    meta: [
      { title: "School Admin — Klasora" },
      {
        name: "description",
        content: "Manage school records, portal access, and terminal reports.",
      },
    ],
  }),
  component: SchoolAdminPage,
});

type SchoolClass = {
  id: string;
  name: string;
  grade_level: string;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
  academic_year_id: string;
  academic_year_name: string;
  term_id: string | null;
  term_name: string | null;
  student_count: number;
};

type ClassTeacher = {
  staff_profile_id: string | null;
  display_name: string;
  role: string;
  active: boolean;
};

type AcademicYear = {
  id: string;
  name: string;
  is_current: boolean;
  terms: { id: string; name: string; is_current: boolean }[];
};

async function schoolApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, window.location.origin);
  const tenant =
    new URLSearchParams(window.location.search).get("tenant") ??
    sessionStorage.getItem("hg-school");
  if (tenant && !url.searchParams.has("tenant")) url.searchParams.set("tenant", tenant);
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetchWithNeonAuth(`${url.pathname}${url.search}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "The school request failed";
    throw new Error(error);
  }
  return payload as T;
}

function SchoolAdminPage() {
  const [summary, setSummary] = useState<{
    active_users: number;
    pending_activations: number;
    terminal_reports: number;
    linked_student_accounts: number;
    linked_parent_accounts: number;
  } | null>(null);
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void schoolApi<typeof summary>("/api/school/admin-summary")
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setSummaryError(error instanceof Error ? error.message : "Could not load school summary");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SchoolShell title="School Admin" schoolAdmin>
      <div className="mx-auto max-w-6xl rise">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border">
              <UsersRound className="size-5" />
            </div>
            <h1 className="font-display text-3xl font-bold">School administration</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Manage your school&apos;s people, portal access, and terminal reporting. Attendance
              remains a teacher responsibility.
            </p>
          </div>
        </div>
        {summaryError && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 px-4 py-3 text-sm text-destructive"
          >
            {summaryError}
          </p>
        )}
        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            label="School accounts"
            value={summary ? String(summary.active_users) : "—"}
            note={
              summary
                ? `${summary.linked_student_accounts} student and ${summary.linked_parent_accounts} parent portals linked`
                : "Loading saved accounts"
            }
          />
          <Card
            label="Pending activations"
            value={summary ? String(summary.pending_activations) : "—"}
            note="Accounts awaiting email verification"
          />
          <Card
            label="Terminal reports"
            value={summary ? String(summary.terminal_reports) : "—"}
            note="Saved report records"
          />
        </section>
        <SchoolWorkflowSettings />
        <DirectoryManager />
        <PortalAccountSetup />
        <SchoolHolidays />
        <SchoolFeeRules />
        <SchoolPromotionReview />
        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <article className="glass-panel rounded-lg p-5">
            <Link2 className="size-5 text-primary" />
            <h2 className="mt-3 font-display text-lg font-bold">Portal account access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Link parent and student sign-ins to their school records and share the generated
              activation link.
            </p>
            <Button className="mt-5" variant="outline" asChild>
              <a href="#portal-account-setup">
                <Link2 />
                Manage portal accounts
              </a>
            </Button>
          </article>
          <article className="glass-panel rounded-lg p-5">
            <FileText className="size-5 text-primary" />
            <h2 className="mt-3 font-display text-lg font-bold">Terminal reports</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate, review, and publish student terminal reports for the current term.
            </p>
            <Button className="mt-5" variant="outline" asChild>
              <Link to="/terminal-reports">
                <FileText />
                Open report centre
              </Link>
            </Button>
          </article>
          <article className="glass-panel rounded-lg p-5">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="mt-3 font-display text-lg font-bold">Daily reconciliation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review gateway-verified payments, attendance exceptions, and close the collection day.
            </p>
            <Button className="mt-5" variant="outline" asChild>
              <Link to="/reconciliation">
                <ShieldCheck />
                Open controls
              </Link>
            </Button>
          </article>
        </section>
      </div>
    </SchoolShell>
  );
}

type WorkflowSettings = {
  class_teachers_can_record_daily_fees: boolean;
  attendance_print_format: "daily_register" | "ges_term_to_date";
  daily_fee_split_enabled: boolean;
};

function SchoolWorkflowSettings() {
  const [settings, setSettings] = useState<WorkflowSettings>({
    class_teachers_can_record_daily_fees: false,
    attendance_print_format: "ges_term_to_date",
    daily_fee_split_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await schoolApi<WorkflowSettings>("/api/school/workflow-settings");
      setSettings(result);
      setSettingsLoaded(true);
    } catch (loadError: unknown) {
      setSettingsLoaded(false);
      setError(
        loadError instanceof Error ? loadError.message : "Could not load school workflow settings",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<WorkflowSettings>("/api/school/workflow-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(result);
      window.dispatchEvent(new Event("school-workflow-settings-updated"));
      setNotice("School workflow settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save school workflow settings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass-panel mt-4 rounded-lg p-5">
      <div className="flex items-center gap-2">
        <Settings2 className="size-5 text-primary" />
        <h2 className="font-display text-xl font-bold">School workflow settings</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        These settings apply only to this school.
      </p>
      <div className="mt-4 flex flex-col gap-4 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <h3 className="font-semibold">Split daily fees into studies and feeding</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn this on to make studies the required daily fee and feeding optional. Set each
            amount in Class fee rules, then collect studies only or studies plus feeding from each
            learner&apos;s Daily payments row. The same row supports collecting multiple school
            days.
          </p>
          {!settingsLoaded && !loading && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span role="alert" className="text-sm text-destructive">
                Load the saved school settings before changing this option.
              </span>
              <Button size="sm" variant="outline" onClick={() => void loadSettings()}>
                Retry loading settings
              </Button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-medium">
            {settings.daily_fee_split_enabled ? "On" : "Off"}
          </span>
          <Switch
            aria-label="Split daily fees into studies and feeding"
            checked={settings.daily_fee_split_enabled}
            disabled={!settingsLoaded || loading || saving}
            onCheckedChange={(checked) =>
              setSettings((current) => ({ ...current, daily_fee_split_enabled: checked }))
            }
          />
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p className="py-5 text-sm text-muted-foreground">Loading workflow settings...</p>
      ) : !settingsLoaded ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Other workflow settings are unavailable until the saved school settings can be
            retrieved.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <label className="flex items-start gap-3 rounded-md border border-border p-4">
            <input
              type="checkbox"
              checked={settings.class_teachers_can_record_daily_fees}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  class_teachers_can_record_daily_fees: event.target.checked,
                }))
              }
              className="mt-1 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold">
                Allow assigned class teachers to record daily fees
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Teachers can confirm the configured daily amount and payment method for learners in
                their assigned class. Recorded collections appear in Finance.
              </span>
            </span>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Default attendance print format
            <select
              value={settings.attendance_print_format}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  attendance_print_format: event.target
                    .value as WorkflowSettings["attendance_print_format"],
                }))
              }
              className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="daily_register">Daily class register</option>
              <option value="ges_term_to_date">Whole-school term-to-date GES-style register</option>
            </select>
            <span className="block text-xs font-normal text-muted-foreground">
              The school-wide option includes every class, its configured term, saved daily marks,
              and cumulative totals. The layout is not verified against the official GES form until
              you share its reference photo.
            </span>
          </label>
        </div>
      )}
      {!loading && settingsLoaded && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => void saveSettings()} disabled={saving || !settingsLoaded}>
            {saving ? "Saving..." : "Save settings"}
          </Button>
          {notice && <span className="text-sm text-emerald-700">{notice}</span>}
        </div>
      )}
    </section>
  );
}

type SchoolHoliday = { date: string; name: string };

function SchoolHolidays() {
  const [holidays, setHolidays] = useState<SchoolHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingDate, setRemovingDate] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await schoolApi<{ holidays: SchoolHoliday[] }>("/api/school/holidays");
      setHolidays(result.holidays);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load school holidays");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const date = String(form.get("date") ?? "");
    const name = String(form.get("name") ?? "").trim();
    try {
      await schoolApi("/api/school/holidays", {
        method: "POST",
        body: JSON.stringify({ date, name }),
      });
      setNotice(`${name} saved for ${date}. Daily fees and attendance are disabled for that day.`);
      formElement.reset();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save school holiday");
    } finally {
      setSaving(false);
    }
  }

  async function removeHoliday(holiday: SchoolHoliday) {
    if (
      !window.confirm(
        `Remove ${holiday.name} on ${holiday.date}? The date will be treated as a regular school day again.`,
      )
    )
      return;
    setRemovingDate(holiday.date);
    setError("");
    setNotice("");
    try {
      await schoolApi(`/api/school/holidays?date=${encodeURIComponent(holiday.date)}`, {
        method: "DELETE",
      });
      setNotice(`${holiday.name} was removed from the school calendar.`);
      await load();
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : "Could not remove school holiday",
      );
    } finally {
      setRemovingDate("");
    }
  }

  return (
    <section className="glass-panel mt-4 rounded-lg p-5">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-5 text-primary" />
        <h2 className="font-display text-xl font-bold">School holidays</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Mark a school-wide holiday. Daily-fee collection and attendance entry will be blocked, and
        the date will not count as an open school day in attendance totals.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-md border border-emerald-600/20 px-3 py-2 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      <form
        onSubmit={(event) => void saveHoliday(event)}
        className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
      >
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Holiday date
          <Input name="date" type="date" required />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Holiday name
          <Input
            name="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. Founders Day"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Mark holiday"}
          </Button>
        </div>
      </form>
      {loading ? (
        <p className="py-5 text-sm text-muted-foreground">Loading school holidays...</p>
      ) : holidays.length === 0 ? (
        <p className="py-5 text-sm text-muted-foreground">No school holidays have been set.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {holidays.map((holiday) => (
            <li
              key={holiday.date}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium">{holiday.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(`${holiday.date}T00:00:00`).toLocaleDateString()}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={removingDate === holiday.date}
                onClick={() => void removeHoliday(holiday)}
              >
                <Trash2 />
                {removingDate === holiday.date ? "Removing..." : "Remove"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DirectoryManager() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<ClassTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [classBeingEdited, setClassBeingEdited] = useState<SchoolClass | null>(null);
  const [editedClassName, setEditedClassName] = useState("");
  const [editedClassTeacher, setEditedClassTeacher] = useState("");
  const [classYearId, setClassYearId] = useState("");

  const loadClasses = useCallback(async () => {
    const result = await schoolApi<{ classes: SchoolClass[] }>("/api/school/classes");
    setClasses(result.classes);
  }, []);

  const loadAcademicYears = useCallback(async () => {
    const result = await schoolApi<{ academic_years: AcademicYear[] }>(
      "/api/school/academic-periods",
    );
    setAcademicYears(result.academic_years);
  }, []);

  const loadTeachers = useCallback(async () => {
    const result = await schoolApi<{ team: ClassTeacher[] }>("/api/school/team");
    setTeachers(
      result.team.filter(
        (member) => member.role === "teacher" && member.active && member.staff_profile_id,
      ),
    );
  }, []);

  const reloadDirectory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadClasses(), loadAcademicYears(), loadTeachers()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load school records");
    } finally {
      setLoading(false);
    }
  }, [loadAcademicYears, loadClasses, loadTeachers]);

  useEffect(() => {
    void reloadDirectory();
  }, [reloadDirectory]);

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

  async function saveClassChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classBeingEdited) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await schoolApi(`/api/school/classes/${encodeURIComponent(classBeingEdited.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editedClassName,
          class_teacher_id: editedClassTeacher || null,
        }),
      });
      setClassBeingEdited(null);
      setNotice("Class details and class teacher updated.");
      await loadClasses();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update this class");
    } finally {
      setSaving(false);
    }
  }

  const filteredYears = academicYears;
  const currentYear = filteredYears.find((year) => year.is_current) ?? filteredYears[0];
  const selectedYear = filteredYears.find((year) => year.id === classYearId) ?? currentYear;
  const visibleYears = filteredYears.length ? filteredYears : [];
  return (
    <section className="mt-7 space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      <article className="glass-panel rounded-lg p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              <h2 className="font-display text-xl font-bold">Classes</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Create classes for your academic years and assign their class teachers.
            </p>
          </div>
          <Button onClick={() => setClassDialogOpen(true)}>
            <Plus />
            Add Class
          </Button>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading classes...</p>
        ) : classes.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No classes created yet. Click &apos;Add Class&apos; to start
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Class</th>
                  <th className="px-3 py-2 font-medium">Grade level</th>
                  <th className="px-3 py-2 font-medium">Academic year</th>
                  <th className="px-3 py-2 font-medium">Term</th>
                  <th className="px-3 py-2 font-medium">Class teacher</th>
                  <th className="px-3 py-2 text-right font-medium">Students</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {classes.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-medium">{item.name}</td>
                    <td className="px-3 py-3">{item.grade_level}</td>
                    <td className="px-3 py-3">{item.academic_year_name}</td>
                    <td className="px-3 py-3">{item.term_name ?? "—"}</td>
                    <td className="px-3 py-3">{item.class_teacher_name ?? "Unassigned"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {Number(item.student_count)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setClassBeingEdited(item);
                            setEditedClassName(item.name);
                            setEditedClassTeacher(item.class_teacher_id ?? "");
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="glass-panel flex flex-col gap-3 rounded-lg p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="size-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Student directory</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Search, admit, and manage students from the Students page.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/students">Open Students</Link>
        </Button>
      </article>

      <Dialog
        open={classDialogOpen}
        onOpenChange={(open) => {
          setClassYearId("");
          setClassDialogOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add class</DialogTitle>
            <DialogDescription>
              Choose a class name, grade level, and academic period.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void submitClass(event)} className="space-y-4">
            <FormField label="Class name">
              <Input
                name="class_name"
                required
                minLength={2}
                maxLength={100}
                placeholder="Form 1A"
              />
            </FormField>
            <FormField label="Grade level">
              <Input name="grade_level" maxLength={100} placeholder="Form 1" />
            </FormField>
            <FormField label="Academic year">
              <select
                name="academic_year_id"
                value={classYearId}
                onChange={(event) => setClassYearId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Current or create initial year automatically</option>
                {visibleYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                    {year.is_current ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Academic term">
              <select
                name="term_id"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Current or create initial term automatically</option>
                {(selectedYear?.terms ?? []).map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                    {term.is_current ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Create class"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={classBeingEdited !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setClassBeingEdited(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit class</DialogTitle>
            <DialogDescription>
              Update the class name or assign an active teacher from this school.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void saveClassChanges(event)} className="space-y-4">
            <FormField label="Class name">
              <Input
                required
                minLength={2}
                maxLength={100}
                value={editedClassName}
                onChange={(event) => setEditedClassName(event.target.value)}
              />
            </FormField>
            <FormField label="Class teacher">
              <select
                value={editedClassTeacher}
                onChange={(event) => setEditedClassTeacher(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {classBeingEdited?.class_teacher_id &&
                  !teachers.some(
                    (teacher) => teacher.staff_profile_id === classBeingEdited.class_teacher_id,
                  ) && (
                    <option value={classBeingEdited.class_teacher_id}>
                      {classBeingEdited.class_teacher_name ?? "Current teacher"} (inactive)
                    </option>
                  )}
                {teachers.map((teacher) => (
                  <option key={teacher.staff_profile_id} value={teacher.staff_profile_id ?? ""}>
                    {teacher.display_name}
                  </option>
                ))}
              </select>
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save class"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="glass-panel rounded-lg p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      <p className="mt-1 text-xs text-secondary-foreground">{note}</p>
    </article>
  );
}
