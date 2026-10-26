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
  is_holiday: boolean;
  holiday_name: string | null;
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
type ClassPrintData = {
  format: "daily" | "term";
  className: string;
  academicYearName?: string;
  termName: string;
  startDate: string;
  endDate: string;
  days: PrintDay[];
};
type SchoolPrintClass = {
  id: string;
  className: string;
  academicYearName: string;
  termName: string;
  startDate: string;
  endDate: string;
  days: PrintDay[];
};
type PrintData = ClassPrintData | {
  format: "school";
  schoolName: string;
  reportThrough: string;
  classes: SchoolPrintClass[];
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

function statusCounts(students: RegisterStudent[]) {
  return students.reduce((counts, student) => {
    const group = genderGroup(student.gender);
    if (student.status === "present" || student.status === "late") counts[group].present += 1;
    else if (student.status === "absent") counts[group].absent += 1;
    else if (student.status === "excused") counts[group].excused += 1;
    else counts[group].unmarked += 1;
    return counts;
  }, {
    boys: { present: 0, absent: 0, excused: 0, unmarked: 0 },
    girls: { present: 0, absent: 0, excused: 0, unmarked: 0 },
    unknown: { present: 0, absent: 0, excused: 0, unmarked: 0 },
  });
}

function termTotals(days: PrintDay[]) {
  return days.reduce((total, day) => {
    const dayCounts = statusCounts(day.students);
    for (const group of ["boys", "girls", "unknown"] as const) {
      for (const status of ["present", "absent", "excused", "unmarked"] as const) {
        total[group][status] += dayCounts[group][status];
      }
    }
    return total;
  }, {
    boys: { present: 0, absent: 0, excused: 0, unmarked: 0 },
    girls: { present: 0, absent: 0, excused: 0, unmarked: 0 },
    unknown: { present: 0, absent: 0, excused: 0, unmarked: 0 },
  });
}

function learnerTermTotals(days: PrintDay[]) {
  const learners = new Map<string, RegisterStudent & {
    present: number;
    absent: number;
    excused: number;
    unmarked: number;
    schoolDays: number;
  }>();
  for (const day of days) {
    for (const student of day.students) {
      const learner = learners.get(student.id) ?? {
        ...student,
        present: 0,
        absent: 0,
        excused: 0,
        unmarked: 0,
        schoolDays: 0,
      };
      learner.schoolDays += 1;
      if (student.status === "present" || student.status === "late") learner.present += 1;
      else if (student.status === "absent") learner.absent += 1;
      else if (student.status === "excused") learner.excused += 1;
      else learner.unmarked += 1;
      learners.set(student.id, learner);
    }
  }
  return [...learners.values()].sort((a, b) =>
    a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name),
  );
}

