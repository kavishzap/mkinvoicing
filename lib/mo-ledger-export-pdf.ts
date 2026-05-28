import type jsPDF from "jspdf";

/** Dark header bar for MoLedger PDF exports (brand strip + title). */
export function drawMoLedgerExportPdfHeader(
  doc: jsPDF,
  opts: {
    margin: number;
    pageW: number;
    rightTitle: string;
    rightSubtitle?: string;
    leftSubtitle?: string;
  }
) {
  const { margin, pageW, rightTitle, rightSubtitle, leftSubtitle } = opts;
  const rightX = pageW - margin;
  const brandColor = "#0F172A";
  doc.setFillColor(brandColor);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("MoLedger", margin, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(leftSubtitle ?? "Operations export", margin, 46);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(rightTitle, rightX, 30, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (rightSubtitle) doc.text(rightSubtitle, rightX, 46, { align: "right" });
  doc.setTextColor("#000000");
}
