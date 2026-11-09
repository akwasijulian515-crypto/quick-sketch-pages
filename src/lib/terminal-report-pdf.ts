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

function levelBadge(score: number) {
  if (score >= 80) return "HP";
  if (score >= 68) return "P";
  if (score >= 54) return "AP";
  if (score >= 40) return "D";
  return "E";
}

function reportPalette(primaryColor: string): {
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
  const pale = selected.map((channel) => Math.round(channel * 0.08 + 255 * 0.92)) as [
    number,
    number,
    number,
  ];
  return { deep, pale };
}

function singleLine(doc: jsPDF, value: string, width: number) {
  const lines = doc.splitTextToSize(value || "-", width) as string[];
  const line = lines[0] ?? "-";
  return lines.length > 1 ? `${line.slice(0, -1)}…` : line;
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
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  for (const [index, report] of reports.entries()) {
    const crestImage = await loadCrestImage(report.crestUrl);
    if (index > 0) doc.addPage();
    drawSinglePageReport(doc, report, crestImage);
  }
  const filename =
    reports.length === 1
      ? `${first.student.replaceAll(" ", "-")}-${resolveReportTemplate(first.template)}-terminal-report.pdf`
      : `${first.className.replaceAll(" ", "-")}-terminal-reports.pdf`;
  doc.save(filename);
}

