import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Building2, Check, CheckCircle2, Clock3, Copy, Eye, Mail, Plus, Search, ShieldCheck, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { SchoolShell } from "@/components/school-shell";
import { usePlatformSession } from "@/hooks/use-platform-session";
import { cn } from "@/lib/utils";
import { getNeonAccessToken } from "../auth/client";

export const Route = createFileRoute("/admin")({ head: () => ({ meta: [{ title: "Super Admin — School Platform" }, { name: "description", content: "Manage school tenants, onboarding, and platform controls." }] }), component: SuperAdminPage });

type SchoolStatus = "Active" | "Trial" | "Suspended";
type School = { id: string; name: string; subdomain: string; students: number | null; admins: number | null; status: SchoolStatus; color: string };
type Application = { id: string; schoolName: string; subdomain: string; applicant: string; email: string; submitted: string; color: string; status: "Pending" | "Approved" };
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function platformAuthHeaders() {
  try {
    return { authorization: `Bearer ${await getNeonAccessToken()}` };
  } catch {
    return {};
  }
}

function SuperAdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"schools" | "onboarding" | "platform">("schools");
  const [schools, setSchools] = useState<School[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [color, setColor] = useState("#1f5c3b");
  const filtered = schools.filter((school) => `${school.name} ${school.subdomain}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pending = applications.filter((application) => application.status === "Pending");
  const studentsAvailable = schools.every((school) => school.students !== null);
  async function createSchool(event: FormEvent) {
    event.preventDefault();
    const slug = slugify(subdomain);
    if (!name.trim() || !slug) return;
    try {
      const response = await fetch("/api/platform/schools", {
        method: "POST",
        headers: { "content-type": "application/json", ...await platformAuthHeaders() },
        body: JSON.stringify({ name: name.trim(), subdomain: slug, primaryColor: color }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; school?: { id: string; name: string; subdomain: string; status: string; primaryColor: string } } | null;
      if (!response.ok || !payload?.school) throw new Error(payload?.error ?? "Could not create school");
      setSchools((current) => [...current, { id: payload.school!.id, name: payload.school!.name, subdomain: payload.school!.subdomain, students: 0, admins: 0, status: "Trial", color: payload.school!.primaryColor }]);
      setName("");
      setSubdomain("");
      setCreating(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not create school");
    }
  }
  const approve = useCallback((application: Application) => {
    setApplications((current) => {
      const existing = current.some((item) => item.id === application.id);
      return existing
        ? current.map((item) => item.id === application.id ? application : item)
        : [...current, application];
    });
    if (application.status === "Approved") {
      setSchools((current) => current.some((school) => school.subdomain === application.subdomain)
        ? current
        : [...current, { id: application.id, name: application.schoolName, subdomain: application.subdomain, students: 0, admins: 1, status: "Trial", color: application.color }]);
    }
  }, []);
  function updateStatus(id: string, status: SchoolStatus, loadedSchool?: School) {
    setSchools((current) => {
      const existing = current.some((school) => school.id === id);
      if (existing) return current.map((school) => school.id === id ? { ...school, status } : school);
      return loadedSchool ? [...current, { ...loadedSchool, status }] : current;
    });
  }
  return <SchoolShell title="Super Admin" platform><div className="mx-auto max-w-6xl rise"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border"><ShieldCheck className="size-5" /></div><h1 className="font-display text-3xl font-bold">School Platform</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Control school tenants, approve onboarding, and oversee platform health without entering a school&apos;s operational workspace.</p></div><Button onClick={() => setCreating(true)}><Plus />Create school</Button></div><section className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Active schools" value={String(schools.filter((school) => school.status === "Active").length)} note={`${schools.length} total tenant workspaces`} /><Metric label="Pending onboarding" value={String(pending.length)} note="Requires Super Admin approval" /><Metric label="Platform students" value={schools.reduce((total, school) => total + school.students, 0).toLocaleString()} note="Across active and trial schools" /></section><section className="glass-panel mt-4 overflow-hidden rounded-lg"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="flex rounded-md border border-input bg-background/70 p-1"><Tab active={tab === "schools"} set={() => setTab("schools")} label="School directory" /><Tab active={tab === "onboarding"} set={() => setTab("onboarding")} label={`Onboarding (${pending.length})`} /><Tab active={tab === "platform"} set={() => setTab("platform")} label="Platform health" /></div>{tab === "schools" && <div className="flex h-9 max-w-sm flex-1 items-center gap-2 rounded-md border border-input bg-background/70 px-3"><Search className="size-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search schools or subdomains" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></div>}</div>{tab === "schools" && <Directory schools={filtered} setStatus={updateStatus} />}{tab === "onboarding" && <Onboarding applications={applications} approve={approve} openSignup={() => navigate({ to: "/signup" })} />}{tab === "platform" && <Health schools={schools} />}</section></div>{creating && <CreateDialog name={name} subdomain={subdomain} color={color} setName={(value) => { setName(value); setSubdomain(slugify(value)); }} setSubdomain={(value) => setSubdomain(slugify(value))} setColor={setColor} close={() => setCreating(false)} submit={createSchool} />}</SchoolShell>;
}

function Directory({ schools, setStatus }: { schools: School[]; setStatus: (id: string, status: SchoolStatus, loadedSchool?: School) => void }) {
  const navigate = useNavigate();
  const [directorySchools, setDirectorySchools] = useState(schools);
  const [platformToken, setPlatformToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const session = usePlatformSession();

  const loadSchools = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/platform/schools", { headers: await platformAuthHeaders() });
      const payload = await response.json().catch(() => null) as { error?: string; schools?: Array<{ id: string; name: string; subdomain: string; status: string; primaryColor: string; students: number; admins: number }> } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not load schools");
      const savedSchools = (payload?.schools ?? []).map((school) => ({
        ...school,
        status: school.status === "active" ? "Active" : school.status === "suspended" ? "Suspended" : "Trial",
        color: school.primaryColor,
      }));
      setDirectorySchools(savedSchools);
      savedSchools.forEach((school) => setStatus(school.id, school.status, school));
      setLoaded(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load schools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.authenticated) void loadSchools();
  }, [session.authenticated, loadSchools]);

  async function signInWithPlatformToken(event: FormEvent) {
    event.preventDefault();
    if (await session.signIn(platformToken)) setPlatformToken("");
  }

  async function updateDirectoryStatus(id: string, status: SchoolStatus) {
    try {
      const response = await fetch(`/api/platform/schools/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...await platformAuthHeaders() },
        body: JSON.stringify({ status: status.toLowerCase() }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not update school status");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update school status");
      return;
    }
    setDirectorySchools((current) => current.map((school) => school.id === id ? { ...school, status } : school));
    setStatus(id, status);
  }

  return <div>
    {session.checkingSession ? <p className="border-b border-border px-5 py-4 text-sm text-muted-foreground">Checking Super Admin session...</p> : session.authenticated ? (
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">{loaded ? `${directorySchools.length} saved schools loaded` : "Loading saved schools..."}</p>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void loadSchools()} disabled={loading}>{loading ? "Loading..." : "Refresh schools"}</Button><Button size="sm" variant="ghost" onClick={() => void session.signOut()}>Sign out</Button></div>
      </div>
    ) : (
      <div className="border-b border-border px-5 py-4">
        <p className="mb-3 text-sm text-muted-foreground">Sign in with your Super Admin account. The platform token remains available for initial setup.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Button onClick={() => navigate({ to: "/login" })}>Sign in with account</Button>
          <form onSubmit={signInWithPlatformToken} className="flex min-w-0 flex-1 gap-2">
            <input required type="password" autoComplete="current-password" aria-label="Platform admin token" placeholder="Platform admin token" value={platformToken} onChange={(event) => setPlatformToken(event.target.value)} className="input min-w-0 flex-1" />
            <Button type="submit" variant="outline">Use token</Button>
          </form>
        </div>
      </div>
    )}
    {(error || session.sessionError) && <p role="alert" className="border-b border-destructive/20 bg-destructive/5 px-5 py-3 text-sm text-destructive">{error || session.sessionError}</p>}
    {session.authenticated && <DirectoryTable schools={directorySchools} setStatus={updateDirectoryStatus} />}
    {!session.authenticated && !session.checkingSession && <p className="px-5 py-10 text-center text-sm text-muted-foreground">Sign in to load schools saved in Neon.</p>}
  </div>;
}

