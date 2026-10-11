import { useCallback, useEffect, useState, type FormEvent } from "react";

import { fetchWithNeonAuth } from "../auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PortalStudent = {
  id: string;
  name: string;
  admission_number: string;
  class_name: string | null;
  linked: boolean;
};
type PortalGuardian = {
  id: string;
  name: string;
  email: string | null;
  linked: boolean;
  students: string;
};

async function portalAccountsApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetchWithNeonAuth(`${url.pathname}${url.search}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Could not load portal accounts";
    throw new Error(message);
  }
  return payload as T;
}

export function PortalAccountSetup() {
  const [students, setStudents] = useState<PortalStudent[]>([]);
  const [guardians, setGuardians] = useState<PortalGuardian[]>([]);
  const [studentId, setStudentId] = useState("");
  const [guardianId, setGuardianId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await portalAccountsApi<{ students: PortalStudent[]; guardians: PortalGuardian[] }>(
        "/api/school/portal-accounts",
      );
      setStudents(result.students);
      setGuardians(result.guardians);
      setStudentId((current) => current || result.students.find((student) => !student.linked)?.id || "");
      setGuardianId((current) => current || result.guardians.find((guardian) => !guardian.linked)?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load portal accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createPortalAccount(event: FormEvent<HTMLFormElement>, accountType: "student" | "parent") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    setNotice("");
    setActivationUrl("");
    try {
      const result = await portalAccountsApi<{ activation_url: string }>("/api/school/portal-accounts", {
        method: "POST",
        body: JSON.stringify({
          account_type: accountType,
          student_id: accountType === "student" ? studentId : undefined,
          guardian_id: accountType === "parent" ? guardianId : undefined,
          email: form.get("email"),
        }),
      });
      setActivationUrl(result.activation_url);
      setNotice(`${accountType === "student" ? "Student" : "Parent"} portal access is linked. Share the activation link with the account holder.`);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not link portal account");
    } finally {
      setSaving(false);
    }
  }

  const availableStudents = students.filter((student) => !student.linked);
  const availableGuardians = guardians.filter((guardian) => !guardian.linked);

  return (
    <section id="portal-account-setup" className="glass-panel mt-4 rounded-lg p-5">
      <div>
        <h2 className="font-display text-xl font-bold">Parent and student portal access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Link verified sign-in accounts to school records. Parent access uses the guardian&apos;s stored email; student access is linked to the selected learner.
        </p>
      </div>
      {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {activationUrl && <p className="mt-2 break-all text-sm text-secondary-foreground">Activation link: <a className="underline" href={activationUrl}>{activationUrl}</a></p>}
      {loading ? <p className="py-5 text-sm text-muted-foreground">Loading portal accounts...</p> : (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <form onSubmit={(event) => void createPortalAccount(event, "student")} className="space-y-3 rounded-md border border-border p-4">
            <h3 className="font-semibold">Link a student account</h3>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">Student
              <select required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="">Choose a learner</option>
                {availableStudents.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.admission_number}{student.class_name ? ` · ${student.class_name}` : ""}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">Student sign-in email
              <Input required name="email" type="email" maxLength={254} />
            </label>
            <Button type="submit" disabled={saving || !studentId || availableStudents.length === 0}>{saving ? "Linking..." : "Link student account"}</Button>
            {availableStudents.length === 0 && <p className="text-xs text-muted-foreground">Every active student is already linked.</p>}
          </form>
          <form onSubmit={(event) => void createPortalAccount(event, "parent")} className="space-y-3 rounded-md border border-border p-4">
            <h3 className="font-semibold">Link a parent account</h3>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">Guardian
              <select required value={guardianId} onChange={(event) => setGuardianId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="">Choose a guardian</option>
                {availableGuardians.map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.name}{guardian.students ? ` · ${guardian.students}` : ""}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">Guardian email (must match the stored email)
              <Input required name="email" type="email" maxLength={254} defaultValue={guardians.find((guardian) => guardian.id === guardianId)?.email ?? ""} key={guardianId} />
            </label>
            <Button type="submit" disabled={saving || !guardianId || availableGuardians.length === 0}>{saving ? "Linking..." : "Link parent account"}</Button>
            {availableGuardians.length === 0 && <p className="text-xs text-muted-foreground">Every guardian record is already linked.</p>}
          </form>
        </div>
      )}
    </section>
  );
}
