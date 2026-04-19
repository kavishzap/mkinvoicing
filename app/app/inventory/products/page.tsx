"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Package,
  Lock,
  Unlock,
  ImageIcon,
  X,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getActiveCompanyId } from "@/lib/active-company";
import { AppPageShell } from "@/components/app-page-shell";
import {
  listActiveLocationsForSelect,
  type LocationOption,
} from "@/lib/locations-service";
import {
  listStocksByProduct,
  replaceProductLocationStocks,
} from "@/lib/product-location-stocks-service";
import {
  addProduct,
  deleteProduct,
  getProduct,
  listProducts,
  setProductActive,
  stripDataUrlPrefix,
  updateProduct,
  type ProductRow,
  type ProductPayload,
} from "@/lib/products-service";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // keep base64 under typical DB limits
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

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
    unit: "ea",
    costPrice: "0",
    salePrice: "0",
    currency: "MUR",
    imageBase64: null,
    imageMimeType: null,
  };
}

function rowToForm(row: ProductRow): FormState {
  return {
    name: row.name,
    sku: row.sku,
    description: row.description,
    unit: row.unit || "ea",
    costPrice: String(row.costPrice ?? 0),
    salePrice: String(row.salePrice ?? 0),
    currency: row.currency || "MUR",
    imageBase64: row.imageBase64,
    imageMimeType: row.imageMimeType || null,
  };
}

