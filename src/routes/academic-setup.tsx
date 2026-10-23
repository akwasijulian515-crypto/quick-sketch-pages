import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/academic-setup")({
  head: () => ({
    meta: [
      { title: "Academic Setup — Klasora" },
      { name: "description", content: "Set the school year, terms, calendar, and promotion window." },
    ],
  }),
  component: AcademicSetupPage,
});

type AcademicYear = {
  id: string;
  name: string;
  is_current: boolean;
  terms: {
    id: string;
    name: string;
    starts_on: string;
    ends_on: string;
    is_current: boolean;
    is_closed: boolean;
    arrears_processed_at: string | null;
  }[];
};

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

function AcademicSetupPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedYear = years.find((year) => year.id === selectedYearId) ?? years.find((year) => year.is_current);
  const nextTermName = selectedYear && selectedYear.terms.length < 3
    ? `Term ${selectedYear.terms.length + 1}`
    : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await schoolApi<{ academic_years: AcademicYear[] }>("/api/school/academic-periods");
      setYears(result.academic_years);
      setSelectedYearId((current) => current || result.academic_years.find((year) => year.is_current)?.id || result.academic_years[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load academic periods");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await schoolApi("/api/school/academic-periods", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("year_name"),
          starts_on: form.get("year_start"),
          ends_on: form.get("year_end"),
          is_current: form.get("is_current") === "on",
        }),
      });
      formElement.reset();
      setNotice("Academic year saved.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save academic year");
    } finally {
      setSaving(false);
    }
  }

  async function createTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await schoolApi("/api/school/terms", {
        method: "POST",
        body: JSON.stringify({
          academic_year_id: selectedYear?.id,
          name: form.get("term_name"),
          starts_on: form.get("term_start"),
          ends_on: form.get("term_end"),
        }),
      });
      formElement.reset();
      setNotice("Term saved.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save term");
    } finally {
      setSaving(false);
    }
  }

  async function closeTerm(termId: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await schoolApi(`/api/school/terms/${encodeURIComponent(termId)}/close`, { method: "POST", body: "{}" });
      setNotice("Term closed. Teachers can now submit promotion decisions if this is Term 3.");
      await load();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Could not close Term 3");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SchoolShell title="Academic setup" schoolAdmin>
      <div className="mx-auto max-w-6xl rise">
        <div>
          <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><CalendarDays className="size-5" /></div>
          <h1 className="font-display text-3xl font-bold">Academic setup</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Set up exactly three dated terms per academic year. Term-based unpaid tuition and PTA balances automatically carry into the next term as labeled arrears; daily payments are never carried forward. Closing Term 3 opens the teacher promotion register.</p>
        </div>
        {error && <p role="alert" className="mt-5 rounded-md border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <form onSubmit={(event) => void createYear(event)} className="glass-panel space-y-3 rounded-lg p-5">
            <h2 className="font-display text-lg font-bold">Add academic year</h2>
            <Field label="Name"><input name="year_name" required minLength={2} maxLength={80} placeholder="2026/2027" /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Starts"><input name="year_start" required type="date" /></Field><Field label="Ends"><input name="year_end" required type="date" /></Field></div>
            <label className="flex items-center gap-2 text-sm"><input name="is_current" type="checkbox" />Set as current year</label>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save academic year"}</Button>
          </form>
          <form onSubmit={(event) => void createTerm(event)} className="glass-panel space-y-3 rounded-lg p-5">
            <h2 className="font-display text-lg font-bold">Add term</h2>
            <Field label="Academic year"><select value={selectedYear?.id ?? ""} onChange={(event) => setSelectedYearId(event.target.value)} required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.is_current ? " (Current)" : ""}</option>)}</select></Field>
            <Field label="Term name"><input name="term_name" required minLength={2} maxLength={80} value={nextTermName} readOnly placeholder="Term 1" /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Starts"><input name="term_start" required type="date" /></Field><Field label="Ends"><input name="term_end" required type="date" /></Field></div>
            <Button type="submit" disabled={saving || !selectedYear || selectedYear.terms.length >= 3}>{saving ? "Saving..." : selectedYear?.terms.length === 3 ? "Three terms configured" : "Save term"}</Button>
          </form>
        </div>
        <section className="glass-panel mt-4 rounded-lg p-5">
          <h2 className="font-display text-lg font-bold">School academic periods</h2>
          {loading ? <p className="py-6 text-sm text-muted-foreground">Loading academic periods...</p> : years.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No academic years yet. Add a year to get started.</p> : (
            <div className="mt-3 space-y-4">{years.map((year) => <article key={year.id} className="rounded-md border border-border p-4">
              <h3 className="font-semibold">{year.name}{year.is_current ? " · Current" : ""}<span className="ml-2 text-xs font-normal text-muted-foreground">{year.terms.length}/3 terms configured</span></h3>
              {year.terms.length ? <ul className="mt-3 divide-y divide-border/70">{year.terms.map((term) => <li key={term.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span>{term.name} · {term.starts_on} to {term.ends_on}{term.is_current ? " · Current" : ""}{term.is_closed ? " · Closed" : ""}<span className="block text-xs text-muted-foreground">{term.arrears_processed_at ? "Term-fee arrears carried forward" : term.ends_on < new Date().toISOString().slice(0, 10) ? "Arrears will carry after pending payments are resolved and next-term fees are set up" : "Unpaid term-based fees carry forward after the end date"}</span></span>{term.name.toLowerCase().includes("term 3") && !term.is_closed && <Button size="sm" variant="outline" disabled={saving} onClick={() => void closeTerm(term.id)}>Close Term 3</Button>}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No terms set for this year.</p>}
            </article>)}</div>
          )}
        </section>
      </div>
    </SchoolShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-xs font-medium text-muted-foreground">{label}{children}</label>;
}
