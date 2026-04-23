"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import {
  listActiveLocationsForSelect,
  type LocationOption,
} from "@/lib/locations-service";
import { listStocksByProduct } from "@/lib/product-location-stocks-service";
import {
  listStockBalancesForProduct,
  recordInventoryTransfer,
  type StockBalanceRow,
} from "@/lib/inventory-stock-service";
import {
  getProduct,
  stripDataUrlPrefix,
  type ProductPayload,
  updateProduct,
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

function rowToForm(p: Awaited<ReturnType<typeof getProduct>>): FormState {
  return {
    name: p.name ?? "",
    sku: p.sku ?? "",
    description: p.description ?? "",
    unit: p.unit || "pcs",
    costPrice: String(p.costPrice ?? 0),
    salePrice: String(p.salePrice ?? 0),
    currency: p.currency || "MUR",
    imageBase64: p.imageBase64 ?? null,
    imageMimeType: p.imageMimeType || null,
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

export default function EditInventoryProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = params?.id;
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(emptyForm());
  const [stockLines, setStockLines] = useState<StockLineForm[]>([]);
  const [activeLocationOptions, setActiveLocationOptions] = useState<LocationOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [transferAtLoc, setTransferAtLoc] = useState<StockBalanceRow[]>([]);
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refreshStockViews(
    pid: string,
    activeLocs: LocationOption[]
  ): Promise<void> {
    const [stocks, atLoc] = await Promise.all([
      listStocksByProduct(pid),
      listStockBalancesForProduct(pid),
    ]);

    const idSet = new Set(activeLocs.map((o) => o.id));
    const extras: LocationOption[] = [];
    for (const s of stocks) {
      if (!idSet.has(s.location_id)) {
        idSet.add(s.location_id);
        extras.push({
          id: s.location_id,
          name: `${s.locationName || "Location"} (inactive)`,
          code: s.locationCode,
        });
      }
    }
    setLocationOptions(
      [...extras, ...activeLocs].sort((a, b) => a.name.localeCompare(b.name))
    );
    setStockLines(
      stocks.map((s) => ({
        key: newLineKey(),
        locationId: s.location_id,
        quantity: String(s.quantity),
      }))
    );
    setTransferAtLoc(atLoc);
    setTransferFromId((prev) =>
      prev && atLoc.some((r) => r.location_id === prev) ? prev : ""
    );
  }

  useEffect(() => {
    if (!productId) return;
    (async () => {
      try {
        const opts = await listActiveLocationsForSelect();
        const p = await getProduct(productId);
        setActiveLocationOptions(opts);
        setForm(rowToForm(p));
        await refreshStockViews(productId, opts);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Could not load product",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [productId, toast]);

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
        toast({ title: "Could not read image", variant: "destructive" });
      }
    };
    reader.onerror = () => {
      toast({ title: "Read failed", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!productId) return;
    if (!validate()) return;
    try {
      setSaving(true);
      await updateProduct(productId, formToPayload(form));
      toast({ title: "Product updated" });
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

  const transferFromRow = transferAtLoc.find((r) => r.location_id === transferFromId);
  const maxTransferQty = transferFromRow?.quantity ?? 0;
  const transferToOptions = activeLocationOptions.filter(
    (l) => l.id !== transferFromId
  );

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return;
    if (!transferFromId || !transferToId) {
      toast({
        title: "Missing fields",
        description: "Choose source and destination locations.",
        variant: "destructive",
      });
      return;
    }
    if (transferFromId === transferToId) {
      toast({
        title: "Invalid transfer",
        description: "Source and destination must differ.",
        variant: "destructive",
      });
      return;
    }
    const q = parseFloat(transferQty);
    if (Number.isNaN(q) || q <= 0) {
      toast({ title: "Invalid quantity", variant: "destructive" });
      return;
    }
    if (q > maxTransferQty) {
      toast({
        title: "Not enough stock",
        description: `Only ${maxTransferQty} available at the source location.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setTransferSubmitting(true);
      await recordInventoryTransfer({
        productId,
        fromLocationId: transferFromId,
        toLocationId: transferToId,
        quantity: q,
        note: transferNote.trim() || null,
      });
      toast({
        title: "Transfer recorded",
        description: "Stock balances were updated.",
      });
      setTransferQty("");
      setTransferNote("");
      setTransferToId("");
      await refreshStockViews(productId, activeLocationOptions);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Transfer failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setTransferSubmitting(false);
    }
  }

  const previewUrl = dataUrlFromForm(form);

  return (
    <AppPageShell
      subtitle="Edit catalogue item details and image. Stock by location is read-only here."
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
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Edit product</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading…</div>
          ) : (
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
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                      onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
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
                      onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
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
                        <img src={previewUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => handleImageFile(e.target.files?.[0] ?? null)}
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
                        PNG, JPEG, WebP, or GIF. Max 4 MB file size. Stored as Base64 only.
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
                    <Button type="button" variant="outline" size="sm" className="gap-1 shrink-0" disabled>
                      <Plus className="h-3.5 w-3.5" />
                      Add line
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stock by location is read-only here.
                  </p>
                  {locationOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Create at least one active location under Inventory - Locations.
                    </p>
                  ) : stockLines.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No stock lines.</p>
                  ) : (
                    <div className="space-y-2">
                      {stockLines.map((line, idx) => {
                        const rowOpts = locationsForRow(idx, stockLines, locationOptions);
                        return (
                          <div
                            key={line.key}
                            className="flex flex-col gap-2 sm:flex-row sm:items-end"
                          >
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Location</Label>
                              <Select value={line.locationId || NONE_LOC} onValueChange={() => {}} disabled>
                                <SelectTrigger className="w-full min-w-0">
                                  <SelectValue placeholder="Choose location" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NONE_LOC}>Choose location</SelectItem>
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
                              <Label className="text-xs text-muted-foreground">Quantity</Label>
                              <Input type="number" min={0} step="any" value={line.quantity} disabled />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 self-end text-muted-foreground hover:text-destructive"
                              aria-label="Remove line"
                              disabled
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

              <div className="rounded-lg border border-border p-4 space-y-3 lg:col-span-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Transfer stock for this product</p>
                  <p className="text-xs text-muted-foreground">
                    Move quantity from one location to another.
                  </p>
                </div>
                <form onSubmit={handleTransfer} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>From location</Label>
                      <Select
                        value={transferFromId || NONE_LOC}
                        onValueChange={(v) =>
                          setTransferFromId(v === NONE_LOC ? "" : v)
                        }
                        disabled={transferAtLoc.length === 0 || transferSubmitting}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Where stock is now" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_LOC}>Choose location</SelectItem>
                          {transferAtLoc.map((r) => (
                            <SelectItem key={r.location_id} value={r.location_id}>
                              {r.location_name} ({r.quantity} on hand)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>To location</Label>
                      <Select
                        value={transferToId || NONE_LOC}
                        onValueChange={(v) =>
                          setTransferToId(v === NONE_LOC ? "" : v)
                        }
                        disabled={transferSubmitting}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Destination" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_LOC}>Choose location</SelectItem>
                          {transferToOptions.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                              {l.code ? ` (${l.code})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="transfer-qty">Quantity</Label>
                      <Input
                        id="transfer-qty"
                        type="number"
                        min={0}
                        step="any"
                        value={transferQty}
                        onChange={(e) => setTransferQty(e.target.value)}
                        placeholder={transferFromRow ? `Max ${maxTransferQty}` : "0"}
                        disabled={transferSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transfer-note">Note (optional)</Label>
                      <Textarea
                        id="transfer-note"
                        rows={2}
                        value={transferNote}
                        onChange={(e) => setTransferNote(e.target.value)}
                        placeholder="e.g. Rebalanced for branch display"
                        disabled={transferSubmitting}
                      />
                    </div>
                  </div>
                  <Button type="submit" size="sm" disabled={transferSubmitting}>
                    {transferSubmitting ? "Saving..." : "Record transfer"}
                  </Button>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  );
}

