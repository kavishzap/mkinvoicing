import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import {
  DELIVERY_NOTE_STATUS_LABELS,
  type DeliveryDetail,
} from "@/lib/deliveries-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";

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

function pdfMoney(n: number, ccy: string | null | undefined) {
  const code =
    ccy && String(ccy).trim().length === 3
      ? String(ccy).trim().toUpperCase()
      : "MUR";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
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

function senderLabel(profile: Profile, branding: Branding): string {
  if (branding.companyName?.trim()) return branding.companyName.trim();
  return profile.accountType === "company"
    ? (profile.companyName ?? "").trim() || "Your Company"
    : (profile.fullName ?? "").trim() || "Your Company";
}

function senderEmail(profile: Profile, branding: Branding): string {
  return (
    branding.email?.trim() ||
    profile?.email?.trim() ||
    ""
  );
}

function drawListFooter(
  doc: jsPDF,
  margin: number,
  pageW: number,
  pageH: number
) {
  doc.setDrawColor(230);
  doc.line(margin, pageH - 50, pageW - margin, pageH - 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#94A3B8");
  doc.text("Powered by MoLedger", pageW / 2, pageH - 35, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor("#64748B");
  doc.text(`Page ${doc.getNumberOfPages()}`, pageW - margin, pageH - 24, {
    align: "right",
  });
  doc.setTextColor("#000000");
}

async function buildDeliveryNotePdf(
  delivery: DeliveryDetail,
  profile: Profile,
  branding: Branding
): Promise<jsPDF> {
  const brandColor = branding.brandColor || "#0F172A";
  const resolvedLogo =
    branding.logoUrl || profile?.logoUrl || "/kredence.png";

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

  const name = senderLabel(profile, branding);
  const email = senderEmail(profile, branding);

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold").setFontSize(16).text(name, M + 60, 28);
  doc.setFont("helvetica", "normal").setFontSize(10);
  if (email) doc.text(email, M + 60, 44);

  doc.setFont("helvetica", "bold").setFontSize(20).text("DELIVERY NOTE", rightX, 28, {
    align: "right",
    baseline: "middle",
  });
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(`Ref: ${delivery.id}`, rightX, 46, { align: "right" });

  doc.setTextColor("#000000");

  let y = 88;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Date: ${fmtWhen(delivery.createdAt)}`, M, y);
  doc.text(`Driver: ${delivery.driverDisplay}`, M + 220, y);
  doc.text(`Status: ${DELIVERY_NOTE_STATUS_LABELS[delivery.status]}`, M + 460, y);
  y += 8;

  const bodyRows: RowInput[] = delivery.salesOrders.map((so, index) => {
    const qty = (so.items ?? []).reduce(
      (sum, it) => sum + Number(it.quantity ?? 0),
      0
    );
    const productNames = (so.items ?? [])
      .map((it) => String(it.item ?? "").trim())
      .filter(Boolean)
      .join(", ");
    return [
      String(index + 1),
      so.number || "-",
      so.clientName || "-",
      so.addressLines || "-",
      so.phone || "-",
      String(qty),
      productNames || "-",
      pdfMoney(so.total, so.currency),
      "",
    ];
  });

  autoTable(doc, {
    head: [
      [
        "No",
        "Order No",
        "Name",
        "Address",
        "Phone",
        "Qty",
        "Products",
        "Amount",
        "Remark",
      ],
    ],
    body:
      bodyRows.length > 0
        ? bodyRows
        : [["1", "-", "No orders", "-", "-", "0", "-", pdfMoney(0, "MUR"), ""]],
    startY: y + 8,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3,
      lineColor: 80,
      lineWidth: 0.4,
      textColor: 20,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [226, 232, 240],
      textColor: 15,
      lineColor: 80,
      lineWidth: 0.5,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 24 },
      1: { cellWidth: 64 },
      2: { cellWidth: 84 },
      3: { cellWidth: 138 },
      4: { cellWidth: 68 },
      5: { halign: "right", cellWidth: 32 },
      6: { cellWidth: 116 },
      7: { halign: "right", cellWidth: 58 },
      8: { cellWidth: 92 },
    },
    margin: { left: M, right: M },
    theme: "grid",
  });

  const afterTable =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y;
  y = afterTable + 14;

  if (delivery.notes?.trim()) {
    doc.setFont("helvetica", "bold").setFontSize(10).text("Notes:", M, y);
    doc.setFont("helvetica", "normal").setFontSize(10);
    const noteLines = doc.splitTextToSize(delivery.notes.trim(), pageW - 2 * M - 40);
    doc.text(noteLines, M + 40, y);
    y += (Array.isArray(noteLines) ? noteLines.length : 1) * 12 + 12;
  }

  if (y > pageH - 200) {
    doc.addPage();
    y = M;
  }

  doc.setFont("helvetica", "bold").setFontSize(11).text("Acknowledgement", M, y);
  y += 14;
  doc.setFont("helvetica", "normal").setFontSize(9);
  const ack = doc.splitTextToSize(
    "I confirm that the goods listed above were prepared for dispatch as described. The driver acknowledges receipt of these items for delivery.",
    pageW - 2 * M
  );
  doc.text(ack, M, y);
  y += (Array.isArray(ack) ? ack.length : 1) * 12 + 20;

  const gap = 36;
  const colW = (pageW - 2 * M - gap) / 2;
  const xRight = M + colW + gap;

  doc.setFont("helvetica", "bold").setFontSize(10).text("Prepared by", M, y);
  doc.setFont("helvetica", "normal").setFontSize(10).text(delivery.createdByDisplay, M, y + 14);
  doc.setDrawColor(0);
  doc.line(M, y + 52, M + colW, y + 52);
  doc.setFontSize(8).setTextColor(80);
  doc.text("Signature and date", M, y + 64);
  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "bold").setFontSize(10).text("Driver", xRight, y);
  doc.setFont("helvetica", "normal").setFontSize(10).text(delivery.driverDisplay, xRight, y + 14);
  doc.line(xRight, y + 52, xRight + colW, y + 52);
  doc.setFontSize(8).setTextColor(80);
  doc.text("Driver signature", xRight, y + 64);
  doc.setTextColor(0, 0, 0);

  drawListFooter(doc, M, pageW, pageH);

  return doc;
}

export type DeliveryNotePdfResult =
  | { ok: true; mode: "print" }
  | { ok: true; mode: "download-fallback"; filename: string };

/**
 * Build a delivery note PDF (same stack as invoices: jsPDF + autotable) and
 * download or open the browser print dialog on the generated blob.
 */
export async function renderDeliveryNotePdf(
  delivery: DeliveryDetail,
  mode: "download" | "print"
): Promise<DeliveryNotePdfResult | void> {
  const [profile, brandingRaw] = await Promise.all([
    fetchProfile(),
    fetchBranding(),
  ]);
  const branding = brandingRaw ?? {};
  const doc = await buildDeliveryNotePdf(delivery, profile, branding);
  const safeName = delivery.id.replace(/[^a-zA-Z0-9-_]+/g, "_");
  const filename = `DeliveryNote-${safeName}.pdf`;

  if (mode === "download") {
    doc.save(filename);
    return;
  }

  const pdfBlob = doc.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const printWindow = window.open(pdfUrl, "_blank");
  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        URL.revokeObjectURL(pdfUrl);
      }, 250);
    };
    return { ok: true, mode: "print" };
  }
  doc.save(filename);
  return { ok: true, mode: "download-fallback", filename };
}
