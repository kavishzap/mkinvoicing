"use client";
import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchPreferences, type Preferences } from "@/lib/settings-service";
import {
  getCreditNote,
  listCreditableInvoices,
  updateCreditNoteDraft,
  type CreditNoteReason,
} from "@/lib/credit-notes-service";
import { getInvoice } from "@/lib/invoices-service";
import { AppPageShell } from "@/components/app-page-shell";
import {
  CreditNoteForm,
  useCreditNoteFormState,
  validateCreditNoteForm,
  linesToPayload,
} from "@/components/credit-note-form";
import { runActionProgress } from "@/lib/action-progress-bridge";
import { useActionProgress } from "@/contexts/action-progress-context";

export default function EditCreditNotePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const { isRunning } = useActionProgress();

  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [creditableBalance, setCreditableBalance] = useState<number | null>(
    null,
  );

  const form = useCreditNoteFormState();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [prefs, cn] = await Promise.all([
          fetchPreferences(),
          getCreditNote(id),
        ]);
        if (cancelled) return;
        setPreferences(prefs);
        if (!cn || cn.status !== "draft") {
          router.replace(`/app/credit-notes/${id}`);
          return;
        }
        const invoice = cn.related_invoice_id
          ? await getInvoice(cn.related_invoice_id)
          : null;
        const invoiceQtyByLineId = new Map(
          (invoice?.items ?? []).map((it) => [it.id, Number(it.quantity)]),
        );
        form.setCustomerId(cn.customer_id ?? "");
        form.setInvoiceId(cn.related_invoice_id ?? "");
        form.setIssueDate(cn.issue_date);
        form.setCreditType(cn.credit_type);
        form.setReason((cn.reason as CreditNoteReason) ?? "");
        form.setNotes(cn.notes ?? "");
        form.setDiscountAmount(Number(cn.discount_amount ?? 0));
        form.setLineItems(
          cn.items.map((it, i) => ({
            id: `ln-${i}`,
            invoiceItemId: it.invoice_item_id ?? null,
            productId: it.product_id ?? null,
            item: it.item,
            description: it.description ?? "",
            quantity: Number(it.quantity),
            maxQuantity:
              (it.invoice_item_id
                ? invoiceQtyByLineId.get(it.invoice_item_id)
                : undefined) ?? Number(it.quantity),
            unitPrice: Number(it.unit_price),
            tax: Number(it.tax_percent),
          })),
        );
      } catch {
        if (!cancelled) {
          toast({
            title: "Failed to load credit note",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!form.customerId || !form.invoiceId) return;
    void listCreditableInvoices(form.customerId).then((rows) => {
      const hit = rows.find((r) => r.id === form.invoiceId);
      setCreditableBalance(hit?.creditableBalance ?? null);
    });
  }, [form.customerId, form.invoiceId]);

  async function handleSave() {
    const validation = validateCreditNoteForm(form, creditableBalance);
    form.setErrors(validation);
    if (Object.keys(validation).length > 0) {
      toast({
        title: "Please fix the highlighted fields",
        variant: "destructive",
      });
      return;
    }

    await runActionProgress("Saving draft…", async () => {
      try {
        if (!preferences) throw new Error("Preferences not loaded");
        await updateCreditNoteDraft(id, {
          issue_date: form.issueDate,
          currency: preferences.currency,
          credit_type: form.creditType,
          discount_type: "value",
          discount_amount: form.discountAmount,
          reason: form.reason as CreditNoteReason,
          notes: form.notes || null,
          customer_id: form.customerId,
          related_invoice_id: form.invoiceId,
          items: linesToPayload(form.lineItems),
        });
        toast({ title: "Draft updated" });
        router.push(`/app/credit-notes/${id}`);
      } catch (e: unknown) {
        toast({
          title: "Save failed",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      }
    });
  }

  if (loading) {
    return (
      <AppPageShell className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
        <FormTwoColumnPageSkeleton withLineItems />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      subtitle="Edit this draft before posting."
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link href={`/app/credit-notes/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <Button
          disabled={isRunning}
          className="gap-2"
          onClick={() => void handleSave()}
        >
          <Save className="h-4 w-4" />
          Save draft
        </Button>
      }
    >
      <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <CreditNoteForm preferences={preferences} value={form} />
      </div>
    </AppPageShell>
  );
}
