"use client";
import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, Save, UserRound, type LucideIcon } from "lucide-react";
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
import { addCustomer } from "@/lib/customers-service";
import { safeAppReturnTo } from "@/lib/safe-return-to";
import { cn } from "@/lib/utils";
import {
  CustomerDirectoryFormFields,
  customerDirectoryFormToPayload,
  emptyCustomerDirectoryForm,
  validateCustomerDirectoryForm,
  type CustomerDirectoryFormData,
} from "@/components/customer-directory-form-fields";
import { runActionProgress } from "@/lib/action-progress-bridge";
import { useActionProgress } from "@/contexts/action-progress-context";
import {
  listDeliveryCities,
  type DeliveryCityRow,
} from "@/lib/delivery-zones-service";

const primaryCardShellClass =
  "flex w-full min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6";

const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm",
        className
      )}
    >
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
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [formData, setFormData] = useState<CustomerDirectoryFormData>(() =>
    emptyCustomerDirectoryForm("company")
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof CustomerDirectoryFormData, string>>
  >({});
  const { isRunning } = useActionProgress();
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [cities, setCities] = useState<DeliveryCityRow[]>([]);

  const returnTo = safeAppReturnTo(searchParams.get("returnTo"));

  const customerPreviewName =
    formData.type === "company"
      ? formData.companyName.trim() || "Company customer"
      : formData.fullName.trim() || "Individual customer";

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
    await runActionProgress("Creating customer…", async () => {
      try {
      const created = await addCustomer(customerDirectoryFormToPayload(formData));
      toastRef.current({
        title: "Customer added",
        description: "You can select them from your customer list.",
      });
      if (returnTo === "/app/customers") {
        router.push(`/app/customers/${created.id}/edit`);
      } else {
        router.push(returnTo);
      }
      } catch (err: unknown) {
      toastRef.current({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    requestSave();
  }

  return (
    <AppPageShell
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
            type="button"
            onClick={requestSave}
            disabled={isRunning}
            className="gap-2 rounded font-semibold shadow-sm"
          >
            <Save className="size-3.5 shrink-0" aria-hidden />
            "Save customer"
          </Button>
        </div>
      }
    >
      <div className={primaryCardShellClass}>
        <div className="flex min-w-0 flex-col gap-1 border-b border-border/60 pb-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            New customer
          </h2>
          <p className="text-xs text-muted-foreground">
            Add a company or individual to your directory for quotations, sales
            orders, and invoices.
          </p>
        </div>

        <form
          id="customer-new-form"
          onSubmit={handleSubmit}
          className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10"
        >
          <SectionCard icon={Building2} title="Customer details" className="min-h-0">
            <CustomerDirectoryFormFields
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              cities={cities}
              allowTypeChange
              className="py-0"
            />
          </SectionCard>

          <SectionCard icon={UserRound} title="Requirements" className="min-h-0">
            <div className="flex min-h-0 flex-1 flex-col justify-between gap-4">
              <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Phone</span> and{" "}
                  <span className="font-medium text-foreground">city</span> are
                  required. All other fields are optional but help on documents and
                  delivery routing.
                </p>
                <p>
                  Choose <span className="font-medium text-foreground">Company</span>{" "}
                  for a business with a contact person, or{" "}
                  <span className="font-medium text-foreground">Individual</span> for
                  a person billed directly.
                </p>
                <p>
                  After saving, this customer appears in pickers when you create
                  sales orders, quotations, and invoices.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground/90">
                You can update details anytime from the customer list.
              </p>
            </div>
          </SectionCard>
        </form>
      </div>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add {customerPreviewName} to your customer directory
              {returnTo !== "/app/customers"
                ? " and return you to the previous page."
                : " and open the customer edit page."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning}
              onClick={(e) => {
                e.preventDefault();
                setSaveConfirmOpen(false);
                void performSave();
              }}
            >
              "Save customer"
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}

export default function NewCustomerPage() {
  return (
    <Suspense
      fallback={
        <AppPageShell className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
          <div className={primaryCardShellClass}>
            <FormTwoColumnPageSkeleton withLineItems={false} />
          </div>
        </AppPageShell>
      }
    >
      <NewCustomerForm />
    </Suspense>
  );
}
