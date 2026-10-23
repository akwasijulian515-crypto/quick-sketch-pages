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
  phone: string | null;
  linked: boolean;
  active: boolean;
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
  const [guardianStudentId, setGuardianStudentId] = useState("");
  const [guardianId, setGuardianId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  const [invitationEmail, setInvitationEmail] = useState<{ sent: boolean; error?: string } | null>(null);
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
      setStudentId((current) => result.students.some((student) => student.id === current && !student.linked)
        ? current
        : result.students.find((student) => !student.linked)?.id || "");
      setGuardianStudentId((current) => result.students.some((student) => student.id === current)
        ? current
        : result.students[0]?.id || "");
      setGuardianId((current) => result.guardians.some((guardian) => guardian.id === current && guardian.active && !guardian.linked)
        ? current
        : result.guardians.find((guardian) => guardian.active && !guardian.linked)?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load portal accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addGuardian(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    setNotice("");
    setActivationUrl("");
    setInvitationEmail(null);
    try {
      const result = await portalAccountsApi<{ guardian: Pick<PortalGuardian, "id" | "email" | "linked"> }>("/api/school/guardians", {
        method: "POST",
        body: JSON.stringify({
          student_id: guardianStudentId,
          name: form.get("guardianName"),
          email: form.get("guardianEmail"),
          phone: form.get("guardianPhone"),
        }),
      });

      let portalLinkError = "";
      if (result.guardian.linked) {
        setNotice("Guardian added and linked to the student. Their existing parent portal access is active.");
      } else {
        try {
          const account = await portalAccountsApi<{ activation_url: string; invitation: { sent: boolean; error?: string } }>("/api/school/portal-accounts", {
            method: "POST",
            body: JSON.stringify({
              account_type: "parent",
              guardian_id: result.guardian.id,
              email: result.guardian.email,
            }),
          });
          setActivationUrl(account.activation_url);
          setInvitationEmail(account.invitation);
          setNotice(account.invitation.sent
            ? "Guardian added and linked to the student. An activation email was sent to the parent."
            : "Guardian added and linked to the student. The activation email could not be sent; share the link below.");
        } catch (linkError) {
          const message = linkError instanceof Error ? linkError.message : "Could not link parent portal access";
          portalLinkError = `Guardian was added and linked to the student, but portal access could not be linked: ${message}`;
        }
      }
      await load();
      if (portalLinkError) setError(portalLinkError);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not add guardian");
    } finally {
      setSaving(false);
    }
  }

  async function createPortalAccount(event: FormEvent<HTMLFormElement>, accountType: "student" | "parent") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    setNotice("");
    setActivationUrl("");
    setInvitationEmail(null);
    try {
      const result = await portalAccountsApi<{ activation_url: string; invitation: { sent: boolean; error?: string } }>("/api/school/portal-accounts", {
        method: "POST",
        body: JSON.stringify({
          account_type: accountType,
          student_id: accountType === "student" ? studentId : undefined,
          guardian_id: accountType === "parent" ? guardianId : undefined,
          email: form.get("email"),
        }),
      });
      setActivationUrl(result.activation_url);
      setInvitationEmail(result.invitation);
      setNotice(result.invitation.sent
        ? `${accountType === "student" ? "Student" : "Parent"} portal access is linked. An activation email was sent.`
        : `${accountType === "student" ? "Student" : "Parent"} portal access is linked. The activation email could not be sent; share the link below.`);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not link portal account");
    } finally {
      setSaving(false);
    }
  }

  async function updateGuardian(guardian: PortalGuardian, action: "archive" | "restore" | "delete") {
    const message = action === "delete"
      ? `Permanently delete ${guardian.name} from this school? Their guardian contact and parent-student links will be removed. Student records and the global login account will remain.`
      : action === "archive"
        ? `Archive ${guardian.name}? Their access to this school's parent portal will be revoked, but the contact and linked history will be retained.`
        : `Restore ${guardian.name}'s parent access for this school?`;
    if (!window.confirm(message)) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const deleting = action === "delete";
      await portalAccountsApi(`/api/school/guardians/${encodeURIComponent(guardian.id)}`, {
        method: deleting ? "DELETE" : "PATCH",
        ...(!deleting ? { body: JSON.stringify({ active: action === "restore" }) } : {}),
      });
      setNotice(deleting ? "Parent contact permanently deleted." : action === "archive" ? "Parent contact archived." : "Parent contact restored.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update parent contact");
    } finally {
      setSaving(false);
    }
  }

  const availableStudents = students.filter((student) => !student.linked);
  const availableGuardians = guardians.filter((guardian) => guardian.active && !guardian.linked);
  const selectedGuardian = guardians.find((guardian) => guardian.id === guardianId);

  return (
    <section id="portal-account-setup" className="glass-panel mt-4 rounded-lg p-5">
      <div>
        <h2 className="font-display text-xl font-bold">Parent and student portal access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a guardian to an existing student or link verified sign-in accounts to school records. Parent access uses the guardian&apos;s email.
        </p>
      </div>
      {error && <p role="alert" className="mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p role={invitationEmail?.sent === false ? "alert" : "status"} className={`mt-4 rounded-md border px-3 py-2 text-sm ${invitationEmail?.sent === false ? "border-amber-600/30 bg-amber-600/5 text-amber-900" : "border-emerald-600/20 bg-emerald-600/5 text-emerald-800"}`}>{notice}</p>}
      {activationUrl && <p className={`mt-2 break-all text-sm ${invitationEmail?.sent ? "text-secondary-foreground" : "text-amber-900"}`}>{invitationEmail?.sent ? "Activation link (email sent; share manually if needed): " : `Activation link (email failed${invitationEmail?.error ? `: ${invitationEmail.error}` : ""}): `}<a className="underline" href={activationUrl}>{activationUrl}</a></p>}
      {loading ? <p className="py-5 text-sm text-muted-foreground">Loading portal accounts...</p> : (
        <div className="mt-5 space-y-5">
          <form onSubmit={(event) => void addGuardian(event)} className="space-y-3 rounded-md border border-border p-4">
            <h3 className="font-semibold">Add guardian to an existing student</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-medium text-muted-foreground">Student
                <select required value={guardianStudentId} onChange={(event) => setGuardianStudentId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  <option value="">Choose a learner</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.admission_number}{student.class_name ? ` · ${student.class_name}` : ""}</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-medium text-muted-foreground">Guardian name
                <Input required name="guardianName" minLength={2} maxLength={160} />
              </label>
              <label className="block space-y-1 text-xs font-medium text-muted-foreground">Guardian email
                <Input required name="guardianEmail" type="email" maxLength={254} />
              </label>
              <label className="block space-y-1 text-xs font-medium text-muted-foreground">Guardian phone
                <Input required name="guardianPhone" type="tel" maxLength={40} />
              </label>
            </div>
            <Button type="submit" disabled={saving || !guardianStudentId || students.length === 0}>{saving ? "Adding guardian..." : "Add guardian and link student"}</Button>
            {students.length === 0 && <p className="text-xs text-muted-foreground">Add a student before adding a guardian.</p>}
          </form>
          <div className="grid gap-5 lg:grid-cols-2">
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
              {selectedGuardian && (
                <dl className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">Name</dt><dd>{selectedGuardian.name}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Email</dt><dd>{selectedGuardian.email || "Not provided"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{selectedGuardian.phone || "Not provided"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Linked wards</dt><dd>{selectedGuardian.students || "No linked students"}</dd></div>
                </dl>
              )}
              <label className="block space-y-1 text-xs font-medium text-muted-foreground">Guardian email (must match the stored email)
                <Input required name="email" type="email" maxLength={254} defaultValue={guardians.find((guardian) => guardian.id === guardianId)?.email ?? ""} key={guardianId} />
              </label>
              <Button type="submit" disabled={saving || !guardianId || availableGuardians.length === 0}>{saving ? "Linking..." : "Link parent account"}</Button>
              {availableGuardians.length === 0 && <p className="text-xs text-muted-foreground">Every guardian record is already linked.</p>}
            </form>
          </div>
        </div>
      )}
      {!loading && guardians.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <h3 className="mb-2 text-sm font-semibold">Parent contacts</h3>
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>{["Parent", "Contact", "Linked wards", "Status", "Actions"].map((label) => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {guardians.map((guardian) => (
                <tr key={guardian.id}>
                  <td className="px-3 py-3">{guardian.name}</td>
                  <td className="px-3 py-3">{guardian.email || "No email"}<p className="text-xs text-muted-foreground">{guardian.phone || "No phone"}</p></td>
                  <td className="px-3 py-3">{guardian.students || "None"}</td>
                  <td className="px-3 py-3">{guardian.active ? (guardian.linked ? "Active · linked" : "Active") : "Archived"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void updateGuardian(guardian, guardian.active ? "archive" : "restore")}>
                        {guardian.active ? "Archive" : "Restore"}
                      </Button>
                      <Button type="button" variant="destructive" size="sm" disabled={saving} onClick={() => void updateGuardian(guardian, "delete")}>
                        Permanently delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
