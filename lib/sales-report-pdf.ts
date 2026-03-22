import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SalesReportData } from "@/lib/sales-report-service";
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

const brandColor: [number, number, number] = [15, 23, 42]; // slate-900
const tableHeadColor: [number, number, number] = [59, 130, 246]; // blue

export async function generateSalesReportPDF(
  data: SalesReportData,
  profile: Profile | null
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;

  const companyName = data.companyName || (profile?.companyName ?? profile?.fullName ?? "Your Company");
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
  doc.text("SALES REPORT", headerTextX, 28);
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
      ["Total Sales (Gross)", formatCurrency(data.totalSalesGross, data.currency)],
      ["Total Discounts", formatCurrency(data.totalDiscounts, data.currency)],
      ["Total Tax Collected", formatCurrency(data.totalTaxCollected, data.currency)],
      ["Net Sales", formatCurrency(data.netSales, data.currency)],
      ["Total Paid (Money In)", formatCurrency(data.totalPaid, data.currency)],
      ["Outstanding (Money Pending)", formatCurrency(data.outstanding, data.currency)],
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

  doc.setFont("helvetica", "bold").setFontSize(12).text("Sales Breakdown", M, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Type", `Amount (${data.currency})`]],
    body: [
      ["Cash Sales", formatCurrency(data.salesBreakdown.cash, data.currency)],
      ["Credit Sales", formatCurrency(data.salesBreakdown.credit, data.currency)],
      ["Bank / Juice", formatCurrency(data.salesBreakdown.bankJuice, data.currency)],
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

  if (data.byProduct.length > 0) {
    if (y > pageH - 120) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Sales by Product", M, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Product", "Qty Sold", "Unit Price", "Total"]],
      body: data.byProduct.slice(0, 15).map((r) => [
        r.product,
        String(r.qtySold),
        formatCurrency(r.unitPrice, data.currency),
        formatCurrency(r.total, data.currency),
      ]),
      margin: { left: M, right: M },
      theme: "plain",
      headStyles: {
        fillColor: tableHeadColor,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });
    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 16;
  }

  if (data.byCustomer.length > 0) {
    if (y > pageH - 100) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Sales by Customer", M, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Customer", "Total Sales", "Paid", "Outstanding"]],
      body: data.byCustomer.slice(0, 12).map((r) => [
        r.customer,
        formatCurrency(r.totalSales, data.currency),
        formatCurrency(r.paid, data.currency),
        formatCurrency(r.outstanding, data.currency),
      ]),
      margin: { left: M, right: M },
      theme: "plain",
      headStyles: {
        fillColor: tableHeadColor,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });
    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 16;
  }

  if (data.invoices.length > 0) {
    if (y > pageH - 80) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Invoice Details", M, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Invoice #", "Date", "Customer", "Payment", "Total", "Paid", "Status"]],
      body: data.invoices.map((inv) => [
        inv.number,
        formatDate(inv.issueDate),
        inv.clientName,
        inv.paymentMethod ?? "—",
        formatCurrency(inv.total, data.currency),
        formatCurrency(inv.amountPaid, data.currency),
        inv.amountDue > 0 ? (inv.amountPaid > 0 ? "Partial" : "Unpaid") : "Paid",
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
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 16;
  }

  if (data.outstandingInvoices.length > 0) {
    if (y > pageH - 80) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Outstanding Invoices", M, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [["Invoice #", "Customer", "Amount Due", "Due Date"]],
      body: data.outstandingInvoices.map((inv) => [
        inv.number,
        inv.clientName,
        formatCurrency(inv.amountDue, data.currency),
        formatDate(inv.dueDate),
      ]),
      margin: { left: M, right: M },
      theme: "plain",
      headStyles: {
        fillColor: tableHeadColor,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        2: { halign: "right" },
      },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageW - M,
      pageH - 20,
      { align: "right" }
    );
    doc.text("Powered by MoLedger", pageW / 2, pageH - 20, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  const filename = `Sales-Report-${data.startDate}_to_${data.endDate}.pdf`;
  doc.save(filename);
}