function formToPayload(form: FormState): ProductPayload {
  const cost = parseFloat(form.costPrice) || 0;
  const sale = parseFloat(form.salePrice) || 0;
  return {
    name: form.name,
    sku: form.sku.trim() || null,
    description: form.description.trim() || null,
    unit: form.unit.trim() || "ea",
    costPrice: cost,
    salePrice: sale,
    currency: form.currency.trim() || "MUR",
    imageBase64: form.imageBase64,
    imageMimeType: form.imageMimeType,
  };
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "MUR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
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

/** Returns parsed lines or null if invalid (toast already shown). */
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

export default function InventoryProductsPage() {
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [stockLines, setStockLines] = useState<StockLineForm[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [nameError, setNameError] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const id = await getActiveCompanyId();
      if (cancelled) return;
      setCompanyReady(!!id);
      if (!id) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      try {
        const res = await listProducts({
          search: searchQuery,
          includeInactive,
          page,
          pageSize,
        });
        if (!cancelled) {
          setRows(res.rows);
          setTotal(res.total);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Please try again.";
          toast({
            title: "Failed to load products",
            description: msg,
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast, searchQuery, includeInactive, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, includeInactive, pageSize]);

  async function reload() {
    if (companyReady !== true) return;
    const res = await listProducts({
      search: searchQuery,
      includeInactive,
      page,
      pageSize,
    });
    setRows(res.rows);
    setTotal(res.total);
  }

  async function openDialog(productId?: string) {
    setNameError("");
    setEditingId(productId ?? null);
    setDialogOpen(true);
    setDialogLoading(true);

    try {
      const opts = await listActiveLocationsForSelect();

      if (!productId) {
        setLocationOptions(opts);
        setForm(emptyForm());
        setStockLines([]);
        return;
      }

      const [p, stocks] = await Promise.all([
        getProduct(productId),
        listStocksByProduct(productId),
      ]);

      const idSet = new Set(opts.map((o) => o.id));
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
        [...extras, ...opts].sort((a, b) => a.name.localeCompare(b.name))
      );
      setForm(rowToForm(p));
      setStockLines(
        stocks.map((s) => ({
          key: newLineKey(),
          locationId: s.location_id,
          quantity: String(s.quantity),
        }))
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Could not load product",
        description: msg,
        variant: "destructive",
      });
      setDialogOpen(false);
    } finally {
      setDialogLoading(false);
    }
  }

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
      const payload = formToPayload(form);
      const isEdit = Boolean(editingId);

      let productId = editingId;
      if (productId) {
        await updateProduct(productId, payload);
      } else {
        const created = await addProduct({ ...payload, is_active: true });
        productId = created.id;
      }

      await replaceProductLocationStocks(productId, stockPayload);

      toast({
        title: isEdit ? "Product updated" : "Product added",
        description:
          stockPayload.length > 0
            ? `Stock saved for ${stockPayload.length} location(s).`
            : "No per-location quantities (optional).",
      });
      await reload();
      setDialogOpen(false);
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

  async function handleToggleActive(p: ProductRow) {
    try {
      await setProductActive(p.id, !p.isActive);
      toast({
        title: p.isActive ? "Product deactivated" : "Product activated",
      });
      await reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Update failed",
        description: msg,
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProduct(id);
      toast({ title: "Product deleted" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Delete failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      if (rows.length === 1 && page > 1) setPage((x) => x - 1);
      else await reload();
      setConfirmDeleteId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const previewUrl = dataUrlFromForm(form);

  return (
    <AppPageShell
      leading={
        <Link href="/app/inventory">
          <Button variant="ghost" size="icon" aria-label="Back to inventory">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Add or edit catalogue items and optional images—stock quantities follow per location."
      actions={
        <Button
          onClick={() => openDialog()}
          className="shrink-0 gap-2"
          disabled={companyReady !== true}
        >
          <Plus className="h-4 w-4" />
          Add product
        </Button>
      }
    >
      {companyReady === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company is linked to this account. Products are scoped to{" "}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">
              company_id
            </code>
            .
          </CardContent>
        </Card>
      )}

      {loading ? (
        <SkeletonFilters />
      ) : (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, SKU, or description…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={companyReady !== true}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={includeInactive}
                    onCheckedChange={(v) => setIncludeInactive(v === true)}
                    disabled={companyReady !== true}
                  />
                  Include inactive
                </label>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  disabled={companyReady !== true}
                >
                  <option value={5}>5 / page</option>
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <SkeletonTable rows={Math.min(pageSize, 6)} />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Image</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">SKU</th>
                <th className="p-3 text-left">Unit</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-right">Sale</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">
                    {p.imageMimeType ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Yes
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-muted-foreground">{p.sku || "—"}</td>
                  <td className="p-3">{p.unit}</td>
                  <td className="p-3 text-right tabular-nums">
                    {formatMoney(p.costPrice, p.currency)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatMoney(p.salePrice, p.currency)}
                  </td>
                  <td className="p-3">
                    {p.isActive ? (
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDialog(p.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(p)}>
                          {p.isActive ? (
                            <>
                              <Lock className="mr-2 h-4 w-4" />
                              Set inactive
                            </>
                          ) : (
                            <>
                              <Unlock className="mr-2 h-4 w-4" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirmDeleteId(p.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="p-8 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-10 w-10 opacity-50" />
                      {companyReady === false
                        ? "Link a company to manage products."
                        : searchQuery
                          ? "No matches. Try a different search."
                          : "No products yet. Add your first item."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && companyReady === true && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing{" "}
            <span className="font-medium text-foreground">{start || 0}</span>–
            <span className="font-medium text-foreground">{end || 0}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((x) => Math.max(1, x - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span>
              Page <span className="font-medium text-foreground">{page}</span> /{" "}
              {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((x) => Math.min(pages, x + 1))}
              disabled={page >= pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit product" : "Add product"}
            </DialogTitle>
            <DialogDescription>
              Set optional image (Base64) and how much of this product you hold
              at each warehouse location.
            </DialogDescription>
          </DialogHeader>

          {dialogLoading ? (
            <div className="space-y-3 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="p-name">Name *</Label>
                <Input
                  id="p-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Widget A"
                  className={nameError ? "border-destructive" : ""}
                />
                {nameError && (
                  <p className="text-xs text-destructive">{nameError}</p>
                )}
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
                  <Input
                    id="p-unit"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="ea, box, kg…"
                  />
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
                  rows={3}
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
                    disabled={locationOptions.length === 0}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add line
                  </Button>
                </div>
                {locationOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Create at least one active location under Inventory → Locations
                    to split stock by warehouse.
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
                  <div className="flex flex-1 flex-col gap-2">
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
                      PNG, JPEG, WebP, or GIF. Max 4 MB file size. Stored as
                      Base64 only (no Supabase Storage).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || dialogLoading}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              This cannot be undone. Remove any stock links before deleting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}

function SkeletonFilters() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="h-9 w-full animate-pulse rounded-md bg-muted sm:flex-1" />
          <div className="flex items-center gap-3">
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Image</th>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">SKU</th>
            <th className="p-3 text-left">Unit</th>
            <th className="p-3 text-right">Cost</th>
            <th className="p-3 text-right">Sale</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t">
              {Array.from({ length: 8 }).map((__, j) => (
                <td key={j} className="p-3">
                  <div className="h-5 animate-pulse rounded bg-muted" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
