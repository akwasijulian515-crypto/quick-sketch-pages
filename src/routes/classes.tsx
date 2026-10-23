import { createFileRoute } from "@tanstack/react-router";
import { Plus, School } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/classes")({
  head: () => ({ meta: [{ title: "Classes — Klasora" }, { name: "description", content: "Review and manage classes in your school." }] }),
  component: ClassesPage,
});

type SchoolClass = {
  id: string;
  name: string;
  grade_level: string;
  academic_year_id: string;
  academic_year_name: string;
  term_name: string | null;
  student_count: number;
};
type AcademicYear = { id: string; name: string; is_current: boolean };

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

function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [canManageClasses, setCanManageClasses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const currentYear = years.find((year) => year.is_current) ?? years[0];

  useEffect(() => {
    setCanManageClasses(sessionStorage.getItem("hg-role") === "school_admin");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classResult, yearResult] = await Promise.all([
        schoolApi<{ classes: SchoolClass[] }>("/api/school/classes"),
        schoolApi<{ academic_years: AcademicYear[] }>("/api/school/academic-periods"),
      ]);
      setClasses(classResult.classes);
      setYears(yearResult.academic_years);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load classes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await schoolApi("/api/school/classes", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          grade_level: form.get("grade_level"),
          academic_year_id: form.get("academic_year_id") || null,
        }),
      });
      setShowForm(false);
      setNotice("Class created.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not create class");
    } finally {
      setSaving(false);
    }
  }

  return <SchoolShell title="Classes" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><School className="size-5" /></div><h1 className="font-display text-3xl font-bold">Classes</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review and manage your school classes and active student counts.</p></div>{canManageClasses && <Button onClick={() => setShowForm((current) => !current)}><Plus />Add class</Button>}</div>
    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    {canManageClasses && showForm && <form onSubmit={(event) => void createClass(event)} className="glass-panel mt-5 grid gap-3 rounded-lg p-5 sm:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1 text-xs font-medium text-muted-foreground">Class name<Input name="name" required minLength={2} maxLength={100} placeholder="e.g. Primary 1A" /></label>
      <label className="space-y-1 text-xs font-medium text-muted-foreground">Grade level<Input name="grade_level" maxLength={100} placeholder="e.g. Primary 1" /></label>
      <label className="space-y-1 text-xs font-medium text-muted-foreground">Academic year<select name="academic_year_id" defaultValue={currentYear?.id ?? ""} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Use current academic year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.is_current ? " (Current)" : ""}</option>)}</select></label>
      <div className="flex items-end gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save class"}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button></div>
    </form>}
    <section className="glass-panel mt-5 overflow-hidden rounded-lg">
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading classes...</p> : classes.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No classes created yet. Add a class to begin.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Class", "Grade level", "Academic year", "Term", "Students"].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{classes.map((item) => <tr key={item.id} className="hover:bg-muted/30"><td className="px-5 py-4 font-medium">{item.name}</td><td className="px-5 py-4">{item.grade_level}</td><td className="px-5 py-4">{item.academic_year_name}</td><td className="px-5 py-4">{item.term_name ?? "—"}</td><td className="px-5 py-4 tabular-nums">{Number(item.student_count)}</td></tr>)}</tbody></table></div>}
    </section>
  </div></SchoolShell>;
}
