import { Link, createFileRoute } from "@tanstack/react-router";
import { FileText, Link2, ShieldCheck, UserPlus, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/school-admin")({
  head: () => ({ meta: [{ title: "School Admin — Harrow Green" }, { name: "description", content: "Manage users, invitations, and terminal reports." }] }),
  component: SchoolAdminPage,
});

function SchoolAdminPage() {
  return <SchoolShell title="School Admin" schoolAdmin><div className="mx-auto max-w-6xl rise">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><UsersRound className="size-5" /></div><h1 className="font-display text-3xl font-bold">School administration</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Manage your school&apos;s people, access, and terminal reporting. Attendance remains a teacher responsibility.</p></div><Button><UserPlus />Create user</Button></div>
    <section className="mt-7 grid gap-3 sm:grid-cols-3"><Card label="Active users" value="128" note="Teachers, parents & finance" /><Card label="Pending invites" value="7" note="Ready to send" /><Card label="Terminal reports" value="3" note="Current term drafts" /></section>
    <section className="mt-4 grid gap-4 lg:grid-cols-3"><article className="glass-panel rounded-lg p-5"><Link2 className="size-5 text-primary" /><h2 className="mt-3 font-display text-lg font-bold">Role signup links</h2><p className="mt-1 text-sm text-muted-foreground">Create controlled invitation links for teachers, parents, students, and finance staff.</p><Button className="mt-5" variant="outline"><Link2 />Create invitation link</Button></article><article className="glass-panel rounded-lg p-5"><FileText className="size-5 text-primary" /><h2 className="mt-3 font-display text-lg font-bold">Terminal reports</h2><p className="mt-1 text-sm text-muted-foreground">Generate, review, and publish student terminal reports for the current term.</p><Button className="mt-5" variant="outline"><FileText />Open report centre</Button></article><article className="glass-panel rounded-lg p-5"><ShieldCheck className="size-5 text-primary" /><h2 className="mt-3 font-display text-lg font-bold">Daily reconciliation</h2><p className="mt-1 text-sm text-muted-foreground">Review gateway-verified payments, attendance exceptions, and close the collection day.</p><Button className="mt-5" variant="outline" asChild><Link to="/reconciliation"><ShieldCheck />Open controls</Link></Button></article></section>
  </div></SchoolShell>;
}

function Card({ label, value, note }: { label: string; value: string; note: string }) { return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
