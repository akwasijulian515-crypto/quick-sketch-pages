import { useCallback, useEffect, useState, type FormEvent } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TeamMember = { user_id: string; email: string; display_name: string; role: string };
type TeachingRow = {
  class_id: string;
  class_name: string;
  academic_year_id: string;
  academic_year_name: string;
  class_teacher_name: string | null;
  class_subject_id: string | null;
  subject_code: string | null;
  subject_name: string | null;
  teacher_user_id: string | null;
  teacher_name: string | null;
};
type Teacher = { user_id: string; email: string; display_name: string };

async function refreshSchoolApiSession(token: string) {
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  const endpoint = tenant
    ? `/api/auth/context?tenant=${encodeURIComponent(tenant)}`
    : "/api/auth/context";
  const response = await fetch(endpoint, {
    credentials: "same-origin",
    headers: { authorization: `Bearer ${token}` },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Could not refresh the school sign-in session";
    throw new Error(message);
  }
}

async function schoolApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant && !url.searchParams.has("tenant")) url.searchParams.set("tenant", tenant);
  const headers = new Headers(init?.headers);
  headers.set("authorization", `******`);
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

export function SchoolTeamSetup({ onDataChanged }: { onDataChanged?: () => void }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [classes, setClasses] = useState<TeachingRow[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activationUrl, setActivationUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await refreshSchoolApiSession(await getNeonAccessToken());
      const [teamResult, setupResult] = await Promise.all([
        schoolApi<{ team: TeamMember[] }>("/api/school/team"),
        schoolApi<{ assignments: TeachingRow[]; teachers: Teacher[] }>("/api/school/teaching-setup"),
      ]);
      setMembers(teamResult.team);
      setClasses(setupResult.assignments);
      setTeachers(setupResult.teachers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load teacher setup");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (window.location.hash === "#staff-setup") {
      document.getElementById("staff-setup")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setActivationUrl("");
    try {
      const result = await schoolApi<{ activation_url: string }>("/api/school/team", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), role: form.get("role") }),
      });
      setActivationUrl(result.activation_url);
      formElement.reset();
      await load();
      onDataChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not add school user");
    } finally {
      setSaving(false);
    }
  }

  async function assignTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    try {
      await schoolApi("/api/school/teaching-setup", {
        method: "POST",
        body: JSON.stringify({
          assignment_type: "subject",
          class_id: form.get("class_id"),
          teacher_user_id: form.get("teacher_user_id"),
          subject_code: form.get("subject_code"),
          subject_name: form.get("subject_name"),
        }),
      });
      formElement.reset();
      await load();
      onDataChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not assign teacher");
    } finally {
      setSaving(false);
    }
  }

  async function assignClassTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    try {
      await schoolApi("/api/school/teaching-setup", {
        method: "POST",
        body: JSON.stringify({
          assignment_type: "class_teacher",
          class_id: form.get("class_id"),
          teacher_user_id: form.get("teacher_user_id"),
        }),
      });
      formElement.reset();
      await load();
      onDataChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not assign class teacher");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="staff-setup" className="glass-panel mt-4 scroll-mt-6 rounded-lg p-5">
      <div><h2 className="font-display text-xl font-bold">Staff and teaching assignments</h2><p className="mt-1 text-sm text-muted-foreground">Add a teacher or Finance user, then assign teachers to class subjects so they can enter marks.</p></div>
      {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
      {activationUrl && <p role="status" className="mt-4 break-all rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">Account activation link (share with the new member): <a className="underline" href={activationUrl}>{activationUrl}</a></p>}
      <form onSubmit={(event) => void addMember(event)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Full name<Input name="name" required minLength={2} maxLength={160} /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Work email<Input name="email" required type="email" maxLength={254} /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Role<select name="role" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="teacher">Teacher</option><option value="finance">Finance</option></select></label>
        <div className="flex items-end"><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add staff account"}</Button></div>
      </form>
      <h3 className="mt-6 text-sm font-semibold">Assign a class teacher</h3>
      <form onSubmit={(event) => void assignClassTeacher(event)} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Class<select name="class_id" required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Select class</option>{[...new Map(classes.map((item) => [item.class_id, item])).values()].map((item) => <option key={item.class_id} value={item.class_id}>{item.class_name} · {item.academic_year_name}</option>)}</select></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Teacher<select name="teacher_user_id" required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Select teacher</option>{teachers.map((teacher) => <option key={teacher.user_id} value={teacher.user_id}>{teacher.display_name}</option>)}</select></label>
        <div className="flex items-end"><Button type="submit" disabled={saving || !classes.length || !teachers.length}>{saving ? "Saving..." : "Assign class teacher"}</Button></div>
      </form>
      <h3 className="mt-6 text-sm font-semibold">Assign a subject</h3>
      <form onSubmit={(event) => void assignTeacher(event)} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Class<select name="class_id" required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Select class</option>{[...new Map(classes.map((item) => [item.class_id, item])).values()].map((item) => <option key={item.class_id} value={item.class_id}>{item.class_name} · {item.academic_year_name}</option>)}</select></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Teacher<select name="teacher_user_id" required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Select teacher</option>{teachers.map((teacher) => <option key={teacher.user_id} value={teacher.user_id}>{teacher.display_name}</option>)}</select></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Subject code<Input name="subject_code" required maxLength={24} placeholder="MATH" /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Subject name<Input name="subject_name" required maxLength={120} placeholder="Mathematics" /></label>
        <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" disabled={saving || !classes.length || !teachers.length}>{saving ? "Saving..." : "Assign subject"}</Button></div>
      </form>
      {loading ? <p className="py-5 text-sm text-muted-foreground">Loading school staff...</p> : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground"><tr>{["Member", "Role", "Class", "Subject", "Class teacher"].map((label) => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-border/70">
              {classes.filter((item) => item.class_subject_id || item.class_teacher_name).map((item) => <tr key={item.class_subject_id ?? item.class_id}><td className="px-3 py-3">{item.teacher_name ?? item.class_teacher_name ?? "Unassigned"}</td><td className="px-3 py-3">Teacher</td><td className="px-3 py-3">{item.class_name}</td><td className="px-3 py-3">{item.subject_name ?? "—"}</td><td className="px-3 py-3">{item.class_teacher_name ?? "Unassigned"}</td></tr>)}
              {classes.filter((item) => item.class_subject_id || item.class_teacher_name).length === 0 && members.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No staff or subject assignments yet.</td></tr>}
              {members.map((member) => <tr key={member.user_id}><td className="px-3 py-3">{member.display_name}<p className="text-xs text-muted-foreground">{member.email}</p></td><td className="px-3 py-3 capitalize">{member.role.replace("_", " ")}</td><td className="px-3 py-3">—</td><td className="px-3 py-3">—</td><td className="px-3 py-3">—</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
