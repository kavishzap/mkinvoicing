import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExpensePeriodFilter, ExpenseRow } from "@/lib/expenses-service";
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

function formatExpenseDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatAmount(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const tableHeadColor: [number, number, number] = [59, 130, 246];

/**
 * Branded expenses list PDF (header matches other list exports: logo bar + company identity).
 */
export async function buildExpensesListPdfDoc(params: {
  rows: ExpenseRow[];
  periodFilter: ExpensePeriodFilter;
  searchQuery: string;
}): Promise<jsPDF> {
  const { rows, periodFilter, searchQuery } = params;
  const [prof, brandingRes] = await Promise.all([fetchProfile(), fetchBranding()]);
  const branding = brandingRes ?? {};
  const brandColor = branding.brandColor || "#0F172A";
  const acctType = prof?.accountType ?? "individual";
  const fallbackName = acctType === "company" ? prof?.companyName : prof?.fullName;
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

  doc.setFont("helvetica", "bold").setFontSize(22).text("EXPENSES", rightX, 30, {
    align: "right",
    baseline: "middle",
  });
  doc.setFont("helvetica", "normal").setFontSize(10);
  const generated = formatGeneratedDate(new Date());
  doc.text(`Generated: ${generated}`, rightX, 48, { align: "right" });

  doc.setTextColor("#000000");

  const totalsByCurrency = new Map<string, number>();
  for (const r of rows) {
    const cur = (r.currency || "MUR").toUpperCase();
    totalsByCurrency.set(cur, (totalsByCurrency.get(cur) ?? 0) + Number(r.amount ?? 0));
  }
  const totalsLabel = [...totalsByCurrency.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cur, sum]) => `${cur} ${formatAmount(sum)}`)
    .join(" · ");

  const filterBits: string[] = [];
  if (periodFilter === "month") filterBits.push("Period: This month");
  else if (periodFilter === "year") filterBits.push("Period: This year");
  const q = searchQuery.trim();
  if (q) filterBits.push(`Search: "${q}"`);

  const subtitle = [
    `${rows.length} expense${rows.length === 1 ? "" : "s"}`,
    ...filterBits,
  ].join("  •  ");

  let y = 78;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.setTextColor(60);
  doc.text(subtitle, M, y);
  if (totalsLabel) {
    y += 16;
    doc.setFont("helvetica", "bold").setTextColor(20);
    doc.text(`Total: ${totalsLabel}`, M, y);
  }
  doc.setFont("helvetica", "normal").setTextColor(0);

  y += 18;

  const body = rows.map((r) => {
    const notes = (r.notes ?? "").replace(/\s+/g, " ").trim();
    const notesShort = notes.length > 140 ? `${notes.slice(0, 137)}…` : notes;
    return [
      formatExpenseDate(r.expense_date),
      r.description ?? "",
      r.currency ?? "MUR",
      formatAmount(Number(r.amount ?? 0)),
      String((r.line_items ?? []).length),
      notesShort,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Date", "Description", "Currency", "Amount", "Items", "Notes"]],
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
      1: { cellWidth: 220 },
      2: { cellWidth: 60, halign: "center" },
      3: { cellWidth: 80, halign: "right" },
      4: { cellWidth: 40, halign: "right" },
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

