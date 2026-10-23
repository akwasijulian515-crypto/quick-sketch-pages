import { useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";

type LearnerProfile = {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  conduct: string;
  attitude: string;
  interest: string;
  teacher_remark: string;
  headteacher_remark: string;
  promotion_status: string;
};

async function schoolApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${url.pathname}${url.search}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "The school request failed";
    throw new Error(message);
  }
  return payload as T;
}

export function LearnerProfileEntry({ classId, termId, active }: { classId: string; termId: string; active: boolean }) {
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!classId || !termId) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    void schoolApi<{ reports: Array<{
      student_id: string;
      first_name: string;
      last_name: string;
      admission_number: string;
      conduct: string | null;
      attitude: string | null;
      interest: string | null;
      teacher_remark: string | null;
      headteacher_remark: string | null;
      promotion_status: string | null;
    }> }>(`/api/school/terminal-reports?class_id=${encodeURIComponent(classId)}&term_id=${encodeURIComponent(termId)}`)
      .then(({ reports }) => {
        if (cancelled) return;
        setProfiles(reports.map((report) => ({
          ...report,
          conduct: report.conduct ?? "",
          attitude: report.attitude ?? "",
          interest: report.interest ?? "",
          teacher_remark: report.teacher_remark ?? "",
          headteacher_remark: report.headteacher_remark ?? "",
          promotion_status: report.promotion_status ?? "",
        })));
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load learner profiles");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [classId, termId]);

  function updateProfile(studentId: string, field: "conduct" | "attitude" | "interest", value: string) {
    setProfiles((current) => current.map((profile) => profile.student_id === studentId ? { ...profile, [field]: value } : profile));
    setNotice("");
  }

  async function saveProfiles() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await schoolApi<{ saved_count: number }>("/api/school/terminal-reports", {
        method: "POST",
        body: JSON.stringify({
          class_id: classId,
          term_id: termId,
          publish: false,
          profiles: profiles.map(({ student_id, conduct, attitude, interest, teacher_remark, headteacher_remark, promotion_status }) => ({
            student_id, conduct, attitude, interest, teacher_remark, headteacher_remark, promotion_status,
          })),
        }),
      });
      setNotice(`Learner profiles saved for ${result.saved_count} student${result.saved_count === 1 ? "" : "s"}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save learner profiles");
    } finally {
      setSaving(false);
    }
  }

  return <section hidden={!active} className="glass-panel mt-4 overflow-hidden rounded-lg">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div>
        <h2 className="font-display text-lg font-bold">Conduct, Attitude &amp; Interest</h2>
        <p className="text-xs text-muted-foreground">Enter learner profile details for the selected class and term. Save drafts before changing the selection.</p>
      </div>
      <Button size="sm" variant="outline" disabled={saving || loading || !classId || !termId || profiles.length === 0} onClick={() => void saveProfiles()}>
        {saving ? "Saving..." : "Save profile drafts"}
      </Button>
    </div>
    {error && <p role="alert" className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mx-5 mt-4 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading learner profiles...</p>
      : profiles.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{classId && termId ? "No active students are enrolled in this class." : "Select a class, subject and term to enter learner profiles."}</p>
        : <div className="divide-y divide-border/70">
          {profiles.map((profile) => <article key={profile.student_id} className="px-5 py-4">
            <div className="mb-3">
              <h3 className="font-medium">{profile.first_name} {profile.last_name}</h3>
              <p className="font-mono text-xs text-muted-foreground">{profile.admission_number}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["conduct", "attitude", "interest"] as const).map((field) => <label key={field} className="space-y-1 text-xs font-medium capitalize text-muted-foreground">
                {field}
                <input value={profile[field]} maxLength={80} disabled={saving} onChange={(event) => updateProfile(profile.student_id, field, event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-60" />
              </label>)}
            </div>
          </article>)}
        </div>}
  </section>;
}
