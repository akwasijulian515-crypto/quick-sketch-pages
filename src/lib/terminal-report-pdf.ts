import { jsPDF } from "jspdf";
import { resolveReportTemplate, type ReportTemplate } from "./report-design";

export type TerminalReportSubject = {
  subject: string;
  score: number;
  teacher: string;
  remark: string;
  classTest?: number | null;
  project?: number | null;
  groupWork?: number | null;
  homework?: number | null;
  exam?: number | null;
};
export type TerminalReportPdfData = {
  schoolName: string;
  primaryColor: string;
  crestUrl?: string | null;
  student: string;
  admission: string;
  className: string;
  term: string;
  attendance: string;
  conduct: string;
  attitude: string;
  interest: string;
  teacherRemark: string;
  headteacherRemark?: string;
  template?: ReportTemplate;
  fictional?: boolean;
  promotionStatus?: string;
  results: TerminalReportSubject[];
};

function level(score: number) {
  return score >= 80
    ? "HP - Highly Proficient"
    : score >= 68
      ? "P - Proficient"
      : score >= 54
        ? "AP - Approaching Proficiency"
        : score >= 40
          ? "D - Developing"
          : "E - Emerging";
}

function reportPalette(primaryColor: string): {
  primary: [number, number, number];
  deep: [number, number, number];
  pale: [number, number, number];
} {
  const match = /^#([0-9a-f]{6})$/i.exec(primaryColor);
  const selected = match?.[1]
    ? ((match[1].match(/.{2}/g) ?? []).map((channel) => Number.parseInt(channel, 16)) as [
        number,
        number,
        number,
      ])
    : ([31, 92, 59] as [number, number, number]);
  const luminance = (0.2126 * selected[0] + 0.7152 * selected[1] + 0.0722 * selected[2]) / 255;
  const deep = selected.map((channel) =>
    Math.round(channel * (luminance > 0.42 ? 0.58 : 0.78)),
  ) as [number, number, number];
  const pale = selected.map((channel) => Math.round(channel * 0.12 + 255 * 0.88)) as [
    number,
    number,
    number,
  ];
  return { primary: selected, deep, pale };
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 4.5,
) {
  const lines = doc.splitTextToSize(text, width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

async function loadCrestImage(crestUrl: string | null | undefined) {
  if (!crestUrl) return null;
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = crestUrl;
  try {
    await image.decode();
  } catch {
    throw new Error("The school badge could not be loaded for the terminal report.");
  }

  const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the school badge for the terminal report.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export async function downloadTerminalReports(reports: TerminalReportPdfData[]) {
  const first = reports[0];
  if (!first) return;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  for (const [index, report] of reports.entries()) {
    const crestImage = await loadCrestImage(report.crestUrl);
    if (index > 0) doc.addPage();
    drawReport(doc, report, crestImage);
  }
  const filename =
    reports.length === 1
      ? `${first.student.replaceAll(" ", "-")}-${resolveReportTemplate(first.template)}-terminal-report.pdf`
      : `${first.className.replaceAll(" ", "-")}-terminal-reports.pdf`;
  doc.save(filename);
}

function drawReport(doc: jsPDF, report: TerminalReportPdfData, crestImage: string | null) {
  const template = resolveReportTemplate(report.template);
  const { deep, pale } = reportPalette(report.primaryColor);
  const ink: [number, number, number] = [28, 42, 35];
  const rule: [number, number, number] = [211, 218, 213];
  const gazette = template === "gazette";
  const ledger = template === "ledger";
  const font = gazette ? "times" : "helvetica";
  let y = gazette ? 58 : 42;
  doc.setFont(font, "normal");
  if (gazette) {
    doc.setDrawColor(156, 130, 72);
    doc.rect(8, 8, 194, 281); doc.rect(10, 10, 190, 277);
  } else if (!ledger) {
    doc.setFillColor(...pale); doc.rect(0, 0, 210, 33, "F");
  }
  if (crestImage) {
    const dimensions = doc.getImageProperties(crestImage);
    const scale = Math.min(16 / dimensions.width, 16 / dimensions.height);
    const width = dimensions.width * scale; const height = dimensions.height * scale;
    doc.addImage(crestImage, "PNG", gazette ? 105 - width / 2 : 15, gazette ? 14 : 9, width, height);
  }
  doc.setTextColor(...deep); doc.setFont(font, "bold"); doc.setFontSize(16);
  const nameX = gazette ? 105 : crestImage ? 36 : 15;
  const nameY = gazette ? 38 : 17;
  const nameLines = doc.splitTextToSize(report.schoolName, gazette ? 170 : 155) as string[];
  doc.text(nameLines.slice(0, 2), nameX, nameY, gazette ? { align: "center" } : {});
  doc.setFont(font, "normal"); doc.setFontSize(9);
  doc.text(`Terminal report - ${report.term}`, gazette ? 105 : 15, gazette ? 49 : 29, gazette ? { align: "center" } : {});
  doc.setDrawColor(...deep); doc.line(15, y - 4, 195, y - 4);
  if (report.fictional) {
    doc.setFontSize(8); doc.setTextColor(100, 105, 100);
    doc.text("FICTIONAL SAMPLE - NOT AN OFFICIAL REPORT", 105, y, { align: "center" }); y += 7;
  }
  const freshPage = () => {
    doc.addPage(); doc.setFont(font, "bold"); doc.setFontSize(10); doc.setTextColor(...deep);
    doc.text(`${report.student} - Terminal report (continued)`, 15, 16); y = 26;
  };
  const ensure = (height: number) => { if (y + height > 266) freshPage(); };
  const textBlock = (label: string, value: string) => {
    doc.setFont(font, "bold"); doc.setFontSize(9);
    const lines = doc.splitTextToSize(value || "-", 176) as string[];
    ensure(12); doc.setTextColor(...deep); doc.text(label, 15, y); y += 6;
    doc.setFont(font, "normal"); doc.setTextColor(...ink);
    for (const line of lines) { ensure(5); doc.text(line, 15, y); y += 4.5; }
    y += 5;
  };
  const identities = [["LEARNER", report.student], ["CLASS", report.className], ["ADMISSION", report.admission]];
  const identityLines = identities.map(([, value]) => doc.splitTextToSize(value || "-", 54) as string[]);
  const identityHeight = Math.max(...identityLines.map((lines) => lines.length)) * 4 + 13;
  if (!ledger) { doc.setFillColor(...pale); doc.roundedRect(15, y, 180, identityHeight, 2, 2, "F"); }
  identities.forEach(([label], index) => {
    doc.setFontSize(7); doc.setTextColor(...deep); doc.text(label ?? "", 19 + index * 60, y + 6);
    doc.setFontSize(9); doc.setTextColor(...ink); doc.text(identityLines[index] ?? [], 19 + index * 60, y + 12);
  });
  y += identityHeight + 10;
  doc.setFont(font, "bold"); doc.setFontSize(11); doc.setTextColor(...deep); doc.text("Academic performance", 15, y); y += 6;
  const columns = ledger ? [15, 62, 79, 99, 116, 133, 151, 169, 184, 195] : [15, 112, 137, 161, 180, 195];
  const labels = ledger ? ["Subject", "Test /10", "Project /20", "Group /10", "HW /10", "Class /50", "Exam /50", "Total", "Level"] : ["Subject", "Class /50", "Exam /50", "Total", "Level"];
  const tableHead = () => {
    doc.setFillColor(...pale); doc.rect(15, y, 180, 9, "F"); doc.setFont(font, "bold"); doc.setFontSize(ledger ? 6 : 8); doc.setTextColor(...deep);
    labels.forEach((label, index) => doc.text(label, (columns[index] ?? 15) + 2, y + 6)); y += 14;
  };
  tableHead();
  for (const result of report.results) {
    const subjectLines = doc.splitTextToSize(result.subject, ledger ? 43 : 90) as string[];
    const height = Math.max(10, subjectLines.length * 4 + 4);
    if (y + height > 266) { freshPage(); tableHead(); }
    doc.setFont(font, "normal"); doc.setFontSize(8); doc.setTextColor(...ink);
    doc.text(subjectLines, 17, y);
    const parts = [result.classTest, result.project, result.groupWork, result.homework];
    const classScore = parts.every((part) => typeof part === "number") ? parts.reduce<number>((sum, part) => sum + (part ?? 0), 0) : null;
    const exam = typeof result.exam === "number" ? result.exam / 2 : null;
    const format = (value: number | null | undefined) => value == null ? "-" : Number(value.toFixed(1)).toString();
    const values = ledger ? [...parts, classScore, exam, result.score].map(format) : [classScore, exam, result.score].map(format);
    values.push(level(result.score).split(" - ")[0] ?? "-");
    values.forEach((value, index) => doc.text(value, (columns[index + 1] ?? 15) + 2, y));
    doc.setDrawColor(...rule); doc.line(15, y + height - 5, 195, y + height - 5); y += height;
  }
  y += 5;
  const average = report.results.length ? (report.results.reduce((sum, item) => sum + item.score, 0) / report.results.length).toFixed(1) + "%" : "-";
  textBlock("Overall average", average);
  textBlock("Proficiency key", "HP: Highly Proficient | P: Proficient | AP: Approaching Proficiency | D: Developing | E: Emerging");
  textBlock("Attendance", report.attendance);
  textBlock("Learner profile", `Conduct: ${report.conduct || "-"}\nAttitude: ${report.attitude || "-"}\nInterest: ${report.interest || "-"}`);
  textBlock("Class teacher's remarks", report.teacherRemark);
  if (report.headteacherRemark) textBlock("Headteacher's remarks", report.headteacherRemark);
  textBlock("Recommendation", report.promotionStatus ?? "-");
  if (report.results.some((result) => result.remark || result.teacher)) {
    textBlock("Subject notes", report.results.map((result) => `${result.subject}${result.teacher ? ` (${result.teacher})` : ""}: ${result.remark || "-"}`).join("\n"));
  }
  ensure(24); y += 12; doc.setDrawColor(...rule); doc.line(18, y, 87, y); doc.line(120, y, 192, y);
  doc.setFontSize(8); doc.setTextColor(...ink); doc.text("Class teacher's signature", 22, y + 5); doc.text("Headteacher's signature", 125, y + 5);
}
