import { jsPDF } from "jspdf";

export type PaymentReceiptData = {
  schoolName: string;
  primaryColor: string;
  receiptNumber: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  feeDescription: string;
  amount: number;
  currency: string;
  method: string;
  paidAt: string;
  status: string;
  feeCategory: "school_fee" | "other_fee";
};

function palette(color: string): { primary: [number, number, number]; deep: [number, number, number]; pale: [number, number, number] } {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  const primary = match
    ? (match[1]!.match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16)) as [number, number, number])
    : [31, 92, 59] as [number, number, number];
  const luminance = (0.2126 * primary[0] + 0.7152 * primary[1] + 0.0722 * primary[2]) / 255;
  const deep = primary.map((channel) => Math.round(channel * (luminance > 0.42 ? 0.58 : 0.78))) as [number, number, number];
  const pale = primary.map((channel) => Math.round(channel * 0.12 + 255 * 0.88)) as [number, number, number];
  return { primary, deep, pale };
}

export function downloadPaymentReceipt(receipt: PaymentReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { primary, deep, pale } = palette(receipt.primaryColor);
  const ink: [number, number, number] = [28, 42, 35];
  const status = receipt.status === "verified"
    ? "VALIDATED PAYMENT RECEIPT"
    : receipt.status === "voided"
      ? "VOIDED - NOT A VALID RECEIPT"
      : "PENDING ADMIN VALIDATION - NOT YET VERIFIED";

  doc.setFillColor(...deep);
  doc.rect(0, 0, 210, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(receipt.schoolName, 16, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(receipt.feeCategory === "school_fee" ? "SCHOOL FEE PAYMENT" : "EXAMINATION / OTHER FEE PAYMENT", 16, 28);
  doc.setFillColor(...primary);
  doc.rect(0, 38, 210, 2, "F");

  doc.setTextColor(...deep);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("PAYMENT RECEIPT", 16, 55);
  doc.setFillColor(...pale);
  doc.roundedRect(16, 62, 178, 18, 2, 2, "F");
  doc.setTextColor(...deep);
  doc.setFontSize(9);
  doc.text(status, 21, 73);

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const details: Array<[string, string]> = [
    ["Receipt number", receipt.receiptNumber],
    ["Date received", new Date(receipt.paidAt).toLocaleString()],
    ["Student", receipt.studentName],
    ["Admission number", receipt.admissionNumber],
    ["Class", receipt.className],
    ["Fee", receipt.feeDescription],
    ["Payment method", receipt.method.replaceAll("_", " ")],
  ];
  let y = 96;
  for (const [label, value] of details) {
    doc.setTextColor(95, 108, 100);
    doc.text(label, 20, y);
    doc.setTextColor(...ink);
    doc.text(doc.splitTextToSize(value, 125), 75, y);
    y += 12;
  }

  doc.setFillColor(...pale);
  doc.roundedRect(16, y + 2, 178, 25, 2, 2, "F");
  doc.setTextColor(...deep);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("AMOUNT RECEIVED", 22, y + 12);
  doc.setFontSize(17);
  doc.text(`${receipt.currency} ${receipt.amount.toFixed(2)}`, 22, y + 22);

  doc.setTextColor(95, 108, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const note = receipt.status === "verified"
    ? "This payment has been validated by a school administrator."
    : receipt.status === "voided"
      ? "This payment was rejected by a school administrator. Retain this copy for audit purposes."
      : "This is a recording of payment pending independent school-admin validation. It is not yet an official verified receipt.";
  doc.text(doc.splitTextToSize(note, 178), 16, y + 40);
  doc.setDrawColor(120, 133, 124);
  doc.line(20, 265, 85, 265);
  doc.line(125, 265, 190, 265);
  doc.text("Finance officer", 20, 271);
  doc.text("School administrator", 125, 271);

  const safeNumber = receipt.receiptNumber.replace(/[^a-z0-9-]/gi, "-");
  doc.save(`${safeNumber}-receipt.pdf`);
}
