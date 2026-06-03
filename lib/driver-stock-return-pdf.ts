import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawMoLedgerExportPdfHeader } from "@/lib/mo-ledger-export-pdf";
import {
  DELIVERY_NOTE_STATUS_LABELS,
  type DeliveryDetail,
  type DriverStockReturnLine,
} from "@/lib/deliveries-service";
import { SALES_ORDER_FULFILLMENT_LABELS } from "@/lib/sales-orders-service";

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

function fulfillmentLabel(status: string) {
  const key = status as keyof typeof SALES_ORDER_FULFILLMENT_LABELS;
  return SALES_ORDER_FULFILLMENT_LABELS[key] ?? status;
}

export type DriverStockReturnPdfInput = {
  delivery: Pick<
    DeliveryDetail,
    | "id"
    | "driverDisplay"
    | "status"
    | "createdAt"
    | "createdByDisplay"
    | "deliveryDate"
  >;
  lines: DriverStockReturnLine[];
  availableByProduct: Record<string, number>;
  /** Product id → return qty field value (may be blank). */
  returnQtys: Record<string, string>;
};

export function generateDriverStockReturnPdf(
  input: DriverStockReturnPdfInput,
  mode: "download" | "print" = "download"
): { filename: string; mode: "download" | "print" | "print-fallback" } {
  const { delivery, lines, availableByProduct, returnQtys } = input;

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  drawMoLedgerExportPdfHeader(doc, {
    margin,
    pageW,
    leftSubtitle: "Driver stock return",
    rightTitle: "RETURN DRIVER STOCK",
    rightSubtitle: delivery.driverDisplay,
  });

  let y = 88;
  doc.setFont("helvetica", "bold").setFontSize(11).text("Summary", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  y += 22;

  const metaBody: string[][] = [
    ["Delivery note", delivery.id],
    ["Status", DELIVERY_NOTE_STATUS_LABELS[delivery.status]],
    ["Driver", delivery.driverDisplay],
    ["Created", fmtWhen(delivery.createdAt)],
    ["Created by", delivery.createdByDisplay?.trim() || "—"],
    ["Scheduled delivery date", fmtScheduleDay(delivery.deliveryDate)],
    ["Products on sheet", String(lines.length)],
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

  doc.setFont("helvetica", "bold").setFontSize(11).text("Stock to return", margin, y2);
  y2 += 14;

  const tableHead = [
    "Product",
    "Sales order",
    "Status",
    "Order total",
    "Line qty",
    "On driver",
    "Return qty",
  ];

  const tableBody: string[][] = [];

  if (lines.length === 0) {
    tableBody.push(["—", "—", "—", "—", "—", "—", "No lines"]);
  } else {
    for (const l of lines) {
      const onDriver = String(availableByProduct[l.productId] ?? 0);
      const returnRaw = returnQtys[l.productId]?.trim();
      const returnQty =
        returnRaw === "" || returnRaw == null ? "0" : returnRaw;
      const soRows =
        l.salesOrders.length > 0
          ? l.salesOrders
          : [
              {
                salesOrderId: "",
                salesOrderNumber: "—",
                salesOrderTotal: 0,
                currency: "MUR",
                qty: 0,
                fulfillmentStatus: "pending" as const,
              },
            ];

      soRows.forEach((so, idx) => {
        tableBody.push([
          idx === 0 ? l.productName : "",
          so.salesOrderNumber || "—",
          so.salesOrderId ? fulfillmentLabel(so.fulfillmentStatus) : "—",
          so.salesOrderId
            ? fmtMoneyCurrency(so.salesOrderTotal, so.currency)
            : "—",
          so.salesOrderId ? String(so.qty) : "—",
          idx === 0 ? onDriver : "",
          idx === 0 ? returnQty : "",
        ]);
      });
    }
  }

  autoTable(doc, {
    startY: y2,
    margin: { left: margin, right: margin },
    head: [tableHead],
    body: tableBody,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4,
      lineColor: 230,
      lineWidth: 0.3,
      valign: "top",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 72 },
      2: { cellWidth: 88 },
      3: { cellWidth: 72 },
      4: { cellWidth: 44, halign: "right" },
      5: { cellWidth: 52, halign: "right" },
      6: { cellWidth: 52, halign: "right" },
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

  const safeId = delivery.id.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 32);
  const filename = `DriverStockReturn-${safeId}-${new Date().toISOString().slice(0, 10)}.pdf`;

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
