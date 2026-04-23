"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Download, Edit, Printer, ShoppingCart, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";
import {
  computeQuotationTotals,
  getQuotation,
  type QuotationDetail,
} from "@/lib/quotations-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import Link from "next/link";

type Branding = {
  logoUrl?: string;
  brandColor?: string;
  companyName?: string;
  address1?: string;
  address2?: string;
  website?: string;
  phone?: string;
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

function money(n: number, ccy: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy }).format(n);
}

function buildFromLines(q: QuotationDetail, prof: Profile | null | undefined, branding: Branding) {
  const fromSnap = (q.from_snapshot ?? {}) as Record<string, unknown>;
  const acctType = prof?.accountType ?? "individual";
  const senderName =
    branding.companyName ||
    (fromSnap?.type === "company" ? fromSnap?.company_name : fromSnap?.full_name) ||
    (acctType === "company" ? prof?.companyName : prof?.fullName) ||
    "Your Company";
  const senderEmail =
    String(fromSnap?.email || "") || prof?.email || branding.email || "";
  const addr1 =
    branding.address1 ||
    String(fromSnap?.address_line_1 || "") ||
    prof?.address_line_1 ||
    "";
  const addr2 =
    branding.address2 ||
    String(fromSnap?.address_line_2 || "") ||
    prof?.address_line_2 ||
    "";
  const phone =
    branding.phone || String(fromSnap?.phone || "") || prof?.phone || "";
  const registrationId = String(fromSnap?.registration_id || prof?.registrationId || "");
  const vatNumber = String(fromSnap?.vat_number || prof?.vatNumber || "");
  const bankName = String((prof as { bank_name?: string })?.bank_name || "");
  const bankAcc = String((prof as { bank_acc_num?: string })?.bank_acc_num || "");
  const website = branding.website || "";

  const lines: string[] = [];
  lines.push(String(senderName));
  if (senderEmail) lines.push(String(senderEmail));
  if (registrationId) lines.push(`Reg: ${registrationId}`);
  if (vatNumber) lines.push(`VAT: ${vatNumber}`);
  if (addr1) lines.push(String(addr1));
  if (addr2) lines.push(String(addr2));
  if (phone) lines.push(String(phone));
  if (bankName) lines.push(`Bank: ${bankName}`);
  if (bankAcc) lines.push(`Account: ${bankAcc}`);
  if (website) lines.push(String(website));

  return lines.length ? lines : ["—"];
}

