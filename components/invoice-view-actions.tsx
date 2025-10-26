"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";
import {
  computeTotals,
  getInvoice,
  type InvoiceDetail,
  markInvoicePaid,
} from "@/lib/invoices-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";

interface InvoiceViewActionsProps {
  invoiceId: string;
  invoice?: InvoiceDetail | null;
  profile?: Profile | null;
  logoSrc?: string;
  // Optional: parent can flip local UI instantly after mark-as-paid
  onPaid?: () => void;
}

type Branding = {
  logoUrl?: string;
  brandColor?: string; // hex
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

/**
 * Build the "From" block by merging (priority):
 * 1) branding (address1/2, phone, website, companyName/email if set)
 * 2) inv.from_snapshot (company/fullName, street/city/postal/country, phone/email)
 * 3) profile (companyName/fullName, email, phone, website)
 * Always returns at least a company/name line so the block never looks empty.
 */
function buildFromLines(inv: InvoiceDetail, prof: Profile | null | undefined, branding: Branding) {
  const fromSnap: any = inv.from_snapshot ?? {};
  const acctType = (prof as any)?.accountType ?? "individual";

  // Primary identity
  const senderName =
    branding.companyName ||
    (fromSnap?.type === "company" ? fromSnap?.company_name : fromSnap?.full_name) ||
    (acctType === "company" ? (prof as any)?.companyName : (prof as any)?.fullName) ||
    "Your Company";

  const senderEmail =
    fromSnap?.email || (prof as any)?.email || branding.email || "";

  // Address preference: branding first, then snapshot, then profile
  const addr1 =
    branding.address1 ||
    fromSnap?.address_line_1 ||
    (prof as any)?.address_line_1 ||
    "";
  const addr2 =
    branding.address2 ||
    fromSnap?.address_line_2 ||
    (prof as any)?.address_line_2 ||
    "";

  const phone =
    branding.phone || fromSnap?.phone || (prof as any)?.phone || "";

  // Bank info from profile (if present)
  const bankName = (prof as any)?.bank_name || "";
  const bankAcc = (prof as any)?.bank_acc_num || "";

  const website = branding.website || (prof as any)?.website || "";

  const lines: string[] = [];
  lines.push(String(senderName));
  if (senderEmail) lines.push(String(senderEmail));
  if (addr1) lines.push(String(addr1));
  if (addr2) lines.push(String(addr2));
  if (phone) lines.push(String(phone));
  if (bankName) lines.push(`Bank: ${bankName}`);
  if (bankAcc) lines.push(`Account: ${bankAcc}`);
  if (website) lines.push(String(website));

  return lines.length ? lines : ["—"];
}


export function InvoiceViewActions({
  invoiceId,
  invoice,
  profile,
  logoSrc,
  onPaid,
}: InvoiceViewActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const isPaid = useMemo(() => invoice?.status === "paid", [invoice?.status]);

  const handleDownloadPDF = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const inv = invoice ?? (await getInvoice(invoiceId));
      const prof = profile ?? (await fetchProfile());
      if (!inv) throw new Error("Invoice not found.");

      const branding = (await fetchBranding()) ?? {};
      const brandColor = branding.brandColor || "#0F172A"; // slate-900
      const resolvedLogo = branding.logoUrl || logoSrc || (prof as any)?.logoUrl || "/logo.png";

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const M = 40; // margin
      const G = 24; // gutter
      const rightX = pageW - M;

      // Header bar
      doc.setFillColor(brandColor);
      doc.rect(0, 0, pageW, 60, "F");

      // Logo
      const logoImg = resolvedLogo ? await imageUrlToDataURL(resolvedLogo) : undefined;
      if (logoImg?.dataUrl) {
        doc.addImage(logoImg.dataUrl, logoImg.fmt, M, 14, 48, 48, undefined, "FAST");
      }

      // Sender identity (title + email in the header)
      const fromSnap = inv.from_snapshot ?? {};
      const acctType = (prof as any)?.accountType ?? "individual";
      const fallbackName =
        fromSnap?.type === "company"
          ? fromSnap?.company_name
          : fromSnap?.full_name ||
            (acctType === "company" ? (prof as any)?.companyName : (prof as any)?.fullName);
      const senderName = branding.companyName || fallbackName || "Your Company";
      const senderEmail = (fromSnap as any)?.email || (prof as any)?.email || branding.email || "";

      doc.setTextColor("#FFFFFF");
      doc.setFont("helvetica", "bold").setFontSize(16).text(senderName, M + 60, 28);
      doc.setFont("helvetica", "normal").setFontSize(10);
      if (senderEmail) doc.text(senderEmail, M + 60, 44);

      // Invoice label + number (right)
      doc.setFont("helvetica", "bold").setFontSize(24).text("INVOICE", rightX, 30, {
        align: "right",
        baseline: "middle",
      });
      doc.setFont("helvetica", "normal").setFontSize(10);
      doc.text(String(inv.number || ""), rightX, 48, { align: "right" });

      // Reset text color
      doc.setTextColor("#000000");

      // ===== Three-column block (From / Bill To / Invoice Details)
      let y = 90;
      const available = pageW - 2 * M;

      // desired widths
      let fromW = 180;
      let detailsW = 200;
      let midW = available - fromW - detailsW - 2 * G;
      const MID_MIN = 160;

      // ensure Bill To has minimum width
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

      // From (merged lines)
      const fromLines = buildFromLines(inv, prof, branding);
      doc.setFont("helvetica", "bold").setFontSize(11).text("From", fromX, y);
      doc.setFont("helvetica", "normal").setFontSize(10);
      const fromWrapped = doc.splitTextToSize(fromLines.join("\n"), fromW);
      doc.text(fromWrapped, fromX, y + 16);

      // Bill To
      const bill = inv.bill_to_snapshot ?? {};
      const billName = bill?.type === "company" ? bill?.company_name : bill?.full_name;
      const billAddress = [bill?.street, [bill?.city, bill?.postal].filter(Boolean).join(", "), bill?.country]
        .filter(Boolean)
        .join(" • ");
      const billLines = [billName || "—", bill?.email || "", bill?.phone || "", billAddress].filter(Boolean);
      const billWrapped = doc.splitTextToSize(billLines.join("\n"), midW);
      doc.setFont("helvetica", "bold").setFontSize(11).text("Bill To", midX, y);
      doc.setFont("helvetica", "normal").setFontSize(10);
      doc.text(billWrapped, midX, y + 16);

      // Invoice Details
      const issue = new Date(inv.issue_date).toLocaleDateString("en-GB");
      const due = new Date(inv.due_date).toLocaleDateString("en-GB");
      const detailsLines = [`Issue Date: ${issue}`, `Due Date: ${due}`, `Status: ${inv.status}`];
      doc.setFont("helvetica", "bold").setFontSize(11).text("Invoice Details", detailsX, y);
      doc.setFont("helvetica", "normal").setFontSize(10);
      let detailsY = y + 16;
      for (const line of detailsLines) {
        const wrapped = doc.splitTextToSize(line, detailsW);
        doc.text(wrapped, detailsX, detailsY);
        detailsY += wrapped.length * 13;
      }

      // advance Y by tallest column
      const fromH = (Array.isArray(fromWrapped) ? fromWrapped.length : 1) * 13;
      const billH = (Array.isArray(billWrapped) ? billWrapped.length : 1) * 13;
      const detailsH = detailsY - (y + 16);
      y = y + 16 + Math.max(fromH, billH, detailsH) + 20;

      // Items
      const bodyRows: RowInput[] = (inv.items ?? []).map((it) => {
        const qty = Number(it.quantity);
        const unit = Number(it.unit_price);
        const line = qty * unit;
        const taxAmt = line * (Number(it.tax_percent) / 100);
        const lineTotal = line + taxAmt;
        return [
          it.item ?? "",
          it.description ?? "",
          String(qty),
          money(unit, inv.currency),
          `${it.tax_percent ?? 0}%`,
          money(lineTotal, inv.currency),
        ];
      });

      autoTable(doc, {
        head: [["Item", "Description", "Qty", "Price", "Tax", "Total"]],
        body: bodyRows,
        startY: y,
        styles: { font: "helvetica", fontSize: 10, cellPadding: 6, lineColor: 230, lineWidth: 0.4 },
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
          doc.line(M, pageH - 40, pageW - M, pageH - 40);
          doc.setFontSize(9);
          doc.setTextColor("#64748B");
          doc.text(`Page ${doc.getNumberOfPages()}`, pageW - M, pageH - 24, { align: "right" });
          doc.setTextColor("#000000");
        },
        margin: { left: M, right: M },
      });

      const afterTableY = (doc as any).lastAutoTable?.finalY ?? y;

      // Totals card
      const totals = computeTotals(inv);
      const cardW = 260;
      const cardH = 110 + (totals.discount > 0 ? 14 : 0);
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
      doc.text(money(totals.subtotal, inv.currency), valueX, ty, { align: "right" });
      ty += 16;

      doc.text("Tax", labelX, ty);
      doc.text(money(totals.taxTotal, inv.currency), valueX, ty, { align: "right" });
      ty += 16;

      if (totals.discount > 0) {
        doc.text("Discount", labelX, ty);
        doc.text("-" + money(totals.discount, inv.currency), valueX, ty, { align: "right" });
        ty += 16;
      }

      doc.setDrawColor(210);
      doc.line(labelX, ty, valueX, ty);
      ty += 18;

      doc.setFont("helvetica", "bold").setFontSize(12);
      doc.text("Total", labelX, ty);
      doc.text(money(totals.total, inv.currency), valueX, ty, { align: "right" });

      // Notes / Terms
      let ny = Math.max(ty + 28, afterTableY + 28);
      const notes = inv.notes ? String(inv.notes) : "";
      const terms = inv.terms ? String(inv.terms) : "";

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

      const filename = `Invoice-${inv.number || invoiceId}.pdf`;
      doc.save(filename);

      toast({ title: "PDF Downloaded", description: `${filename} has been downloaded.` });
    } catch (err: any) {
      toast({
        title: "PDF Error",
        description: err?.message ?? "Could not generate PDF.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // Persist "paid" then refresh UI; button hidden when already paid
  const handleMarkAsPaid = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await markInvoicePaid(invoiceId);
      toast({ title: "Marked as paid" });
      onPaid?.(); // let parent flip local state instantly if desired
      router.replace(`/app/invoices/${invoiceId}`); // force fresh mount
    } catch (e: any) {
      toast({
        title: "Failed to mark as paid",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-nowrap">
      <Button variant="outline" onClick={handleDownloadPDF} className="gap-2" disabled={busy}>
        <Download className="h-4 w-4" />
        {busy ? "Generating…" : "Download PDF"}
      </Button>

      {!isPaid && (
        <Button variant="outline" onClick={handleMarkAsPaid} className="gap-2" disabled={busy}>
          <CheckCircle2 className="h-4 w-4" />
          Mark as Paid
        </Button>
      )}
    </div>
  );
}

export function InvoiceQuickActions() {
  return <div className="flex items-center gap-2" />;
}
