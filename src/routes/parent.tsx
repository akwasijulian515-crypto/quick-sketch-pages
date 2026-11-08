import { createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  CreditCard,
  Download,
  GraduationCap,
  ReceiptText,
  ScrollText,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchWithNeonAuth } from "../auth/client";
import { SchoolShell } from "@/components/school-shell";
import { useTenantBranding } from "@/components/tenant-branding-provider";

export const Route = createFileRoute("/parent")({
  head: () => ({
    meta: [
      { title: "Parent Portal — Klasora" },
      { name: "description", content: "Follow your children’s learning, attendance, and fees." },
    ],
  }),
  component: ParentPortal,
});

type Child = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_name: string | null;
  term_name: string | null;
  academic_year_name: string | null;
  attendance_present: number;
  attendance_total: number;
  balance_due: number | string;
  currency: string;
  mark_count: number;
  term_average: number | string | null;
  published_reports: PublishedReport[];
};
type PublishedReport = {
  id: string;
  term_name: string;
  academic_year_name: string;
  published_at: string;
  conduct: string | null;
  attitude: string | null;
  interest: string | null;
  attendance_present: number | null;
  attendance_total: number | null;
  teacher_remark: string | null;
  headteacher_remark: string | null;
  items: {
    subject_name: string;
    total_score: number | string | null;
    performance_level: string | null;
    remark: string | null;
  }[];
};
type Payment = {
  id: string;
  student_name: string;
  receipt_number: string | null;
  amount: number | string;
  currency: string;
  category: string;
  paid_at: string;
  status: string;
};

async function portalApi<T>(path: string): Promise<T> {
  const url = new URL(path, window.location.origin);
  const tenant =
    new URLSearchParams(window.location.search).get("tenant") ??
    sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const response = await fetchWithNeonAuth(`${url.pathname}${url.search}`);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "Could not load family records";
    throw new Error(message);
  }
  return payload as T;
}

