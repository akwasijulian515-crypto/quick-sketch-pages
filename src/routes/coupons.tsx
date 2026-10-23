import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, Search, TicketCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { SchoolShell } from "@/components/school-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/coupons")({
  head: () => ({ meta: [{ title: "Daily Fee Status — Harrow Green" }, { name: "description", content: "Review daily-fee clearance for every learner." }] }),
  component: CouponsPage,
});

type FeeStatus = "Paid" | "Unpaid" | "Awaiting confirmation";
type Clearance = { id: string; student: string; admission: string; className: string; amount: number; status: FeeStatus; coupon?: string; recordedAt?: string; collector?: string };

const clearances: Clearance[] = [
  { id: "1", student: "Abena Ofori", admission: "HGA-2B-001", className: "Form 2B", amount: 20, status: "Paid", coupon: "DF-2B-4817", recordedAt: "07:29", collector: "Ama Finance" },
  { id: "2", student: "Daniel Boateng", admission: "HGA-2B-002", className: "Form 2B", amount: 20, status: "Unpaid" },
  { id: "3", student: "Eunice Agyeman", admission: "HGA-2B-003", className: "Form 2B", amount: 20, status: "Paid", coupon: "DF-2B-4818", recordedAt: "08:06", collector: "Ama Finance" },
  { id: "4", student: "Felix Nyarko", admission: "HGA-2B-004", className: "Form 2B", amount: 20, status: "Awaiting confirmation" },
  { id: "5", student: "Gloria Mensah", admission: "HGA-2B-005", className: "Form 2B", amount: 20, status: "Unpaid" },
  { id: "6", student: "Isaac Amankwah", admission: "HGA-2B-006", className: "Form 2B", amount: 20, status: "Paid", coupon: "DF-2B-4822", recordedAt: "08:19", collector: "Kwame Cashier" },
  { id: "7", student: "Janet Asiedu", admission: "HGA-2B-007", className: "Form 2B", amount: 20, status: "Paid", coupon: "DF-2B-4820", recordedAt: "07:25", collector: "Ama Finance" },
  { id: "8", student: "Kojo Mensah", admission: "HGA-3C-001", className: "Form 3C", amount: 25, status: "Unpaid" },
];

function CouponsPage() {
  const [className, setClassName] = useState("Form 2B"); const [query, setQuery] = useState("");
  const classRecords = clearances.filter((record) => record.className === className);
  const records = useMemo(() => classRecords.filter((record) => `${record.student} ${record.admission}`.toLowerCase().includes(query.toLowerCase())), [classRecords, query]);
  const paid = classRecords.filter((record) => record.status === "Paid"); const unpaid = classRecords.filter((record) => record.status === "Unpaid");
  return <SchoolShell title="Daily fee status" schoolAdmin><div className="mx-auto max-w-6xl rise"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><TicketCheck className="size-5" /></div><h1 className="font-display text-3xl font-bold">Daily fee status</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">See each learner&apos;s daily-fee clearance. A coupon confirms payment for today; it is not a discount or an official receipt.</p></div><section className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Paid today" value={String(paid.length)} note={`GH₵ ${paid.reduce((total, record) => total + record.amount, 0).toFixed(2)} received`} tone="good" /><Metric label="Not paid" value={String(unpaid.length)} note="Needs Finance follow-up" tone="warning" /><Metric label="Awaiting confirmation" value={String(classRecords.filter((record) => record.status === "Awaiting confirmation").length)} note="Not yet counted as paid" /></section><section className="glass-panel mt-4 overflow-hidden rounded-lg"><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between"><label className="text-sm font-medium">Class<select value={className} onChange={(event) => { setClassName(event.target.value); setQuery(""); }} className="ml-2 h-9 rounded-md border border-input bg-background px-3 text-sm"><option>Form 2B</option><option>Form 3C</option></select></label><div className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-input bg-background/70 px-3"><Search className="size-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or admission number" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></div></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Learner", "Daily fee", "Status", "Clearance coupon", "Recorded", "Collector"].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{records.map((record) => <tr key={record.id} className="hover:bg-muted/30"><td className="px-5 py-3"><p className="font-medium">{record.student}</p><p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{record.admission}</p></td><td className="px-5 py-3">GH₵ {record.amount.toFixed(2)}</td><td className="px-5 py-3"><StatusBadge status={record.status} /></td><td className="px-5 py-3 font-mono text-xs text-secondary-foreground">{record.coupon ?? "—"}</td><td className="px-5 py-3 text-muted-foreground">{record.recordedAt ?? "—"}</td><td className="px-5 py-3 text-muted-foreground">{record.collector ?? "—"}</td></tr>)}{records.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">No learner matches your search.</td></tr>}</tbody></table></div><p className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground"><CircleAlert className="size-4 text-amber-600" />Only Finance records collections. Teachers and School Admin use this page to see who has paid and who has not.</p></section></div></SchoolShell>;
}

function StatusBadge({ status }: { status: FeeStatus }) { const style = status === "Paid" ? "bg-emerald-500/10 text-emerald-700" : status === "Unpaid" ? "bg-rose-500/10 text-rose-700" : "bg-amber-500/10 text-amber-700"; return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", style)}>{status === "Paid" ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />}{status}</span>; }
function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "good" | "warning" }) { return <article className={cn("glass-panel rounded-lg p-5", tone === "warning" && "ring-1 ring-amber-500/25")}><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={cn("mt-2 font-display text-3xl", tone === "good" && "text-emerald-700", tone === "warning" && "text-amber-700")}>{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
