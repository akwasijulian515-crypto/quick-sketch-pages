import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance — Klasora" }, { name: "description", content: "Review school fee schedules and payment status." }] }),
  component: FinancePage,
});

type FeeRule = {
  id: string;
  class_name: string;
  academic_year_name: string;
  term_name: string | null;
  fee_type: string;
  description: string;
  amount: number | string;
  currency: string;
  is_active: boolean;
};

function FinancePage() {
  const [fees, setFees] = useState<FeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadFees() {
      try {
        const token = await getNeonAccessToken();
        const url = new URL("/api/school/fees", window.location.origin);
        const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
        if (tenant) url.searchParams.set("tenant", tenant);
        const response = await fetch(`${url.pathname}${url.search}`, { headers: { authorization: `Bearer ${token}` } });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Could not load fee rules";
          throw new Error(message);
        }
        const result = payload as { fees: FeeRule[] };
        if (!cancelled) setFees(result.fees);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load fee rules");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadFees();
    return () => { cancelled = true; };
  }, []);

  return <SchoolShell title="Finance" finance><div className="mx-auto max-w-6xl rise">
    <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Wallet className="size-5" /></div><h1 className="font-display text-3xl font-bold">Finance desk</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review the active school fee schedule. Payment and receipt recording is not connected yet.</p></div>
    <div className="mt-5 rounded-md border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-secondary-foreground">No payments are being created or verified from this screen. The fee rules below are configured by your School Admin.</div>
    <section className="glass-panel mt-5 overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-bold">Class fee schedule</h2><p className="mt-1 text-xs text-muted-foreground">Configured fees by class and academic period.</p></div><ReceiptText className="size-5 text-primary" /></div>
      {error && <p role="alert" className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading fee rules...</p> : fees.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">No fee rules have been configured for this school yet.</p>
      ) : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Class", "Academic year / term", "Fee", "Description", "Amount", "Status"].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-border/70">{fees.map((fee) => <tr key={fee.id}>
          <td className="px-5 py-3 font-medium">{fee.class_name}</td>
          <td className="px-5 py-3">{fee.academic_year_name}{fee.term_name ? <p className="text-xs text-muted-foreground">{fee.term_name}</p> : null}</td>
          <td className="px-5 py-3 capitalize">{fee.fee_type}</td>
          <td className="px-5 py-3">{fee.description}</td>
          <td className="px-5 py-3">{fee.currency} {Number(fee.amount).toFixed(2)}</td>
          <td className="px-5 py-3">{fee.is_active ? "Active" : "Inactive"}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </div></SchoolShell>;
}
