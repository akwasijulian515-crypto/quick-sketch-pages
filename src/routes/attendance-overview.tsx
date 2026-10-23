import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, ClipboardCheck, Printer, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchWithNeonAuth, getNeonAccessToken } from "../auth/client";
import { Button } from "@/components/ui/button";
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

type RegisterStudent = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  gender: string;
  status: "present" | "late" | "absent" | "excused" | null;
};

type PrintDay = { date: string; students: RegisterStudent[] };
type PrintData = {
  format: "daily" | "weekly";
  className: string;
  startDate: string;
  endDate: string;
  days: PrintDay[];
};

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function attendanceApi<T>(path: string): Promise<T> {
  const url = new URL(path, window.location.origin);
  const tenant = new URLSearchParams(window.location.search).get("tenant") ?? sessionStorage.getItem("hg-school");
  if (tenant) url.searchParams.set("tenant", tenant);
  const response = await fetchWithNeonAuth(`${url.pathname}${url.search}`);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "The attendance request failed";
    throw new Error(message);
  }
  return payload as T;
}

function getWeekDates(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return localDateString(date);
  });
}

function attendanceMark(status: RegisterStudent["status"]) {
  if (status === "present" || status === "late") return "/";
  if (status === "absent") return "O";
  if (status === "excused") return "E";
  return "";
}

function genderGroup(gender: string): "boys" | "girls" | "unknown" {
  const value = gender.trim().toLowerCase();
  if (["male", "boy", "boys", "m"].includes(value)) return "boys";
  if (["female", "girl", "girls", "f"].includes(value)) return "girls";
  return "unknown";
}

function presentCounts(students: RegisterStudent[]) {
  return students.reduce((counts, student) => {
    if (student.status === "present" || student.status === "late") {
      counts[genderGroup(student.gender)] += 1;
    }
    return counts;
  }, { boys: 0, girls: 0, unknown: 0 });
}

