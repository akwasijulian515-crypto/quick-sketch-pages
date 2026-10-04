import { useCallback, useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";

type Promotion = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  from_class_name: string;
  term_name: string;
  decision: "promote" | "repeat" | "transfer" | "graduate";
  target_class_name: string | null;
  teacher_remark: string | null;
  status: "pending" | "approved" | "rejected";
};

async function schoolApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getNeonAccessToken();
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant && !url.searchParams.has("tenant")) url.searchParams.set("tenant", tenant);
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

export function SchoolPromotionReview() {
  const [decisions, setDecisions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await schoolApi<{ decisions: Promotion[] }>("/api/school/promotions");
      setDecisions(result.decisions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load promotion decisions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(id: string, action: "approve" | "reject") {
    setSavingId(id);
    setError("");
    setNotice("");
    try {
      await schoolApi("/api/school/promotions", {
        method: "PATCH",
        body: JSON.stringify({ id, action }),
      });
      setNotice(action === "approve" ? "Promotion approved; enrollment was updated." : "Promotion recommendation rejected; enrollment was not changed.");
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review promotion");
    } finally {
      setSavingId("");
    }
  }

  const pending = decisions.filter((item) => item.status === "pending");
  return <section className="glass-panel mt-4 rounded-lg p-5">
    <div><h2 className="font-display text-xl font-bold">Promotion approvals</h2><p className="mt-1 text-sm text-muted-foreground">Approve or reject teacher recommendations. Enrollment records change only on approval.</p></div>
    {error && <p role="alert" className="mt-3 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-md border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p className="py-5 text-sm text-muted-foreground">Loading promotion recommendations...</p> : pending.length === 0 ? (
      <p className="mt-4 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No promotion recommendations are awaiting review.</p>
    ) : <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground"><tr>{["Learner", "Current class", "Decision", "Next-year class", "Teacher remark", "Review"].map((title) => <th key={title} className="px-3 py-2 font-medium">{title}</th>)}</tr></thead>
        <tbody className="divide-y divide-border/70">{pending.map((item) => <tr key={item.id}>
          <td className="px-3 py-3"><p className="font-medium">{item.first_name} {item.last_name}</p><p className="font-mono text-[11px] text-muted-foreground">{item.admission_number}</p></td>
          <td className="px-3 py-3">{item.from_class_name}<p className="text-xs text-muted-foreground">{item.term_name}</p></td>
          <td className="px-3 py-3 capitalize">{item.decision}</td>
          <td className="px-3 py-3">{item.target_class_name ?? "—"}</td>
          <td className="max-w-52 px-3 py-3 text-xs text-muted-foreground">{item.teacher_remark || "—"}</td>
          <td className="px-3 py-3"><div className="flex gap-2"><Button size="sm" disabled={savingId === item.id} onClick={() => void review(item.id, "approve")}>{savingId === item.id ? "Saving..." : "Approve"}</Button><Button size="sm" variant="outline" disabled={savingId === item.id} onClick={() => void review(item.id, "reject")}>Reject</Button></div></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
