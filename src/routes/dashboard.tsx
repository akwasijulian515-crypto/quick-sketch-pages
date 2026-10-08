import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard, UserCheck, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Overview — Klasora" },
    { name: "description", content: "View today's attendance, payments, classes, and recent school activity." },
    { property: "og:title", content: "Overview — Klasora" },
    { property: "og:description", content: "View today's attendance, payments, classes, and recent school activity." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Dashboard,
});

function Dashboard() {
  const quickActions = [
    { label: "Student directory", to: "/students" as const, icon: UserCheck, primary: true },
    { label: "Manage teachers", to: "/teachers" as const, icon: UsersRound, primary: false },
    { label: "Attendance overview", to: "/attendance-overview" as const, icon: UserCheck, primary: false },
    { label: "Academic setup", to: "/academic-setup" as const, icon: ArrowRight, primary: false },
  ];

  return (
    <SchoolShell title="Overview">
      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-4">
        <section className="hero-gloss rise col-span-12 rounded-lg p-6 lg:col-span-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-highlight">School overview</p>
          <h1 className="mt-2 max-w-lg font-display text-3xl leading-tight">Your school, at a glance.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/70">Use the connected tools below to manage students, attendance, teachers, and academic setup. School-wide summary charts are not available yet.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link to="/attendance-overview">Attendance overview</Link></Button>
            <Button asChild variant="outline" className="border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"><Link to="/school-admin">School administration</Link></Button>
          </div>
        </section>

        <section className="glass-panel rise col-span-12 rounded-lg p-5 lg:col-span-5">
          <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Today&apos;s Attendance</h2></div>
          <p className="mt-4 font-display text-4xl text-muted-foreground">—</p>
          <p className="mt-1 text-sm text-muted-foreground">Open Attendance overview to check today&apos;s register.</p>
        </section>

        <section className="rise col-span-12 rounded-lg bg-secondary/80 p-5 ring-1 ring-border md:col-span-6 lg:col-span-4">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Payment Status</h2><CreditCard className="size-5 text-secondary-foreground" /></div>
          <p className="mt-4 font-display text-3xl text-muted-foreground">—</p><p className="mt-1 text-sm text-muted-foreground">Payment summaries are not available on this dashboard yet.</p>
        </section>

        <section className="glass-panel rise col-span-12 rounded-lg p-5 md:col-span-6 lg:col-span-4">
          <h2 className="font-display text-lg font-bold">Quick Actions</h2>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {quickActions.map(({ label, to, icon: Icon, primary }) => <Button key={label} asChild variant={primary ? "default" : "outline"} className="h-16 whitespace-normal"><Link to={to}><Icon className="size-4" />{label}</Link></Button>)}
          </div>
        </section>

        <section className="glass-panel rise col-span-12 rounded-lg p-5 lg:col-span-4">
          <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Class setup</h2><Link to="/school-admin" className="text-[11px] font-medium text-secondary-foreground">Manage classes →</Link></div>
          <p className="mt-4 text-sm text-muted-foreground">Create and manage classes in School administration.</p>
        </section>

        <section className="glass-panel rise col-span-12 rounded-lg p-5">
          <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Recent Activity</h2><span className="text-[11px] text-muted-foreground">Last 24 hours</span></div>
          <p className="mt-4 text-sm text-muted-foreground">Recent activity is not shown on this dashboard yet.</p>
        </section>
      </div>
    </SchoolShell>
  );
}
