"use client";

import {
  FormTwoColumnPageSkeleton,
  TableBodyRowsSkeleton,
} from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  History,
  MapPin,
  Package,
  PackageMinus,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPageShell } from "@/components/app-page-shell";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  listActiveLocationsForSelect,
  type LocationOption,
} from "@/lib/locations-service";
import { listStocksByProduct } from "@/lib/product-location-stocks-service";
import {
  listInventoryMovements,
  listStockBalancesForProduct,
  recordInventoryAdjustmentOut,
  recordInventoryRefill,
  recordInventoryTransfer,
  type InventoryMovementRow,
  type StockBalanceRow,
} from "@/lib/inventory-stock-service";
import {
  getProduct,
  type ProductPayload,
  updateProduct,
} from "@/lib/products-service";

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

const MOV_EVENT_LABELS: Record<InventoryMovementRow["event_type"], string> = {
  transfer: "Transfer",
  refill: "Refill",
  adjustment_out: "Stock out",
};

const PRODUCT_MOV_HISTORY_PAGE_SIZE = 15;
const stockMovFormClass = "max-w-xl space-y-4";

function formatMovementWhen(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

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
  };
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
  };
}

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

function ReqLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className={fieldLabelClass}>
      {children}
      <span className="text-destructive" aria-hidden>
        {" "}
        *
      </span>
    </Label>
  );
}

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
        "flex flex-col gap-0 rounded-lg border bg-card py-0 shadow-sm",
        className,
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="field-controls flex flex-col gap-4 px-4 py-5 [&_input]:h-8 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs">
        {children}
      </CardContent>
    </Card>
  );
}

