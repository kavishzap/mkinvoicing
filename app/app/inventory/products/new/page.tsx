"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon, MapPin, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { getActiveCompanyId } from "@/lib/active-company";
import {
  listActiveLocationsForSelect,
  type LocationOption,
} from "@/lib/locations-service";
import { replaceProductLocationStocks } from "@/lib/product-location-stocks-service";
import {
  addProduct,
  stripDataUrlPrefix,
  type ProductPayload,
} from "@/lib/products-service";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const UNIT_OPTIONS = [
  "pcs",
  "kg",
  "g",
  "lb",
  "oz",
  "l",
  "ml",
  "m",
  "cm",
  "box",
  "pack",
  "set",
] as const;
const NONE_LOC = "__none__";

type StockLineForm = {
  key: string;
  locationId: string;
  quantity: string;
};

function newLineKey() {
  return globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random()}`;
}

type FormState = {
  name: string;
  sku: string;
  description: string;
  unit: string;
  costPrice: string;
  salePrice: string;
  currency: string;
  imageBase64: string | null;
  imageMimeType: string | null;
};

function emptyForm(): FormState {
  return {
    name: "",
    sku: "",
    description: "",
    unit: "pcs",
    costPrice: "0",
    salePrice: "0",
    currency: "MUR",
    imageBase64: null,
    imageMimeType: null,
  };
}

function formToPayload(form: FormState): ProductPayload {
  const cost = parseFloat(form.costPrice) || 0;
  const sale = parseFloat(form.salePrice) || 0;
  return {
    name: form.name,
    sku: form.sku.trim() || null,
    description: form.description.trim() || null,
    unit: form.unit.trim() || "pcs",
    costPrice: cost,
    salePrice: sale,
    currency: form.currency.trim() || "MUR",
    imageBase64: form.imageBase64,
    imageMimeType: form.imageMimeType,
  };
}

function dataUrlFromForm(form: FormState): string | null {
  if (!form.imageBase64 || !form.imageMimeType) return null;
  return `data:${form.imageMimeType};base64,${form.imageBase64}`;
}

function locationsForRow(
  rowIndex: number,
  lines: StockLineForm[],
  options: LocationOption[]
): LocationOption[] {
  const taken = new Set(
    lines
      .filter((_, i) => i !== rowIndex)
      .map((l) => l.locationId)
      .filter(Boolean)
  );
  return options.filter(
    (o) => o.id === lines[rowIndex]?.locationId || !taken.has(o.id)
  );
}

function parseStockLines(
  lines: StockLineForm[],
  toast: ReturnType<typeof useToast>["toast"]
): { locationId: string; quantity: number }[] | null {
  const out: { locationId: string; quantity: number }[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const loc = line.locationId.trim();
    const qtyRaw = line.quantity.trim();

    if (!loc) {
      if (qtyRaw !== "" && qtyRaw !== "0") {
        toast({
          title: "Missing location",
          description:
            "Select a warehouse for each row that has a quantity, or clear the quantity.",
          variant: "destructive",
        });
        return null;
      }
      continue;
    }

    const q = parseFloat(line.quantity);
    if (Number.isNaN(q) || q < 0) {
      toast({
        title: "Invalid quantity",
        description: "Use zero or a positive number for each location.",
        variant: "destructive",
      });
      return null;
    }

    if (seen.has(loc)) {
      toast({
        title: "Duplicate location",
        description: "Each location can only appear once. Remove or merge rows.",
        variant: "destructive",
      });
      return null;
    }
    seen.add(loc);
    out.push({ locationId: loc, quantity: q });
  }

  return out;
}

export default function NewInventoryProductPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [stockLines, setStockLines] = useState<StockLineForm[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const opts = await listActiveLocationsForSelect();
        setLocationOptions(opts);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Could not load locations",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  function addStockLine() {
    setStockLines((prev) => [
      ...prev,
      { key: newLineKey(), locationId: "", quantity: "0" },
    ]);
  }

  function removeStockLine(key: string) {
    setStockLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateStockLine(
    key: string,
    patch: Partial<Pick<StockLineForm, "locationId" | "quantity">>
  ) {
    setStockLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );
  }

  function validate(): boolean {
    if (!form.name.trim()) {
      setNameError("Name is required");
      return false;
    }
    setNameError("");
    const hasImg = !!(form.imageBase64 && form.imageMimeType);
    const halfImg =
      (!!form.imageBase64 && !form.imageMimeType) ||
      (!form.imageBase64 && !!form.imageMimeType);
    if (halfImg) {
      toast({
        title: "Invalid image",
        description: "Select an image file or clear the image.",
        variant: "destructive",
      });
      return false;
    }
    if (hasImg && form.imageBase64 && form.imageBase64.length > 5_242_880) {
      toast({
        title: "Image too large",
        description: "Use a smaller image (under ~4 MB file size).",
        variant: "destructive",
      });
      return false;
    }
    return true;
  }

  async function handleImageFile(file: File | null) {
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) {
      toast({
        title: "Unsupported format",
        description: "Use PNG, JPEG, WebP, or GIF.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: "File too large",
        description: "Maximum size is 4 MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      try {
        const base64 = stripDataUrlPrefix(result);
        setForm((f) => ({
          ...f,
          imageBase64: base64,
          imageMimeType: file.type,
        }));
      } catch {
        toast({
          title: "Could not read image",
          variant: "destructive",
        });
      }
    };
    reader.onerror = () => {
      toast({ title: "Read failed", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!validate()) return;
    const stockPayload = parseStockLines(stockLines, toast);
    if (stockPayload === null) return;

    try {
      setSaving(true);
      const companyId = await getActiveCompanyId();
      if (!companyId) {
        toast({
          title: "No active company",
          description: "Link a company before adding products.",
          variant: "destructive",
        });
        return;
      }
      const created = await addProduct({ ...formToPayload(form), is_active: true });
      await replaceProductLocationStocks(created.id, stockPayload);
      toast({
        title: "Product added",
        description:
          stockPayload.length > 0
            ? `Stock saved for ${stockPayload.length} location(s).`
            : "No per-location quantities (optional).",
      });
      router.push("/app/inventory/products");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Save failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = dataUrlFromForm(form);

  return (
    <AppPageShell
      subtitle="Create a catalogue item and optional per-location stock."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" asChild aria-label="Back to products">
            <Link href="/app/inventory/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" onClick={() => router.push("/app/inventory/products")}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Add product"}
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Product details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-name">Name *</Label>
                <Input
                  id="p-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Widget A"
                  className={nameError ? "border-destructive" : ""}
                />
                {nameError ? (
                  <p className="text-xs text-destructive">{nameError}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-sku">SKU</Label>
                  <Input
                    id="p-sku"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="SKU-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-unit">Unit</Label>
                  <Select
                    value={form.unit}
                    onValueChange={(v) => setForm({ ...form, unit: v })}
                  >
                    <SelectTrigger id="p-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-desc">Description</Label>
                <Textarea
                  id="p-desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={4}
                  placeholder="Optional"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-cost">Cost price</Label>
                  <Input
                    id="p-cost"
                    type="number"
                    min={0}
                    step="any"
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm({ ...form, costPrice: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-sale">Sale price</Label>
                  <Input
                    id="p-sale"
                    type="number"
                    min={0}
                    step="any"
                    value={form.salePrice}
                    onChange={(e) =>
                      setForm({ ...form, salePrice: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-curr">Currency</Label>
                <Input
                  id="p-curr"
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value.toUpperCase() })
                  }
                  placeholder="MUR"
                  maxLength={8}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Image</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) =>
                        handleImageFile(e.target.files?.[0] ?? null)
                      }
                      className="cursor-pointer text-sm"
                    />
                    {(form.imageBase64 || form.imageMimeType) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit gap-1"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            imageBase64: null,
                            imageMimeType: null,
                          }))
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                        Remove image
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      PNG, JPEG, WebP, or GIF. Max 4 MB file size. Stored as Base64
                      only.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Stock by location
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 shrink-0"
                    onClick={addStockLine}
                    disabled={locationOptions.length === 0 || loading}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add line
                  </Button>
                </div>
                {locationOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Create at least one active location under Inventory -
                    Locations.
                  </p>
                ) : stockLines.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No lines yet. Use &quot;Add line&quot; to record quantity per
                    location (optional).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stockLines.map((line, idx) => {
                      const rowOpts = locationsForRow(
                        idx,
                        stockLines,
                        locationOptions
                      );
                      return (
                        <div
                          key={line.key}
                          className="flex flex-col gap-2 sm:flex-row sm:items-end"
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                              Location
                            </Label>
                            <Select
                              value={line.locationId || NONE_LOC}
                              onValueChange={(v) =>
                                updateStockLine(line.key, {
                                  locationId: v === NONE_LOC ? "" : v,
                                })
                              }
                            >
                              <SelectTrigger className="w-full min-w-0">
                                <SelectValue placeholder="Choose location" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE_LOC}>
                                  Choose location
                                </SelectItem>
                                {rowOpts.map((opt) => (
                                  <SelectItem key={opt.id} value={opt.id}>
                                    {opt.name}
                                    {opt.code ? ` (${opt.code})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-full space-y-1.5 sm:w-32">
                            <Label className="text-xs text-muted-foreground">
                              Quantity
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={line.quantity}
                              onChange={(e) =>
                                updateStockLine(line.key, {
                                  quantity: e.target.value,
                                })
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 self-end text-muted-foreground hover:text-destructive"
                            onClick={() => removeStockLine(line.key)}
                            aria-label="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
