import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawMoLedgerExportPdfHeader } from "@/lib/mo-ledger-export-pdf";
import {
  DELIVERY_NOTE_STATUS_LABELS,
  getDelivery,
  getDeliveryDriverSettlement,
  listDriverTeamMembers,
  type DeliveryDetail,
  type DeliveryListRow,
} from "@/lib/deliveries-service";

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtMoneyMur(n: number) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `MUR ${n.toFixed(2)}`;
  }
}

function fmtMoneyCurrency(n: number, currency: string) {
  const ccy = currency?.trim() || "MUR";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${ccy} ${n.toFixed(2)}`;
  }
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtScheduleDay(yyyyMmDd: string | null) {
  if (!yyyyMmDd?.trim()) return "—";
  try {
    return new Date(`${yyyyMmDd.trim()}T12:00:00`).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return yyyyMmDd;
  }
}

export type DriverBalanceSheetSource = Pick<
  DeliveryListRow,
  | "id"
  | "driverUserId"
  | "driverDisplay"
  | "driverStatus"
  | "totalAmount"
  | "totalAmountCashForSettlement"
> & {
  status?: DeliveryDetail["status"];
};

export async function generateDriverBalanceSheetPdf(
  listRow: DriverBalanceSheetSource,
  mode: "download" | "print" = "download"
): Promise<{ filename: string; mode: "download" | "print" | "print-fallback" }> {
  const [delivery, settlement, team] = await Promise.all([
    getDelivery(listRow.id),
    getDeliveryDriverSettlement(listRow.id),
    listDriverTeamMembers(),
  ]);
  if (!delivery) {
    throw new Error("Could not load this delivery.");
  }

  const teamRateRaw = team.find((t) => t.userId === listRow.driverUserId)?.driverRate;
  const teamRateNum = Number(teamRateRaw);
  const teamRate = Number.isFinite(teamRateNum) ? roundMoney2(teamRateNum) : null;
  const driverRateForPending =
    settlement?.driverDailyRate != null ? settlement.driverDailyRate : teamRate;
  const settlementCash = listRow.totalAmountCashForSettlement;
  const indicativeDue =
    driverRateForPending != null
      ? roundMoney2(settlementCash - driverRateForPending)
      : null;

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  drawMoLedgerExportPdfHeader(doc, {
    margin,
    pageW,
    leftSubtitle: "Driver balance export",
    rightTitle: "DRIVER BALANCE SHEET",
    rightSubtitle: delivery.driverDisplay,
  });

  let y = 88;
  doc.setFont("helvetica", "bold").setFontSize(11).text("Summary", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  y += 22;

  const metaBody: string[][] = [
    ["Delivery note status", DELIVERY_NOTE_STATUS_LABELS[delivery.status]],
    ["Driver balance collected (flag)", delivery.driverStatus ? "Yes" : "No"],
    ["Driver", delivery.driverDisplay],
    ["Created", fmtWhen(delivery.createdAt)],
    ["Created by", delivery.createdByDisplay || "—"],
    ["Scheduled delivery date", fmtScheduleDay(delivery.deliveryDate)],
    ["Sales orders on delivery", String(delivery.salesOrders.length)],
    ["Sum of order totals (linked + pinned)", fmtMoneyMur(listRow.totalAmount)],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Field", "Value"]],
    body: metaBody,
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      lineColor: 230,
      lineWidth: 0.3,
      valign: "top",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: { 0: { cellWidth: 220 }, 1: { cellWidth: "auto" } },
  });

  let y2 =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    y + 40;
  y2 += 20;

  let payRows: string[][];
  if (settlement) {
    const ccy = settlement.currency || "MUR";
    payRows = [
      ["Collection status", "Recorded — driver balance settled in app"],
      ["Settlement recorded at", fmtWhen(settlement.createdAt)],
      [
        "Driver daily rate (snapshot)",
        settlement.driverDailyRate != null
          ? fmtMoneyCurrency(settlement.driverDailyRate, ccy)
          : "—",
      ],
      ["Paid to owner in cash", fmtMoneyCurrency(settlement.cashAmount, ccy)],
      [
        "Paid to owner by bank transfer",
        fmtMoneyCurrency(settlement.bankTransferAmount, ccy),
      ],
      ["Due (driver balance)", fmtMoneyCurrency(settlement.dueAmount, ccy)],
      ["Bank reference", settlement.bankReference?.trim() || "—"],
      [
        "Cash + bank + due (return to owner)",
        fmtMoneyCurrency(
          roundMoney2(
            settlement.cashAmount +
              settlement.bankTransferAmount +
              settlement.dueAmount
          ),
          ccy
        ),
      ],
    ];
  } else if (listRow.driverStatus) {
    payRows = [
      [
        "Collection status",
        "Marked collected — no settlement row found (legacy or incomplete data)",
      ],
      ["Paid in cash", "—"],
      ["Paid by bank transfer", "—"],
    ];
  } else {
    payRows = [
      ["Collection status", "PENDING — driver balance not collected yet"],
      [
        "Driver daily rate (from company team)",
        teamRate != null ? fmtMoneyMur(teamRate) : "—",
      ],
      [
        "Indicative amount due to owner (cash orders − driver rate)",
        indicativeDue != null ? fmtMoneyMur(indicativeDue) : "—",
      ],
      ["Paid in cash", "— (pending)"],
      ["Paid by bank transfer", "— (pending)"],
    ];
  }

  doc.setFont("helvetica", "bold").setFontSize(11).text("Payment & collection", margin, y2);
  y2 += 14;

  autoTable(doc, {
    startY: y2,
    margin: { left: margin, right: margin },
    head: [["Item", "Detail"]],
    body: payRows,
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      lineColor: 230,
      lineWidth: 0.3,
      valign: "top",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: { 0: { cellWidth: 220 }, 1: { cellWidth: "auto" } },
    didParseCell: (data) => {
      if (
        data.section === "body" &&
        data.column.index === 1 &&
        data.row.index === 0
      ) {
        const raw = data.cell.raw;
        if (typeof raw === "string" && raw.includes("PENDING")) {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    },
  });

  const lastH = doc.internal.pageSize.getHeight();
  const lastW = doc.internal.pageSize.getWidth();
  doc.setDrawColor(230);
  doc.line(margin, lastH - 42, lastW - margin, lastH - 42);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor("#64748B");
  doc.text("Powered by MoLedger", lastW / 2, lastH - 28, { align: "center" });
  doc.text(`Page ${doc.getNumberOfPages()}`, lastW - margin, lastH - 28, {
    align: "right",
  });
  doc.setTextColor(0);

  const safeId = listRow.id.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 32);
  const filename = `DriverBalanceSheet-${safeId}-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (mode === "print") {
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl, "_blank");
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => printWindow.print(), 250);
      };
      return { filename, mode: "print" };
    }
    doc.save(filename);
    return { filename, mode: "print-fallback" };
  }

  doc.save(filename);
  return { filename, mode: "download" };
}
