"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SupplierFormFields } from "@/components/supplier-form-fields";
import { useToast } from "@/hooks/use-toast";
import {
  emptySupplierForm,
  supplierFormToPayload,
  supplierRowToForm,
  validateSupplierForm,
  type SupplierFormData,
} from "@/lib/supplier-form";
import { getSupplier, updateSupplier } from "@/lib/suppliers-service";

export default function EditSupplierPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [formData, setFormData] = useState<SupplierFormData>(
    emptySupplierForm("company")
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof SupplierFormData, string>>
  >({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setNotFound(false);
        const row = await getSupplier(id);
        if (cancelled) return;
        if (!row) {
          setNotFound(true);
        } else {
          setFormData(supplierRowToForm(row));
        }
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Failed to load supplier",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
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
      await updateSupplier(id, supplierFormToPayload(formData));
      toast({ title: "Supplier updated" });
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

  if (!id) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Invalid link.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!loading && notFound) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="font-medium">Supplier not found</p>
            <Button asChild>
              <Link href="/app/suppliers">Back to suppliers</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 text-left">
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72 rounded-lg bg-muted animate-pulse" />
          <div className="h-72 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-48 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    );
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
          <h1 className="text-3xl font-bold tracking-tight">Edit supplier</h1>
          <p className="text-muted-foreground mt-1">
            Update vendor details and save.
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
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