function AttendanceOverview() {
  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState(() => localDateString(new Date()));
  const [classId, setClassId] = useState("");
  const [defaultPrintFormat, setDefaultPrintFormat] = useState<"daily_register" | "ges_weekly">("ges_weekly");
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return localDateString(today);
  });
  const [printError, setPrintError] = useState("");
  const [printing, setPrinting] = useState(false);
  const [printData, setPrintData] = useState<PrintData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void attendanceApi<{ attendance_print_format: "daily_register" | "ges_weekly" }>("/api/school/workflow-settings")
      .then((result) => { if (!cancelled) setDefaultPrintFormat(result.attendance_print_format); })
      .catch((loadError: unknown) => {
        if (!cancelled) setPrintError(loadError instanceof Error ? loadError.message : "Could not load print preferences.");
      });
    return () => { cancelled = true; };
  }, []);

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
        if (!cancelled) {
          setClasses(result.classes);
          setClassId((current) => result.classes.some((item) => item.id === current)
            ? current
            : result.classes[0]?.id || "");
        }
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

  async function printDailyRegister() {
    const schoolClass = classes.find((item) => item.id === classId);
    if (!schoolClass) {
      setPrintError("Choose a class before printing.");
      return;
    }
    setPrinting(true);
    setPrintError("");
    try {
      const result = await attendanceApi<{ session_id: string | null; students: RegisterStudent[] }>(
        `/api/school/attendance?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`,
      );
      if (!result.session_id) throw new Error("There is no saved attendance register for this class and date.");
      setPrintData({ format: "daily", className: schoolClass.name, startDate: date, endDate: date, days: [{ date, students: result.students }] });
      window.setTimeout(() => window.print(), 100);
    } catch (printCause) {
      setPrintError(printCause instanceof Error ? printCause.message : "Could not prepare the attendance register.");
    } finally {
      setPrinting(false);
    }
  }

  async function printWeeklyRegister() {
    const schoolClass = classes.find((item) => item.id === classId);
    if (!schoolClass) {
      setPrintError("Choose a class before printing.");
      return;
    }
    const dates = getWeekDates(weekStart);
    setPrinting(true);
    setPrintError("");
    try {
      const months = [...new Set(dates.map((item) => item.slice(0, 7)))];
      const monthly = await Promise.all(months.map((month) =>
        attendanceApi<{ days: { attendance_date: string }[] }>(
          `/api/school/attendance?class_id=${encodeURIComponent(classId)}&month=${encodeURIComponent(month)}`,
        ),
      ));
      const openDates = [...new Set(monthly.flatMap((result) => result.days.map((item) => item.attendance_date))
        .filter((item) => item >= dates[0]! && item <= dates[6]!))].sort();
      if (openDates.length === 0) throw new Error("No saved attendance sessions were found for this class during the selected week.");
      const dayResults = await Promise.all(openDates.map(async (day) => {
        const register = await attendanceApi<{ session_id: string | null; students: RegisterStudent[] }>(
          `/api/school/attendance?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(day)}`,
        );
        if (!register.session_id) throw new Error(`The saved register for ${day} could not be loaded.`);
        return { date: day, students: register.students };
      }));
      setPrintData({
        format: "weekly",
        className: schoolClass.name,
        startDate: dates[0]!,
        endDate: dates[6]!,
        days: dayResults,
      });
      window.setTimeout(() => window.print(), 100);
    } catch (printCause) {
      setPrintError(printCause instanceof Error ? printCause.message : "Could not prepare the weekly attendance register.");
    } finally {
      setPrinting(false);
    }
  }

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
        <section className="glass-panel mt-4 rounded-lg p-5">
          <div className="flex items-center gap-2">
            <Printer className="size-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Print attendance registers</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Print a saved daily register or a weekly GES-style register. Only dates with a saved class attendance session count as days the school opened.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Class
              <select value={classId} onChange={(event) => setClassId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Daily register date
              <input type="date" max={localDateString(new Date())} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Week (choose any day)
              <input type="date" max={localDateString(new Date())} value={weekStart} onChange={(event) => event.target.value && setWeekStart(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <Button disabled={printing || loading || !classes.length} onClick={() => void (defaultPrintFormat === "daily_register" ? printDailyRegister() : printWeeklyRegister())}>
                Print school default ({defaultPrintFormat === "daily_register" ? "Daily" : "Weekly"})
              </Button>
              <Button variant="outline" disabled={printing || loading || !classes.length} onClick={() => void printDailyRegister()}>
                {printing ? "Preparing..." : "Print daily register"}
              </Button>
              <Button disabled={printing || loading || !classes.length} onClick={() => void printWeeklyRegister()}>
                {printing ? "Preparing..." : "Print weekly GES-style"}
              </Button>
            </div>
          </div>
          {printError && <p role="alert" className="mt-3 text-sm text-destructive">{printError}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            Weekly marks: / = present or late, O = absent, E = excused, blank = unmarked. Totals count present student-days; unknown or missing gender is listed separately. This layout has not been checked against the official GES form because its reference photo has not been provided.
          </p>
        </section>
      </div>
      {printData && <AttendancePrint data={printData} />}
    </SchoolShell>
  );
}

function AttendancePrint({ data }: { data: PrintData }) {
  const weeklyTotals = data.days.reduce((total, day) => {
    const counts = presentCounts(day.students);
    return {
      boys: total.boys + counts.boys,
      girls: total.girls + counts.girls,
      unknown: total.unknown + counts.unknown,
    };
  }, { boys: 0, girls: 0, unknown: 0 });
  return <div className="attendance-print-root">
    {data.days.map((day, index) => {
      const counts = presentCounts(day.students);
      return <article className="attendance-print-page" key={day.date}>
        <h1>{data.format === "weekly" ? "Weekly Attendance Register" : "Daily Class Attendance Register"}</h1>
        <p><strong>Class:</strong> {data.className} <span className="print-spacer" /><strong>Date:</strong> {day.date}</p>
        {data.format === "weekly" && <p>School-open day {index + 1} of {data.days.length} for {data.startDate} to {data.endDate}</p>}
        <p className="print-legend">/ Present or late &nbsp; O Absent &nbsp; E Excused &nbsp; Blank Unmarked</p>
        <table>
          <thead><tr><th>No.</th><th>Student ID</th><th>Learner name</th><th>Sex</th><th>Mark</th></tr></thead>
          <tbody>{day.students.map((student, studentIndex) => <tr key={student.id}>
            <td>{studentIndex + 1}</td><td>{student.admission_number}</td>
            <td>{student.last_name} {student.first_name}</td><td>{student.gender || "—"}</td>
            <td className="print-mark">{attendanceMark(student.status)}</td>
          </tr>)}</tbody>
        </table>
        <div className="print-totals">
          <span>Boys present: {counts.boys}</span><span>Girls present: {counts.girls}</span>
          {counts.unknown > 0 && <span>Unclassified gender present: {counts.unknown}</span>}
        </div>
      </article>;
    })}
    {data.format === "weekly" && <article className="attendance-print-page">
      <h1>Weekly Attendance Summary</h1>
      <p><strong>Class:</strong> {data.className}</p>
      <p><strong>Week:</strong> {data.startDate} to {data.endDate}</p>
      <p><strong>Days school opened:</strong> {data.days.length}</p>
      <table>
        <thead><tr><th>School-open date</th><th>Boys present</th><th>Girls present</th><th>Unclassified gender</th></tr></thead>
        <tbody>
          {data.days.map((day) => {
            const counts = presentCounts(day.students);
            return <tr key={day.date}><td>{day.date}</td><td>{counts.boys}</td><td>{counts.girls}</td><td>{counts.unknown}</td></tr>;
          })}
          <tr><th>Weekly present student-days</th><th>{weeklyTotals.boys}</th><th>{weeklyTotals.girls}</th><th>{weeklyTotals.unknown}</th></tr>
        </tbody>
      </table>
      <p className="print-footnote">Weekly totals are the sum of daily attendance counts (student-days), not unique learners.</p>
    </article>}
  </div>;
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
