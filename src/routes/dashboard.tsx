import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard, GraduationCap, School, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Overview — Klasora" },
    { name: "description", content: "View live school enrollment, attendance, and payment activity." },
    { property: "og:title", content: "Overview — Klasora" },
    { property: "og:description", content: "View live school enrollment, attendance, and payment activity." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Dashboard,
});

type DashboardData = {
  date: string;
  class_count: number;
  student_count: number;
  attendance: { present_count: number; late_count: number; absent_count: number; marked_count: number };
  payments: { currency: string; verified_amount: number | string; verified_count: number; pending_count: number }[];
  current_term: { academic_year_name: string; term_name: string } | null;
  recent_payments: {
    id: string;
    receipt_number: string | null;
    amount: number | string;
    currency: string;
    status: string;
    paid_at: string;
    category: string;
    student_name: string;
  }[];
};

async function dashboardApi<T>(path: string): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const response = await fetch(`${url.pathname}${url.search}`, { headers: { authorization: `Bearer ${token}` } });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Could not load school overview";
    throw new Error(message);
  }
  return payload as T;
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void dashboardApi<DashboardData>("/api/school/dashboard")
      .then((result) => { if (!cancelled) setData(result); })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load school overview");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const paymentTotal = (data?.payments ?? []).map((payment) =>
    `${payment.currency} ${Number(payment.verified_amount).toFixed(2)}`,
  ).join(" · ") || "—";
  const paymentCount = (data?.payments ?? []).reduce((sum, payment) => sum + Number(payment.verified_count), 0);
  const pendingCount = (data?.payments ?? []).reduce((sum, payment) => sum + Number(payment.pending_count), 0);

  return (
    <SchoolShell title="Overview" schoolAdmin>
      <div className="mx-auto max-w-6xl rise">
        <section className="hero-gloss rounded-lg p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-highlight">School overview</p>
          <h1 className="mt-2 max-w-lg font-display text-3xl leading-tight">Your school, at a glance.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/70">
            Live enrollment, attendance, and collection information for {data?.date ?? "today"}.
            {data?.current_term ? ` ${data.current_term.academic_year_name} · ${data.current_term.term_name}.` : ""}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link to="/attendance-overview">Attendance overview</Link></Button>
            <Button asChild variant="outline" className="border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"><Link to="/school-admin">School administration</Link></Button>
          </div>
        </section>

        {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={GraduationCap} label="Active students" value={loading ? "—" : String(data?.student_count ?? 0)} note="Currently enrolled learners" />
          <Metric icon={School} label="Classes" value={loading ? "—" : String(data?.class_count ?? 0)} note="In active academic years" />
          <Metric icon={UserCheck} label="Present or late today" value={loading ? "—" : String(Number(data?.attendance.present_count ?? 0) + Number(data?.attendance.late_count ?? 0))} note={`${data?.attendance.absent_count ?? 0} absent · ${data?.attendance.marked_count ?? 0} marked`} />
          <Metric icon={CreditCard} label="Verified collections today" value={loading ? "—" : paymentTotal} note={`${paymentCount} verified · ${pendingCount} awaiting review`} />
        </section>

        <section className="glass-panel mt-4 overflow-hidden rounded-lg">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div><h2 className="font-display text-lg font-bold">Recent payments</h2><p className="mt-1 text-xs text-muted-foreground">Latest saved tenant payment records.</p></div>
            <Button asChild size="sm" variant="outline"><Link to="/payments">Open finance <ArrowRight /></Link></Button>
          </div>
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading recent payments...</p> : !data?.recent_payments.length ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No payment activity has been recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Student</th><th className="px-5 py-3 font-medium">Receipt</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Amount</th><th className="px-5 py-3 font-medium">Status</th></tr></thead>
                <tbody className="divide-y divide-border/70">{data.recent_payments.map((payment) => <tr key={payment.id}><td className="px-5 py-4 font-medium">{payment.student_name}</td><td className="px-5 py-4 font-mono text-xs">{payment.receipt_number ?? "—"}</td><td className="px-5 py-4 capitalize">{payment.category.replaceAll("_", " ")}</td><td className="px-5 py-4">{payment.currency} {Number(payment.amount).toFixed(2)}</td><td className="px-5 py-4 capitalize">{payment.status}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </SchoolShell>
  );
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof GraduationCap; label: string; value: string; note: string }) {
  return <article className="glass-panel rounded-lg p-5"><div className="flex items-center justify-between"><h2 className="font-display text-sm font-bold">{label}</h2><Icon className="size-4 text-primary" /></div><p className="mt-4 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></article>;
}
