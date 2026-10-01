import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, GraduationCap, LockKeyhole, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNeonAccessToken, neonAuthClient } from "../../auth/client";

export const Route = createFileRoute("/teacher/promotion")({ head: () => ({ meta: [{ title: "Class Promotion — Harrow Green" }, { name: "description", content: "Class teacher promotion register." }] }), component: PromotionPage });

type Decision = "Promote" | "Repeat" | "Transfer" | "Graduate";
const learners = [{ id: "1", name: "Abena Ofori", admission: "HGA-2B-001", attendance: "96%", average: "76%", profile: "Excellent" }, { id: "2", name: "Daniel Boateng", admission: "HGA-2B-002", attendance: "94%", average: "63%", profile: "Good" }, { id: "3", name: "Eunice Agyeman", admission: "HGA-2B-003", attendance: "91%", average: "71%", profile: "Very good" }, { id: "4", name: "Felix Nyarko", admission: "HGA-2B-004", attendance: "86%", average: "48%", profile: "Needs support" }, { id: "5", name: "Gloria Mensah", admission: "HGA-2B-005", attendance: "89%", average: "58%", profile: "Good" }];

function PromotionPage() {
  const navigate = useNavigate(); const [allowed, setAllowed] = useState(false); const [open] = useState(() => sessionStorage.getItem("hg-term-three-closed") === "true"); const [decisions, setDecisions] = useState<Record<string, Decision>>(() => Object.fromEntries(learners.map((learner) => [learner.id, "Promote"]))); const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function verifyTeacher() {
      try {
        const token = await getNeonAccessToken();
        const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
        const endpoint = tenant ? `/api/auth/context?tenant=${encodeURIComponent(tenant)}` : "/api/auth/context";
        const response = await fetch(endpoint, { headers: { authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => null) as { membership?: { role?: string } } | null;
        if (!response.ok || payload?.membership?.role !== "teacher") throw new Error("Teacher membership is required");
        if (!cancelled) setAllowed(true);
      } catch {
        if (!cancelled) navigate({ to: "/login" });
      }
    }
    void verifyTeacher();
    return () => { cancelled = true; };
  }, [navigate]);
  if (!allowed) return null;
  return <div className="relative min-h-screen bg-background font-body text-foreground"><div className="pointer-events-none fixed inset-0 ambient-wash" /><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6"><div className="flex items-center gap-2.5"><div className="grid size-9 place-items-center rounded-md bg-primary font-display text-base font-bold text-primary-foreground">H</div><div className="leading-tight"><p className="font-display text-[15px] font-bold">Teacher Portal</p><p className="text-[11px] text-muted-foreground">Mr. Okoye · Form 2B</p></div></div><Button variant="outline" size="sm" onClick={() => { sessionStorage.removeItem("hg-role"); navigate({ to: "/login" }); }}><LogOut />Sign out</Button></header><main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><GraduationCap className="size-5" /></div><h1 className="font-display text-3xl font-bold">Class promotion</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Review your Form 2B learners and submit their next-year placement after Term 3.</p></div><Button variant="outline" onClick={() => navigate({ to: "/teacher" })}>Back to portal</Button></div>{open ? <><div className="mt-5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700"><span className="flex items-center gap-2"><CheckCircle2 className="size-5" />Term 3 is closed. Promotion is open for your class.</span></div><section className="glass-panel mt-4 overflow-hidden rounded-lg"><div className="border-b border-border px-5 py-4"><h2 className="font-display text-lg font-bold">Form 2B promotion register</h2><p className="mt-1 text-xs text-muted-foreground">Promotion keeps each learner&apos;s current-year record and creates their next academic-year enrollment.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["Learner", "Attendance", "Average", "Learner profile", "Decision"].map((item) => <th key={item} className="px-5 py-3 font-medium">{item}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{learners.map((learner) => <tr key={learner.id} className="hover:bg-muted/30"><td className="px-5 py-3"><p className="font-medium">{learner.name}</p><p className="font-mono text-[11px] text-muted-foreground">{learner.admission}</p></td><td className="px-5 py-3">{learner.attendance}</td><td className="px-5 py-3">{learner.average}</td><td className="px-5 py-3">{learner.profile}</td><td className="px-5 py-3"><select value={decisions[learner.id]} onChange={(event) => setDecisions((current) => ({ ...current, [learner.id]: event.target.value as Decision }))} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option>Promote</option><option>Repeat</option><option>Transfer</option><option>Graduate</option></select></td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4"><p className="text-xs text-muted-foreground">{submitted ? "Promotion register submitted. School Admin can review it." : "You can review decisions before submitting the register."}</p><Button onClick={() => setSubmitted(true)} disabled={submitted}>{submitted ? <><CheckCircle2 />Submitted</> : "Submit promotion register"}</Button></div></section></> : <div className="glass-panel mt-5 rounded-lg p-8 text-center"><LockKeyhole className="mx-auto size-7 text-amber-600" /><h2 className="mt-3 font-display text-lg font-bold">Promotion is not open</h2><p className="mt-1 text-sm text-muted-foreground">Your School Admin must close Term 3 before you can promote learners.</p></div>}</main></div>;
}
