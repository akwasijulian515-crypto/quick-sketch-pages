import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, BookOpenCheck, LogOut, TicketCheck, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher Portal — Harrow Green" },
      { name: "description", content: "Teacher register, grade entry, and coupon tools." },
      { property: "og:title", content: "Teacher Portal — Harrow Green" },
      { property: "og:description", content: "Teacher register, grade entry, and coupon tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeacherPortal,
});

const tabs = [
  { id: "register", label: "Register", icon: UserRoundCheck },
  { id: "grades", label: "Grades", icon: BookOpenCheck },
  { id: "coupons", label: "Coupons", icon: TicketCheck },
] as const;

type AttendanceStatus = "present" | "late" | "absent";
type RegisterStudent = { id: string; name: string; admissionNumber: string; status: AttendanceStatus; timeIn: string; note?: string };
type ScoreField = "classTest" | "project" | "homework" | "groupWork" | "exam";
type StudentScores = Record<ScoreField, string>;
type LearnerProfile = { conduct: string; attitude: string; interest: string; remark: string };
type DailyFeeStatus = "paid" | "unpaid" | "pending";
type DailyFeeCoupon = { studentId: string; code?: string; paidAt?: string; status: DailyFeeStatus };

const initialRegister: RegisterStudent[] = [
  { id: "stu-001", name: "Abena Ofori", admissionNumber: "HGA-2B-001", status: "present", timeIn: "07:36" },
  { id: "stu-002", name: "Daniel Boateng", admissionNumber: "HGA-2B-002", status: "present", timeIn: "07:42" },
  { id: "stu-003", name: "Eunice Agyeman", admissionNumber: "HGA-2B-003", status: "late", timeIn: "08:14", note: "Transport delay" },
  { id: "stu-004", name: "Felix Nyarko", admissionNumber: "HGA-2B-004", status: "present", timeIn: "07:39" },
  { id: "stu-005", name: "Gloria Mensah", admissionNumber: "HGA-2B-005", status: "absent", timeIn: "-", note: "Parent notified" },
  { id: "stu-006", name: "Isaac Amankwah", admissionNumber: "HGA-2B-006", status: "present", timeIn: "07:45" },
  { id: "stu-007", name: "Janet Asiedu", admissionNumber: "HGA-2B-007", status: "present", timeIn: "07:32" },
  { id: "stu-008", name: "Kofi Owusu", admissionNumber: "HGA-2B-008", status: "late", timeIn: "08:08", note: "Assembly" },
];
const dailyFeeCoupons: DailyFeeCoupon[] = [
  { studentId: "stu-001", code: "DF-2B-4817", paidAt: "07:29", status: "paid" },
  { studentId: "stu-002", status: "unpaid" },
  { studentId: "stu-003", code: "DF-2B-4818", paidAt: "08:06", status: "paid" },
  { studentId: "stu-004", code: "DF-2B-4819", paidAt: "07:34", status: "paid" },
  { studentId: "stu-005", status: "unpaid" },
  { studentId: "stu-006", status: "pending" },
  { studentId: "stu-007", code: "DF-2B-4820", paidAt: "07:25", status: "paid" },
  { studentId: "stu-008", code: "DF-2B-4821", paidAt: "08:04", status: "paid" },
];

function statusLabel(status: AttendanceStatus) { return `${status.charAt(0).toUpperCase()}${status.slice(1)}`; }
const subjects = ["Mathematics", "Integrated Science", "ICT"];
const scoreLimits: Record<ScoreField, number> = { classTest: 10, project: 20, homework: 10, groupWork: 10, exam: 100 };
const emptyScores: StudentScores = { classTest: "", project: "", homework: "", groupWork: "", exam: "" };
const emptyProfile: LearnerProfile = { conduct: "Good", attitude: "Good", interest: "Good", remark: "" };
function calculateScore(scores: StudentScores) { return Number(scores.classTest || 0) + Number(scores.project || 0) + Number(scores.homework || 0) + Number(scores.groupWork || 0) + Number(scores.exam || 0) / 2; }
function gradeFor(score: number) { return score >= 80 ? "A" : score >= 70 ? "B+" : score >= 60 ? "B" : score >= 50 ? "C+" : score >= 40 ? "C" : "D"; }

