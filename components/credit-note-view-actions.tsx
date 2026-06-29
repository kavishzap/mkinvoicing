"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Copy,
  Download,
  Edit,
  Printer,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useActionProgress } from "@/contexts/action-progress-context";
import { runActionProgress } from "@/lib/action-progress-bridge";
import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";
import {
  cancelCreditNote,
  computeCreditNoteTotals,
  creditNoteIsEditable,
  creditNoteReasonLabel,
  getCreditNote,
  postCreditNote,
  type CreditNoteDetail,
} from "@/lib/credit-notes-service";
import {
  fetchDocumentBranding,
  type DocumentBranding,
} from "@/lib/branding-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import {
  addPdfHeaderLogo,
  loadImageForJsPdf,
  pdfHeaderTextX,
  resolveDocumentPdfLogo,
} from "@/lib/pdf-image-for-jspdf";
import { cn } from "@/lib/utils";

function money(n: number, ccy: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: ccy,
  }).format(n);
}

function buildFromLines(
  cn: CreditNoteDetail,
  prof: Profile | null | undefined,
  branding: DocumentBranding,
) {
  const fromSnap = (cn.from_snapshot ?? {}) as Record<string, unknown>;
  const acctType = prof?.accountType ?? "individual";
  const senderName =
    branding.companyName ||
    (fromSnap?.type === "company" ? fromSnap?.company_name : fromSnap?.full_name) ||
    (acctType === "company" ? prof?.companyName : prof?.fullName) ||
    "Your Company";
  const lines: string[] = [String(senderName)];
  return lines;
}

export function CreditNoteViewActions({
  creditNoteId,
  creditNote,
  profile,
  logoSrc,
  onStatusChange,
  onRefresh,
  toolbarClassName,
}: {
  creditNoteId: string;
  creditNote?: CreditNoteDetail | null;
  profile?: Profile | null;
  logoSrc?: string;
  onStatusChange?: (status: CreditNoteDetail["status"]) => void;
  onRefresh?: () => void;
  toolbarClassName?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { isRunning } = useActionProgress();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  const status = creditNote?.status;
  const isDraft = status === "draft";
  const isPosted = status === "posted";
  const canEdit = creditNoteIsEditable(creditNote);

  const renderPdf = async (mode: "download" | "print") => {
    if (isRunning || !creditNote) return;
    await runActionProgress("Generating PDF…", async () => {
      try {
        const cn = creditNote ?? (await getCreditNote(creditNoteId));
        const prof = profile ?? (await fetchProfile());
        if (!cn) throw new Error("Credit note not found.");
        const branding = (await fetchDocumentBranding()) ?? {};
        const brandColor = branding.brandColor || "#0F172A";
        const resolvedLogo = resolveDocumentPdfLogo({
          logoSrc,
          profileLogoUrl: (prof as { logoUrl?: string })?.logoUrl,
          brandingLogoUrl: branding.logoUrl,
        });
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const M = 40;
        doc.setFillColor(brandColor);
        doc.rect(0, 0, pageW, 60, "F");
        const logoImg = resolvedLogo
          ? await loadImageForJsPdf(resolvedLogo)
          : undefined;
        addPdfHeaderLogo(doc, logoImg, M);
        const fromLines = buildFromLines(cn, prof, branding);
        doc.setTextColor("#FFFFFF");
        doc.setFont("helvetica", "bold").setFontSize(16).text(fromLines[0] ?? "", pdfHeaderTextX(M, logoImg), 28);
        doc.setFont("helvetica", "bold").setFontSize(22).text("CREDIT NOTE", pageW - M, 30, { align: "right" });
        doc.setFont("helvetica", "normal").setFontSize(10).text(String(cn.number), pageW - M, 48, { align: "right" });
        doc.setTextColor("#000000");
        let y = 90;
        const bodyRows: RowInput[] = (cn.items ?? []).map((it) => {
          const qty = Number(it.quantity);
          const unit = Number(it.unit_price);
          const lineTotal = qty * unit * (1 + Number(it.tax_percent) / 100);
          return [it.item, it.description ?? "", String(qty), money(unit, cn.currency), `${it.tax_percent}%`, money(lineTotal, cn.currency)];
        });
        autoTable(doc, {
          head: [["Item", "Description", "Qty", "Price", "Tax", "Total"]],
          body: bodyRows,
          startY: y,
          margin: { left: M, right: M },
        });
        const totals = computeCreditNoteTotals(cn);
        const afterY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
        doc.text(`Credit total: ${money(totals.total, cn.currency)}`, M, afterY + 24);
        doc.text(`Reason: ${creditNoteReasonLabel(cn.reason)}`, M, afterY + 40);
        if (mode === "download") doc.save(`${cn.number}.pdf`);
        else {
          const url = URL.createObjectURL(doc.output("blob"));
          const w = window.open(url, "_blank");
          if (w) {
            w.onload = () => setTimeout(() => w.print(), 250);
          }
        }
      } catch (err: unknown) {
        toast({
          title: "PDF failed",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const handlePost = async () => {
    try {
      await runActionProgress("Posting credit note…", () =>
        postCreditNote(creditNoteId),
      );
      toast({
        title: "Credit note posted",
        description: "Invoice balance updated.",
      });
      onStatusChange?.("posted");
      onRefresh?.();
      setPostOpen(false);
    } catch (err: unknown) {
      toast({
        title: "Could not post",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async () => {
    try {
      await runActionProgress("Cancelling…", () =>
        cancelCreditNote(creditNoteId),
      );
      toast({ title: "Credit note cancelled" });
      onStatusChange?.("cancelled");
      onRefresh?.();
      setCancelOpen(false);
    } catch (err: unknown) {
      toast({
        title: "Could not cancel",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2", toolbarClassName)}>
        {canEdit ? (
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href={`/app/credit-notes/${creditNoteId}/edit`}>
              <Edit className="h-4 w-4" />
              Edit draft
            </Link>
          </Button>
        ) : null}
        {isDraft ? (
          <Button
            size="sm"
            className="gap-2"
            disabled={isRunning}
            onClick={() => setPostOpen(true)}
          >
            <Send className="h-4 w-4" />
            Post
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isRunning}
          onClick={() => void renderPdf("download")}
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isRunning}
          onClick={() => void renderPdf("print")}
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
        {isPosted ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isRunning}
            onClick={() => setDuplicateOpen(true)}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
        ) : null}
        {isDraft ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            disabled={isRunning}
            onClick={() => setCancelOpen(true)}
          >
            <XCircle className="h-4 w-4" />
            Cancel draft
          </Button>
        ) : null}
      </div>

      <AlertDialog open={postOpen} onOpenChange={setPostOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post credit note?</AlertDialogTitle>
            <AlertDialogDescription>
              This reduces the linked invoice outstanding balance. Posted credit notes are read-only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handlePost()}>Post</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This draft credit note will be marked cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleCancel()}>Cancel draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate from posted note?</AlertDialogTitle>
            <AlertDialogDescription>
              Creates a new draft linked to the same invoice. Adjust lines before posting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (creditNote?.related_invoice_id) {
                  router.push(
                    `/app/credit-notes/new?fromInvoice=${encodeURIComponent(creditNote.related_invoice_id)}`,
                  );
                }
                setDuplicateOpen(false);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
