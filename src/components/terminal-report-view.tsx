import { GraduationCap, Award } from "lucide-react";
import type { TerminalReportPdfData, TerminalReportSubject } from "@/lib/terminal-report-pdf";
import { resolveReportTemplate, type ReportTemplate } from "@/lib/report-design";

export function scoreLevel(score: number) {
  return score >= 80 ? "HP" : score >= 68 ? "P" : score >= 54 ? "AP" : score >= 40 ? "D" : "E";
}
export function assessmentValues(item: TerminalReportSubject) {
  const parts = [item.classTest, item.project, item.groupWork, item.homework];
  const classScore = parts.every((value) => typeof value === "number")
    ? parts.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  return [...parts, classScore, typeof item.exam === "number" ? item.exam / 2 : null];
}
const number = (value: number | null | undefined) => value == null ? "—" : Number(value.toFixed(1)).toString();

export function TerminalReportView({ report, template = "bento" }: { report: TerminalReportPdfData; template?: ReportTemplate }) {
  const design = resolveReportTemplate(template);
  const average = report.results.length ? report.results.reduce((sum, item) => sum + item.score, 0) / report.results.length : null;
  const ledger = design === "ledger";
  return (
    <article aria-label={`${design} terminal report for ${report.student}`} className={`terminal-document report-${design}`}>
      {report.fictional && <p className="report-sample-label">Fictional sample · Not an official report</p>}
      <header className="report-heading">
        <div className="report-crest">{report.crestUrl ? <img src={report.crestUrl} alt={`${report.schoolName} badge`} className="size-full object-contain" /> : <GraduationCap className="size-8" />}</div>
        <div className="min-w-0 flex-1"><h3 className="report-school">{report.schoolName}</h3><p className="mt-2 text-xs">Standards-based learner assessment</p></div>
        <div className="report-title"><p className="font-semibold">Terminal report</p><p className="mt-2 text-xs">{report.term}</p></div>
      </header>
      <div className="report-body">
        <dl className="report-identity">{[["Learner", report.student], ["Class", report.className], ["Admission no.", report.admission], ["Attendance", report.attendance]].map(([label, value]) => <div key={label}><dt className="report-label">{label}</dt><dd className="mt-1 text-sm font-semibold">{value || "—"}</dd></div>)}</dl>
        <div className="report-section-heading"><h4>Academic performance</h4><span>Class /50 + Exam /50</span></div>
        <table className="report-results-table">
          <thead><tr><th scope="col">Subject</th>{(ledger ? ["Test /10", "Project /20", "Group /10", "HW /10", "Class /50", "Exam /50"] : ["Class /50", "Exam /50"]).map((label) => <th scope="col" key={label}>{label}</th>)}<th scope="col">Total /100</th><th scope="col">Level</th></tr></thead>
          <tbody>{report.results.map((item) => <tr key={item.subject}><th scope="row">{item.subject}<p className="report-subject-note">{item.remark}</p>{item.teacher && <p className="report-subject-note">{item.teacher}</p>}</th>{(ledger ? assessmentValues(item) : assessmentValues(item).slice(4)).map((value, index) => <td key={index}>{number(value)}</td>)}<td className="font-semibold">{number(item.score)}</td><td><span className="report-level">{scoreLevel(item.score)}</span></td></tr>)}</tbody>
        </table>
        <div className="report-results-mobile">{report.results.map((item) => <div key={item.subject} className="report-subject-mobile"><div className="flex items-start justify-between gap-3"><h5 className="text-sm font-semibold">{item.subject}</h5><span className="report-level shrink-0">{number(item.score)} /100 · {scoreLevel(item.score)}</span></div><dl className={`mt-3 grid gap-3 ${ledger ? "grid-cols-3" : "grid-cols-2"}`}>{(ledger ? ["Test /10", "Project /20", "Group /10", "Homework /10", "Class /50", "Exam /50"] : ["Class /50", "Exam /50"]).map((label, index) => <div key={label}><dt className="report-label">{label}</dt><dd className="mt-1 text-sm tabular-nums">{number((ledger ? assessmentValues(item) : assessmentValues(item).slice(4))[index])}</dd></div>)}</dl><p className="report-subject-note mt-3">{item.remark}</p></div>)}</div>
        {!report.results.length && <p className="py-6 text-sm">No subject results available.</p>}
        <div className="report-summary"><div><p className="report-label">Overall average</p><p className="mt-1 text-2xl font-semibold tabular-nums">{average === null ? "—" : `${average.toFixed(1)}%`}</p></div><Award className="size-8" /><div className="text-right"><p className="report-label">Recommendation</p><p className="mt-1 text-sm">{report.promotionStatus || "—"}</p></div></div>
        <p className="report-legend">HP · Highly Proficient &nbsp; P · Proficient &nbsp; AP · Approaching Proficiency &nbsp; D · Developing &nbsp; E · Emerging</p>
        <dl className="report-profile">{[["Conduct", report.conduct], ["Attitude", report.attitude], ["Interest", report.interest]].map(([label, value]) => <div key={label}><dt className="report-label">{label}</dt><dd className="mt-2 text-sm">{value || "—"}</dd></div>)}</dl>
        <div className="report-remarks"><div><h4>Class teacher’s remarks</h4><p>{report.teacherRemark || "—"}</p></div>{report.headteacherRemark && <div><h4>Headteacher’s remarks</h4><p>{report.headteacherRemark}</p></div>}</div>
        <footer className="report-signatures"><div>Class teacher’s signature</div><div>Headteacher’s signature</div></footer>
        {design === "gazette" && <p className="report-seal"><Award className="size-4" /> {report.fictional ? "Demonstration school seal" : "School report"}</p>}
      </div>
    </article>
  );
}