import { createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  CreditCard,
  Download,
  GraduationCap,
  ReceiptText,
  ScrollText,
  UserRoundCheck,
  Eye,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchWithNeonAuth } from "../auth/client";
import { SchoolShell } from "@/components/school-shell";
import { useTenantBranding } from "@/components/tenant-branding-provider";
import { useReportDesign } from "@/lib/report-design";
import type { TerminalReportPdfData } from "@/lib/terminal-report-pdf";
import { TerminalReportView } from "@/components/terminal-report-view";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/parent")({
  head: () => ({
    meta: [
      { title: "Parent Portal — Klasora" },
      { name: "description", content: "Follow your children’s learning, attendance, and fees." },
      { property: "og:title", content: "Family Reports & Learning — Klasora" },
      {
        property: "og:description",
        content: "Follow linked learners' progress and view published school reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
    class_test_score?: number | string | null;
    project_score?: number | string | null;
    group_work_score?: number | string | null;
    homework_score?: number | string | null;
    exam_score?: number | string | null;
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
  const { template } = useReportDesign();
  const [preview, setPreview] = useState<TerminalReportPdfData | null>(null);
  const locationHash = useRouterState({ select: (state) => state.location.hash });
  const [children, setChildren] = useState<Child[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const refreshPortalData = useCallback(async () => {
    setError("");
    try {
      const result = await portalApi<{ children: Child[]; recent_payments: Payment[] }>(
        "/api/school/portal-data",
      );
      if (!isMounted.current) return;
      setChildren(result.children);
      setPayments(result.recent_payments);
    } catch (loadError) {
      if (!isMounted.current) return;
      setError(loadError instanceof Error ? loadError.message : "Could not load family records");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPortalData();
  }, [refreshPortalData]);

  useEffect(() => {
    if (locationHash.replace(/^#/, "") !== "published-results" || loading) return;
    void refreshPortalData();
    const frame = window.requestAnimationFrame(() =>
      document.getElementById("published-results")?.scrollIntoView({ behavior: "smooth" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [locationHash, loading, refreshPortalData]);

  useEffect(() => {
    const refreshWhenFocused = () => {
      void refreshPortalData();
    };
    window.addEventListener("focus", refreshWhenFocused);
    return () => window.removeEventListener("focus", refreshWhenFocused);
  }, [refreshPortalData]);

  const outstandingBalance = useMemo(
    () => children.reduce((sum, child) => sum + Number(child.balance_due), 0),
    [children],
  );
  const currency = children[0]?.currency ?? "GHS";
  const publishedReports = children.flatMap((child) =>
    (child.published_reports ?? []).map((report) => ({ child, report })),
  );

  function reportData(child: Child, report: PublishedReport): TerminalReportPdfData {
    const numeric = (value: number | string | null | undefined) =>
      value == null ? null : Number(value);
    return {
      schoolName,
      primaryColor,
      crestUrl,
      template,
      student: `${child.first_name} ${child.last_name}`,
      admission: child.admission_number,
      className: child.class_name ?? "Unassigned",
      term: `${report.academic_year_name} · ${report.term_name}`,
      attendance: `${report.attendance_present ?? 0} / ${report.attendance_total ?? 0} days`,
      conduct: report.conduct ?? "",
      attitude: report.attitude ?? "",
      interest: report.interest ?? "",
      teacherRemark: report.teacher_remark ?? "",
      headteacherRemark: report.headteacher_remark ?? "",
      results: report.items.map((item) => ({
        subject: item.subject_name,
        score: Number(item.total_score ?? 0),
        teacher: "",
        remark: item.remark ?? item.performance_level ?? "",
        classTest: numeric(item.class_test_score),
        project: numeric(item.project_score),
        groupWork: numeric(item.group_work_score),
        homework: numeric(item.homework_score),
        exam: numeric(item.exam_score),
      })),
    };
  }

  async function downloadReport(child: Child, report: PublishedReport) {
    setDownloadingReportId(report.id);
    setDownloadError("");
    try {
      const { downloadTerminalReports } = await import("@/lib/terminal-report-pdf");
      await downloadTerminalReports([reportData(child, report)]);
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreview(reportData(child, report))}
                      >
                        <Eye />
                        View
                      </Button>
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
        <Dialog
          open={preview !== null}
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
        >
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Published terminal report</DialogTitle>
              <DialogDescription>
                {preview?.student} · {preview?.term}
              </DialogDescription>
            </DialogHeader>
            {preview && <TerminalReportView report={preview} template={template} />}
          </DialogContent>
        </Dialog>
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
