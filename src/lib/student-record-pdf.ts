import { jsPDF } from "jspdf";

type StudentPdfProfile = {
  name: string;
  studentId: string;
  className: string;
  status: string;
  dob: string;
  gender: string;
  guardian: string;
  guardianRelationship: string;
  phone: string;
  address: string;
  emergencyContact: string;
  medicalNote: string;
};

type StudentPdfAttendance = {
  attendance_date: string;
  class_name: string;
  status: string;
  note: string | null;
};

type StudentPdfGrade = {
  subject_name: string;
  class_name: string;
  term_name: string;
  academic_year_name: string;
  class_test_score: number | string | null;
  project_score: number | string | null;
  homework_score: number | string | null;
  group_work_score: number | string | null;
  exam_score: number | string | null;
  total_score: number | string | null;
  performance_level: string | null;
};

type StudentPdfPayment = {
  receipt_number: string | null;
  amount: number | string;
  currency: string;
  category: string;
  method: string;
  status: string;
  paid_at: string;
  daily_fee_date: string | null;
  fee_description: string;
  class_name: string | null;
  term_name: string | null;
  academic_year_name: string | null;
};

type StudentPdfTotal = {
  currency: string;
  payment_count: number;
  verified_count: number;
  pending_count: number;
  verified_amount: number | string;
  pending_amount: number | string;
};

type StudentPdfFeeBalance = {
  fee_description: string;
  term_name: string;
  academic_year_name: string;
  currency: string;
  arrears_sources: string | null;
  base_amount_due: number | string;
  arrears_amount: number | string;
  paid_amount: number | string;
  pending_amount: number | string;
  balance_due: number | string;
};

