"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierFormFields } from "@/components/supplier-form-fields";
import { useToast } from "@/hooks/use-toast";
import {
  emptySupplierForm,
  supplierFormToPayload,
  validateSupplierForm,
  type SupplierFormData,
} from "@/lib/supplier-form";
import { addSupplier } from "@/lib/suppliers-service";
import { AppPageShell } from "@/components/app-page-shell";

export default function NewSupplierPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState<SupplierFormData>(
    emptySupplierForm("company")
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof SupplierFormData, string>>
  >({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = validateSupplierForm(formData);
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
      await addSupplier(supplierFormToPayload(formData));
      toast({ title: "Supplier added" });
      router.push("/app/suppliers");
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
      className="max-w-7xl text-left"
      subtitle="Fill in the supplier’s details and save—you can change them later from the list."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/suppliers">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label="Back to suppliers"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" type="button" asChild>
            <Link href="/app/suppliers">Cancel</Link>
          </Button>
          <Button type="submit" form="supplier-new-form" disabled={saving}>
            {saving ? "Saving…" : "Save supplier"}
          </Button>
        </div>
      }
    >
      <form
        id="supplier-new-form"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <SupplierFormFields
          formData={formData}
          setFormData={setFormData}
          errors={errors}
        />
      </form>
    </AppPageShell>
  );
}
