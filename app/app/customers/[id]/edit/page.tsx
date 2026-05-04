"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import {
  getCustomer,
  updateCustomer,
  type CustomerRow,
} from "@/lib/customers-service";
import {
  CustomerDirectoryFormFields,
  customerDirectoryFormToPayload,
  emptyCustomerDirectoryForm,
  validateCustomerDirectoryForm,
  type CustomerDirectoryFormData,
} from "@/components/customer-directory-form-fields";

function rowToForm(c: CustomerRow): CustomerDirectoryFormData {
  return {
    type: c.type,
    companyName: c.companyName ?? "",
    contactName: c.contactName ?? "",
    fullName: c.fullName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    street: c.street ?? "",
    city: c.city ?? "",
    postal: c.postal ?? "",
    country: c.country ?? "",
    address_line_1: c.address_line_1 ?? "",
    address_line_2: c.address_line_2 ?? "",
  };
}

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<CustomerDirectoryFormData>(() =>
    emptyCustomerDirectoryForm("company"),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof CustomerDirectoryFormData, string>>
  >({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const row = await getCustomer(id);
        if (cancelled) return;
        if (!row) {
          toast({
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
          toast({
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
  }, [id, router, toast]);

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
      await updateCustomer(id, customerDirectoryFormToPayload(formData));
      toast({ title: "Customer updated" });
      router.push("/app/customers");
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

  if (loading) {
    return (
      <AppPageShell subtitle="Loading customer…">
        <div className="h-48 max-w-2xl animate-pulse rounded-lg border bg-muted/40" />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      subtitle="Update billing and contact details. This record is used across quotes and invoices."
      leading={
        <Button variant="ghost" size="icon" asChild aria-label="Back to customers">
          <Link href="/app/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" type="button" asChild>
            <Link href="/app/customers">Cancel</Link>
          </Button>
          <Button type="submit" form="customer-edit-form" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Edit customer</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="customer-edit-form" onSubmit={handleSubmit} className="space-y-2">
            <CustomerDirectoryFormFields
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              allowTypeChange={false}
            />
          </form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
