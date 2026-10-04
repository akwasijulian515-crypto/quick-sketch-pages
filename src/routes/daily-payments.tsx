import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/daily-payments")({
  head: () => ({ meta: [{ title: "Daily Payments — Klasora" }, { name: "description", content: "Daily-fee payment register for Finance." }] }),
  component: DailyPaymentsPage,
});

function DailyPaymentsPage() {
  return <SchoolShell title="Daily payments" finance><div className="mx-auto max-w-6xl rise">
    <div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><Wallet className="size-5" /></div><h1 className="font-display text-3xl font-bold">Daily payments</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Daily payment recording, learner balances, and clearance coupons are not connected to persistent payment records yet.</p></div>
    <section className="glass-panel mt-6 rounded-lg border border-dashed border-border p-10 text-center">
      <h2 className="font-display text-lg font-bold">Payment register unavailable</h2>
      <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">No payment status or coupon is being generated here. Review the configured fee rules in Finance while the payment workflow is pending implementation.</p>
      <Button className="mt-4" variant="outline" asChild><Link to="/finance">View fee schedule</Link></Button>
    </section>
  </div></SchoolShell>;
}
