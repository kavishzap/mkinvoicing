"use client";
import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Send } from "lucide-react";
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
import { fetchPreferences, type Preferences } from "@/lib/settings-service";
import {
  createCreditNote,
  listCreditableInvoices,
  type CreditNoteReason,
} from "@/lib/credit-notes-service";
import { AppPageShell } from "@/components/app-page-shell";
import {
  CreditNoteForm,
  useCreditNoteFormState,
  validateCreditNoteForm,
  linesToPayload,
} from "@/components/credit-note-form";
import { runActionProgress } from "@/lib/action-progress-bridge";
import { useActionProgress } from "@/contexts/action-progress-context";
import { getInvoice } from "@/lib/invoices-service";
import { listCustomers } from "@/lib/customers-service";

function NewCreditNotePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromInvoiceId = searchParams.get("fromInvoice");
  const { toast } = useToast();
  const { isRunning } = useActionProgress();

  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [creditableBalance, setCreditableBalance] = useState<number | null>(
    null,
  );
  const [saveMode, setSaveMode] = useState<"draft" | "posted" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useCreditNoteFormState();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prefs = await fetchPreferences();
        if (cancelled) return;
        setPreferences(prefs);

        if (fromInvoiceId) {
          const inv = await getInvoice(fromInvoiceId);
          if (inv?.customer_id) {
            const { rows } = await listCustomers({
              search: "",
              includeInactive: false,
              page: 1,
              pageSize: 200,
            });
            const customer = rows.find((c) => c.id === inv.customer_id);
            if (customer) {
              form.setCustomerId(customer.id);
              form.setInvoiceId(fromInvoiceId);
              form.setReason("goods_returned");
            }
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromInvoiceId]);

  useEffect(() => {
    if (!form.customerId || !form.invoiceId) {
      setCreditableBalance(null);
      return;
    }
    void listCreditableInvoices(form.customerId).then((rows) => {
      const hit = rows.find((r) => r.id === form.invoiceId);
      setCreditableBalance(hit?.creditableBalance ?? null);
    });
  }, [form.customerId, form.invoiceId]);

  const submitLabel = useMemo(
    () => (saveMode === "posted" ? "Post credit note" : "Save as draft"),
    [saveMode],
  );

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

    const status = saveMode === "posted" ? "posted" : "draft";
    const actionLabel =
      status === "posted" ? "Posting credit note…" : "Saving draft…";

    await runActionProgress(actionLabel, async () => {
      try {
        if (!preferences) throw new Error("Preferences not loaded");

        const id = await createCreditNote({
          issue_date: form.issueDate,
          status,
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

        toast({
          title: status === "posted" ? "Credit note posted" : "Draft saved",
          description:
            status === "posted"
              ? "Invoice balance has been updated."
              : "You can edit and post this credit note later.",
        });
        router.push(`/app/credit-notes/${id}`);
      } catch (e: unknown) {
        toast({
          title: "Could not save credit note",
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
      subtitle="Link to an invoice, choose full or partial credit, then save as draft or post."
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link href="/app/credit-notes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={isRunning}
            className="gap-2"
            onClick={() => {
              setSaveMode("draft");
              setConfirmOpen(true);
            }}
          >
            <Save className="h-4 w-4" />
            Save as draft
          </Button>
          <Button
            disabled={isRunning}
            className="gap-2"
            onClick={() => {
              setSaveMode("posted");
              setConfirmOpen(true);
            }}
          >
            <Send className="h-4 w-4" />
            Post credit note
          </Button>
        </div>
      }
    >
      <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <CreditNoteForm preferences={preferences} value={form} />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{submitLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              {saveMode === "posted"
                ? "Posting will reduce the linked invoice outstanding balance. This cannot be edited afterwards."
                : "The credit note will be saved as a draft. You can edit and post it later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning}
              onClick={(e) => {
                e.preventDefault();
                setConfirmOpen(false);
                void handleSave();
              }}
            >
              {submitLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}

export default function NewCreditNotePage() {
  return (
    <Suspense
      fallback={
        <AppPageShell className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
          <FormTwoColumnPageSkeleton withLineItems />
        </AppPageShell>
      }
    >
      <NewCreditNotePageContent />
    </Suspense>
  );
}
