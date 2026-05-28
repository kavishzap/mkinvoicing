import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  SALES_ORDER_PAYMENT_LABELS,
  salesOrderFulfillmentDisplayLabel,
  salesOrderFulfillmentFilterLabel,
  salesOrderPaymentFilterLabel,
  type SalesOrderFulfillmentStatus,
  type SalesOrderPaymentStatusDb,
  type SalesOrderListRow,
} from "@/lib/sales-orders-service";
import { fetchProfile } from "@/lib/settings-service";

type Branding = {
  logoUrl?: string;
  brandColor?: string;
  companyName?: string;
  email?: string;
};

async function fetchBranding(): Promise<Branding | undefined> {
  try {
    const res = await fetch("/api/branding", { method: "GET", cache: "no-store" });
    if (!res.ok) return undefined;
    return (await res.json()) as Branding;
  } catch {
    return undefined;
  }
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

function formatGeneratedDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatListDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}

const tableHeadColor: [number, number, number] = [59, 130, 246];

/**
 * Branded sales order list PDF (same header treatment as customer list / invoice bar).
 */
export async function buildSalesOrdersListPdfDoc(params: {
  rows: SalesOrderListRow[];
  fulfillmentFilter: SalesOrderFulfillmentStatus | "all";
  paymentFilter: SalesOrderPaymentStatusDb | "all";
  searchQuery: string;
}): Promise<jsPDF> {
  const { rows, fulfillmentFilter, paymentFilter, searchQuery } = params;
  const [prof, brandingRes] = await Promise.all([fetchProfile(), fetchBranding()]);
  const branding = brandingRes ?? {};
  const brandColor = branding.brandColor || "#0F172A";
  const acctType = prof?.accountType ?? "individual";
  const fallbackName =
    acctType === "company" ? prof?.companyName : prof?.fullName;
  const senderName = branding.companyName || fallbackName || "Your Company";
  const senderEmail = prof?.email || branding.email || "";
  const resolvedLogo =
    branding.logoUrl ||
    (prof as { logoUrl?: string })?.logoUrl ||
    "/kredence.png";

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;
  const rightX = pageW - M;

  doc.setFillColor(brandColor);
  doc.rect(0, 0, pageW, 60, "F");

  const logoImg = resolvedLogo ? await imageUrlToDataURL(resolvedLogo) : undefined;
  if (logoImg?.dataUrl) {
    doc.addImage(logoImg.dataUrl, logoImg.fmt, M, 14, 48, 48, undefined, "FAST");
  }

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold").setFontSize(16).text(senderName, M + 60, 28);
  doc.setFont("helvetica", "normal").setFontSize(10);
  if (senderEmail) doc.text(senderEmail, M + 60, 44);

  doc.setFont("helvetica", "bold").setFontSize(22).text("SALES ORDERS", rightX, 30, {
    align: "right",
    baseline: "middle",
  });
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Generated: ${formatGeneratedDate(new Date())}`, rightX, 48, {
    align: "right",
  });

  doc.setTextColor("#000000");

  const filterBits: string[] = [];
  if (fulfillmentFilter !== "all") {
    filterBits.push(
      `Fulfillment: ${salesOrderFulfillmentFilterLabel(fulfillmentFilter)}`,
    );
  }
  if (paymentFilter !== "all") {
    filterBits.push(
      `Payment: ${salesOrderPaymentFilterLabel(paymentFilter)}`,
    );
  }
  const q = searchQuery.trim();
  if (q) filterBits.push(`Search: "${q}"`);
  const subtitle = [
    `${rows.length} order${rows.length === 1 ? "" : "s"}`,
    ...filterBits,
  ].join("  •  ");
  let y = 78;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.setTextColor(60);
  doc.text(subtitle, M, y);
  doc.setTextColor(0);
  y += 18;

  const body = rows.map((r) => [
    r.number,
    r.clientName || "—",
    r.address || "—",
    r.cityName || "—",
    r.createdByName || "—",
    formatListDate(r.deliveryDate),
    salesOrderFulfillmentDisplayLabel(r.fulfillmentStatus),
    SALES_ORDER_PAYMENT_LABELS[r.paymentStatus] ?? r.paymentStatus,
    formatMoney(r.total, r.currency),
  ]);

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Order #",
        "Customer",
        "Address",
        "City",
        "Created by",
        "Delivery date",
        "Fulfillment",
        "Payment",
        "Total",
      ],
    ],
    body,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: tableHeadColor,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [250, 250, 251] },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 118 },
      2: { cellWidth: 78 },
      3: { cellWidth: 88 },
      4: { cellWidth: 72 },
      5: { cellWidth: 100 },
      6: { cellWidth: 58 },
      7: { cellWidth: 72, halign: "right" },
    },
    margin: { left: M, right: M },
    didDrawPage: () => {
      const pn = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`Page ${pn}`, pageW - M, pageH - 14, { align: "right" });
      doc.setTextColor(0);
    },
  });

  return doc;
}