function AttendanceOverview() {
  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState(() => localDateString(new Date()));
  const [classId, setClassId] = useState("");
  const [defaultPrintFormat, setDefaultPrintFormat] = useState<"daily_register" | "ges_term_to_date">("ges_term_to_date");
  const [printError, setPrintError] = useState("");
  const [printing, setPrinting] = useState(false);
  const [printData, setPrintData] = useState<PrintData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void attendanceApi<{ attendance_print_format: "daily_register" | "ges_term_to_date" }>("/api/school/workflow-settings")
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
      const result = await attendanceApi<{ session_id: string | null; students: RegisterStudent[]; holiday?: { date: string; name: string } }>(
        `/api/school/attendance?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`,
      );
      if (result.holiday) throw new Error(`${result.holiday.name} is a school holiday; there is no attendance register to print.`);
      if (!result.session_id) throw new Error("There is no saved attendance register for this class and date.");
      setPrintData({ format: "daily", className: schoolClass.name, academicYearName: schoolClass.academic_year_name, termName: "", startDate: date, endDate: date, days: [{ date, students: result.students }] });
      window.setTimeout(() => window.print(), 100);
    } catch (printCause) {
      setPrintError(printCause instanceof Error ? printCause.message : "Could not prepare the attendance register.");
    } finally {
      setPrinting(false);
    }
  }

  async function printTermReport() {
    const schoolClass = classes.find((item) => item.id === classId);
    if (!schoolClass) {
      setPrintError("Choose a class before printing.");
      return;
    }
    setPrinting(true);
    setPrintError("");
    try {
      const report = await attendanceApi<{
        class_name: string;
        term_name: string;
        term_starts_on: string;
        report_ends_on: string;
        days: { date: string; students: RegisterStudent[] }[];
      }>(
        `/api/school/attendance?class_id=${encodeURIComponent(classId)}&term_report=true&as_of=${encodeURIComponent(date)}`,
      );
      if (report.days.length === 0) {
        throw new Error(`No saved attendance registers were found for ${report.class_name} during ${report.term_name}.`);
      }
      setPrintData({
        format: "term",
        className: report.class_name || schoolClass.name,
        academicYearName: schoolClass.academic_year_name,
        termName: report.term_name,
        startDate: report.term_starts_on,
        endDate: report.report_ends_on,
        days: report.days,
      });
      window.setTimeout(() => window.print(), 100);
    } catch (printCause) {
      setPrintError(printCause instanceof Error ? printCause.message : "Could not prepare the term-to-date attendance report.");
    } finally {
      setPrinting(false);
    }
  }

  async function printSchoolTermReport() {
    setPrinting(true);
    setPrintError("");
    try {
      const report = await attendanceApi<{
        school_name: string;
        classes: SchoolPrintClass[];
      }>(`/api/school/attendance?school_report=true&as_of=${encodeURIComponent(date)}`);
      if (report.classes.length === 0) throw new Error("No classes have been configured for this school.");
      setPrintData({
        format: "school",
        schoolName: report.school_name,
        reportThrough: date,
        classes: report.classes,
      });
      window.setTimeout(() => window.print(), 100);
    } catch (printCause) {
      setPrintError(printCause instanceof Error ? printCause.message : "Could not prepare the school-wide term-to-date attendance report.");
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
        {classes.some((item) => item.is_holiday) && <p role="status" className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900">{date} is a school holiday{classes.find((item) => item.is_holiday)?.holiday_name ? `: ${classes.find((item) => item.is_holiday)?.holiday_name}` : ""}. Attendance totals for this date are excluded.</p>}
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
                    item.is_holiday
                      ? "School holiday"
                      : studentCount === 0
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
            Print a daily register or a term-to-date attendance report. The school-wide report includes every class and its configured term through the selected report date.
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
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Report through
              <input type="date" max={localDateString(new Date())} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <Button disabled={printing || loading || !classes.length} onClick={() => void (defaultPrintFormat === "daily_register" ? printDailyRegister() : printSchoolTermReport())}>
                Print school default ({defaultPrintFormat === "daily_register" ? "Daily" : "Whole-school term"})
              </Button>
              <Button variant="outline" disabled={printing || loading || !classes.length} onClick={() => void printDailyRegister()}>
                {printing ? "Preparing..." : "Print daily register"}
              </Button>
              <Button disabled={printing || loading || !classes.length} onClick={() => void printTermReport()}>
                {printing ? "Preparing..." : "Print this class term report"}
              </Button>
              <Button variant="outline" disabled={printing || loading || !classes.length} onClick={() => void printSchoolTermReport()}>
                {printing ? "Preparing..." : "Print whole-school term report"}
              </Button>
            </div>
          </div>
          {printError && <p role="alert" className="mt-3 text-sm text-destructive">{printError}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            Marks: / = present or late, O = absent, E = excused, blank = unmarked. Term reports include saved registers, learner totals, daily boys&apos; and girls&apos; counts, and totals. Use the browser print dialog and choose “Save as PDF” to export. The layout has not been checked against the official GES form because its reference photo has not been provided.
          </p>
        </section>
      </div>
      {printData && <AttendancePrint data={printData} />}
    </SchoolShell>
  );
}

function AttendancePrint({ data }: { data: PrintData }) {
  if (data.format === "school") {
    const days = data.classes.flatMap((schoolClass) => schoolClass.days);
    const totals = termTotals(days);
    const total = (status: "present" | "absent" | "excused" | "unmarked") =>
      totals.boys[status] + totals.girls[status] + totals.unknown[status];
    return <div className="attendance-print-root">
      <article className="attendance-print-page">
        <h1>Whole-School Term-to-date Attendance Report</h1>
        <p><strong>School:</strong> {data.schoolName}</p>
        <p><strong>Report through:</strong> {data.reportThrough}</p>
        <p><strong>Classes included:</strong> {data.classes.length} · <strong>Saved class registers:</strong> {days.length}</p>
        <table>
          <thead><tr><th>Class</th><th>Academic year</th><th>Term</th><th>Saved days</th><th>Present / late</th><th>Absent</th><th>Excused</th><th>Unmarked</th></tr></thead>
          <tbody>{data.classes.map((schoolClass) => {
            const classTotals = termTotals(schoolClass.days);
            const count = (status: "present" | "absent" | "excused" | "unmarked") =>
              classTotals.boys[status] + classTotals.girls[status] + classTotals.unknown[status];
            return <tr key={schoolClass.id}>
              <td>{schoolClass.className}</td>
              <td>{schoolClass.academicYearName}</td>
              <td>{schoolClass.termName}</td>
              <td>{schoolClass.days.length}</td>
              <td>{count("present")}</td>
              <td>{count("absent")}</td>
              <td>{count("excused")}</td>
              <td>{count("unmarked")}</td>
            </tr>;
          })}</tbody>
          <tfoot><tr>
            <th colSpan={3}>School totals (student-days)</th><th>{days.length}</th>
            <th>{total("present")}</th><th>{total("absent")}</th>
            <th>{total("excused")}</th><th>{total("unmarked")}</th>
          </tr></tfoot>
        </table>
        <p className="print-footnote">Each class uses its configured term. Saved attendance sessions count as school-open days, excluding dates marked as school holidays.</p>
      </article>
      {data.classes.map((schoolClass) => <ClassAttendancePrint
        key={schoolClass.id}
        data={{
          format: "term",
          className: schoolClass.className,
          academicYearName: schoolClass.academicYearName,
          termName: schoolClass.termName,
          startDate: schoolClass.startDate,
          endDate: schoolClass.endDate,
          days: schoolClass.days,
        }}
      />)}
    </div>;
  }
  return <div className="attendance-print-root"><ClassAttendancePrint data={data} /></div>;
}

function ClassAttendancePrint({ data }: { data: ClassPrintData }) {
  const totals = termTotals(data.days);
  const learners = learnerTermTotals(data.days);
  const enrolledBoys = learners.filter((learner) => genderGroup(learner.gender) === "boys").length;
  const enrolledGirls = learners.filter((learner) => genderGroup(learner.gender) === "girls").length;
  const enrolledUnknown = learners.length - enrolledBoys - enrolledGirls;
  return <div>
    {data.days.map((day, index) => {
      const counts = statusCounts(day.students);
      return <article className="attendance-print-page" key={day.date}>
        <h1>{data.format === "term" ? "Term Attendance Register" : "Daily Class Attendance Register"}</h1>
        <p><strong>Class:</strong> {data.className}{data.academicYearName ? ` · ${data.academicYearName}` : ""} <span className="print-spacer" /><strong>Date:</strong> {day.date}</p>
        {data.format === "term" && <p><strong>Term:</strong> {data.termName} <span className="print-spacer" /><strong>School-open day:</strong> {index + 1} of {data.days.length}</p>}
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
          <span>Boys present: {counts.boys.present}</span><span>Girls present: {counts.girls.present}</span>
          {counts.unknown.present > 0 && <span>Unclassified gender present: {counts.unknown.present}</span>}
          <span>Boys absent: {counts.boys.absent}</span><span>Girls absent: {counts.girls.absent}</span>
        </div>
      </article>;
    })}
    {data.format === "term" && <article className="attendance-print-page">
      <h1>Term-to-date Attendance Summary</h1>
      <p><strong>Class:</strong> {data.className}{data.academicYearName ? ` · ${data.academicYearName}` : ""}</p>
      <p><strong>Term:</strong> {data.termName} ({data.startDate} to {data.endDate})</p>
      <p><strong>Days school opened / registers saved:</strong> {data.days.length}</p>
      <table>
        <thead><tr><th>School-open date</th><th>Boys present</th><th>Girls present</th><th>Boys absent</th><th>Girls absent</th><th>Excused</th><th>Unmarked</th></tr></thead>
        <tbody>
          {data.days.map((day) => {
            const counts = statusCounts(day.students);
            return <tr key={day.date}>
              <td>{day.date}</td>
              <td>{counts.boys.present}</td><td>{counts.girls.present}</td>
              <td>{counts.boys.absent}</td><td>{counts.girls.absent}</td>
              <td>{counts.boys.excused + counts.girls.excused + counts.unknown.excused}</td>
              <td>{counts.boys.unmarked + counts.girls.unmarked + counts.unknown.unmarked}</td>
            </tr>;
          })}
          <tr>
            <th>Term total student-days</th>
            <th>{totals.boys.present}</th><th>{totals.girls.present}</th>
            <th>{totals.boys.absent}</th><th>{totals.girls.absent}</th>
            <th>{totals.boys.excused + totals.girls.excused + totals.unknown.excused}</th>
            <th>{totals.boys.unmarked + totals.girls.unmarked + totals.unknown.unmarked}</th>
          </tr>
        </tbody>
      </table>
      <p className="print-footnote">Enrolled learners represented in saved registers: {learners.length} ({enrolledBoys} boys, {enrolledGirls} girls, {enrolledUnknown} unclassified gender).</p>
      <h2 className="print-subheading">Individual learner totals</h2>
      <table>
        <thead><tr><th>No.</th><th>Student ID</th><th>Learner name</th><th>Sex</th><th>Present / late</th><th>Absent</th><th>Excused</th><th>Unmarked</th><th>Attendance %</th></tr></thead>
        <tbody>{learners.map((learner, index) => {
          const attendanceRate = learner.schoolDays > 0
            ? Math.round((learner.present / learner.schoolDays) * 100)
            : 0;
          return <tr key={learner.id}>
            <td>{index + 1}</td><td>{learner.admission_number}</td>
            <td>{learner.last_name} {learner.first_name}</td><td>{learner.gender || "—"}</td>
            <td>{learner.present}</td><td>{learner.absent}</td><td>{learner.excused}</td><td>{learner.unmarked}</td><td>{attendanceRate}%</td>
          </tr>;
        })}</tbody>
      </table>
      <p className="print-footnote">Term totals are attendance student-days across saved school-open registers. Each learner&apos;s attendance percentage uses only saved register days when that learner was enrolled in this class.</p>
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
