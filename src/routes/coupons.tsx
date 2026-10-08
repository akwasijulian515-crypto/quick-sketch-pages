import { createFileRoute } from "@tanstack/react-router";
import { TicketCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Klasora" }, { name: "description", content: "Review daily-fee clearance coupons for this school." }] }),
  component: CouponsPage,
});

type Coupon = {
  id: string;
  code: string;
  status: string;
  valid_on: string | null;
  expires_at: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  admission_number: string | null;
  amount: number | string | null;
  currency: string | null;
  daily_fee_date: string | null;
};

function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadCoupons() {
      try {
        const token = await getNeonAccessToken();
        const url = new URL("/api/school/coupons", window.location.origin);
        const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
        if (tenant) url.searchParams.set("tenant", tenant);
        const response = await fetch(`${url.pathname}${url.search}`, { headers: { authorization: `Bearer ${token}` } });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Could not load coupons";
          throw new Error(message);
        }
        if (!cancelled) setCoupons((payload as { coupons: Coupon[] }).coupons);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load coupons");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCoupons();
    return () => { cancelled = true; };
  }, []);

  return <SchoolShell title="Coupons" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><TicketCheck className="size-5" /></div><h1 className="font-display text-3xl font-bold">Coupons</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review daily-fee clearance coupons linked to payment records. Coupons are not discount vouchers or payment receipts.</p></div>
    <section className="glass-panel mt-5 overflow-hidden rounded-lg">
      {error && <p role="alert" className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading coupons...</p> : coupons.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No daily-fee coupons have been issued for this school yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Coupon code", "Student", "Admission no.", "Valid on", "Daily payment", "Status"].map((label) => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{coupons.map((coupon) => <tr key={coupon.id}><td className="px-5 py-3 font-mono text-xs">{coupon.code}</td><td className="px-5 py-3 font-medium">{coupon.first_name ? `${coupon.first_name} ${coupon.last_name ?? ""}`.trim() : "Student unavailable"}</td><td className="px-5 py-3 font-mono text-xs">{coupon.admission_number ?? "—"}</td><td className="px-5 py-3">{coupon.valid_on ?? coupon.daily_fee_date ?? "—"}</td><td className="px-5 py-3">{coupon.amount === null ? "—" : `${coupon.currency ?? "GHS"} ${Number(coupon.amount).toFixed(2)}`}</td><td className="px-5 py-3 capitalize">{coupon.status}</td></tr>)}</tbody></table></div>}
    </section>
  </div></SchoolShell>;
}
