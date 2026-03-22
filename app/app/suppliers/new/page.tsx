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
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-left">
      <div className="flex items-center gap-4">
        <Link href="/app/suppliers">
          <Button variant="ghost" size="icon" type="button">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New supplier</h1>
          <p className="text-muted-foreground mt-1">
            Enter vendor details — you can edit them anytime.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <SupplierFormFields
          formData={formData}
          setFormData={setFormData}
          errors={errors}
        />

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-6">
          <Button variant="outline" type="button" asChild>
            <Link href="/app/suppliers">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save supplier"}
          </Button>
        </div>
      </form>
    </div>
  );
}
