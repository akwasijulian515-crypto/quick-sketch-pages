import { createFileRoute } from "@tanstack/react-router";
import { Building2, CheckCircle2, Plus, Search, ShieldCheck, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ head: () => ({ meta: [{ title: "Super Admin — Harrow Green" }, { name: "description", content: "Manage schools, tenants, and platform access." }] }), component: SuperAdminPage });

type School = { id: string; name: string; subdomain: string; students: number; admins: number; status: "Active" | "Trial" };
const initialSchools: School[] = [
  { id: "harrow-green", name: "Harrow Green Academy", subdomain: "harrowgreen", students: 562, admins: 3, status: "Active" },
  { id: "oakwood", name: "Oakwood Preparatory", subdomain: "oakwood", students: 238, admins: 2, status: "Trial" },
  { id: "kingsbridge", name: "Kingsbridge School", subdomain: "kingsbridge", students: 417, admins: 4, status: "Active" },
];
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function SuperAdminPage() {
  const [schools, setSchools] = useState(initialSchools);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const filtered = schools.filter((school) => `${school.name} ${school.subdomain}`.toLowerCase().includes(query.trim().toLowerCase()));

  function createSchool(event: FormEvent) {
    event.preventDefault();
    const slug = slugify(subdomain);
    if (!name.trim() || !slug) return;
    setSchools((current) => [...current, { id: slug, name: name.trim(), subdomain: slug, students: 0, admins: 1, status: "Trial" }]);
    setName(""); setSubdomain(""); setCreating(false);
  }

  return <SchoolShell title="Super Admin" platform><div className="mx-auto max-w-6xl rise">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><ShieldCheck className="size-5" /></div><h1 className="font-display text-3xl font-bold">Platform schools</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create and oversee isolated school workspaces from one platform account.</p></div><Button onClick={() => setCreating(true)}><Plus />Add school</Button></div>
    <section className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Schools" value={String(schools.length)} note="Tenant workspaces" /><Metric label="Active students" value={String(schools.reduce((total, school) => total + school.students, 0))} note="Across all schools" /><Metric label="School admins" value={String(schools.reduce((total, school) => total + school.admins, 0))} note="Tenant-level access" /></section>
    <section className="glass-panel mt-4 overflow-hidden rounded-lg"><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex h-9 max-w-sm flex-1 items-center gap-2 rounded-md border border-input bg-background/70 px-3"><Search className="size-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search schools or subdomains" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></div><p className="text-xs text-muted-foreground">Data will be isolated by school ID.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">School</th><th className="px-5 py-3 font-medium">Workspace</th><th className="px-5 py-3 font-medium">Students</th><th className="px-5 py-3 font-medium">Admins</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-border/70">{filtered.map((school) => <tr key={school.id} className="hover:bg-muted/30"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary"><Building2 className="size-4" /></div><span className="font-medium">{school.name}</span></div></td><td className="px-5 py-4 font-mono text-xs text-secondary-foreground">{school.subdomain}.yourdomain.com</td><td className="px-5 py-4">{school.students.toLocaleString()}</td><td className="px-5 py-4">{school.admins}</td><td className="px-5 py-4"><span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium", school.status === "Active" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700")}><CheckCircle2 className="size-3.5" />{school.status}</span></td></tr>)}</tbody></table></div></section>
  </div>{creating && <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"><form onSubmit={createSchool} className="glass-panel w-full max-w-md rounded-lg p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="font-display text-xl font-bold">Add a school</h2><p className="mt-1 text-sm text-muted-foreground">A separate tenant will be created for this school.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setCreating(false)} aria-label="Close"><X /></Button></div><label className="mt-5 block text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">School name</span><input required value={name} onChange={(event) => { setName(event.target.value); setSubdomain(slugify(event.target.value)); }} placeholder="Sunrise International School" className="h-10 w-full rounded-md border border-input bg-background/70 px-3 outline-none focus:ring-2 focus:ring-ring" /></label><label className="mt-4 block text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">Subdomain</span><div className="flex h-10 items-center rounded-md border border-input bg-background/70"><input required value={subdomain} onChange={(event) => setSubdomain(slugify(event.target.value))} placeholder="sunrise" className="min-w-0 flex-1 bg-transparent px-3 outline-none" /><span className="pr-3 text-xs text-muted-foreground">.yourdomain.com</span></div></label><p className="mt-3 text-xs text-muted-foreground">Tenant URL: {subdomain || "school"}.yourdomain.com</p><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit">Create school</Button></div></form></div>}</SchoolShell>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
