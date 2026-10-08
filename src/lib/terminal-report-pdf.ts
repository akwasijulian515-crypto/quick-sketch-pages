import { jsPDF } from "jspdf";

export type TerminalReportSubject = { subject: string; score: number; teacher: string; remark: string };
export type TerminalReportPdfData = { schoolName: string; primaryColor: string; student: string; admission: string; className: string; term: string; attendance: string; conduct: string; attitude: string; interest: string; teacherRemark: string; promotionStatus?: string; results: TerminalReportSubject[] };

function level(score: number) { return score >= 80 ? "HP - Highly Proficient" : score >= 68 ? "P - Proficient" : score >= 54 ? "AP - Approaching Proficiency" : score >= 40 ? "D - Developing" : "E - Emerging"; }

function reportPalette(primaryColor: string): { primary: [number, number, number]; deep: [number, number, number]; pale: [number, number, number] } {
  const match = /^#([0-9a-f]{6})$/i.exec(primaryColor);
  const selected = match
    ? (match[1]!.match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16)) as [number, number, number])
    : [31, 92, 59] as [number, number, number];
  const luminance = (0.2126 * selected[0] + 0.7152 * selected[1] + 0.0722 * selected[2]) / 255;
  const deep = selected.map((channel) => Math.round(channel * (luminance > 0.42 ? 0.58 : 0.78))) as [number, number, number];
  const pale = selected.map((channel) => Math.round(channel * 0.12 + 255 * 0.88)) as [number, number, number];
  return { primary: selected, deep, pale };
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 4.5) { const lines = doc.splitTextToSize(text, width) as string[]; doc.text(lines, x, y); return y + lines.length * lineHeight; }

export function downloadTerminalReports(reports: TerminalReportPdfData[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  reports.forEach((report, index) => { if (index > 0) doc.addPage(); drawReport(doc, report); });
  const filename = reports.length === 1 ? `${reports[0]!.student.replaceAll(" ", "-")}-terminal-report.pdf` : `${reports[0]!.className.replaceAll(" ", "-")}-terminal-reports.pdf`;
  doc.save(filename);
}

function drawReport(doc: jsPDF, report: TerminalReportPdfData) {
  const { primary, deep, pale } = reportPalette(report.primaryColor); const ink: [number, number, number] = [28, 42, 35];
  doc.setFillColor(...deep); doc.rect(0, 0, 210, 35, "F"); doc.setFillColor(...primary); doc.roundedRect(15, 10, 14, 14, 2, 2, "F"); doc.setTextColor(...deep); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("S", 19.5, 19.5); doc.setTextColor(255, 255, 255); doc.setFontSize(17); doc.text(report.schoolName, 35, 17); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Terminal report - ${report.term}`, 35, 24); doc.setFillColor(...primary); doc.rect(0, 35, 210, 1.5, "F"); doc.setTextColor(...ink); doc.setFontSize(9); doc.text("Standards-based learner report", 15, 44);
  doc.setFillColor(...pale); doc.roundedRect(15, 49, 180, 27, 2, 2, "F"); doc.setFontSize(8); doc.setTextColor(95, 108, 100); doc.text("LEARNER", 20, 57); doc.text("CLASS", 85, 57); doc.text("ADMISSION NO.", 140, 57); doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(report.student, 20, 64); doc.text(report.className, 85, 64); doc.text(report.admission, 140, 64); doc.setFont("helvetica", "normal");
  doc.setTextColor(...deep); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Academic performance", 15, 88); doc.setFillColor(...deep); doc.rect(15, 92, 180, 8, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.text("SUBJECT", 18, 97); doc.text("SCORE", 71, 97); doc.text("LEVEL", 91, 97); doc.text("TEACHER", 132, 97); doc.text("REMARK", 158, 97);
  let y = 106; doc.setTextColor(...ink); doc.setFont("helvetica", "normal"); report.results.forEach((result, row) => { const remarkLines = doc.splitTextToSize(result.remark, 35) as string[]; const height = Math.max(8, remarkLines.length * 3.8 + 3); if (row % 2 === 0) { doc.setFillColor(247, 249, 247); doc.rect(15, y - 4, 180, height, "F"); } doc.setFontSize(8); doc.text(result.subject, 18, y); doc.text(`${result.score}%`, 71, y); doc.text(level(result.score), 91, y); doc.text(result.teacher, 132, y); doc.text(remarkLines, 158, y); y += height; });
  y += 8; doc.setDrawColor(218, 225, 219); doc.line(15, y, 195, y); y += 10; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Learner profile", 15, y); doc.text("Attendance & recommendation", 110, y); y += 7; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(95, 108, 100); doc.text("Conduct", 15, y); doc.text("Attitude", 15, y + 7); doc.text("Interest", 15, y + 14); doc.setTextColor(...ink); doc.text(report.conduct, 48, y); doc.text(report.attitude, 48, y + 7); doc.text(report.interest, 48, y + 14); doc.setTextColor(95, 108, 100); doc.text("Attendance", 110, y); doc.text("Promotion", 110, y + 7); doc.setTextColor(...ink); doc.text(report.attendance, 145, y); doc.text(report.promotionStatus ?? "—", 145, y + 7); doc.setTextColor(95, 108, 100); doc.text("Class teacher's remark", 15, y + 25); doc.setTextColor(...ink); doc.setFontSize(8); writeWrapped(doc, report.teacherRemark, 15, y + 31, 180); doc.setDrawColor(120, 133, 124); doc.line(20, 274, 85, 274); doc.line(125, 274, 190, 274); doc.setFontSize(8); doc.setTextColor(95, 108, 100); doc.text("Class teacher's signature", 30, 279); doc.text("School Administrator's signature", 130, 279);
}
