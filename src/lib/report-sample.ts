import type { TerminalReportPdfData } from "./terminal-report-pdf";

export function sampleReport(branding: { schoolName: string; primaryColor: string; crestUrl: string | null }): TerminalReportPdfData {
  return {
    ...branding, student: "Ama Mensah", admission: "DEMO-025", className: "Basic 5",
    term: "2025 / 2026 · Term 2", attendance: "58 / 60 days", conduct: "Respectful and responsible",
    attitude: "Enthusiastic learner", interest: "Reading and science", teacherRemark: "Ama contributes thoughtfully and works well with others. Continue building confidence in reading.",
    headteacherRemark: "A commendable term. Keep up your excellent effort!", promotionStatus: "Not yet determined", fictional: true,
    results: [
      { subject: "English Language", score: 85, teacher: "Mrs. Adjei", remark: "Excellent progress", classTest: 8, project: 18, groupWork: 8, homework: 8, exam: 86 },
      { subject: "Mathematics", score: 89, teacher: "Mr. Owusu", remark: "Strong problem-solving", classTest: 9, project: 18, groupWork: 9, homework: 8, exam: 90 },
      { subject: "Science", score: 82, teacher: "Mrs. Adjei", remark: "Curious and engaged", classTest: 8, project: 16, groupWork: 8, homework: 8, exam: 84 },
      { subject: "Social Studies", score: 84, teacher: "Mr. Owusu", remark: "Thoughtful contributions", classTest: 9, project: 17, groupWork: 8, homework: 9, exam: 82 },
    ],
  };
}