export default function EditInventoryProductPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const productId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : undefined;
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
  const [stockMovTab, setStockMovTab] = useState("transfer");
  const [refillLocationId, setRefillLocationId] = useState("");
  const [refillQty, setRefillQty] = useState("");
  const [refillNote, setRefillNote] = useState("");
  const [refillSubmitting, setRefillSubmitting] = useState(false);
  const [stockOutFromId, setStockOutFromId] = useState("");
  const [stockOutQty, setStockOutQty] = useState("");
  const [stockOutNote, setStockOutNote] = useState("");
  const [stockOutSubmitting, setStockOutSubmitting] = useState(false);
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movPage, setMovPage] = useState(1);
  const [movLoading, setMovLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [productIsActive, setProductIsActive] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshStockViews = useCallback(
    async (pid: string, activeLocs: LocationOption[]): Promise<void> => {
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
      setStockOutFromId((prev) =>
        prev && atLoc.some((r) => r.location_id === prev) ? prev : ""
      );
    },
    []
  );

  const refreshMovementHistory = useCallback(async () => {
    if (!productId) return;
    setMovLoading(true);
    try {
      const res = await listInventoryMovements({
        productId,
        page: movPage,
        pageSize: PRODUCT_MOV_HISTORY_PAGE_SIZE,
      });
      setMovements(res.rows);
      setMovTotal(res.total);
    } catch (e: unknown) {
      toast({
        title: "Could not load movement history",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setMovLoading(false);
    }
  }, [productId, movPage, toast]);

  useEffect(() => {
    setMovPage(1);
  }, [productId]);

  useEffect(() => {
    if (!productId || loading) return;
    void refreshMovementHistory();
  }, [productId, loading, refreshMovementHistory]);

  useEffect(() => {
    if (!productId) {
      setLoadError("Missing product id in the URL.");
      setLoading(false);
      return;
    }

    setLoadError(null);
    setLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const opts = await listActiveLocationsForSelect();
        if (cancelled) return;
        const p = await getProduct(productId);
        if (cancelled) return;
        setActiveLocationOptions(opts);
        setForm(rowToForm(p));
        setProductIsActive(p.isActive);
        await refreshStockViews(productId, opts);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Please try again.";
        setLoadError(msg);
        setForm(emptyForm());
        toast({
          title: "Could not load product",
          description: msg,
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, toast, refreshStockViews]);

  function validate(): boolean {
    if (!form.name.trim()) {
      setNameError("Name is required");
      return false;
    }
    setNameError("");
    return true;
  }

  function requestSave() {
    if (!productId) return;
    if (!validate()) return;
    setSaveConfirmOpen(true);
  }

  async function performSave() {
    if (!productId) return;
    try {
      setSaving(true);
      await updateProduct(productId, {
        ...formToPayload(form),
        is_active: productIsActive,
      });
      toast({ title: "Product updated", description: "Your changes have been saved." });
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

  const stockOutFromRow = transferAtLoc.find((r) => r.location_id === stockOutFromId);
  const maxStockOutQty = stockOutFromRow?.quantity ?? 0;
  const movPages = Math.max(1, Math.ceil(movTotal / PRODUCT_MOV_HISTORY_PAGE_SIZE));

  async function handleRefill(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return;
    if (!refillLocationId) {
      toast({
        title: "Missing location",
        description: "Choose where to add stock.",
        variant: "destructive",
      });
      return;
    }
    const q = parseFloat(refillQty);
    if (Number.isNaN(q) || q <= 0) {
      toast({ title: "Invalid quantity", variant: "destructive" });
      return;
    }
    try {
      setRefillSubmitting(true);
      await recordInventoryRefill({
        productId,
        toLocationId: refillLocationId,
        quantity: q,
        note: refillNote.trim() || null,
      });
      toast({
        title: "Refill recorded",
        description: "Stock increased at that location.",
      });
      setRefillQty("");
      setRefillNote("");
      await refreshStockViews(productId, activeLocationOptions);
      await refreshMovementHistory();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Refill failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setRefillSubmitting(false);
    }
  }

  async function handleStockOut(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return;
    if (!stockOutFromId) {
      toast({
        title: "Missing location",
        description: "Choose which location to reduce stock at.",
        variant: "destructive",
      });
      return;
    }
    const q = parseFloat(stockOutQty);
    if (Number.isNaN(q) || q <= 0) {
      toast({ title: "Invalid quantity", variant: "destructive" });
      return;
    }
    if (q > maxStockOutQty) {
      toast({
        title: "Not enough stock",
        description: `Only ${maxStockOutQty} available at that location.`,
        variant: "destructive",
      });
      return;
    }
    try {
      setStockOutSubmitting(true);
      await recordInventoryAdjustmentOut({
        productId,
        fromLocationId: stockOutFromId,
        quantity: q,
        note: stockOutNote.trim() || null,
      });
      toast({
        title: "Stock out recorded",
        description: "Quantity was reduced at that location.",
      });
      setStockOutQty("");
      setStockOutNote("");
      await refreshStockViews(productId, activeLocationOptions);
      await refreshMovementHistory();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Stock out failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setStockOutSubmitting(false);
    }
  }

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
      await refreshMovementHistory();
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

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to products">
          <Link href="/app/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        loading || loadError ? undefined : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 font-semibold"
              onClick={() => router.push("/app/products")}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={requestSave}
              disabled={saving || loading}
              className="shrink-0 gap-2 font-semibold shadow-sm"
            >
              <Save className="size-3.5 shrink-0" aria-hidden />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        {loading ? (
          <FormTwoColumnPageSkeleton withLineItems={false} />
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="max-w-md text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" asChild>
              <Link href="/app/products">Back to products</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                  {form.name.trim() || "Product"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {form.sku.trim() ? form.sku : "No SKU"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  id="product-active"
                  checked={productIsActive}
                  onCheckedChange={setProductIsActive}
                  disabled={saving}
                  aria-label="Product active"
                />
                <Label
                  htmlFor="product-active"
                  className={cn(
                    "cursor-pointer text-xs font-medium text-foreground",
                    saving && "pointer-events-none opacity-60",
                  )}
                >
                  Active
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:gap-8 xl:gap-10">
              <SectionCard icon={Package} title="Product details">
                <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <ReqLabel htmlFor="p-name">Display name</ReqLabel>
                  <Input
                    id="p-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Widget A"
                    className={nameError ? "border-destructive" : ""}
                  />
                  {nameError ? (
                    <p className="text-xs text-destructive">{nameError}</p>
                  ) : null}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-sku" className={fieldLabelClass}>
                      SKU
                    </Label>
                    <Input
                      id="p-sku"
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      placeholder="SKU-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-unit" className={fieldLabelClass}>
                      Unit
                    </Label>
                    <Select
                      value={form.unit}
                      onValueChange={(v) => setForm({ ...form, unit: v })}
                    >
                      <SelectTrigger id="p-unit" className="h-8 w-full rounded-sm text-xs">
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
                  <Label htmlFor="p-desc" className={fieldLabelClass}>
                    Description
                  </Label>
                  <Textarea
                    id="p-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={5}
                    placeholder="Optional"
                    className="min-h-[120px] resize-y rounded-sm py-2"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-cost" className={fieldLabelClass}>
                      Cost price
                    </Label>
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
                    <Label htmlFor="p-sale" className={fieldLabelClass}>
                      Sale price
                    </Label>
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
                  <Label htmlFor="p-curr" className={fieldLabelClass}>
                    Currency
                  </Label>
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
              </SectionCard>
            </div>

            <SectionCard icon={MapPin} title="Stock by location">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Read-only snapshot — use{" "}
                  <span className="font-medium text-foreground/80">Stock movements</span>{" "}
                  below for transfer, refill, or stock out.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 shrink-0 text-xs"
                  disabled
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add line
                </Button>
              </div>
              {locationOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Create at least one active location under{" "}
                  <Link
                    href="/app/locations"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Locations
                  </Link>
                  .
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
                          <Label className={cn("text-xs", fieldLabelClass)}>
                            Location
                          </Label>
                          <Select
                            value={line.locationId || NONE_LOC}
                            onValueChange={() => {}}
                            disabled
                          >
                            <SelectTrigger className="h-8 w-full min-w-0 rounded-sm text-xs">
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
                          <Label className={cn("text-xs", fieldLabelClass)}>
                            Quantity
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={line.quantity}
                            disabled
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 self-end text-muted-foreground"
                          disabled
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={ArrowLeftRight}
              title="Stock movements"
              className="w-full self-start"
            >
              <p className="max-w-xl text-xs text-muted-foreground">
                Transfer between warehouses, record incoming stock (refill), or stock out.
                Events appear in history and update balances automatically.
              </p>
              <Tabs
                value={stockMovTab}
                onValueChange={setStockMovTab}
                className="w-full max-w-xl space-y-4"
              >
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
                  <TabsTrigger value="transfer" className="gap-1.5 text-xs">
                    <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Transfer
                  </TabsTrigger>
                  <TabsTrigger value="refill" className="gap-1.5 text-xs">
                    <PackagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Refill
                  </TabsTrigger>
                  <TabsTrigger value="stock_out" className="gap-1.5 text-xs">
                    <PackageMinus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Stock out
                  </TabsTrigger>
                  <TabsTrigger value="history" className="gap-1.5 text-xs">
                    <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="transfer"
                  className="mt-0 data-[state=inactive]:hidden"
                >
                  <form onSubmit={handleTransfer} className={stockMovFormClass}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className={fieldLabelClass}>From location</Label>
                        <Select
                          value={transferFromId || NONE_LOC}
                          onValueChange={(v) => setTransferFromId(v === NONE_LOC ? "" : v)}
                          disabled={transferAtLoc.length === 0 || transferSubmitting}
                        >
                          <SelectTrigger className="h-8 w-full rounded-sm text-xs">
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
                        <Label className={fieldLabelClass}>To location</Label>
                        <Select
                          value={transferToId || NONE_LOC}
                          onValueChange={(v) => setTransferToId(v === NONE_LOC ? "" : v)}
                          disabled={
                            transferSubmitting ||
                            !transferFromId ||
                            transferToOptions.length === 0
                          }
                        >
                          <SelectTrigger className="h-8 w-full rounded-sm text-xs">
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
                    <div className="space-y-2">
                      <Label htmlFor="transfer-qty" className={fieldLabelClass}>
                        Quantity
                      </Label>
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
                      <Label htmlFor="transfer-note" className={fieldLabelClass}>
                        Note (optional)
                      </Label>
                      <Textarea
                        id="transfer-note"
                        rows={2}
                        value={transferNote}
                        onChange={(e) => setTransferNote(e.target.value)}
                        placeholder="e.g. Rebalanced for branch display"
                        disabled={transferSubmitting}
                        className="min-h-[72px] resize-y rounded-sm py-2"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={transferSubmitting}
                    >
                      {transferSubmitting ? "Saving…" : "Record transfer"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent
                  value="refill"
                  className="mt-0 data-[state=inactive]:hidden"
                >
                  <form onSubmit={handleRefill} className={stockMovFormClass}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className={fieldLabelClass}>Receive into location</Label>
                        <Select
                          value={refillLocationId || NONE_LOC}
                          onValueChange={(v) =>
                            setRefillLocationId(v === NONE_LOC ? "" : v)
                          }
                          disabled={
                            activeLocationOptions.length === 0 || refillSubmitting
                          }
                        >
                          <SelectTrigger className="h-8 w-full rounded-sm text-xs">
                            <SelectValue placeholder="Warehouse" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_LOC}>Choose location</SelectItem>
                            {activeLocationOptions.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {l.name}
                                {l.code ? ` (${l.code})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="refill-qty" className={fieldLabelClass}>
                          Quantity to add
                        </Label>
                        <Input
                          id="refill-qty"
                          type="number"
                          min={0}
                          step="any"
                          value={refillQty}
                          onChange={(e) => setRefillQty(e.target.value)}
                          placeholder="0"
                          disabled={refillSubmitting}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="refill-note" className={fieldLabelClass}>
                        Note (optional)
                      </Label>
                      <Textarea
                        id="refill-note"
                        rows={2}
                        value={refillNote}
                        onChange={(e) => setRefillNote(e.target.value)}
                        placeholder="e.g. Supplier delivery #1234"
                        disabled={refillSubmitting}
                        className="min-h-[72px] resize-y rounded-sm py-2"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={refillSubmitting || activeLocationOptions.length === 0}
                    >
                      {refillSubmitting ? "Saving…" : "Record refill"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent
                  value="stock_out"
                  className="mt-0 data-[state=inactive]:hidden"
                >
                  <form onSubmit={handleStockOut} className={stockMovFormClass}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className={fieldLabelClass}>From location</Label>
                        <Select
                          value={stockOutFromId || NONE_LOC}
                          onValueChange={(v) =>
                            setStockOutFromId(v === NONE_LOC ? "" : v)
                          }
                          disabled={transferAtLoc.length === 0 || stockOutSubmitting}
                        >
                          <SelectTrigger className="h-8 w-full rounded-sm text-xs">
                            <SelectValue placeholder="Where to reduce stock" />
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
                        <Label htmlFor="stock-out-qty" className={fieldLabelClass}>
                          Quantity to remove
                        </Label>
                        <Input
                          id="stock-out-qty"
                          type="number"
                          min={0}
                          step="any"
                          value={stockOutQty}
                          onChange={(e) => setStockOutQty(e.target.value)}
                          placeholder={stockOutFromRow ? `Max ${maxStockOutQty}` : "0"}
                          disabled={stockOutSubmitting}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock-out-note" className={fieldLabelClass}>
                        Note (optional)
                      </Label>
                      <Textarea
                        id="stock-out-note"
                        rows={2}
                        value={stockOutNote}
                        onChange={(e) => setStockOutNote(e.target.value)}
                        placeholder="e.g. Damaged, expired, or sold offline"
                        disabled={stockOutSubmitting}
                        className="min-h-[72px] resize-y rounded-sm py-2"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={stockOutSubmitting || transferAtLoc.length === 0}
                    >
                      {stockOutSubmitting ? "Saving…" : "Record stock out"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent
                  value="history"
                  className="mt-0 w-full max-w-3xl space-y-4 data-[state=inactive]:hidden"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Movement log for this product (newest first).
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 text-xs"
                      onClick={() => void refreshMovementHistory()}
                      disabled={movLoading || !productId}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${movLoading ? "animate-spin" : ""}`}
                        aria-hidden
                      />
                      Refresh
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-md border border-border/60">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="p-2.5 text-left font-medium">When</th>
                          <th className="p-2.5 text-left font-medium">Type</th>
                          <th className="p-2.5 text-left font-medium">From</th>
                          <th className="p-2.5 text-left font-medium">To</th>
                          <th className="p-2.5 text-right font-medium">Qty</th>
                          <th className="p-2.5 text-left font-medium">Note</th>
                          <th className="p-2.5 text-left font-medium">By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movLoading ? (
                          <TableBodyRowsSkeleton rowCount={4} colCount={7} />
                        ) : (
                          movements.map((m) => (
                            <tr key={m.id} className="border-t border-border/60">
                              <td className="whitespace-nowrap p-2.5">
                                {formatMovementWhen(m.created_at)}
                              </td>
                              <td className="p-2.5">
                                <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                                  {MOV_EVENT_LABELS[m.event_type]}
                                </span>
                              </td>
                              <td
                                className="max-w-[120px] truncate p-2.5"
                                title={m.from_label}
                              >
                                {m.from_label}
                              </td>
                              <td
                                className="max-w-[120px] truncate p-2.5"
                                title={m.to_label}
                              >
                                {m.to_label}
                              </td>
                              <td className="p-2.5 text-right tabular-nums font-medium">
                                {m.quantity}
                              </td>
                              <td
                                className="max-w-[140px] truncate p-2.5 text-muted-foreground"
                                title={m.note}
                              >
                                {m.note || "—"}
                              </td>
                              <td
                                className="max-w-[100px] truncate p-2.5 text-muted-foreground"
                                title={m.recorded_by_label}
                              >
                                {m.recorded_by_label}
                              </td>
                            </tr>
                          ))
                        )}
                        {!movLoading && movements.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="p-8 text-center text-muted-foreground"
                            >
                              No movements yet. Transfers, refills, and stock-outs will
                              appear here.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Page{" "}
                      <span className="font-medium text-foreground">{movPage}</span> /{" "}
                      {movPages} — {movTotal} event(s)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={movPage <= 1 || movLoading}
                        onClick={() => setMovPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={movPage >= movPages || movLoading}
                        onClick={() => setMovPage((p) => Math.min(movPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </SectionCard>
          </>
        )}
      </div>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update {form.name.trim() || "this product"} in your catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                setSaveConfirmOpen(false);
                void performSave();
              }}
            >
              {saving ? "Saving…" : "Save changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}

