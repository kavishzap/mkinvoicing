"use client";
export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

  const returnTo = safeAppReturnTo(searchParams.get("returnTo"));

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
      await addCustomer(customerDirectoryFormToPayload(formData));
      toast({
        title: "Customer added",
        description: "You can select them from your customer list.",
      });
      router.push(returnTo);
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
      subtitle="Add someone you sell to—they will appear in quotes, sales orders, and invoices."
      leading={
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
          <Button type="submit" form="customer-new-form" disabled={saving}>
            {saving ? "Saving…" : "Save customer"}
          </Button>
        </div>
      }
    >
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>New customer</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="customer-new-form" onSubmit={handleSubmit} className="space-y-2">
            <CustomerDirectoryFormFields
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              allowTypeChange
            />
          </form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}

export default function NewCustomerPage() {
  return (
    <Suspense
      fallback={
        <AppPageShell subtitle="Loading…">
          <div className="h-48 max-w-2xl animate-pulse rounded-lg border bg-muted/40" />
        </AppPageShell>
      }
    >
      <NewCustomerForm />
    </Suspense>
  );
}