function TeacherPortal() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("register");
  const [register, setRegister] = useState(initialRegister);
  const [subject, setSubject] = useState(subjects[0]!);
  const [gradeBook, setGradeBook] = useState<Record<string, StudentScores>>(() => Object.fromEntries(initialRegister.map((student) => [student.id, { ...emptyScores }])));
  const [gradeView, setGradeView] = useState<"scores" | "profile">("scores");
  const [profiles, setProfiles] = useState<Record<string, LearnerProfile>>(() => Object.fromEntries(initialRegister.map((student) => [student.id, { ...emptyProfile }])));

  const presentCount = register.filter((student) => student.status === "present").length;
  const lateCount = register.filter((student) => student.status === "late").length;
  const absentCount = register.filter((student) => student.status === "absent").length;
  const paidDailyFees = dailyFeeCoupons.filter((coupon) => coupon.status === "paid").length;

  function setAttendance(studentId: string, status: AttendanceStatus) {
    setRegister((current) => current.map((student) => student.id === studentId ? { ...student, status, timeIn: status === "absent" ? "-" : student.timeIn === "-" ? "08:00" : student.timeIn } : student));
  }

  function updateScore(studentId: string, field: ScoreField, value: string) {
    if (value !== "" && (!/^\d*(\.\d{0,2})?$/.test(value) || Number(value) > scoreLimits[field])) return;
    setGradeBook((current) => ({ ...current, [studentId]: { ...(current[studentId] ?? emptyScores), [field]: value } }));
  }

  function updateProfile(studentId: string, field: keyof LearnerProfile, value: string) {
    setProfiles((current) => ({ ...current, [studentId]: { ...(current[studentId] ?? emptyProfile), [field]: value } }));
  }

  useEffect(() => {
    if (sessionStorage.getItem("hg-role") === "teacher") {
      setAllowed(true);
    } else {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  if (!allowed) return null;

  return (
    <div className="relative min-h-screen bg-background font-body text-foreground">
      <div className="pointer-events-none fixed inset-0 ambient-wash" />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-md bg-primary font-display text-base font-bold text-primary-foreground">H</div>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold">Teacher Portal</p>
            <p className="text-[11px] text-muted-foreground">Mr. Okoye · Form 2B</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            sessionStorage.removeItem("hg-role");
            navigate({ to: "/login" });
          }}
        >
          <LogOut />Sign out
        </Button>
      </header>

      <main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Good morning, Mr. Okoye</h1>
            <p className="mt-1 text-sm text-muted-foreground">Form 2B · 42 students · Today&apos;s register is waiting.</p>
          </div>
          <div className="flex gap-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <Button key={id} variant={tab === id ? "default" : "outline"} size="sm" onClick={() => setTab(id)}>
                <Icon />{label}
              </Button>
            ))}
            <Button asChild size="sm" variant="outline"><Link to="/teacher/promotion"><ArrowUpRight />Promotion</Link></Button>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Present today", value: String(presentCount), note: `of ${register.length} students shown` },
            { label: "Grades pending", value: "2", note: "subjects to submit" },
            { label: "Daily fees paid", value: String(paidDailyFees), note: "in this class today" },
          ].map((stat) => (
            <article key={stat.label} className="glass-panel rise rounded-lg p-5">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-2 font-display text-3xl">{stat.value}</p>
              <p className="mt-1 text-xs text-secondary-foreground">{stat.note}</p>
            </article>
          ))}
        </section>

        <section className="glass-panel rise mt-4 overflow-hidden rounded-lg">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-bold">
              {tab === "register" ? "Today's register" : tab === "grades" ? "Grade entry" : "Daily fee coupons"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {tab === "register" ? "Mark each student present, late, or absent." : tab === "grades" ? "Coursework totals 50 marks; half of the 100-mark exam creates the final score out of 100." : "View Finance-recorded daily-fee clearance. A coupon is proof of payment for today, not a discount or a receipt."}
            </p>
          </div>
          {tab === "grades" && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3"><div className="flex rounded-md border border-input bg-background/70 p-1"><button type="button" onClick={() => setGradeView("scores")} className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors", gradeView === "scores" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Academic scores</button><button type="button" onClick={() => setGradeView("profile")} className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors", gradeView === "profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Conduct & remarks</button></div>{gradeView === "scores" ? <label className="flex items-center gap-2 text-sm"><span className="text-xs font-medium text-muted-foreground">Assigned subject</span><select value={subject} onChange={(event) => setSubject(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">{subjects.map((item) => <option key={item}>{item}</option>)}</select></label> : <span className="text-xs text-muted-foreground">Term-wide learner profile</span>}<span className="text-xs text-muted-foreground">Form 2B · {register.length} students shown</span></div>}
          <div className="overflow-x-auto">
            <table className={cn("w-full text-left text-sm", tab === "grades" ? gradeView === "scores" ? "min-w-[1040px]" : "min-w-[920px]" : "min-w-[560px]")}>
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  {(tab === "register" ? ["Student", "Status", "Time in", "Note"] : tab === "grades" ? gradeView === "scores" ? ["Student", "Class test /10", "Project /20", "Homework /10", "Group work /10", "Exam /100", "Final /100", "Grade"] : ["Student", "Conduct", "Attitude", "Interest", "Teacher remark"] : ["Student", "Daily fee coupon", "Recorded", "Status"]).map((column) => (
                    <th key={column} className="px-5 py-3 font-medium">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {tab === "register" ? register.map((student) => <tr key={student.id} className="hover:bg-muted/30"><td className="px-5 py-3"><p className="font-medium">{student.name}</p><p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{student.admissionNumber}</p></td><td className="px-5 py-3"><div className="flex gap-1.5">{(["present", "late", "absent"] as const).map((status) => <button key={status} type="button" onClick={() => setAttendance(student.id, status)} className={cn("rounded-full px-2 py-1 text-xs font-medium transition-colors", student.status === status ? status === "present" ? "bg-emerald-500 text-white" : status === "late" ? "bg-amber-500 text-white" : "bg-rose-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted-foreground/15")}>{statusLabel(status)}</button>)}</div></td><td className="px-5 py-3 font-mono text-xs text-secondary-foreground">{student.timeIn}</td><td className="px-5 py-3 text-xs text-muted-foreground">{student.note ?? "-"}</td></tr>) : tab === "grades" ? gradeView === "scores" ? register.map((student) => { const scores = gradeBook[student.id] ?? emptyScores; const finalScore = calculateScore(scores); return <tr key={student.id} className="hover:bg-muted/30"><td className="px-5 py-3"><p className="font-medium">{student.name}</p><p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{student.admissionNumber}</p></td>{(["classTest", "project", "homework", "groupWork", "exam"] as const).map((field) => <td key={field} className="px-3 py-3"><input inputMode="decimal" value={scores[field]} onChange={(event) => updateScore(student.id, field, event.target.value)} placeholder="0" className="h-9 w-20 rounded-md border border-input bg-background/70 px-2 text-center text-sm outline-none focus:ring-2 focus:ring-ring" /></td>)}<td className="px-5 py-3 font-display text-base">{finalScore.toFixed(1)}</td><td className="px-5 py-3"><span className={cn("rounded-full px-2 py-1 text-xs font-medium", finalScore >= 50 ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700")}>{gradeFor(finalScore)}</span></td></tr> }) : register.map((student) => { const profile = profiles[student.id] ?? emptyProfile; return <tr key={student.id} className="hover:bg-muted/30"><td className="px-5 py-3"><p className="font-medium">{student.name}</p><p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{student.admissionNumber}</p></td>{(["conduct", "attitude", "interest"] as const).map((field) => <td key={field} className="px-3 py-3"><select value={profile[field]} onChange={(event) => updateProfile(student.id, field, event.target.value)} className="h-9 w-28 rounded-md border border-input bg-background/70 px-2 text-sm outline-none focus:ring-2 focus:ring-ring">{["Excellent", "Very good", "Good", "Fair", "Needs support"].map((value) => <option key={value}>{value}</option>)}</select></td>)}<td className="px-3 py-3"><input value={profile.remark} onChange={(event) => updateProfile(student.id, "remark", event.target.value)} placeholder="Add a short remark" className="h-9 w-full min-w-64 rounded-md border border-input bg-background/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></td></tr> }) : register.map((student) => { const coupon = dailyFeeCoupons.find((item) => item.studentId === student.id); const status = coupon?.status ?? "unpaid"; return <tr key={student.id} className="hover:bg-muted/30"><td className="px-5 py-3"><p className="font-medium">{student.name}</p><p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{student.admissionNumber}</p></td><td className="px-5 py-3 font-mono text-xs text-secondary-foreground">{coupon?.code ?? "—"}</td><td className="px-5 py-3 text-xs text-muted-foreground">{coupon?.paidAt ?? "—"}</td><td className="px-5 py-3"><span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", status === "paid" ? "bg-emerald-500/10 text-emerald-700" : status === "pending" ? "bg-amber-500/10 text-amber-700" : "bg-rose-500/10 text-rose-700")}>{status === "paid" ? "Paid" : status === "pending" ? "Awaiting confirmation" : "Not paid"}</span></td></tr>; })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>{tab === "register" ? `${presentCount} present · ${lateCount} late · ${absentCount} absent` : tab === "grades" ? gradeView === "scores" ? `${subject}: coursework /50 + exam ÷ 2 = final /100` : "Teacher assessments used in the terminal report" : `${paidDailyFees} paid · ${dailyFeeCoupons.filter((coupon) => coupon.status === "unpaid").length} not paid · ${dailyFeeCoupons.filter((coupon) => coupon.status === "pending").length} awaiting confirmation`}</span><span>Showing 8 of 42 students</span></div>
        </section>
      </main>
    </div>
  );
}
