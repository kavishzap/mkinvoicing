import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PayslipWithEmployee } from "@/lib/payroll-runs-service";
import type { Profile } from "@/lib/settings-service";

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

function formatAddress(p: Profile | null): string {
  if (!p) return "";
  const parts: string[] = [];
  const line1 = p.address_line_1?.trim() || p.street?.trim();
  if (line1) parts.push(line1);
  if (p.address_line_2?.trim()) parts.push(p.address_line_2.trim());
  const cityLine = [p.city, p.postal].filter(Boolean).join(" ");
  if (cityLine) parts.push(cityLine.trim());
  if (p.country?.trim()) parts.push(p.country.trim());
  return parts.join(", ") || "";
}

function shortId(id: string, len = 8): string {
  return id.replace(/-/g, "").slice(0, len).toUpperCase();
}

export async function generatePayslipPDF(
  payslip: PayslipWithEmployee,
  month: number,
  year: number,
  profile: Profile | null
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 36;
  const tableWidth = pageW - 2 * M;
  const halfW = tableWidth / 2;

  const companyName = (profile?.companyName ?? profile?.fullName ?? "Your Company").toUpperCase();
  const currency = "MUR";
  const periodLabel = `END PAYMENT - ${MONTH_NAMES[month - 1] ?? ""} ${year}`;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);

  let y = 36;
  doc.rect(M, y, tableWidth, pageH - 2 * M - 8);

  y += 12;

  // ─── 1. HEADER ─────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(companyName, M, y);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(periodLabel, pageW - M, y, { align: "right" });
  y += 16;

  doc.line(M, y, pageW - M, y);
  y += 14;

  // ─── 2. EMPLOYEE INFORMATION (two columns) ─────────────
  const empNo = shortId(payslip.employee_id);
  const leftRows: [string, string][] = [
    ["EMPLOYEE NO.", empNo],
    ["NAME", (payslip.employee.full_name ?? "").toUpperCase()],
    ["IC NO.", "—"],
    ["DEPARTMENT", "—"],
    ["BASE RATE", formatAmount(payslip.basic_salary, currency)],
    ["WORKING DAYS", "—"],
  ];
  const rightRows: [string, string][] = [
    ["POSITION", (payslip.employee.position?.trim() ?? "—").toUpperCase()],
    ["EPF NO.", "—"],
    ["SOCSO NO.", "—"],
    ["TAX NO.", "—"],
  ];

  const empColW = (pageW - 2 * M - 24) / 2;
  const empBodyRows = leftRows.map(([k, v], i) => {
    const right = rightRows[i];
    return [k, v, "", right?.[0] ?? "", right?.[1] ?? ""];
  });
  autoTable(doc, {
    startY: y,
    body: empBodyRows,
    margin: { left: M, right: M },
    theme: "plain",
    showHead: false,
    columnStyles: {
      0: { cellWidth: 90, fontStyle: "bold", fontSize: 8, textColor: [100, 100, 100] },
      1: { cellWidth: empColW - 90, fontSize: 9 },
      2: { cellWidth: 24 },
      3: { cellWidth: 90, fontStyle: "bold", fontSize: 8, textColor: [100, 100, 100] },
      4: { cellWidth: empColW - 90, fontSize: 9 },
    },
    bodyStyles: { fontSize: 9 },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 14;

  // ─── 3. EARNINGS | DEDUCTION (side by side) ────────────
  const er: [string, string][] = [
    ["BASIC PAY", formatAmount(payslip.basic_salary, currency)],
    ["TRANSPORT ALLOWANCE", formatAmount(payslip.transport_allowance, currency)],
    ["OTHER ALLOWANCE", formatAmount(payslip.other_allowance, currency)],
  ];
  const dr: [string, string][] = [
    ["ADVANCE DEDUCTION", `-${formatAmount(payslip.advance_deduction, currency)}`],
    ["ABSENCE DEDUCTION", `-${formatAmount(payslip.absence_deduction, currency)}`],
    ["OTHER DEDUCTION", `-${formatAmount(payslip.other_deduction, currency)}`],
  ];

  const mainRows: [string, string, string, string, string][] = [];
  for (let i = 0; i < 3; i++) {
    mainRows.push([
      er[i][0],
      er[i][1],
      "|",
      dr[i][0],
      dr[i][1],
    ]);
  }
  mainRows.push(["", "", "|", "TOTAL DEDUCTION", `-${formatAmount(payslip.total_deductions, currency)}`]);
  mainRows.push(["GROSS PAY", formatAmount(payslip.gross_salary, currency), "|", "NET PAY", formatAmount(payslip.net_salary, currency)]);

  const amtColW = 72;
  const labelColW = (halfW - amtColW - 6);
  autoTable(doc, {
    startY: y,
    head: [["EARNINGS", "AMOUNT", "", "DEDUCTION", "AMOUNT"]],
    body: mainRows,
    margin: { left: M, right: M },
    tableWidth,
    theme: "plain",
    headStyles: {
      fillColor: [60, 60, 60],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: labelColW, fontStyle: "normal" },
      1: { cellWidth: amtColW, halign: "right" },
      2: { cellWidth: 12, halign: "center", fontSize: 8 },
      3: { cellWidth: labelColW, fontStyle: "normal" },
      4: { cellWidth: amtColW, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const row = data.row.index;
        const lastTwo = mainRows.length - 2;
        if (row >= lastTwo) {
          data.cell.styles.fontStyle = "bold";
          if (row === mainRows.length - 1 && (data.column.index === 3 || data.column.index === 4)) {
            data.cell.styles.fontSize = 10;
          }
        }
      }
    },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 18;

  // ─── 4. FOOTER: Employer contributions & Leave ─────────
  const footerY = Math.min(y, pageH - 95);

  autoTable(doc, {
    startY: footerY,
    head: [["EMPLOYER CONTRIBUTIONS", "AMOUNT"]],
    body: [
      ["EPF (E'YER)", "—"],
      ["SOCSO (E'YER)", "—"],
      ["EIS (E'YER)", "—"],
    ],
    margin: { left: M },
    tableWidth: halfW - 12,
    theme: "plain",
    headStyles: {
      fillColor: [80, 80, 80],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: "right", cellWidth: 70 },
    },
  });

  const leaveX = M + halfW + 12;
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(80, 80, 80);
  doc.text("LEAVE BALANCES", leaveX, footerY + 8);
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text("YTD AL", leaveX, footerY + 22);
  doc.text("—", leaveX + 60, footerY + 22, { align: "right" });
  doc.text("YTD MC", leaveX, footerY + 32);
  doc.text("—", leaveX + 60, footerY + 32, { align: "right" });

  // ─── 5. SIGNATURE LINES ────────────────────────────────
  const sigY = pageH - 50;
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(0, 0, 0);
  doc.text("APPROVED BY :", M, sigY);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100, 100, 100);
  doc.line(M, sigY + 4, M + 120, sigY + 4);

  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(0, 0, 0);
  doc.text("RECEIVED BY :", pageW - M - 120, sigY);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100, 100, 100);
  doc.line(pageW - M - 120, sigY + 4, pageW - M, sigY + 4);

  // Footer: company details, ref, Powered by
  const addr = formatAddress(profile);
  const hasCompanyInfo = companyName || addr || profile?.email?.trim() || profile?.phone?.trim();
  doc.setFontSize(7).setTextColor(140, 140, 140);
  doc.text("Powered by MoLedger", pageW / 2, pageH - 12, { align: "center" });
  doc.text(`Payslip ref: ${payslip.id} · Generated ${formatDate(new Date().toISOString().slice(0, 10))}`, pageW / 2, pageH - 24, { align: "center" });
  if (hasCompanyInfo) {
    doc.setFontSize(7).setTextColor(120, 120, 120);
    const details: string[] = [];
    if (companyName) details.push(companyName);
    if (addr) details.push(addr);
    if (profile?.email?.trim()) details.push(profile.email!.trim());
    if (profile?.phone?.trim()) details.push(profile.phone!.trim());
    doc.text(details.join(" · "), pageW / 2, pageH - 36, { align: "center" });
  }

  const safeName = payslip.employee.full_name.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Payslip-${safeName}-${MONTH_NAMES[month - 1]}-${year}.pdf`;
  doc.save(filename);
}
