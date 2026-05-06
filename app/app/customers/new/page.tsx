"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, Mail, Save, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { addCustomer } from "@/lib/customers-service";
import { safeAppReturnTo } from "@/lib/safe-return-to";
import {
  CustomerDirectoryFormFields,
  customerDirectoryFormToPayload,
  emptyCustomerDirectoryForm,
  validateCustomerDirectoryForm,
  type CustomerDirectoryFormData,
} from "@/components/customer-directory-form-fields";
import {
  listDeliveryCities,
  type DeliveryCityRow,
} from "@/lib/delivery-zones-service";

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="field-controls flex min-h-0 flex-1 flex-col space-y-4 px-4 py-5 [&_input]:h-8 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs">
        {children}
      </CardContent>
    </Card>
  );
}

function NewCustomerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [formData, setFormData] = useState<CustomerDirectoryFormData>(() =>
    emptyCustomerDirectoryForm("company"),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof CustomerDirectoryFormData, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [cities, setCities] = useState<DeliveryCityRow[]>([]);

  const returnTo = safeAppReturnTo(searchParams.get("returnTo"));

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listDeliveryCities();
        setCities(rows);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = validateCustomerDirectoryForm(formData);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast({
        title: "Check the form",
        description: "Fix the highlighted fields.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const created = await addCustomer(customerDirectoryFormToPayload(formData));
      toast({
        title: "Customer added",
        description: "You can select them from your customer list.",
      });
      if (returnTo === "/app/customers") {
        router.push(`/app/customers/${created.id}/edit`);
      } else {
        router.push(returnTo);
      }
    } catch (err: unknown) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link href={returnTo}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" type="button" asChild>
            <Link href={returnTo}>Cancel</Link>
          </Button>
          <Button
            type="submit"
            form="customer-new-form"
            disabled={saving}
            className="gap-2 rounded font-semibold shadow-sm"
          >
            <Save className="size-3.5 shrink-0" aria-hidden />
            {saving ? "Saving…" : "Save customer"}
          </Button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="border-b border-border/60 pb-4 mb-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            New customer
          </h2>
          <p className={fieldLabelClass}>
            Add someone you sell to—they will appear in quotes, sales orders, and
            invoices.
          </p>
        </div>
        <form
          id="customer-new-form"
          onSubmit={handleSubmit}
          className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10"
        >
          <SectionCard icon={Building2} title="Customer details">
            <CustomerDirectoryFormFields
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              cities={cities}
              allowTypeChange
              className="py-0"
            />
          </SectionCard>
          <SectionCard icon={Mail} title="How this record is used">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Phone and city are required for delivery and routing. Email and
              display name are optional—you can add them later or pick this customer
              on quotes and invoices using phone or city.
            </p>
          </SectionCard>
        </form>
      </div>
    </AppPageShell>
  );
}

export default function NewCustomerPage() {
  return (
    <Suspense
      fallback={
        <AppPageShell fillHeight className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
          <div className="h-48 animate-pulse rounded-lg border bg-muted/40" />
        </AppPageShell>
      }
    >
      <NewCustomerForm />
    </Suspense>
  );
}
