import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  CustomerSupplierLedgerData,
  CustomerLedgerAccount,
  SupplierLedgerAccount,
} from "@/lib/customer-supplier-ledger-service";
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

export async function generateCustomerSupplierLedgerPDF(
  data: CustomerSupplierLedgerData,
  profile: Profile | null
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;

  const companyName = profile?.companyName ?? profile?.fullName ?? "Your Company";
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
  doc.text("CUSTOMER / SUPPLIER LEDGER", headerTextX, 28);
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
  doc.text(`Generated: ${formatDate(new Date().toISOString().slice(0, 10))}`, rightX, 38, {
    align: "right",
  });

  doc.setTextColor(0, 0, 0);
  let y = 95;

  autoTable(doc, {
    startY: y,
    head: [["Summary", `Amount (${data.currency})`]],
    body: [
      ["Total Receivable (customers owe you)", formatCurrency(data.totalReceivable, data.currency)],
      ["Total Payable (you owe suppliers)", formatCurrency(data.totalPayable, data.currency)],
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
      1: { halign: "right" },
    },
  });
  y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 16;

  if (data.customers.length > 0) {
    if (y > pageH - 80) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Customer Ledger (Receivables)", M, y);
    y += 10;

    for (const acc of data.customers) {
      if (y > pageH - 100) {
        doc.addPage();
        y = M;
      }
      doc.setFont("helvetica", "bold").setFontSize(10).text(acc.customerName, M, y);
      y += 6;
      doc.setFont("helvetica", "normal").setFontSize(8);
      doc.text(
        `Sales: ${formatCurrency(acc.totalSales, data.currency)} · Paid: ${formatCurrency(acc.totalPayments, data.currency)} · Balance: ${formatCurrency(acc.balance, data.currency)}`,
        M,
        y
      );
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [["Date", "Ref", "Type", "Debit", "Credit", "Balance"]],
        body: acc.transactions.map((t) => [
          formatDate(t.date),
          t.ref,
          t.type,
          t.debit > 0 ? formatCurrency(t.debit, data.currency) : "—",
          t.credit > 0 ? formatCurrency(t.credit, data.currency) : "—",
          formatCurrency(t.balance, data.currency),
        ]),
        margin: { left: M, right: M },
        theme: "plain",
        headStyles: {
          fillColor: tableHeadColor,
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7,
        },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
      });
      y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 14;
    }
  }

  if (data.suppliers.length > 0) {
    if (y > pageH - 80) {
      doc.addPage();
      y = M;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Supplier Ledger (Payables)", M, y);
    y += 10;

    for (const acc of data.suppliers) {
      if (y > pageH - 100) {
        doc.addPage();
        y = M;
      }
      doc.setFont("helvetica", "bold").setFontSize(10).text(acc.supplierName, M, y);
      y += 6;
      doc.setFont("helvetica", "normal").setFontSize(8);
      doc.text(
        `Purchases: ${formatCurrency(acc.totalPurchases, data.currency)} · Paid: ${formatCurrency(acc.totalPayments, data.currency)} · Balance: ${formatCurrency(acc.balance, data.currency)}`,
        M,
        y
      );
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [["Date", "Ref", "Type", "Debit", "Credit", "Balance"]],
        body: acc.transactions.map((t) => [
          formatDate(t.date),
          t.ref,
          t.type,
          t.debit > 0 ? formatCurrency(t.debit, data.currency) : "—",
          t.credit > 0 ? formatCurrency(t.credit, data.currency) : "—",
          formatCurrency(t.balance, data.currency),
        ]),
        margin: { left: M, right: M },
        theme: "plain",
        headStyles: {
          fillColor: tableHeadColor,
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7,
        },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
      });
      y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 14;
    }
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

  const filename = `Customer-Supplier-Ledger-${data.startDate}_to_${data.endDate}.pdf`;
  doc.save(filename);
}
