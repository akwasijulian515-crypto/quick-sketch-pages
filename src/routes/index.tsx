import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenCheck, CreditCard, UserCheck } from "lucide-react";

import studentOne from "@/assets/student-1.jpg";
import studentTwo from "@/assets/student-2.jpg";
import studentThree from "@/assets/student-3.jpg";
import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "School Dashboard — Harrow Green" },
    { name: "description", content: "View today's attendance, payments, classes, and recent school activity." },
    { property: "og:title", content: "School Dashboard — Harrow Green" },
    { property: "og:description", content: "View today's attendance, payments, classes, and recent school activity." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Index,
});

function Index() {
  return (
    <SchoolShell>
      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-4">
        <section className="rise col-span-12 rounded-lg bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/15 lg:col-span-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-highlight">Good morning</p>
          <h1 className="mt-2 max-w-lg font-display text-3xl leading-tight">The ledger is current.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/70">All six classes are on the register and this morning&apos;s payments cleared on schedule. Nothing requires your attention before first period.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link to="/attendance">Open register</Link></Button>
            <Button asChild variant="outline" className="border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"><Link to="/payments">Daily summary</Link></Button>
          </div>
        </section>

        <section className="glass-panel rise col-span-12 rounded-lg p-5 lg:col-span-5">
          <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Today&apos;s Attendance</h2><span className="text-[11px] font-medium text-secondary-foreground">9:42 AM</span></div>
          <div className="mt-4 flex items-end gap-3"><p className="font-display text-4xl">468</p><p className="pb-1 text-sm text-muted-foreground">/ 484 present</p><span className="ml-auto rounded bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">96.7%</span></div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/10"><div className="h-full w-[96.7%] rounded-full bg-secondary-foreground" /></div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">{[["14","Late"],["2","Absent"],["6","Excused"]].map(([value,label])=><div key={label} className="rounded-md bg-background/70 py-2 ring-1 ring-border"><p className="font-display text-lg">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>)}</div>
        </section>

        <section className="rise col-span-12 rounded-lg bg-secondary/80 p-5 ring-1 ring-border md:col-span-6 lg:col-span-4">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Payment Status</h2><CreditCard className="size-5 text-secondary-foreground" /></div>
          <p className="mt-4 font-display text-3xl">GH₵ 18,240</p><p className="mt-1 text-sm text-muted-foreground">collected of GH₵ 21,000 expected</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/10"><div className="h-full w-[87%] rounded-full bg-highlight" /></div>
          <div className="mt-4 flex justify-between text-sm"><span className="text-muted-foreground">34 students paid</span><span className="font-medium">9 outstanding</span></div>
        </section>

        <section className="glass-panel rise col-span-12 rounded-lg p-5 md:col-span-6 lg:col-span-4">
          <h2 className="font-display text-lg font-bold">Quick Actions</h2>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {[["Record payment","/payments",CreditCard],["Mark attendance","/attendance",UserCheck],["Enter grades","/grades",BookOpenCheck],["Issue coupon","/coupons",ArrowRight]].map(([label,to,Icon])=><Button key={label as string} asChild variant={label === "Record payment" ? "default" : "outline"} className="h-16 whitespace-normal"><Link to={to as "/payments"}><Icon className="size-4" />{label as string}</Link></Button>)}
          </div>
        </section>

        <section className="glass-panel rise col-span-12 rounded-lg p-5 lg:col-span-4">
          <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Class Snapshot</h2><Link to="/classes" className="text-[11px] font-medium text-secondary-foreground">All classes →</Link></div>
          <div className="mt-4 space-y-3">
            {[[studentOne,"Form 2A","28 students · Ms. Mensah","98% here"],[studentTwo,"Form 2B","27 students · Mr. Okoye","95% here"],[studentThree,"Form 3A","30 students · Dr. Osei","88% here"]].map(([image,name,detail,rate])=><div key={name} className="flex items-center gap-3"><img src={image} alt="Student representative" width={512} height={512} loading="lazy" className="size-9 rounded-md object-cover"/><div className="min-w-0 leading-tight"><p className="text-sm font-medium">{name}</p><p className="truncate text-[11px] text-muted-foreground">{detail}</p></div><span className="ml-auto shrink-0 rounded bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">{rate}</span></div>)}
          </div>
        </section>

        <section className="glass-panel rise col-span-12 rounded-lg p-5">
          <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Recent Activity</h2><span className="text-[11px] text-muted-foreground">Last 24 hours</span></div>
          <div className="mt-4 divide-y divide-border">{[["Payment of GH₵ 480 received from Kwame Asante — auto-marked present.","09:12 AM"],["Coupon HG-2291 issued to a paid student in Form 3A.","08:47 AM"],["Mr. Okoye submitted Mathematics grades for Form 2B.","Yesterday"]].map(([text,time])=><div key={text} className="flex items-start gap-3 py-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-secondary-foreground"/><p className="text-sm">{text}</p><span className="ml-auto shrink-0 text-xs text-muted-foreground">{time}</span></div>)}</div>
        </section>
      </div>
    </SchoolShell>
  );
}