function DirectoryTable({ schools, setStatus }: { schools: School[]; setStatus: (id: string, status: SchoolStatus) => void }) { return <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{["School", "Workspace", "Students", "Admins", "Status", "Control"].map((column) => <th key={column} className="px-5 py-3 font-medium">{column}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{schools.map((school) => <tr key={school.id} className="hover:bg-muted/30"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-md text-white" style={{ backgroundColor: school.color }}><Building2 className="size-4" /></div><span className="font-medium">{school.name}</span></div></td><td className="px-5 py-4 font-mono text-xs text-secondary-foreground">{school.subdomain}.yourdomain.com</td><td className="px-5 py-4">{school.students.toLocaleString()}</td><td className="px-5 py-4">{school.admins}</td><td className="px-5 py-4"><Status status={school.status} /></td><td className="px-5 py-4"><select value={school.status} onChange={(event) => setStatus(school.id, event.target.value as SchoolStatus)} className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none"><option>Active</option><option>Trial</option><option>Suspended</option></select></td></tr>)}</tbody></table>{schools.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No schools loaded. Enter the platform token above to load saved schools.</p>}</div>; }
function Onboarding({ applications, approve, openSignup }: { applications: Application[]; approve: (application: Application) => void; openSignup: () => void }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [platformToken, setPlatformToken] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [approvedLoginUrl, setApprovedLoginUrl] = useState("");
  const [copiedLoginUrl, setCopiedLoginUrl] = useState(false);
  const session = usePlatformSession();

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/platform/applications", { headers: await platformAuthHeaders() });
      const payload = await response.json().catch(() => null) as { error?: string; applications?: Array<{ id: string; schoolName: string; subdomain: string; applicant: string; email: string; submitted: string; color: string }> } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not load applications");
      for (const item of payload?.applications ?? []) {
        approve({ ...item, submitted: new Date(item.submitted).toLocaleString(), status: "Pending" });
      }
      setLoaded(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load applications");
    } finally {
      setLoading(false);
    }
  }, [approve]);

  useEffect(() => {
    if (session.authenticated) void loadApplications();
  }, [session.authenticated, loadApplications]);

  async function signInWithPlatformToken(event: FormEvent) {
    event.preventDefault();
    if (await session.signIn(platformToken)) setPlatformToken("");
  }

  async function approveApplication(application: Application) {
    setApprovingId(application.id);
    setError("");
    try {
      const response = await fetch(`/api/platform/applications/${encodeURIComponent(application.id)}/approve`, {
        method: "POST",
        headers: await platformAuthHeaders(),
      });
      const payload = await response.json().catch(() => null) as { error?: string; school?: { tenantLoginUrl?: string | null } } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not approve this application");
      setApprovedLoginUrl(payload?.school?.tenantLoginUrl ?? "");
      setCopiedLoginUrl(false);
      approve({ ...application, status: "Approved" });
      await loadApplications();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Could not approve this application");
    } finally {
      setApprovingId(null);
    }
  }

  async function copyApprovedLoginUrl() {
    try {
      await navigator.clipboard.writeText(approvedLoginUrl);
      setCopiedLoginUrl(true);
    } catch {
      setError("Could not copy the login link; select and copy it manually.");
    }
  }

  return <div>
    <div className="flex items-center justify-between border-b border-border px-5 py-4">
      <div><h2 className="font-display text-lg font-bold">School applications</h2><p className="mt-1 text-xs text-muted-foreground">Approval creates a trial tenant and first School Admin workspace.</p></div>
      <Button size="sm" variant="outline" onClick={openSignup}><Mail />Open onboarding</Button>
    </div>
    {session.checkingSession ? <p className="border-b border-border px-5 py-4 text-sm text-muted-foreground">Checking Super Admin session...</p> : session.authenticated ? (
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">{loaded ? `${applications.filter((application) => application.status === "Pending").length} pending applications` : "Loading applications..."}</p>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void loadApplications()} disabled={loading}>{loading ? "Loading..." : "Refresh queue"}</Button><Button size="sm" variant="ghost" onClick={() => void session.signOut()}>Sign out</Button></div>
      </div>
    ) : (
      <div className="border-b border-border px-5 py-4">
        <p className="mb-3 text-sm text-muted-foreground">Sign in with your Super Admin account. The platform token remains available for initial setup.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Button onClick={() => navigate({ to: "/login" })}>Sign in with account</Button>
          <form onSubmit={signInWithPlatformToken} className="flex min-w-0 flex-1 gap-2">
            <input required type="password" autoComplete="current-password" aria-label="Platform admin token" placeholder="Platform admin token" value={platformToken} onChange={(event) => setPlatformToken(event.target.value)} className="input min-w-0 flex-1" />
            <Button type="submit" variant="outline">Use token</Button>
          </form>
        </div>
      </div>
    )}
    {(error || session.sessionError) && <p role="alert" className="border-b border-destructive/20 bg-destructive/5 px-5 py-3 text-sm text-destructive">{error || session.sessionError}</p>}
    {approvedLoginUrl && <div role="status" className="flex flex-col gap-3 border-b border-emerald-500/20 bg-emerald-500/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-emerald-800">Tenant approved. Share this login link with the school admin:</p><a href={approvedLoginUrl} className="mt-1 block break-all text-sm text-secondary-foreground underline">{approvedLoginUrl}</a></div><Button size="sm" variant="outline" onClick={() => void copyApprovedLoginUrl()}>{copiedLoginUrl ? <Check /> : <Copy />}{copiedLoginUrl ? "Copied" : "Copy link"}</Button></div>}
    <div className="divide-y divide-border/70">
      {session.authenticated && applications.map((application) => <article key={application.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-md text-white" style={{ backgroundColor: application.color }}><Building2 className="size-4" /></div><div><p className="font-medium">{application.schoolName}</p><p className="mt-0.5 text-xs text-muted-foreground">{application.subdomain}.yourdomain.com · {application.submitted}</p><p className="mt-1 text-xs text-secondary-foreground">{application.applicant} · {application.email}</p></div></div>{application.status === "Pending" ? <Button size="sm" disabled={approvingId === application.id} onClick={() => void approveApplication(application)}><CheckCircle2 />{approvingId === application.id ? "Approving..." : "Approve tenant"}</Button> : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-4" />Tenant created</span>}</article>)}
      {session.authenticated && loaded && applications.every((application) => application.status !== "Pending") && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No pending applications.</p>}
    </div>
  </div>;
}
function Health({ schools }: { schools: School[] }) { return <div className="p-5"><div className="grid gap-4 md:grid-cols-3"><HealthCard icon={Activity} title="Platform API" value="Operational" note="Tenant and platform endpoint checks ready" tone="good" /><HealthCard icon={Clock3} title="Audit coverage" value="Enabled" note="Schools, payments, and reconciliation events" tone="good" /><HealthCard icon={Eye} title="Suspended tenants" value={String(schools.filter((school) => school.status === "Suspended").length)} note="Blocked from normal school access" tone="warning" /></div><div className="mt-5 rounded-lg border border-border bg-background/60 p-4"><h2 className="font-display text-lg font-bold">Platform safeguards</h2><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li>• School tenants are separated by school ID and database policies.</li><li>• Super Admin workspaces remain separate from normal school administration.</li><li>• School suspension becomes enforceable at sign-in once server-side authentication is connected.</li></ul></div></div>; }
function CreateDialog({ name, subdomain, color, setName, setSubdomain, setColor, close, submit }: { name: string; subdomain: string; color: string; setName: (value: string) => void; setSubdomain: (value: string) => void; setColor: (value: string) => void; close: () => void; submit: (event: FormEvent) => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"><form onSubmit={submit} className="glass-panel w-full max-w-md rounded-lg p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">Create school tenant</h2><p className="mt-1 text-sm text-muted-foreground">Creates a trial workspace and first School Admin seat.</p></div><Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close"><X /></Button></div><Field label="School name"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Sunrise International School" className="input" /></Field><Field label="Subdomain"><div className="flex h-10 items-center rounded-md border border-input bg-background/70"><input required value={subdomain} onChange={(event) => setSubdomain(event.target.value)} placeholder="sunrise" className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" /><span className="pr-3 text-xs text-muted-foreground">.yourdomain.com</span></div></Field><Field label="Primary colour"><div className="flex h-10 items-center gap-3 rounded-md border border-input bg-background/70 px-3"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" /><span className="font-mono text-sm uppercase">{color}</span></div></Field><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit"><UserPlus />Create tenant</Button></div></form></div>; }
function Tab({ active, set, label }: { active: boolean; set: () => void; label: string }) { return <button type="button" onClick={set} className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</button>; }
function Status({ status }: { status: SchoolStatus }) { return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium", status === "Active" ? "bg-emerald-500/10 text-emerald-700" : status === "Suspended" ? "bg-rose-500/10 text-rose-700" : "bg-amber-500/10 text-amber-700")}><CheckCircle2 className="size-3.5" />{status}</span>; }
function HealthCard({ icon: Icon, title, value, note, tone }: { icon: typeof Activity; title: string; value: string; note: string; tone: "good" | "warning" }) { return <article className="rounded-lg border border-border bg-background/60 p-4"><Icon className={cn("size-5", tone === "good" ? "text-emerald-700" : "text-amber-600")} /><p className="mt-3 text-xs font-medium text-muted-foreground">{title}</p><p className="mt-1 font-display text-xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="glass-panel rounded-lg p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-secondary-foreground">{note}</p></article>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-4 block text-sm"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }
