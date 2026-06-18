import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ProductListStatus, ProductRow } from "@/lib/products-service";
import {
  fetchDocumentBranding,
  type DocumentBranding,
} from "@/lib/branding-service";
import { fetchProfile } from "@/lib/settings-service";

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

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "MUR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function statusFilterLabel(status: ProductListStatus): string {
  if (status === "all") return "All products";
  if (status === "active") return "Active";
  return "Inactive";
}

const tableHeadColor: [number, number, number] = [59, 130, 246];

/**
 * Branded product list PDF (same header pattern as customers / sales orders lists).
 * Columns match the products table: Name, SKU, Unit, Cost, Sale, Status.
 */
export async function buildProductsListPdfDoc(params: {
  rows: ProductRow[];
  statusFilter: ProductListStatus;
  searchQuery: string;
}): Promise<jsPDF> {
  const { rows, statusFilter, searchQuery } = params;
  const [prof, brandingRes] = await Promise.all([
    fetchProfile(),
    fetchDocumentBranding(),
  ]);
  const branding: DocumentBranding = brandingRes ?? {};
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

  doc.setFont("helvetica", "bold").setFontSize(22).text("PRODUCTS", rightX, 30, {
    align: "right",
    baseline: "middle",
  });
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Generated: ${formatGeneratedDate(new Date())}`, rightX, 48, {
    align: "right",
  });

  doc.setTextColor("#000000");

  const filterBits: string[] = [];
  if (statusFilter !== "active") {
    filterBits.push(`Status: ${statusFilterLabel(statusFilter)}`);
  }
  const q = searchQuery.trim();
  if (q) filterBits.push(`Search: "${q}"`);
  const subtitle = [
    `${rows.length} product${rows.length === 1 ? "" : "s"}`,
    ...filterBits,
  ].join("  •  ");
  let y = 78;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.setTextColor(60);
  doc.text(subtitle, M, y);
  doc.setTextColor(0);
  y += 18;

  const body = rows.map((p) => [
    p.name,
    p.sku ?? "",
    p.unit,
    formatMoney(p.costPrice, p.currency),
    formatMoney(p.salePrice, p.currency),
    p.isActive ? "Active" : "Inactive",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Name", "SKU", "Unit", "Cost", "Sale", "Status"]],
    body,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4 },
    headStyles: {
      fillColor: tableHeadColor,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [250, 250, 251] },
    columnStyles: {
      0: { cellWidth: 200 },
      1: { cellWidth: 100 },
      2: { cellWidth: 56 },
      3: { cellWidth: 100, halign: "right" },
      4: { cellWidth: 100, halign: "right" },
      5: { cellWidth: 72 },
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