export function QuotationViewActions({
  quotationId,
  quotation,
  profile,
  logoSrc,
}: {
  quotationId: string;
  quotation?: QuotationDetail | null;
  profile?: Profile | null;
  logoSrc?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDuplicate = () => {
    if (busy) return;
    router.push(
      `/app/quotations/new?duplicate=${encodeURIComponent(quotationId)}`
    );
  };

  const handleConvertToSalesOrder = () => {
    if (busy) return;
    router.push(
      `/app/sales-orders/new?convertFromQuotation=${encodeURIComponent(quotationId)}`
    );
  };

  const handleConvertToInvoice = () => {
    if (busy) return;
    router.push(
      `/app/invoices/new?convertFromQuotation=${encodeURIComponent(quotationId)}`
    );
  };

  const renderPdf = async (mode: "download" | "print") => {
    if (busy) return;
    setBusy(true);
    try {
      const q = quotation ?? (await getQuotation(quotationId));
      const prof = profile ?? (await fetchProfile());
      if (!q) throw new Error("Quotation not found.");

      const branding = (await fetchBranding()) ?? {};
      const brandColor = branding.brandColor || "#0F172A";
      const resolvedLogo = branding.logoUrl || logoSrc || (prof as { logoUrl?: string })?.logoUrl || "/kredence.png";

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const M = 40;
      const G = 24;
      const rightX = pageW - M;

      doc.setFillColor(brandColor);
      doc.rect(0, 0, pageW, 60, "F");

      const logoImg = resolvedLogo ? await imageUrlToDataURL(resolvedLogo) : undefined;
      if (logoImg?.dataUrl) {
        doc.addImage(logoImg.dataUrl, logoImg.fmt, M, 14, 48, 48, undefined, "FAST");
      }

      const fromSnap = q.from_snapshot ?? {};
      const acctType = prof?.accountType ?? "individual";
      const fallbackName =
        (fromSnap as { type?: string }).type === "company"
          ? (fromSnap as { company_name?: string }).company_name
          : (fromSnap as { full_name?: string }).full_name ||
            (acctType === "company" ? prof?.companyName : prof?.fullName);
      const senderName = branding.companyName || fallbackName || "Your Company";
      const senderEmail =
        String((fromSnap as { email?: string }).email || "") ||
        prof?.email ||
        branding.email ||
        "";

      doc.setTextColor("#FFFFFF");
      doc.setFont("helvetica", "bold").setFontSize(16).text(senderName, M + 60, 28);
      doc.setFont("helvetica", "normal").setFontSize(10);
      if (senderEmail) doc.text(senderEmail, M + 60, 44);

      doc.setFont("helvetica", "bold").setFontSize(22).text("QUOTATION", rightX, 30, {
        align: "right",
        baseline: "middle",
      });
      doc.setFont("helvetica", "normal").setFontSize(10);
      doc.text(String(q.number || ""), rightX, 48, { align: "right" });

      doc.setTextColor("#000000");

      let y = 90;
      const available = pageW - 2 * M;
      let fromW = 180;
      let detailsW = 200;
      let midW = available - fromW - detailsW - 2 * G;
      const MID_MIN = 160;
      if (midW < MID_MIN) {
        const deficit = MID_MIN - midW;
        const detailsFloor = 160;
        const canTakeFromDetails = Math.max(0, detailsW - detailsFloor);
        const takeFromDetails = Math.min(deficit, canTakeFromDetails);
        detailsW -= takeFromDetails;
        midW = available - fromW - detailsW - 2 * G;
        if (midW < MID_MIN) {
          const remaining = MID_MIN - midW;
          const fromFloor = 140;
          const canTakeFromFrom = Math.max(0, fromW - fromFloor);
          const takeFromFrom = Math.min(remaining, canTakeFromFrom);
          fromW -= takeFromFrom;
          midW = available - fromW - detailsW - 2 * G;
          if (midW < MID_MIN) midW = Math.max(120, midW);
        }
      }

      const fromX = M;
      const midX = fromX + fromW + G;
      const detailsX = midX + midW + G;

      const fromLines = buildFromLines(q, prof, branding);
      doc.setFont("helvetica", "bold").setFontSize(11).text("From", fromX, y);
      doc.setFont("helvetica", "normal").setFontSize(10);
      const fromWrapped = doc.splitTextToSize(fromLines.join("\n"), fromW);
      doc.text(fromWrapped, fromX, y + 16);

      const bill = q.bill_to_snapshot ?? {};
      const billName =
        (bill as { type?: string }).type === "company"
          ? (bill as { company_name?: string }).company_name
          : (bill as { full_name?: string }).full_name;
      const billAddress = [
        (bill as { street?: string }).street,
        [
          (bill as { city?: string }).city,
          (bill as { postal?: string }).postal,
        ]
          .filter(Boolean)
          .join(", "),
        (bill as { country?: string }).country,
      ]
        .filter(Boolean)
        .join(" • ");
      const billLines = [
        billName || "—",
        (bill as { email?: string }).email || "",
        (bill as { phone?: string }).phone || "",
        billAddress,
      ].filter(Boolean);
      const billWrapped = doc.splitTextToSize(billLines.join("\n"), midW);
      doc.setFont("helvetica", "bold").setFontSize(11).text("Bill To", midX, y);
      doc.setFont("helvetica", "normal").setFontSize(10);
      doc.text(billWrapped, midX, y + 16);

      const issue = new Date(q.issue_date).toLocaleDateString("en-GB");
      const valid = new Date(q.valid_until).toLocaleDateString("en-GB");
      const detailsLines = [
        `Issue Date: ${issue}`,
        `Valid Until: ${valid}`,
        `Status: ${q.status}`,
      ];
      doc.setFont("helvetica", "bold").setFontSize(11).text("Details", detailsX, y);
      doc.setFont("helvetica", "normal").setFontSize(10);
      let detailsY = y + 16;
      for (const line of detailsLines) {
        const wrapped = doc.splitTextToSize(line, detailsW);
        doc.text(wrapped, detailsX, detailsY);
        detailsY += wrapped.length * 13;
      }

      const fromH = (Array.isArray(fromWrapped) ? fromWrapped.length : 1) * 13;
      const billH = (Array.isArray(billWrapped) ? billWrapped.length : 1) * 13;
      const detailsH = detailsY - (y + 16);
      y = y + 16 + Math.max(fromH, billH, detailsH) + 20;

      const bodyRows: RowInput[] = [...(q.items ?? [])]
        .sort(
          (a, b) =>
            Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
        )
        .map((it) => {
        const qty = Number(it.quantity);
        const unit = Number(it.unit_price);
        const line = qty * unit;
        const taxAmt = line * (Number(it.tax_percent) / 100);
        const lineTotal = line + taxAmt;
        return [
          it.item ?? "",
          it.description ?? "",
          String(qty),
          money(unit, q.currency),
          `${it.tax_percent ?? 0}%`,
          money(lineTotal, q.currency),
        ];
      });

      autoTable(doc, {
        head: [["Item", "Description", "Qty", "Price", "Tax", "Total"]],
        body: bodyRows,
        startY: y,
        styles: {
          font: "helvetica",
          fontSize: 10,
          cellPadding: 6,
          lineColor: 230,
          lineWidth: 0.4,
        },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        bodyStyles: { valign: "top" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          2: { halign: "right", cellWidth: 50 },
          3: { halign: "right", cellWidth: 70 },
          4: { halign: "right", cellWidth: 50 },
          5: { halign: "right", cellWidth: 80 },
        },
        didDrawPage: () => {
          doc.setDrawColor(230);
          doc.line(M, pageH - 50, pageW - M, pageH - 50);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor("#94A3B8");
          doc.text("Powered by MoLedger", pageW / 2, pageH - 35, { align: "center" });
          doc.setFontSize(9);
          doc.setTextColor("#64748B");
          doc.text(`Page ${doc.getNumberOfPages()}`, pageW - M, pageH - 24, { align: "right" });
          doc.setTextColor("#000000");
        },
        margin: { left: M, right: M },
      });

      const afterTableY =
        (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
        y;
      const totals = computeQuotationTotals(q);
      const cardW = 260;
      let cardH = 110 + (totals.discount > 0 ? 14 : 0);
      if (totals.shipping > 0) cardH += 14;
      const cardX = pageW - M - cardW;
      let cardY = afterTableY + 18;

      doc.setFillColor("#F1F5F9");
      doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, "F");
      doc.setDrawColor(230);
      doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6);

      let ty = cardY + 16;
      const labelX = cardX + 14;
      const valueX = cardX + cardW - 14;

      doc.setFont("helvetica", "normal").setFontSize(10);
      doc.text("Subtotal", labelX, ty);
      doc.text(money(totals.subtotal, q.currency), valueX, ty, { align: "right" });
      ty += 16;
      doc.text("Tax", labelX, ty);
      doc.text(money(totals.taxTotal, q.currency), valueX, ty, { align: "right" });
      ty += 16;
      if (totals.discount > 0) {
        doc.text("Discount", labelX, ty);
        doc.text("-" + money(totals.discount, q.currency), valueX, ty, { align: "right" });
        ty += 16;
      }
      if (totals.shipping > 0) {
        doc.text("Shipping", labelX, ty);
        doc.text(money(totals.shipping, q.currency), valueX, ty, { align: "right" });
        ty += 16;
      }
      doc.setDrawColor(210);
      doc.line(labelX, ty, valueX, ty);
      ty += 18;
      doc.setFont("helvetica", "bold").setFontSize(12);
      doc.text("Total", labelX, ty);
      doc.text(money(totals.total, q.currency), valueX, ty, { align: "right" });

      let ny = ty + 36;
      const notes = q.notes ? String(q.notes) : "";
      const terms = q.terms ? String(q.terms) : "";
      ny = Math.max(ny, afterTableY + 28);
      if (notes) {
        doc.setFont("helvetica", "bold").setFontSize(11).text("Notes", M, ny);
        doc.setFont("helvetica", "normal").setFontSize(10);
        ny += 14;
        const notesLines = doc.splitTextToSize(notes, pageW - 2 * M);
        doc.text(notesLines, M, ny);
        ny += notesLines.length * 13 + 6;
      }
      if (terms) {
        doc.setFont("helvetica", "bold").setFontSize(11).text("Terms & Conditions", M, ny);
        doc.setFont("helvetica", "normal").setFontSize(10);
        ny += 14;
        const termsLines = doc.splitTextToSize(terms, pageW - 2 * M);
        doc.text(termsLines, M, ny);
      }

      const filename = `Quotation-${q.number || quotationId}.pdf`;

      if (mode === "download") {
        doc.save(filename);
        toast({ title: "PDF downloaded", description: filename });
      } else {
        const pdfBlob = doc.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(pdfUrl, "_blank");
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => printWindow.print(), 250);
          };
        } else {
          doc.save(filename);
          toast({
            title: "Print blocked",
            description: "Allow popups to print. PDF downloaded instead.",
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not generate PDF.";
      toast({ title: "PDF error", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full max-w-full flex-wrap items-center justify-start gap-1.5 sm:gap-2">
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={busy}
        onClick={() => renderPdf("download")}
      >
        <Download className="h-4 w-4" />
        {busy ? "Generating…" : "Download PDF"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={busy}
        onClick={() => renderPdf("print")}
      >
        <Printer className="h-4 w-4" />
        Print
      </Button>
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={busy}
        onClick={handleDuplicate}
      >
        <Copy className="h-4 w-4" />
        Duplicate (prefill)
      </Button>
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={handleConvertToSalesOrder}
        disabled={busy}
      >
        <ShoppingCart className="h-4 w-4" />
        Convert to Sales Order
      </Button>
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={handleConvertToInvoice}
        disabled={busy}
      >
        <FileText className="h-4 w-4" />
        Convert to Invoice
      </Button>
      <Button type="button" variant="outline" className="gap-2" asChild>
        <Link href={`/app/quotations/${quotationId}/edit`}>
          <Edit className="h-4 w-4" />
          Edit
        </Link>
      </Button>
    </div>
  );
}