function ParentPortal() {
  const { schoolName, primaryColor, crestUrl } = useTenantBranding();
  const locationHash = useRouterState({ select: (state) => state.location.hash });
  const [children, setChildren] = useState<Child[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void portalApi<{ children: Child[]; recent_payments: Payment[] }>("/api/school/portal-data")
      .then((result) => {
        if (cancelled) return;
        setChildren(result.children);
        setPayments(result.recent_payments);
      })
      .catch((loadError: unknown) => {
        if (!cancelled)
          setError(
            loadError instanceof Error ? loadError.message : "Could not load family records",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (locationHash.replace(/^#/, "") !== "published-results" || loading) return;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById("published-results")?.scrollIntoView({ behavior: "smooth" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [locationHash, loading]);

  const outstandingBalance = useMemo(
    () => children.reduce((sum, child) => sum + Number(child.balance_due), 0),
    [children],
  );
  const currency = children[0]?.currency ?? "GHS";
  const publishedReports = children.flatMap((child) =>
    (child.published_reports ?? []).map((report) => ({ child, report })),
  );

  async function downloadReport(child: Child, report: PublishedReport) {
    setDownloadingReportId(report.id);
    setDownloadError("");
    try {
      const { downloadTerminalReports } = await import("@/lib/terminal-report-pdf");
      await downloadTerminalReports([
        {
          schoolName,
          primaryColor,
          crestUrl,
          student: `${child.first_name} ${child.last_name}`,
          admission: child.admission_number,
          className: child.class_name ?? "Unassigned",
          term: `${report.academic_year_name} · ${report.term_name}`,
          attendance: `${report.attendance_present ?? 0} / ${report.attendance_total ?? 0} days`,
          conduct: report.conduct ?? "",
          attitude: report.attitude ?? "",
          interest: report.interest ?? "",
          teacherRemark: [
            report.teacher_remark ? `Teacher: ${report.teacher_remark}` : "",
            report.headteacher_remark ? `Headteacher: ${report.headteacher_remark}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          results: report.items.map((item) => ({
            subject: item.subject_name,
            score: Number(item.total_score ?? 0),
            teacher: "",
            remark: item.remark ?? item.performance_level ?? "",
          })),
        },
      ]);
    } catch (cause) {
      setDownloadError(
        cause instanceof Error ? cause.message : "Could not download this published report",
      );
    } finally {
      setDownloadingReportId(null);
    }
  }

  return (
    <SchoolShell title="My children" parentPortal>
      <div className="mx-auto max-w-6xl rise">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border">
              <GraduationCap className="size-5" />
            </div>
            <h1 className="font-display text-3xl font-bold">Your family</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              View linked learners&apos; school records, attendance, results, and payment history.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            <CreditCard className="size-4" /> Contact the school to make or arrange a payment.
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-md border border-destructive/30 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <section className="mt-7 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Linked children"
            value={loading ? "—" : String(children.length)}
            note={loading ? "Loading" : "From your linked guardian account"}
          />
          <Metric
            label="Outstanding fees"
            value={loading ? "—" : `${currency} ${outstandingBalance.toFixed(2)}`}
            note="Across linked children"
          />
          <Metric
            label="Recent payments"
            value={loading ? "—" : String(payments.length)}
            note="Saved school payment records"
          />
        </section>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Loading children&apos;s records...
          </p>
        ) : children.length === 0 ? (
          <section className="glass-panel mt-4 rounded-lg px-5 py-12 text-center">
            <h2 className="font-display text-lg font-bold">No learner records are linked yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask the school administrator to link your verified email to the guardian record.
            </p>
          </section>
        ) : (
          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            {children.map((child) => {
              const attendanceRate = Number(child.attendance_total)
                ? Math.round(
                    (Number(child.attendance_present) / Number(child.attendance_total)) * 100,
                  )
                : null;
              return (
                <article key={child.id} className="glass-panel rounded-lg p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-bold">
                        {child.first_name} {child.last_name}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {child.admission_number} · {child.class_name ?? "No active class"}
                        {child.term_name ? ` · ${child.term_name}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700">
                      {child.currency} {Number(child.balance_due).toFixed(2)} due
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <SmallStat
                      icon={UserRoundCheck}
                      label="Attendance this term"
                      value={
                        attendanceRate === null
                          ? "No entries"
                          : `${attendanceRate}% (${child.attendance_present}/${child.attendance_total})`
                      }
                    />
                    <SmallStat
                      icon={GraduationCap}
                      label="Term average"
                      value={
                        child.term_average === null
                          ? "No grades"
                          : `${Number(child.term_average).toFixed(1)}%`
                      }
                    />
                  </div>
                  {child.academic_year_name && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Academic year: {child.academic_year_name}
                    </p>
                  )}
                </article>
              );
            })}
          </section>
        )}

        <section
          id="published-results"
          className="glass-panel mt-4 scroll-mt-6 overflow-hidden rounded-lg"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <ScrollText className="size-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-display text-lg font-bold">Published results</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  View and download reports the school has published for your linked children.
                </p>
              </div>
            </div>
          </div>
          {downloadError && (
            <p
              role="alert"
              className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
            >
              {downloadError}
            </p>
          )}
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Loading published results...
            </p>
          ) : publishedReports.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No results have been published for your linked children yet.
            </p>
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {publishedReports.map(({ child, report }) => (
                <article key={report.id} className="min-w-0 rounded-md border border-border p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <h3 className="break-words font-display font-semibold">
                        {child.first_name} {child.last_name}
                      </h3>
                      <p className="mt-1 break-words text-sm">
                        {report.term_name} · {report.academic_year_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {child.class_name ?? "No active class"} · Published{" "}
                        {new Date(report.published_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={downloadingReportId !== null}
                      onClick={() => void downloadReport(child, report)}
                    >
                      <Download className="size-4" />
                      {downloadingReportId === report.id ? "Preparing..." : "Download PDF"}
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Attendance: {report.attendance_present ?? 0}/{report.attendance_total ?? 0}{" "}
                    school days
                  </p>
                  {report.items.length > 0 && (
                    <ul className="mt-2 divide-y divide-border/70">
                      {report.items.map((item) => (
                        <li
                          key={item.subject_name}
                          className="flex items-start justify-between gap-3 py-2 text-sm"
                        >
                          <span className="min-w-0 break-words">{item.subject_name}</span>
                          <span className="shrink-0 text-right font-medium">
                            {item.total_score === null
                              ? "—"
                              : `${Number(item.total_score).toFixed(1)}%`}
                            {item.performance_level ? ` · ${item.performance_level}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(report.teacher_remark || report.headteacher_remark) && (
                    <div className="mt-3 space-y-1 break-words text-sm text-muted-foreground">
                      {report.teacher_remark && (
                        <p>
                          <span className="font-medium">Teacher:</span> {report.teacher_remark}
                        </p>
                      )}
                      {report.headteacher_remark && (
                        <p>
                          <span className="font-medium">Headteacher:</span>{" "}
                          {report.headteacher_remark}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="glass-panel mt-4 overflow-hidden rounded-lg">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-bold">Recent payment activity</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Only payments recorded against your linked children are shown.
              </p>
            </div>
            <ReceiptText className="size-5 text-primary" />
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading payment history...
            </p>
          ) : payments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No payment records are available yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Receipt</th>
                    <th className="px-5 py-3 font-medium">Child</th>
                    <th className="px-5 py-3 font-medium">Payment</th>
                    <th className="px-5 py-3 font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-5 py-4 font-mono text-xs">
                        {payment.receipt_number ?? "—"}
                      </td>
                      <td className="px-5 py-4 font-medium">{payment.student_name}</td>
                      <td className="px-5 py-4 capitalize">
                        {payment.category.replaceAll("_", " ")}
                      </td>
                      <td className="px-5 py-4">
                        {payment.currency} {Number(payment.amount).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 capitalize">{payment.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </SchoolShell>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="glass-panel rounded-lg p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      <p className="mt-1 text-xs text-secondary-foreground">{note}</p>
    </article>
  );
}

function SmallStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRoundCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-secondary/45 p-3">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-lg">{value}</p>
    </div>
  );
}
