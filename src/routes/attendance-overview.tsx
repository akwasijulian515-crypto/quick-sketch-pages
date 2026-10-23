import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, ClipboardCheck, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { getNeonAccessToken } from "../auth/client";
import { SchoolShell } from "@/components/school-shell";

export const Route = createFileRoute("/attendance-overview")({
  head: () => ({
    meta: [
      { title: "Attendance Overview — Klasora" },
      { name: "description", content: "School Admin attendance monitoring." },
    ],
  }),
  component: AttendanceOverview,
});

type AttendanceClass = {
  id: string;
  name: string;
  academic_year_name: string;
  student_count: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  marked_count: number;
};

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function AttendanceOverview() {
  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date] = useState(() => localDateString(new Date()));

  useEffect(() => {
    let cancelled = false;
    async function loadAttendance() {
      try {
        const token = await getNeonAccessToken();
        const url = new URL("/api/school/attendance", window.location.origin);
        url.searchParams.set("date", date);
        const tenant =
          new URLSearchParams(window.location.search).get("tenant") ??
          sessionStorage.getItem("hg-school");
        if (tenant) url.searchParams.set("tenant", tenant);
        const response = await fetch(`${url.pathname}${url.search}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : "Could not load attendance";
          throw new Error(message);
        }
        const result = payload as { classes: AttendanceClass[] };
        if (!cancelled) setClasses(result.classes);
      } catch (loadError) {
        if (!cancelled)
          setError(loadError instanceof Error ? loadError.message : "Could not load attendance");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadAttendance();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const classesWithLearners = classes.filter((item) => Number(item.student_count) > 0);
  const completedRegisters = classesWithLearners.filter(
    (item) => Number(item.marked_count) >= Number(item.student_count),
  ).length;
  const present = classes.reduce((total, item) => total + Number(item.present_count), 0);
  const absent = classes.reduce((total, item) => total + Number(item.absent_count), 0);

  return (
    <SchoolShell title="Attendance" schoolAdmin>
      <div className="mx-auto max-w-6xl rise">
        <div>
          <div className="mb-3 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border">
            <ClipboardCheck className="size-5" />
          </div>
          <h1 className="font-display text-3xl font-bold">Attendance overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Monitor attendance across the school. Only teachers can make or edit register entries.
          </p>
        </div>
        <section className="mt-7 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Present today"
            value={loading ? "—" : String(present)}
            note={loading ? "Loading attendance" : error ? "Attendance unavailable" : date}
          />
          <Metric
            label="Absent today"
            value={loading ? "—" : String(absent)}
            note={loading ? "Loading attendance" : error ? "Attendance unavailable" : date}
          />
          <Metric
            label="Registers complete"
            value={loading ? "—" : `${completedRegisters}/${classesWithLearners.length}`}
            note={
              loading
                ? "Loading attendance"
                : error
                  ? "Attendance unavailable"
                  : "Classes with active learners"
            }
          />
        </section>
        <section className="glass-panel mt-4 overflow-hidden rounded-lg">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <CircleAlert className="size-4 text-amber-600" />
            <p className="text-sm text-secondary-foreground">
              View-only access: register marking is assigned to teachers.
            </p>
          </div>
          {error && (
            <p
              role="alert"
              className="mx-5 mt-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Class</th>
                  <th className="px-5 py-3 font-medium">Present</th>
                  <th className="px-5 py-3 font-medium">Late</th>
                  <th className="px-5 py-3 font-medium">Absent</th>
                  <th className="px-5 py-3 font-medium">Register status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {classes.map((item) => {
                  const studentCount = Number(item.student_count);
                  const markedCount = Number(item.marked_count);
                  const status =
                    studentCount === 0
                      ? "No active learners"
                      : markedCount >= studentCount
                        ? "Complete"
                        : `${markedCount} of ${studentCount} marked`;
                  return (
                    <tr key={item.id}>
                      <td className="px-5 py-4 font-medium">
                        {item.name}
                        <p className="text-xs font-normal text-muted-foreground">
                          {item.academic_year_name}
                        </p>
                      </td>
                      <td className="px-5 py-4">{Number(item.present_count)}</td>
                      <td className="px-5 py-4">{Number(item.late_count)}</td>
                      <td className="px-5 py-4">{Number(item.absent_count)}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-secondary-foreground">
                          <UserRoundCheck className="size-3.5 text-primary" />
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && !error && classes.length === 0 && (
            <p className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground">
              No classes have been set up for this school yet.
            </p>
          )}
          {loading && (
            <p className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground">
              Loading attendance...
            </p>
          )}
          {!loading &&
            !error &&
            classes.length > 0 &&
            classes.every((item) => Number(item.marked_count) === 0) && (
              <p className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground">
                No attendance has been recorded for these classes today.
              </p>
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
