import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpenCheck, LogOut, TicketCheck, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher Portal — Harrow Green" },
      { name: "description", content: "Teacher register, grade entry, and coupon tools." },
      { property: "og:title", content: "Teacher Portal — Harrow Green" },
      { property: "og:description", content: "Teacher register, grade entry, and coupon tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherPortal,
});

const tabs = [
  { id: "register", label: "Register", icon: UserRoundCheck },
  { id: "grades", label: "Grades", icon: BookOpenCheck },
  { id: "coupons", label: "Coupons", icon: TicketCheck },
] as const;

function TeacherPortal() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("register");

  useEffect(() => {
    if (sessionStorage.getItem("hg-role") === "teacher") {
      setAllowed(true);
    } else {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  if (!allowed) return null;

  return (
    <div className="relative min-h-screen bg-background font-body text-foreground">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-md bg-primary font-display text-base font-bold text-primary-foreground">H</div>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold">Teacher Portal</p>
            <p className="text-[11px] text-muted-foreground">Mr. Okoye · Form 2B</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            sessionStorage.removeItem("hg-role");
            navigate({ to: "/login" });
          }}
        >
          <LogOut />Sign out
        </Button>
      </header>

      <main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Good morning, Mr. Okoye</h1>
            <p className="mt-1 text-sm text-muted-foreground">Form 2B · 42 students · Today&apos;s register is waiting.</p>
          </div>
          <div className="flex gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <Button key={id} variant={tab === id ? "default" : "outline"} size="sm" onClick={() => setTab(id)}>
                <Icon />{label}
              </Button>
            ))}
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Present today", value: "38", note: "of 42 students" },
            { label: "Grades pending", value: "2", note: "subjects to submit" },
            { label: "Coupons issued", value: "5", note: "this week" },
          ].map((stat) => (
            <article key={stat.label} className="glass-panel rise rounded-lg p-5">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-2 font-display text-3xl">{stat.value}</p>
              <p className="mt-1 text-xs text-secondary-foreground">{stat.note}</p>
            </article>
          ))}
        </section>

        <section className="glass-panel rise mt-4 overflow-hidden rounded-lg">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-bold">
              {tab === "register" ? "Today's register" : tab === "grades" ? "Grade entry" : "Coupon generation"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {tab === "register" ? "Mark each student present, late, or absent." : tab === "grades" ? "Enter scores for your subjects." : "Issue coupons to paid students."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  {(tab === "register" ? ["Student", "Status", "Time in", "Note"] : tab === "grades" ? ["Student", "Subject", "Score", "Grade"] : ["Student", "Coupon", "Issued", "Status"]).map((column) => (
                    <th key={column} className="px-5 py-3 font-medium">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {[0, 1, 2, 3, 4].map((row) => (
                  <tr key={row}>
                    {[0, 1, 2, 3].map((cell) => (
                      <td key={cell} className="px-5 py-4">
                        <div className={cn("h-3 rounded", cell === 0 ? "w-28 bg-primary/15" : "w-20 bg-muted-foreground/15")} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Ready for live class records.</div>
        </section>
      </main>
    </div>
  );
}
