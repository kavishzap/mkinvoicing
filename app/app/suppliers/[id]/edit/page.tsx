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
import { AppPageShell, APP_PAGE_SHELL_CLASS } from "@/components/app-page-shell";

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
      <AppPageShell>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Invalid link.
          </CardContent>
        </Card>
      </AppPageShell>
    );
  }

  if (!loading && notFound) {
    return (
      <AppPageShell className="max-w-lg">
        <Card>
          <CardContent className="space-y-4 py-12 text-center">
            <p className="font-medium">Supplier not found</p>
            <Button asChild>
              <Link href="/app/suppliers">Back to suppliers</Link>
            </Button>
          </CardContent>
        </Card>
      </AppPageShell>
    );
  }

  if (loading) {
    return (
      <div className={`${APP_PAGE_SHELL_CLASS} max-w-7xl text-left`}>
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <AppPageShell
      className="max-w-7xl text-left"
      subtitle="Update this supplier’s contact or billing details, then save your changes."
      leading={
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
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" type="button" asChild>
            <Link href="/app/suppliers">Cancel</Link>
          </Button>
          <Button type="submit" form="supplier-edit-form" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form
        id="supplier-edit-form"
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