function drawSinglePageReport(
  doc: jsPDF,
  report: TerminalReportPdfData,
  crestImage: string | null,
) {
  const template = resolveReportTemplate(report.template);
  const { deep, pale } = reportPalette(report.primaryColor);
  const ink: [number, number, number] = [28, 42, 35];
  const muted: [number, number, number] = [95, 108, 102];
  const rule: [number, number, number] = [218, 224, 220];
  const gazette = template === "gazette";
  const ledger = template === "ledger";
  const font = gazette ? "times" : "helvetica";

  doc.setFont(font, "normal");
  if (gazette) {
    doc.setDrawColor(165, 138, 78);
    doc.setLineWidth(0.8);
    doc.rect(7, 7, 196, 283);
    doc.setLineWidth(0.3);
    doc.rect(9, 9, 192, 279);
  } else if (!ledger) {
    doc.setFillColor(...pale);
    doc.rect(0, 0, 210, 26, "F");
  }

  const headerY = gazette ? 14 : 11;
  if (crestImage) {
    const dimensions = doc.getImageProperties(crestImage);
    const scale = Math.min(14 / dimensions.width, 14 / dimensions.height);
    const width = dimensions.width * scale;
    const height = dimensions.height * scale;
    doc.addImage(crestImage, "PNG", gazette ? 105 - width / 2 : 14, headerY, width, height);
  }

  doc.setTextColor(...deep);
  doc.setFont(font, "bold");
  doc.setFontSize(gazette ? 14 : 13);
  const titleX = gazette ? 105 : crestImage ? 32 : 14;
  const titleY = gazette ? headerY + 18 : headerY + 6;
  const titleMaxWidth = gazette ? 170 : crestImage ? 160 : 182;
  doc.text(
    singleLine(doc, report.schoolName, titleMaxWidth),
    titleX,
    titleY,
    gazette ? { align: "center" } : {},
  );

  doc.setFont(font, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...muted);
  const subtitleY = titleY + 5;
  const subtitle = `OFFICIAL TERMINAL ASSESSMENT REPORT · ${report.term.toUpperCase()}`;
  doc.text(subtitle, gazette ? 105 : titleX, subtitleY, gazette ? { align: "center" } : {});
  if (report.fictional) {
    doc.setFontSize(7);
    doc.setTextColor(175, 110, 30);
    doc.text(
      "FICTIONAL PREVIEW SAMPLE · NOT AN OFFICIAL RECORD",
      gazette ? 105 : 196,
      subtitleY,
      gazette ? { align: "center" } : { align: "right" },
    );
  }

  doc.setDrawColor(...deep);
  doc.setLineWidth(0.4);
  const dividerY = gazette ? subtitleY + 4 : 29;
  doc.line(14, dividerY, 196, dividerY);

  const infoY = dividerY + 3;
  const infoHeight = 11;
  doc.setFillColor(...pale);
  doc.roundedRect(14, infoY, 182, infoHeight, 1.5, 1.5, "F");
  const fields = [
    { label: "LEARNER NAME", value: report.student },
    { label: "CLASS", value: report.className },
    { label: "ADMISSION NO.", value: report.admission },
    { label: "ATTENDANCE", value: report.attendance || "-" },
  ];
  fields.forEach((field, index) => {
    const x = 18 + index * 45;
    doc.setFont(font, "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...deep);
    doc.text(field.label, x, infoY + 4);
    doc.setFont(font, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...ink);
    doc.text(singleLine(doc, field.value, 42), x, infoY + 8.5);
  });

  let y = infoY + infoHeight + 4;
  doc.setFont(font, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...deep);
  doc.text("ACADEMIC PERFORMANCE & SUBJECT ASSESSMENT", 14, y);
  y += 2.5;

  const columns = ledger
    ? [14, 60, 76, 92, 108, 124, 142, 158, 174, 196]
    : [14, 88, 112, 136, 156, 172, 196];
  const headers = ledger
    ? [
        "Subject",
        "Test /10",
        "Proj /20",
        "Group /10",
        "HW /10",
        "Class /50",
        "Exam /50",
        "Total",
        "Level",
      ]
    : ["Subject", "Teacher / Remark", "Class /50", "Exam /50", "Total", "Level"];
  doc.setFillColor(...deep);
  doc.rect(14, y, 182, 6, "F");
  doc.setFont(font, "bold");
  doc.setFontSize(ledger ? 6 : 6.5);
  doc.setTextColor(255, 255, 255);
  headers.forEach((header, index) => {
    const rightAligned = index >= (ledger ? 1 : 2);
    const x = rightAligned ? (columns[index + 1] ?? 196) - 2 : (columns[index] ?? 14) + 2;
    doc.text(header, x, y + 4.2, rightAligned ? { align: "right" } : {});
  });
  y += 6;

  const fixedSectionsHeight = 57;
  const minimumRowHeight = 3.2;
  const availableRowsHeight = 250 - y - fixedSectionsHeight;
  const rowHeight =
    report.results.length > 8 ? Math.min(6, availableRowsHeight / report.results.length) : 6;
  if (report.results.length && rowHeight < minimumRowHeight)
    throw new Error(
      `This report has ${report.results.length} subjects, which cannot fit legibly on one A4 page.`,
    );
  const rowFontSize = Math.min(7.5, 5 + rowHeight * 0.42);

  report.results.forEach((result, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 248);
      doc.rect(14, y, 182, rowHeight, "F");
    }

    doc.setFont(font, "normal");
    doc.setFontSize(rowFontSize);
    doc.setTextColor(...ink);
    const subject = singleLine(doc, result.subject, ledger ? 44 : 70);
    doc.text(subject, 16, y + rowHeight * 0.7);

    const parts = [result.classTest, result.project, result.groupWork, result.homework];
    const classScore = parts.every((part) => typeof part === "number")
      ? parts.reduce<number>((sum, part) => sum + (part ?? 0), 0)
      : null;
    const examScore = typeof result.exam === "number" ? result.exam / 2 : null;
    const format = (value: number | null | undefined) =>
      value == null ? "-" : Number(value.toFixed(1)).toString();
    const level = levelBadge(result.score);

    if (ledger) {
      const values = [
        ...parts.map(format),
        format(classScore),
        format(examScore),
        format(result.score),
        level,
      ];
      values.forEach((value, valueIndex) => {
        const x = (columns[valueIndex + 2] ?? 196) - 2;
        doc.text(value, x, y + rowHeight * 0.7, { align: "right" });
      });
    } else {
      doc.setFontSize(Math.min(6.3, rowFontSize));
      doc.setTextColor(...muted);
      const note = result.remark || result.teacher || "-";
      doc.text(singleLine(doc, note, 22), columns[1]! + 2, y + rowHeight * 0.7);

      doc.setFontSize(rowFontSize);
      doc.setTextColor(...ink);
      [format(classScore), format(examScore), format(result.score), level].forEach(
        (value, valueIndex) => {
          const x = (columns[valueIndex + 3] ?? 196) - 2;
          doc.text(value, x, y + rowHeight * 0.7, { align: "right" });
        },
      );
    }

    doc.setDrawColor(...rule);
    doc.setLineWidth(0.15);
    doc.line(14, y + rowHeight, 196, y + rowHeight);
    y += rowHeight;
  });

  y += 3;
  const average = report.results.length
    ? `${(report.results.reduce((sum, result) => sum + result.score, 0) / report.results.length).toFixed(1)}%`
    : "-";
  const boxWidth = (182 - 4) / 3;
  const summaryHeight = 15;
  const summaryX = [14, 14 + boxWidth + 2, 14 + (boxWidth + 2) * 2];
  summaryX.forEach((x) => {
    doc.setFillColor(...pale);
    doc.roundedRect(x, y, boxWidth, summaryHeight, 1, 1, "F");
  });

  doc.setFont(font, "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...deep);
  doc.text("OVERALL AVERAGE", summaryX[0]! + 3, y + 4.5);
  doc.setFontSize(11);
  doc.text(average, summaryX[0]! + 3, y + 11.5);

  doc.setFontSize(6.5);
  doc.text("CONDUCT & ATTITUDE", summaryX[1]! + 3, y + 4.5);
  doc.setFont(font, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...ink);
  doc.text(`Conduct: ${singleLine(doc, report.conduct, 48)}`, summaryX[1]! + 3, y + 8.5);
  doc.text(`Attitude: ${singleLine(doc, report.attitude, 48)}`, summaryX[1]! + 3, y + 12.5);

  doc.setFont(font, "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(...deep);
  doc.text("INTEREST & RECOMMENDATION", summaryX[2]! + 3, y + 4.5);
  doc.setFont(font, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...ink);
  doc.text(`Interest: ${singleLine(doc, report.interest, 48)}`, summaryX[2]! + 3, y + 8.5);
  doc.text(
    `Status: ${singleLine(doc, report.promotionStatus || "-", 48)}`,
    summaryX[2]! + 3,
    y + 12.5,
  );
  y += summaryHeight + 3.5;

  const remarkWidth = (182 - 3) / 2;
  const remarkHeight = 26;
  const remarks = [
    { title: "CLASS TEACHER'S REMARKS", text: report.teacherRemark || "-" },
    { title: "HEADTEACHER'S REMARKS", text: report.headteacherRemark || "-" },
  ];
  remarks.forEach((remark, index) => {
    const x = 14 + index * (remarkWidth + 3);
    doc.setDrawColor(...rule);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, remarkWidth, remarkHeight, 1, 1, "D");
    doc.setFont(font, "bold");
    doc.setFontSize(7);
    doc.setTextColor(...deep);
    doc.text(remark.title, x + 3, y + 4.5);
    doc.setFont(font, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...ink);
    const lines = doc.splitTextToSize(remark.text, remarkWidth - 6) as string[];
    const visibleLines = lines.slice(0, 4);
    if (lines.length > visibleLines.length && visibleLines.length > 0) {
      visibleLines[visibleLines.length - 1] = `${visibleLines[visibleLines.length - 1]}…`;
    }
    doc.text(visibleLines, x + 3, y + 9.5);
  });
  y += remarkHeight + 4;

  doc.setFillColor(244, 246, 244);
  doc.rect(14, y, 182, 5, "F");
  doc.setFont(font, "bold");
  doc.setFontSize(5.8);
  doc.setTextColor(...muted);
  doc.text(
    "NaCCA SCALE: HP 80-100% (Highly Proficient) | P 68-79% (Proficient) | AP 54-67% (Approaching) | D 40-53% (Developing) | E <40% (Emerging)",
    105,
    y + 3.5,
    { align: "center" },
  );

  const signatureY = Math.max(y + 12, 272);
  doc.setDrawColor(...rule);
  doc.setLineWidth(0.3);
  doc.line(18, signatureY, 82, signatureY);
  doc.line(128, signatureY, 192, signatureY);
  doc.setFont(font, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...ink);
  doc.text("Class Teacher's Signature", 32, signatureY + 4);
  doc.text("Headteacher's Signature & Stamp", 136, signatureY + 4);
}
