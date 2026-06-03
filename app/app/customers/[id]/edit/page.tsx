"use client";
import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Building2, Mail, Save, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import {
  getCustomer,
  getCachedCustomer,
  updateCustomer,
  type CustomerRow,
} from "@/lib/customers-service";
import { getActiveCompanyId } from "@/lib/active-company";
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
import { CustomerRelatedDocuments } from "@/components/customer-related-documents";

/** Bordered page shell; height follows inner content (no flex-1 / viewport min-height). */
const primaryCardShellClass =
  "mb-6 flex w-full min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:mb-8 sm:p-5 lg:p-6";

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

function rowToForm(c: CustomerRow): CustomerDirectoryFormData {
  return {
    type: c.type,
    companyName: c.companyName ?? "",
    contactName: c.contactName ?? "",
    fullName: c.fullName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    phone_2: c.phone_2 ?? "",
    map_location: c.map_location ?? "",
    street: c.street ?? "",
    city: c.city ?? "",
    cityId: c.cityId ?? "",
    postal: c.postal ?? "",
    country: c.country ?? "",
    address_line_1: c.address_line_1 ?? "",
    address_line_2: c.address_line_2 ?? "",
  };
}

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<CustomerDirectoryFormData>(() =>
    emptyCustomerDirectoryForm("company"),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof CustomerDirectoryFormData, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [cities, setCities] = useState<DeliveryCityRow[]>([]);
  const [relatedDocsReload, setRelatedDocsReload] = useState(0);

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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const companyId = await getActiveCompanyId();
        const cached = companyId ? getCachedCustomer(companyId, id) : null;
        if (cancelled) return;
        if (cached) {
          setFormData(rowToForm(cached));
          setLoading(false);
        } else {
          setLoading(true);
        }

        const row = await getCustomer(id);
        if (cancelled) return;
        if (!row) {
          toastRef.current({
            title: "Customer not found",
            description: "Check the link or open the customer from the list.",
            variant: "destructive",
          });
          router.replace("/app/customers");
          return;
        }
        setFormData(rowToForm(row));
      } catch (e: unknown) {
        if (!cancelled) {
          toastRef.current({
            title: "Could not load customer",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
          router.replace("/app/customers");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  function requestSave() {
    const next = validateCustomerDirectoryForm(formData);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toastRef.current({
        title: "Check the form",
        description: "Fix the highlighted fields.",
        variant: "destructive",
      });
      return;
    }
    setSaveConfirmOpen(true);
  }

  async function performSave() {
    try {
      setSaving(true);
      const updated = await updateCustomer(
        id,
        customerDirectoryFormToPayload(formData),
      );
      setFormData(rowToForm(updated));
      setRelatedDocsReload((n) => n + 1);
      toastRef.current({
        title: "Customer saved",
        description: "Your changes have been saved.",
      });
    } catch (err: unknown) {
      toastRef.current({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    requestSave();
  }

  const displayName =
    formData.type === "company"
      ? formData.companyName.trim() || "Company customer"
      : formData.fullName.trim() || "Individual customer";

  if (loading) {
    return (
      <AppPageShell className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
        <div className={primaryCardShellClass}>
          <FormTwoColumnPageSkeleton withLineItems={false} />
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to customers">
          <Link href="/app/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <Button
          type="button"
          onClick={requestSave}
          disabled={saving}
          className="gap-2 rounded font-semibold shadow-sm"
        >
          <Save className="size-3.5 shrink-0" aria-hidden />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      }
    >
      <div className={primaryCardShellClass}>
        <div className="flex min-w-0 flex-col gap-1 border-b border-border/60 pb-4">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold tracking-tight text-foreground sm:truncate">
              {displayName}
            </h2>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{formData.email || "No email"}</span>
              <span aria-hidden>·</span>
              <span className="capitalize">{formData.type}</span>
            </p>
          </div>
        </div>

        <form
          id="customer-edit-form"
          onSubmit={handleSubmit}
          className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10"
        >
          <SectionCard icon={Building2} title="Customer details">
            <CustomerDirectoryFormFields
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              cities={cities}
              allowTypeChange={false}
              className="py-0"
            />
          </SectionCard>
          <SectionCard icon={Mail} title="Document defaults">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Updates apply to new quotations and invoices. Existing documents keep
              the customer snapshot from when they were created.
            </p>
          </SectionCard>
        </form>

        {id ? (
          <CustomerRelatedDocuments customerId={id} reloadToken={relatedDocsReload} />
        ) : null}
      </div>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update {displayName} in your customer directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                setSaveConfirmOpen(false);
                void performSave();
              }}
            >
              {saving ? "Saving…" : "Save changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
