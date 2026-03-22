import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExpenseReportData } from "@/lib/expense-report-service";
import type { Profile } from "@/lib/settings-service";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

const brandColor: [number, number, number] = [15, 23, 42];
const tableHeadColor: [number, number, number] = [59, 130, 246];

export async function generateExpenseReportPDF(
  data: ExpenseReportData,
  profile: Profile | null
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;

  const companyName =
    data.companyName || (profile?.companyName ?? profile?.fullName ?? "Your Company");
  const resolvedLogo =
    (profile as { logoUrl?: string })?.logoUrl || (profile as { logo_url?: string })?.logo_url || "/kredence.png";

  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageW, 70, "F");

  const logoImg = resolvedLogo ? await imageUrlToDataURL(resolvedLogo) : undefined;
  if (logoImg?.dataUrl) {
    doc.addImage(logoImg.dataUrl, logoImg.fmt, M, 14, 48, 48, undefined, "FAST");
  }

  const headerTextX = M + 60;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text("EXPENSE REPORT", headerTextX, 28);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(companyName, headerTextX, 44);
  doc.text(
    `Period: ${formatDate(data.startDate)} → ${formatDate(data.endDate)}`,
    headerTextX,
    56
  );

  const rightX = pageW - M;
  doc.setFontSize(9);
  doc.text(`Currency: ${data.currency} (Rs)`, rightX, 26, { align: "right" });
  doc.text(`Generated: ${formatDate(data.generatedOn)}`, rightX, 38, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 95;

  autoTable(doc, {
    startY: y,
    head: [["Metric", `Amount (${data.currency})`]],
    body: [
      ["Total Expenses", formatCurrency(data.totalExpenses, data.currency)],
      ["Expense Count", String(data.expenseCount)],
      ["Average Daily Expense", formatCurrency(data.averageDailyExpense, data.currency)],
    ],
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: tableHeadColor,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 100, halign: "right" },
    },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 16;

  if (data.byCategory.length > 0) {
    if (y > pageH - 80) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Expenses by Category", M, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Category", `Amount (${data.currency})`]],
      body: data.byCategory.map((r) => [r.category, formatCurrency(r.amount, data.currency)]),
      margin: { left: M, right: M },
      theme: "plain",
      headStyles: {
        fillColor: tableHeadColor,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 10,
      },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        1: { halign: "right" },
      },
    });
    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 16;
  }

  if (data.timeline.length > 0) {
    if (y > pageH - 100) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Expense Timeline", M, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Date", `Amount (${data.currency})`]],
      body: data.timeline.map((r) => [formatDate(r.date), formatCurrency(r.amount, data.currency)]),
      margin: { left: M, right: M },
      theme: "plain",
      headStyles: {
        fillColor: tableHeadColor,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 10,
      },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        1: { halign: "right" },
      },
    });
    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 16;
  }

  if (data.expenses.length > 0) {
    if (y > pageH - 80) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Detailed Expense List", M, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Ref No", "Date", "Category", "Amount"]],
      body: data.expenses.map((e) => [
        e.refNo,
        formatDate(e.date),
        e.description,
        formatCurrency(e.amount, data.currency),
      ]),
      margin: { left: M, right: M },
      theme: "plain",
      headStyles: {
        fillColor: tableHeadColor,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        3: { halign: "right" },
      },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${totalPages}`, pageW - M, pageH - 20, { align: "right" });
    doc.text("Powered by MoLedger", pageW / 2, pageH - 20, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  const filename = `Expense-Report-${data.startDate}_to_${data.endDate}.pdf`;
  doc.save(filename);
}
