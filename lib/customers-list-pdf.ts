import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CustomerRow } from "@/lib/customers-service";
import {
  fetchDocumentBranding,
  type DocumentBranding,
} from "@/lib/branding-service";
import { fetchProfile } from "@/lib/settings-service";

async function imageUrlToDataURL(
  url: string
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

const tableHeadColor: [number, number, number] = [59, 130, 246];

/**
 * Branded customer list PDF (header matches invoice / sales order: logo bar + company identity).
 */
export async function buildCustomersListPdfDoc(params: {
  rows: CustomerRow[];
  typeFilter: "all" | "company" | "individual";
  searchQuery: string;
}): Promise<jsPDF> {
  const { rows, typeFilter, searchQuery } = params;
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

  doc.setFont("helvetica", "bold").setFontSize(22).text("CUSTOMERS", rightX, 30, {
    align: "right",
    baseline: "middle",
  });
  doc.setFont("helvetica", "normal").setFontSize(10);
  const generated = formatGeneratedDate(new Date());
  doc.text(`Generated: ${generated}`, rightX, 48, { align: "right" });

  doc.setTextColor("#000000");

  const filterBits: string[] = [];
  if (typeFilter !== "all") filterBits.push(`Type: ${typeFilter}`);
  const q = searchQuery.trim();
  if (q) filterBits.push(`Search: "${q}"`);
  const subtitle = [
    `${rows.length} customer${rows.length === 1 ? "" : "s"}`,
    ...filterBits,
  ].join("  •  ");
  let y = 78;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.setTextColor(60);
  doc.text(subtitle, M, y);
  doc.setTextColor(0);

  y += 18;

  const body = rows.map((c) => {
    const name =
      (c.type === "company" ? c.companyName : c.fullName)?.trim() || "";
    const contact = c.type === "company" ? c.contactName?.trim() || "" : "";
    const addr1 = (c.address_line_1 ?? "").trim();
    return [
      c.type === "company" ? "Company" : "Individual",
      name + (contact ? `\n${contact}` : ""),
      c.email ?? "",
      c.phone ?? "",
      c.cityName || c.city || "",
      addr1,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Type", "Name", "Email", "Phone", "City", "Address line 1"]],
    body,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4 },
    headStyles: {
      fillColor: tableHeadColor,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [250, 250, 251] },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 150 },
      2: { cellWidth: 150 },
      3: { cellWidth: 95 },
      4: { cellWidth: 95 },
      5: { cellWidth: "auto" },
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