export function downloadStudentRecordPdf({
  schoolName,
  primaryColor,
  student,
  attendance,
  grades,
  financialRecords,
  financialTotals,
  financialBalances,
}: {
  schoolName: string;
  primaryColor: string;
  student: StudentPdfProfile;
  attendance: StudentPdfAttendance[];
  grades: StudentPdfGrade[];
  financialRecords: StudentPdfPayment[];
  financialTotals: StudentPdfTotal[];
  financialBalances: StudentPdfFeeBalance[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const palette = pdfPalette(primaryColor);
  let y = 0;

  function drawHeader() {
    doc.setFillColor(...palette.deep);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setFillColor(...palette.primary);
    doc.rect(0, 30, pageWidth, 2, "F");
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 6, 18, 18, 3, 3, "F");
    doc.setTextColor(...palette.deep);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(schoolInitials(schoolName), margin + 9, 17, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text(doc.splitTextToSize(schoolName, contentWidth - 30), margin + 25, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("STUDENT RECORD", pageWidth - margin, 23, { align: "right" });
    y = 40;
  }

  function ensureSpace(height: number) {
    if (y + height <= pageHeight - 17) return;
    doc.addPage();
    drawHeader();
  }

  function addSectionTitle(title: string) {
    ensureSpace(13);
    doc.setFillColor(...palette.pale);
    doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, "F");
    doc.setTextColor(...palette.deep);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), margin + 3, y + 6);
    y += 13;
  }

  function addDetailRows(rows: Array<[string, string]>) {
    const gap = 5;
    const columnWidth = (contentWidth - gap) / 2;
    for (let index = 0; index < rows.length; index += 2) {
      const first = rows[index]!;
      const second = rows[index + 1];
      const firstLines = doc.splitTextToSize(first[1] || "Not recorded", columnWidth - 8);
      const secondLines = second ? doc.splitTextToSize(second[1] || "Not recorded", columnWidth - 8) : [];
      const rowHeight = Math.max(firstLines.length, secondLines.length, 1) * 4 + 9;
      ensureSpace(rowHeight + 2);
      addDetailCard(margin, y, columnWidth, rowHeight, first[0], firstLines);
      if (second) addDetailCard(margin + columnWidth + gap, y, columnWidth, rowHeight, second[0], secondLines);
      y += rowHeight + 2;
    }
  }

  function addDetailCard(x: number, top: number, width: number, height: number, label: string, value: string[]) {
    doc.setDrawColor(225, 231, 227);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, top, width, height, 1.5, 1.5, "FD");
    doc.setTextColor(105, 117, 109);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x + 4, top + 4);
    doc.setTextColor(33, 46, 38);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(value, x + 4, top + 9);
  }

  function addTableSection(title: string, headers: string[], rows: string[][], columnWidths: number[]) {
    addSectionTitle(title);
    if (rows.length === 0) {
      ensureSpace(9);
      doc.setTextColor(105, 117, 109);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("No saved records.", margin, y + 2);
      y += 8;
      return;
    }
    drawTableRow(headers, columnWidths, true);
    rows.forEach((row, index) => drawTableRow(row, columnWidths, false, index % 2 === 1));

    function drawTableRow(cells: string[], widths: number[], heading: boolean, alternate = false) {
      const padding = 2.4;
      const lineHeight = 3.6;
      const cellLines = cells.map((cell, index) =>
        doc.splitTextToSize(cell || "—", Math.max(widths[index]! - padding * 2, 8)),
      );
      const rowHeight = Math.max(7, Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + padding * 2);
      ensureSpace(rowHeight);
      if (heading) doc.setFillColor(...palette.deep);
      else if (alternate) doc.setFillColor(246, 249, 247);
      else doc.setFillColor(255, 255, 255);
      doc.setDrawColor(224, 230, 226);
      doc.rect(margin, y, contentWidth, rowHeight, heading || alternate ? "FD" : "D");
      let x = margin;
      cells.forEach((_, index) => {
        const width = widths[index]!;
        if (index > 0) doc.line(x, y, x, y + rowHeight);
        doc.setTextColor(...(heading ? [255, 255, 255] as [number, number, number] : [39, 52, 44] as [number, number, number]));
        doc.setFont("helvetica", heading ? "bold" : "normal");
        doc.setFontSize(heading ? 7 : 7.2);
        doc.text(cellLines[index]!, x + padding, y + padding + 2.3);
        x += width;
      });
      y += rowHeight;
    }
  }

  drawHeader();
  doc.setTextColor(...palette.deep);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(student.name, margin, y + 6);
  doc.setTextColor(100, 112, 104);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Admission no. ${student.studentId}  |  ${student.className}  |  ${student.status}`, margin, y + 12);
  y += 20;

  addSectionTitle("Student information");
  addDetailRows([
    ["Date of birth", student.dob],
    ["Gender", student.gender],
    ["Guardian", student.guardian],
    ["Relationship", student.guardianRelationship],
    ["Guardian phone", student.phone],
    ["Emergency contact", student.emergencyContact],
    ["Address", student.address],
    ["Medical notes", student.medicalNote],
  ]);

  addTableSection(
    "Attendance history",
    ["Date", "Class", "Status", "Note"],
    attendance.map((record) => [
      record.attendance_date.slice(0, 10),
      record.class_name,
      record.status,
      record.note ?? "",
    ]),
    [30, 42, 28, contentWidth - 100],
  );

  addTableSection(
    "Grades",
    ["Subject / term", "Class test", "Project", "Homework", "Group", "Exam", "Total", "Level"],
    grades.map((record) => [
      `${record.subject_name}\n${record.class_name} - ${record.term_name}, ${record.academic_year_name}`,
      pdfValue(record.class_test_score),
      pdfValue(record.project_score),
      pdfValue(record.homework_score),
      pdfValue(record.group_work_score),
      pdfValue(record.exam_score),
      pdfValue(record.total_score),
      record.performance_level ?? "",
    ]),
    [contentWidth - 83, 12, 12, 14, 12, 12, 13, 8],
  );

  addSectionTitle("Payment summary");
  if (financialTotals.length === 0) {
    ensureSpace(9);
    doc.setTextColor(105, 117, 109);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("No saved payment records.", margin, y + 2);
    y += 8;
  } else {
    addDetailRows(financialTotals.map((total) => [
      `${total.currency} - ${total.payment_count} payments`,
      `Verified: ${pdfMoney(total.verified_amount, total.currency)} (${total.verified_count})  |  Pending: ${pdfMoney(total.pending_amount, total.currency)} (${total.pending_count})`,
    ]));
  }

  addTableSection(
    "Term-based school-fee balances",
    ["Fee / term", "Current", "Arrears", "Paid", "Pending", "Balance due"],
    financialBalances.map((balance) => [
      `${balance.fee_description}\n${balance.academic_year_name} · ${balance.term_name}${balance.arrears_sources ? `\nCarried from: ${balance.arrears_sources}` : ""}`,
      pdfMoney(balance.base_amount_due, balance.currency),
      pdfMoney(balance.arrears_amount, balance.currency),
      pdfMoney(balance.paid_amount, balance.currency),
      pdfMoney(balance.pending_amount, balance.currency),
      pdfMoney(balance.balance_due, balance.currency),
    ]),
    [contentWidth - 105, 21, 21, 21, 21, 21],
  );

  addTableSection(
    "Payment history",
    ["Date", "Fee", "Amount", "Method", "Status", "Receipt"],
    financialRecords.map((record) => [
      (record.daily_fee_date || record.paid_at).slice(0, 10),
      `${record.fee_description}${record.class_name ? `\n${record.class_name}` : ""}${record.term_name ? ` - ${record.term_name}` : ""}`,
      pdfMoney(record.amount, record.currency),
      record.method.replaceAll("_", " "),
      record.status,
      record.receipt_number ?? "Not issued",
    ]),
    [24, 54, 27, 25, 22, contentWidth - 152],
  );

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(220, 227, 222);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setTextColor(115, 126, 118);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Generated by Klasora", margin, pageHeight - 7);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  const safeAdmissionNumber = student.studentId.replace(/[^a-z0-9_-]/gi, "-") || "student";
  doc.save(`student-record-${safeAdmissionNumber}.pdf`);
}

export function downloadFinancialRecordsPdf({
  schoolName,
  primaryColor,
  studentName,
  admissionNumber,
  className,
  termName,
  records,
  totals,
  feeBalances,
}: {
  schoolName: string;
  primaryColor: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  termName: string;
  records: StudentPdfPayment[];
  totals: StudentPdfTotal[];
  feeBalances: StudentPdfFeeBalance[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const palette = pdfPalette(primaryColor);
  let y = 0;

  function drawHeader() {
    doc.setFillColor(...palette.deep);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setFillColor(...palette.primary);
    doc.rect(0, 30, pageWidth, 2, "F");
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 6, 18, 18, 3, 3, "F");
    doc.setTextColor(...palette.deep);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(schoolInitials(schoolName), margin + 9, 17, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.text(doc.splitTextToSize(schoolName, contentWidth - 30), margin + 25, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("FINANCIAL RECORDS", pageWidth - margin, 23, { align: "right" });
    y = 40;
  }

  function ensureSpace(height: number) {
    if (y + height <= pageHeight - 17) return;
    doc.addPage();
    drawHeader();
  }

  function addSectionTitle(title: string) {
    ensureSpace(13);
    doc.setFillColor(...palette.pale);
    doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, "F");
    doc.setTextColor(...palette.deep);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), margin + 3, y + 6);
    y += 13;
  }

  function addTableSection(title: string, headers: string[], rows: string[][], widths: number[]) {
    addSectionTitle(title);
    const tableRows = rows.length ? [headers, ...rows] : [["No saved records.", ...Array(headers.length - 1).fill("")]];
    tableRows.forEach((cells, rowIndex) => {
      const heading = rowIndex === 0 && rows.length > 0;
      const padding = 2;
      const lineHeight = 3.5;
      const cellLines = cells.map((cell, index) =>
        doc.splitTextToSize(cell || "—", Math.max(widths[index]! - padding * 2, 8)),
      );
      const rowHeight = Math.max(7, Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + padding * 2);
      ensureSpace(rowHeight);
      if (heading) doc.setFillColor(...palette.deep);
      else if (rowIndex % 2 === 0) doc.setFillColor(246, 249, 247);
      else doc.setFillColor(255, 255, 255);
      doc.setDrawColor(224, 230, 226);
      doc.rect(margin, y, contentWidth, rowHeight, heading || rowIndex % 2 === 0 ? "FD" : "D");
      let x = margin;
      cells.forEach((_, index) => {
        const width = widths[index]!;
        if (index > 0) doc.line(x, y, x, y + rowHeight);
        doc.setTextColor(...(heading ? [255, 255, 255] as [number, number, number] : [39, 52, 44] as [number, number, number]));
        doc.setFont("helvetica", heading ? "bold" : "normal");
        doc.setFontSize(heading ? 7 : 6.8);
        doc.text(cellLines[index]!, x + padding, y + padding + 2.3);
        x += width;
      });
      y += rowHeight;
    });
  }

  drawHeader();
  doc.setTextColor(...palette.deep);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(studentName, margin, y + 6);
  doc.setTextColor(100, 112, 104);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Admission no. ${admissionNumber}  |  ${className ?? "Class not recorded"}  |  ${termName}`, margin, y + 12);
  y += 20;

  addTableSection(
    "Payment totals",
    ["Currency", "Payments", "Verified", "Pending"],
    totals.map((total) => [
      total.currency,
      String(total.payment_count),
      `${pdfMoney(total.verified_amount, total.currency)} (${total.verified_count})`,
      `${pdfMoney(total.pending_amount, total.currency)} (${total.pending_count})`,
    ]),
    [contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.3, contentWidth * 0.3],
  );
  addTableSection(
    "Term-based school-fee balances",
    ["Fee / term", "Current", "Arrears", "Paid", "Pending", "Balance"],
    feeBalances.map((balance) => [
      `${balance.fee_description}\n${balance.academic_year_name} · ${balance.term_name}${balance.arrears_sources ? `\nCarried from: ${balance.arrears_sources}` : ""}`,
      pdfMoney(balance.base_amount_due, balance.currency),
      pdfMoney(balance.arrears_amount, balance.currency),
      pdfMoney(balance.paid_amount, balance.currency),
      pdfMoney(balance.pending_amount, balance.currency),
      pdfMoney(balance.balance_due, balance.currency),
    ]),
    [contentWidth - 105, 21, 21, 21, 21, 21],
  );
  addTableSection(
    "Payment history",
    ["Date", "Category", "Fee", "Term", "Receipt", "Amount", "Method", "Status"],
    records.map((record) => [
      (record.daily_fee_date || record.paid_at).slice(0, 10),
      record.category.replaceAll("_", " "),
      `${record.fee_description}${record.class_name ? ` · ${record.class_name}` : ""}`,
      [record.academic_year_name, record.term_name].filter(Boolean).join(" · ") || "—",
      record.receipt_number ?? "Not issued",
      pdfMoney(record.amount, record.currency),
      record.method.replaceAll("_", " "),
      record.status,
    ]),
    [21, 19, 41, 31, 23, 18, 17, 12],
  );

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(220, 227, 222);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setTextColor(115, 126, 118);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Generated by Klasora", margin, pageHeight - 7);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  const safeAdmissionNumber = admissionNumber.replace(/[^a-z0-9_-]/gi, "-") || "student";
  doc.save(`financial-records-${safeAdmissionNumber}.pdf`);
}

function pdfPalette(color: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  const primary = match
    ? (match[1]!.match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16)) as [number, number, number])
    : [31, 92, 59] as [number, number, number];
  const luminance = (0.2126 * primary[0] + 0.7152 * primary[1] + 0.0722 * primary[2]) / 255;
  const deep = primary.map((channel) => Math.round(channel * (luminance > 0.42 ? 0.58 : 0.78))) as [number, number, number];
  const pale = primary.map((channel) => Math.round(channel * 0.12 + 255 * 0.88)) as [number, number, number];
  return { primary, deep, pale };
}

function schoolInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
}

function pdfValue(value: number | string | null) {
  return value == null ? "" : String(value);
}

function pdfMoney(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}
