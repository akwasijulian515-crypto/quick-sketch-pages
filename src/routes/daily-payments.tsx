import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CheckCircle2, Circle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/daily-payments")({
  head: () => ({ meta: [{ title: "Daily Payments — Klasora" }, { name: "description", content: "Daily-fee payment register for Finance." }] }),
  component: DailyPaymentsPage,
});

type DailyStudent = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_id: string | null;
  class_name: string | null;
};

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function paidStorageKey(date: string) {
  return `hg-daily-paid:${date}`;
}

function readPaid(date: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(paidStorageKey(date));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return parsed instanceof Array ? new Set(parsed.filter((item): item is string => typeof item === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function DailyPaymentsPage() {
  const [date, setDate] = useState(() => localDateString(new Date()));
  const [students, setStudents] = useState<DailyStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [paid, setPaid] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    async function loadStudents() {
      try {
        const token = await getNeonAccessToken();
        const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
        const collected: DailyStudent[] = [];
        for (let page = 1; page <= 10; page += 1) {
          const url = new URL("/api/school/students", window.location.origin);
          url.searchParams.set("page", String(page));
          url.searchParams.set("page_size", "100");
          if (tenant) url.searchParams.set("tenant", tenant);
          const response = await fetch(`${url.pathname}${url.search}`, { headers: { authorization: `Bearer ${token}` } });
          const payload: unknown = await response.json().catch(() => null);
          if (!response.ok) {
            const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Could not load the student list";
            throw new Error(message);
          }
          const result = payload as { students: DailyStudent[]; total: number };
          collected.push(...result.students);
          if (collected.length >= result.total || result.students.length === 0) break;
        }
        if (!cancelled) setStudents(collected);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load the student list");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadStudents();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setPaid(readPaid(date));
  }, [date]);

  const togglePaid = useCallback((studentId: string) => {
    setPaid((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      try {
        sessionStorage.setItem(paidStorageKey(date), JSON.stringify([...next]));
      } catch {
        // Storage unavailable (private mode) — marks stay for this session only.
      }
      return next;
    });
  }, [date]);

  const classNames = useMemo(
    () => [...new Set(students.map((student) => student.class_name ?? "Unassigned"))].sort(),
    [students],
  );
  const visible = useMemo(
    () => students
      .filter((student) => classFilter === "all" || (student.class_name ?? "Unassigned") === classFilter)
      .sort((a, b) => (a.class_name ?? "").localeCompare(b.class_name ?? "") || a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)),
    [students, classFilter],
  );
  const paidCount = visible.filter((student) => paid.has(student.id)).length;

  return <SchoolShell title="Daily payments" finance><div className="mx-auto max-w-6xl rise">
    <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Banknote className="size-5" /></div><h1 className="font-display text-3xl font-bold">Daily payments</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Tick each learner who has paid today's daily fee. Anyone not ticked counts as unpaid.</p></div>

    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end sm:gap-3">
        <label className="text-xs font-medium text-muted-foreground">Date
          <input type="date" value={date} max={localDateString(new Date())} onChange={(event) => event.target.value && setDate(event.target.value)} className="mt-1 block w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground sm:w-44" />
        </label>
        <label className="text-xs font-medium text-muted-foreground">Class
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="mt-1 block w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground sm:w-44">
            <option value="all">All classes</option>
            {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-md bg-secondary px-2.5 py-1 text-secondary-foreground ring-1 ring-border">{paidCount} paid</span>
        <span className="rounded-md bg-muted px-2.5 py-1 text-muted-foreground">{visible.length - paidCount} unpaid</span>
      </div>
    </div>

    {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}

    <section className="glass-panel mt-4 overflow-hidden rounded-lg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
        <div><h2 className="font-display text-lg font-bold">Daily fee register</h2><p className="mt-1 text-xs text-muted-foreground">{date} · {visible.length} learners{classFilter !== "all" ? ` in ${classFilter}` : ""}</p></div>
      </div>
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading learners...</p>
        : visible.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No active learners found for this school yet.</p>
        : <>
          {/* Mobile cards */}
          <div className="divide-y divide-border/70 md:hidden">
            {visible.map((student) => {
              const isPaid = paid.has(student.id);
              return <article key={student.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{student.first_name} {student.last_name}</p>
                  <p className="text-xs text-muted-foreground">{student.admission_number} · {student.class_name ?? "Unassigned"}</p>
                </div>
                <PaidButton isPaid={isPaid} onClick={() => togglePaid(student.id)} />
              </article>;
            })}
          </div>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Learner", "Admission no.", "Class", "Daily fee"].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-border/70">
              {visible.map((student) => {
                const isPaid = paid.has(student.id);
                return <tr key={student.id}>
                  <td className="px-5 py-3 font-medium">{student.first_name} {student.last_name}</td>
                  <td className="px-5 py-3">{student.admission_number}</td>
                  <td className="px-5 py-3">{student.class_name ?? "Unassigned"}</td>
                  <td className="px-5 py-3"><PaidButton isPaid={isPaid} onClick={() => togglePaid(student.id)} /></td>
                </tr>;
              })}
            </tbody>
          </table></div>
        </>}
    </section>
    <p className="mt-3 text-xs text-muted-foreground">Marks are kept on this device for preview only — nothing is written to the school's payment records yet.</p>
  </div></SchoolShell>;
}

function PaidButton({ isPaid, onClick }: { isPaid: boolean; onClick: () => void }) {
  return <Button
    type="button"
    size="sm"
    variant={isPaid ? "default" : "outline"}
    className="min-w-28"
    onClick={onClick}
    aria-pressed={isPaid}
  >
    {isPaid ? <><CheckCircle2 />Paid</> : <><Circle />Mark paid</>}
  </Button>;
}
