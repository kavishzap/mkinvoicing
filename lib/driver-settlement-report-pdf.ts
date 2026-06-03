import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DriverSettlementReportData } from "@/lib/driver-settlement-report-service";
import { DELIVERY_NOTE_STATUS_LABELS } from "@/lib/deliveries-service";
import type { Profile } from "@/lib/settings-service";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function imageUrlToDataURL(
  url: string,
): Promise<{ dataUrl: string; fmt: "PNG" | "JPEG" } | undefined> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const fmt: "PNG" | "JPEG" = blob.type.includes("png") ? "PNG" : "JPEG";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { dataUrl, fmt };
  } catch {
    return undefined;
  }
}

const brandColor: [number, number, number] = [15, 23, 42];
const tableHeadColor: [number, number, number] = [59, 130, 246];

export async function generateDriverSettlementReportPDF(
  data: DriverSettlementReportData,
  profile: Profile | null,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;

  const companyName =
    data.companyName || (profile?.companyName ?? profile?.fullName ?? "Your Company");
  const resolvedLogo =
    (profile as { logoUrl?: string })?.logoUrl ||
    (profile as { logo_url?: string })?.logo_url ||
    "/kredence.png";

  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageW, 70, "F");

  const logoImg = resolvedLogo ? await imageUrlToDataURL(resolvedLogo) : undefined;
  if (logoImg?.dataUrl) {
    doc.addImage(logoImg.dataUrl, logoImg.fmt, M, 14, 48, 48, undefined, "FAST");
  }

  const headerTextX = M + 60;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text("DRIVER SETTLEMENT REPORT", headerTextX, 28);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(companyName, headerTextX, 44);
  doc.text(
    `Period: ${formatDate(data.startDate)} → ${formatDate(data.endDate)}`,
    headerTextX,
    56,
  );

  const rightX = pageW - M;
  doc.setFontSize(9);
  doc.text(`Currency: ${data.currency}`, rightX, 26, { align: "right" });
  doc.text(`Generated: ${formatDate(data.generatedOn)}`, rightX, 38, { align: "right" });
  doc.text(`Settlements: ${data.summary.settlementCount}`, rightX, 50, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 95;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Summary", M, y);
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(9);
  const summaryLines = [
    `Total to owner: ${formatCurrency(data.summary.totalAmountToOwner, data.currency)}`,
    `Cash received: ${formatCurrency(data.summary.totalCash, data.currency)}`,
    `Bank received: ${formatCurrency(data.summary.totalBank, data.currency)}`,
    `Linked orders total: ${formatCurrency(data.summary.totalLinkedOrders, data.currency)}`,
    `Driver cash collected (snapshot): ${formatCurrency(data.summary.totalSettlementCashTotal, data.currency)}`,
    `Driver daily rates (snapshot): ${formatCurrency(data.summary.totalDriverDailyRate, data.currency)}`,
  ];
  for (const line of summaryLines) {
    doc.text(line, M, y);
    y += 12;
  }

  y += 8;

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Settled",
        "Delivery",
        "Driver",
        "Status",
        "Del. date",
        "Orders",
        "Linked total",
        "Cash coll.",
        "Daily rate",
        "To owner",
        "Cash",
        "Bank",
        "Bank ref",
        "Recorded by",
      ],
    ],
    body: data.rows.map((row) => [
      formatDateTime(row.settlementCreatedAt),
      row.deliveryId.slice(0, 8),
      row.driverDisplay,
      DELIVERY_NOTE_STATUS_LABELS[row.deliveryStatus] ?? row.deliveryStatus,
      formatDate(row.deliveryDate ?? ""),
      String(row.orderCount),
      row.linkedOrdersTotal != null
        ? formatCurrency(row.linkedOrdersTotal, row.currency)
        : "—",
      row.settlementCashTotal != null
        ? formatCurrency(row.settlementCashTotal, row.currency)
        : "—",
      row.driverDailyRate != null
        ? formatCurrency(row.driverDailyRate, row.currency)
        : "—",
      formatCurrency(row.amountToOwner, row.currency),
      formatCurrency(row.cashAmount, row.currency),
      formatCurrency(row.bankTransferAmount, row.currency),
      row.bankReference ?? "—",
      row.recordedByDisplay,
    ]),
    margin: { left: M, right: M },
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: tableHeadColor, textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const filename = `driver-settlement-report-${data.startDate}-to-${data.endDate}.pdf`;
  doc.save(filename);
}
