import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SchoolClass = { id: string; name: string };
type AcademicYear = { id: string; name: string; is_current: boolean; terms: { id: string; name: string }[] };
type FeeRule = {
  id: string;
  class_id: string;
  class_name: string;
  academic_year_id: string;
  academic_year_name: string;
  term_id: string | null;
  term_name: string | null;
  fee_type: "daily" | "tuition" | "pta" | "exam" | "other";
  description: string;
  amount: number | string;
  currency: string;
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

export function SchoolFeeRules() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [fees, setFees] = useState<FeeRule[]>([]);
  const [classId, setClassId] = useState("");
  const [yearId, setYearId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedYear = years.find((year) => year.id === yearId) ?? years.find((year) => year.is_current) ?? years[0];
  const terms = useMemo(() => selectedYear?.terms ?? [], [selectedYear]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classResult, yearResult, feeResult] = await Promise.all([
        schoolApi<{ classes: SchoolClass[] }>("/api/school/classes"),
        schoolApi<{ academic_years: AcademicYear[] }>("/api/school/academic-periods"),
        schoolApi<{ fees: FeeRule[] }>("/api/school/fees"),
      ]);
      setClasses(classResult.classes);
      setYears(yearResult.academic_years);
      setFees(feeResult.fees);
      if (classResult.classes[0]) setClassId((current) => current || classResult.classes[0]!.id);
      const currentYear = yearResult.academic_years.find((year) => year.is_current) ?? yearResult.academic_years[0];
      if (currentYear) setYearId((current) => current || currentYear.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load fee rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await schoolApi("/api/school/fees", {
        method: "POST",
        body: JSON.stringify({
          class_id: classId,
          academic_year_id: yearId || selectedYear?.id,
          term_id: form.get("fee_type") === "daily" ? null : form.get("term_id") || null,
          fee_type: form.get("fee_type"),
          description: form.get("description"),
          amount: Number(form.get("amount")),
          currency: form.get("currency"),
        }),
      });
      await load();
      formElement.reset();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save fee rule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass-panel mt-4 rounded-lg p-5">
      <div>
        <h2 className="font-display text-xl font-bold">Class fee rules</h2>
        <p className="mt-1 text-sm text-muted-foreground">Set a class rate for daily collections or a fee for an academic term.</p>
      </div>
      {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
      {loading ? <p className="py-6 text-sm text-muted-foreground">Loading fee rules...</p> : (
        <>
          <form onSubmit={(event) => void save(event)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Class
              <select required value={classId} onChange={(event) => setClassId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Academic year
              <select required value={yearId || selectedYear?.id || ""} onChange={(event) => setYearId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="">Select year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.is_current ? " (Current)" : ""}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Fee type
              <select name="fee_type" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="daily">Daily</option><option value="tuition">Tuition</option><option value="pta">PTA</option><option value="exam">Exam</option><option value="other">Other</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Term (optional)
              <select name="term_id" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="">Whole academic year</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Description
              <Input name="description" required minLength={2} maxLength={160} placeholder="e.g. Daily feeding fee" />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Amount
              <Input name="amount" required type="number" min="0" max="99999999.99" step="0.01" placeholder="0.00" />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Currency
              <Input name="currency" required minLength={3} maxLength={3} defaultValue="GHS" />
            </label>
            <div className="flex items-end"><Button type="submit" disabled={saving || !classId || !selectedYear}>{saving ? "Saving..." : "Save fee rule"}</Button></div>
          </form>
          {fees.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No fee rules have been set up yet.</p> : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground"><tr>{["Class", "Fee", "Period", "Amount"].map((label) => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-border/70">{fees.map((fee) => <tr key={fee.id}><td className="px-3 py-3 font-medium">{fee.class_name}</td><td className="px-3 py-3">{fee.description}</td><td className="px-3 py-3">{fee.term_name ?? fee.academic_year_name}</td><td className="px-3 py-3">{fee.currency} {Number(fee.amount).toFixed(2)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
