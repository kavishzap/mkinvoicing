"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Package,
  Plus,
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
import { AppPageShell } from "@/components/app-page-shell";
import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getActiveCompanyId } from "@/lib/active-company";
import {
  listActiveLocationsForSelect,
  type LocationOption,
} from "@/lib/locations-service";
import { replaceProductLocationStocks } from "@/lib/product-location-stocks-service";
import { addProduct, type ProductPayload } from "@/lib/products-service";
import { runActionProgress } from "@/lib/action-progress-bridge";
import { useActionProgress } from "@/contexts/action-progress-context";
import { QtyInput } from "@/components/qty-input";

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
  const { isRunning } = useActionProgress();
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

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
    return true;
  }

  function requestSave() {
    if (!validate()) return;
    const stockPayload = parseStockLines(stockLines, toast);
    if (stockPayload === null) return;
    setSaveConfirmOpen(true);
  }

  async function performSave() {
    const stockPayload = parseStockLines(stockLines, toast);
    if (stockPayload === null) return;

    await runActionProgress("Creating product…", async () => {
      try {
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
      router.push("/app/products");
      } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Save failed",
        description: msg,
        variant: "destructive",
      });
      }
    });
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
        <Button
          onClick={requestSave}
          disabled={isRunning || loading}
          className="gap-2 rounded font-semibold shadow-sm"
        >
          <Save className="size-3.5 shrink-0" aria-hidden />
          "Submit"
        </Button>
      }
    >
      {loading ? (
        <FormTwoColumnPageSkeleton withLineItems />
      ) : (
      <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-6 lg:gap-8">
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
                autoComplete="off"
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
                  autoComplete="off"
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
                  <SelectTrigger
                    id="p-unit"
                    className="h-8 w-full rounded-sm text-xs"
                  >
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
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
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
                  onChange={(e) =>
                    setForm({ ...form, costPrice: e.target.value })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, salePrice: e.target.value })
                  }
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
              Optional starting quantities per warehouse.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 shrink-0 text-xs"
              onClick={addStockLine}
              disabled={locationOptions.length === 0 || loading}
            >
              <Plus className="h-3.5 w-3.5" />
              Add line
            </Button>
          </div>
          {locationOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Create at least one active location under{" "}
              <Link href="/app/locations" className="font-medium text-primary underline-offset-4 hover:underline">
                Locations
              </Link>
              .
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
                  locationOptions,
                );
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
                        onValueChange={(v) =>
                          updateStockLine(line.key, {
                            locationId: v === NONE_LOC ? "" : v,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-full min-w-0 rounded-sm text-xs">
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
                      <Label className={cn("text-xs", fieldLabelClass)}>
                        Quantity
                      </Label>
                      <QtyInput
                        value={line.quantity}
                        onValueChange={(value) =>
                          updateStockLine(line.key, { quantity: value })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 self-end text-muted-foreground hover:text-destructive"
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
        </SectionCard>
      </div>
      )}

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add {form.name.trim() || "this product"} to your catalog
              and return you to the products list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning}
              onClick={(e) => {
                e.preventDefault();
                setSaveConfirmOpen(false);
                void performSave();
              }}
            >
              "Submit"
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
