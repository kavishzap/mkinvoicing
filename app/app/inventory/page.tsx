"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Layers,
  MapPin,
  RefreshCw,
  ArrowRightLeft,
  PackagePlus,
  PackageMinus,
  History,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AppPageShell } from "@/components/app-page-shell";
import { getActiveCompanyId } from "@/lib/active-company";
import { listActiveLocationsForSelect, type LocationOption } from "@/lib/locations-service";
import { listProducts, type ProductRow } from "@/lib/products-service";
import {
  listStockBalances,
  listStockBalancesForProduct,
  listInventoryMovements,
  recordInventoryTransfer,
  recordInventoryRefill,
  recordInventoryAdjustmentOut,
  type StockBalanceRow,
  type InventoryMovementRow,
} from "@/lib/inventory-stock-service";

const NONE = "__none__";

const EVENT_LABELS: Record<InventoryMovementRow["event_type"], string> = {
  transfer: "Transfer",
  refill: "Refill",
  adjustment_out: "Stock out",
};

function formatWhen(iso: string) {
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

function formatQty(n: number) {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1 && Number.isInteger(n)) return String(n);
  const s = n.toFixed(3).replace(/\.?0+$/, "");
  return s;
}

export default function InventoryPage() {
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [tab, setTab] = useState("balances");

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  const [balanceSearch, setBalanceSearch] = useState("");
  const [balanceLocationId, setBalanceLocationId] = useState("");
  const [balancePage, setBalancePage] = useState(1);
  const [balancePageSize, setBalancePageSize] = useState(20);
  const [balances, setBalances] = useState<StockBalanceRow[]>([]);
  const [balanceTotal, setBalanceTotal] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [movPage, setMovPage] = useState(1);
  const [movPageSize] = useState(15);
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movLoading, setMovLoading] = useState(true);

  const [transferProductId, setTransferProductId] = useState("");
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferAtLoc, setTransferAtLoc] = useState<StockBalanceRow[]>([]);
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [refillProductId, setRefillProductId] = useState("");
  const [refillLocationId, setRefillLocationId] = useState("");
  const [refillQty, setRefillQty] = useState("");
  const [refillNote, setRefillNote] = useState("");
  const [refillSubmitting, setRefillSubmitting] = useState(false);

  const [adjProductId, setAdjProductId] = useState("");
  const [adjFromId, setAdjFromId] = useState("");
  const [adjQty, setAdjQty] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjAtLoc, setAdjAtLoc] = useState<StockBalanceRow[]>([]);
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await getActiveCompanyId();
      setCompanyReady(!!id);
      if (!id) return;
      try {
        const [{ rows: prows }, locs] = await Promise.all([
          listProducts({ page: 1, pageSize: 500, includeInactive: false }),
          listActiveLocationsForSelect(),
        ]);
        setProducts(prows);
        setLocations(locs);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({ title: "Failed to load catalog", description: msg, variant: "destructive" });
      }
    })();
  }, [toast]);

  const refreshBalances = useCallback(async () => {
    if (companyReady !== true) return;
    setBalanceLoading(true);
    try {
      const res = await listStockBalances({
        search: balanceSearch,
        locationId: balanceLocationId || undefined,
        page: balancePage,
        pageSize: balancePageSize,
        includeZero: false,
      });
      setBalances(res.rows);
      setBalanceTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Could not load balances", description: msg, variant: "destructive" });
    } finally {
      setBalanceLoading(false);
    }
  }, [
    companyReady,
    balanceSearch,
    balanceLocationId,
    balancePage,
    balancePageSize,
    toast,
  ]);

  const refreshMovements = useCallback(async () => {
    if (companyReady !== true) return;
    setMovLoading(true);
    try {
      const res = await listInventoryMovements({ page: movPage, pageSize: movPageSize });
      setMovements(res.rows);
      setMovTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Could not load history", description: msg, variant: "destructive" });
    } finally {
      setMovLoading(false);
    }
  }, [companyReady, movPage, movPageSize, toast]);

  useEffect(() => {
    if (companyReady !== true) return;
    refreshBalances();
  }, [companyReady, refreshBalances]);

  useEffect(() => {
    if (companyReady !== true) return;
    refreshMovements();
  }, [companyReady, refreshMovements]);

  useEffect(() => {
    setBalancePage(1);
  }, [balanceSearch, balanceLocationId, balancePageSize]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!transferProductId) {
        setTransferAtLoc([]);
        setTransferFromId("");
        return;
      }
      try {
        const rows = await listStockBalancesForProduct(transferProductId);
        if (!cancelled) {
          setTransferAtLoc(rows);
          setTransferFromId((prev) =>
            prev && rows.some((r) => r.location_id === prev) ? prev : ""
          );
        }
      } catch {
        if (!cancelled) setTransferAtLoc([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transferProductId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!adjProductId) {
        setAdjAtLoc([]);
        setAdjFromId("");
        return;
      }
      try {
        const rows = await listStockBalancesForProduct(adjProductId);
        if (!cancelled) {
          setAdjAtLoc(rows);
          setAdjFromId((prev) =>
            prev && rows.some((r) => r.location_id === prev) ? prev : ""
          );
        }
      } catch {
        if (!cancelled) setAdjAtLoc([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adjProductId]);

  const transferFromRow = useMemo(
    () => transferAtLoc.find((r) => r.location_id === transferFromId),
    [transferAtLoc, transferFromId]
  );
  const maxTransferQty = transferFromRow?.quantity ?? 0;

  const adjFromRow = useMemo(
    () => adjAtLoc.find((r) => r.location_id === adjFromId),
    [adjAtLoc, adjFromId]
  );
  const maxAdjQty = adjFromRow?.quantity ?? 0;

  const toLocationOptions = useMemo(() => {
    if (!transferFromId) return locations;
    return locations.filter((l) => l.id !== transferFromId);
  }, [locations, transferFromId]);

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferProductId || !transferFromId || !transferToId) {
      toast({
        title: "Missing fields",
        description: "Choose product, source, and destination.",
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
        productId: transferProductId,
        fromLocationId: transferFromId,
        toLocationId: transferToId,
        quantity: q,
        note: transferNote || null,
      });
      toast({ title: "Transfer recorded", description: "Balances and history were updated." });
      setTransferQty("");
      setTransferNote("");
      setTransferToId("");
      await Promise.all([refreshBalances(), refreshMovements()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Transfer failed", description: msg, variant: "destructive" });
    } finally {
      setTransferSubmitting(false);
    }
  }

  async function handleRefill(e: React.FormEvent) {
    e.preventDefault();
    if (!refillProductId || !refillLocationId) {
      toast({
        title: "Missing fields",
        description: "Choose product and location.",
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
        productId: refillProductId,
        toLocationId: refillLocationId,
        quantity: q,
        note: refillNote || null,
      });
      toast({ title: "Refill recorded", description: "Stock increased at that location." });
      setRefillQty("");
      setRefillNote("");
      await Promise.all([refreshBalances(), refreshMovements()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Refill failed", description: msg, variant: "destructive" });
    } finally {
      setRefillSubmitting(false);
    }
  }

  async function handleAdjustOut(e: React.FormEvent) {
    e.preventDefault();
    if (!adjProductId || !adjFromId) {
      toast({
        title: "Missing fields",
        description: "Choose product and location.",
        variant: "destructive",
      });
      return;
    }
    const q = parseFloat(adjQty);
    if (Number.isNaN(q) || q <= 0) {
      toast({ title: "Invalid quantity", variant: "destructive" });
      return;
    }
    if (q > maxAdjQty) {
      toast({
        title: "Not enough stock",
        description: `Only ${maxAdjQty} available at that location.`,
        variant: "destructive",
      });
      return;
    }
    try {
      setAdjSubmitting(true);
      await recordInventoryAdjustmentOut({
        productId: adjProductId,
        fromLocationId: adjFromId,
        quantity: q,
        note: adjNote || null,
      });
      toast({ title: "Stock out recorded", description: "Quantity was reduced at that location." });
      setAdjQty("");
      setAdjNote("");
      await Promise.all([refreshBalances(), refreshMovements()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Operation failed", description: msg, variant: "destructive" });
    } finally {
      setAdjSubmitting(false);
    }
  }

  const balancePages = Math.max(1, Math.ceil(balanceTotal / balancePageSize));
  const movPages = Math.max(1, Math.ceil(movTotal / movPageSize));

  /** Groups current page rows by warehouse so each location is one block with its products listed underneath. */
  const balancesByLocation = useMemo(() => {
    const map = new Map<
      string,
      {
        locationId: string;
        locationName: string;
        locationCode: string;
        lines: StockBalanceRow[];
      }
    >();
    for (const b of balances) {
      let g = map.get(b.location_id);
      if (!g) {
        g = {
          locationId: b.location_id,
          locationName: b.location_name,
          locationCode: b.location_code,
          lines: [],
        };
        map.set(b.location_id, g);
      }
      g.lines.push(b);
    }
    for (const g of map.values()) {
      g.lines.sort((a, b) =>
        a.product_name.localeCompare(b.product_name, undefined, { sensitivity: "base" }),
      );
    }
    return [...map.values()].sort((a, b) =>
      a.locationName.localeCompare(b.locationName, undefined, { sensitivity: "base" }),
    );
  }, [balances]);

  const shellActions = useMemo(() => {
    const disabled = companyReady !== true;
    if (tab === "balances") {
      return (
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2"
          disabled={disabled || balanceLoading}
          onClick={() => refreshBalances()}
        >
          <RefreshCw className={`h-4 w-4 ${balanceLoading ? "animate-spin" : ""}`} />
          Refresh balances
        </Button>
      );
    }
    if (tab === "transfer") {
      return (
        <Button
          type="submit"
          form="inventory-form-transfer"
          className="shrink-0 gap-2"
          disabled={disabled || transferSubmitting}
        >
          {transferSubmitting ? "Saving…" : "Record transfer"}
        </Button>
      );
    }
    if (tab === "refill") {
      return (
        <Button
          type="submit"
          form="inventory-form-refill"
          className="shrink-0 gap-2"
          disabled={disabled || refillSubmitting}
        >
          {refillSubmitting ? "Saving…" : "Record fill"}
        </Button>
      );
    }
    if (tab === "adjust") {
      return (
        <Button
          type="submit"
          form="inventory-form-adjust"
          className="shrink-0 gap-2"
          disabled={disabled || adjSubmitting}
        >
          {adjSubmitting ? "Saving…" : "Record stock out"}
        </Button>
      );
    }
    if (tab === "history") {
      return (
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2"
          disabled={disabled || movLoading}
          onClick={() => refreshMovements()}
        >
          <RefreshCw className={`h-4 w-4 ${movLoading ? "animate-spin" : ""}`} />
          Refresh history
        </Button>
      );
    }
    return null;
  }, [
    tab,
    companyReady,
    balanceLoading,
    refreshBalances,
    transferSubmitting,
    refillSubmitting,
    adjSubmitting,
    movLoading,
    refreshMovements,
  ]);

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      actions={shellActions}
      subtitle="Quantities by location, transfers, refills, stock-outs, and movement history."
    >
      {companyReady === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company is linked to this account. Stock operations require a company context.
          </CardContent>
        </Card>
      )}

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col space-y-4"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="balances" className="gap-1.5">
            <LayoutGrid className="h-4 w-4" />
            Balances
          </TabsTrigger>
          <TabsTrigger value="transfer" className="gap-1.5">
            <ArrowRightLeft className="h-4 w-4" />
            Transfer
          </TabsTrigger>
          <TabsTrigger value="refill" className="gap-1.5">
            <PackagePlus className="h-4 w-4" />
            Refill
          </TabsTrigger>
          <TabsTrigger value="adjust" className="gap-1.5">
            <PackageMinus className="h-4 w-4" />
            Stock out
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balances" className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-base">On-hand by location</CardTitle>
                <CardDescription>
                  Stock grouped by warehouse: open a location to see every product and quantity on hand
                  there (live balances).
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="bal-search">Search</Label>
                  <Input
                    id="bal-search"
                    placeholder="Product name, SKU, or location…"
                    value={balanceSearch}
                    onChange={(e) => setBalanceSearch(e.target.value)}
                    disabled={companyReady !== true}
                  />
                </div>
                <div className="w-full space-y-2 lg:w-56">
                  <Label>Location</Label>
                  <Select
                    value={balanceLocationId || NONE}
                    onValueChange={(v) => setBalanceLocationId(v === NONE ? "" : v)}
                    disabled={companyReady !== true}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>All locations</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                          {l.code ? ` (${l.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full space-y-2 lg:w-36">
                  <Label>Page size</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={balancePageSize}
                    onChange={(e) => setBalancePageSize(Number(e.target.value))}
                    disabled={companyReady !== true}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {balanceLoading ? (
                <div className="rounded-md border p-10 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : balances.length === 0 ? (
                <div className="rounded-md border p-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Layers className="h-10 w-10 opacity-40" />
                    No stock rows yet. Use Refill to add inventory, or sync from product setup.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {balancesByLocation.map((group) => {
                    const totalUnits = group.lines.reduce((s, row) => s + row.quantity, 0);
                    return (
                      <div
                        key={group.locationId}
                        className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                          <div className="flex min-w-0 items-start gap-2">
                            <MapPin
                              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <Link
                                href={`/app/locations/${group.locationId}?tab=products-line`}
                                className="inline-flex flex-wrap items-baseline gap-x-2 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                              >
                                <span>{group.locationName}</span>
                                {group.location_code ? (
                                  <span className="text-sm font-normal text-muted-foreground">
                                    ({group.location_code})
                                  </span>
                                ) : null}
                              </Link>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {group.lines.length} product{group.lines.length === 1 ? "" : "s"} ·{" "}
                                {formatQty(totalUnits)} total units
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/25 text-xs text-muted-foreground">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium">Product</th>
                                <th className="px-4 py-2 text-left font-medium">SKU</th>
                                <th className="px-4 py-2 text-right font-medium">Qty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.lines.map((b) => (
                                <tr
                                  key={`${b.location_id}-${b.product_id}`}
                                  className="border-t border-border/60"
                                >
                                  <td className="px-4 py-2.5">{b.product_name}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground">
                                    {b.product_sku || "—"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                                    {formatQty(b.quantity)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <span>
                    Page <span className="font-medium text-foreground">{balancePage}</span> /{" "}
                    {balancePages} — {balanceTotal} product line(s)
                    {!balanceLoading && balances.length > 0 ? (
                      <>
                        {" "}
                        · {balancesByLocation.length} location
                        {balancesByLocation.length === 1 ? "" : "s"} on this page
                      </>
                    ) : null}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Pagination counts product lines; a location can span two pages if it has many SKUs.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={balancePage <= 1 || balanceLoading}
                    onClick={() => setBalancePage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={balancePage >= balancePages || balanceLoading}
                    onClick={() => setBalancePage((p) => Math.min(balancePages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transfer between locations</CardTitle>
              <CardDescription>
                Moves quantity from one warehouse to another for the same product. Creates a history
                entry and updates balances automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="inventory-form-transfer"
                onSubmit={handleTransfer}
                className="max-w-xl space-y-4"
              >
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select
                    value={transferProductId || NONE}
                    onValueChange={(v) => setTransferProductId(v === NONE ? "" : v)}
                    disabled={companyReady !== true}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Choose product</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.sku ? ` — ${p.sku}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>From location</Label>
                    <Select
                      value={transferFromId || NONE}
                      onValueChange={(v) => setTransferFromId(v === NONE ? "" : v)}
                      disabled={!transferProductId || transferAtLoc.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Where stock is now" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Choose location</SelectItem>
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
                      value={transferToId || NONE}
                      onValueChange={(v) => setTransferToId(v === NONE ? "" : v)}
                      disabled={!transferProductId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Destination" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Choose location</SelectItem>
                        {toLocationOptions.map((l) => (
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
                  <Label htmlFor="t-qty">Quantity</Label>
                  <Input
                    id="t-qty"
                    type="number"
                    min={0}
                    step="any"
                    value={transferQty}
                    onChange={(e) => setTransferQty(e.target.value)}
                    placeholder={transferFromRow ? `Max ${maxTransferQty}` : "0"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-note">Note (optional)</Label>
                  <Textarea
                    id="t-note"
                    rows={2}
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="e.g. Picked for branch display"
                  />
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refill">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Refill / inbound stock</CardTitle>
              <CardDescription>
                Increase quantity at a location (new delivery, production, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="inventory-form-refill"
                onSubmit={handleRefill}
                className="max-w-xl space-y-4"
              >
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select
                    value={refillProductId || NONE}
                    onValueChange={(v) => setRefillProductId(v === NONE ? "" : v)}
                    disabled={companyReady !== true}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Choose product</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.sku ? ` — ${p.sku}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    value={refillLocationId || NONE}
                    onValueChange={(v) => setRefillLocationId(v === NONE ? "" : v)}
                    disabled={companyReady !== true}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Where stock arrives" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Choose location</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                          {l.code ? ` (${l.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-qty">Quantity to add</Label>
                  <Input
                    id="r-qty"
                    type="number"
                    min={0}
                    step="any"
                    value={refillQty}
                    onChange={(e) => setRefillQty(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-note">Note (optional)</Label>
                  <Textarea
                    id="r-note"
                    rows={2}
                    value={refillNote}
                    onChange={(e) => setRefillNote(e.target.value)}
                    placeholder="e.g. PO #12345 delivery"
                  />
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjust">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock out / adjustment</CardTitle>
              <CardDescription>
                Reduce quantity at one location (damage, shrinkage, samples). Does not move stock to
                another location.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                id="inventory-form-adjust"
                onSubmit={handleAdjustOut}
                className="max-w-xl space-y-4"
              >
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select
                    value={adjProductId || NONE}
                    onValueChange={(v) => setAdjProductId(v === NONE ? "" : v)}
                    disabled={companyReady !== true}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Choose product</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.sku ? ` — ${p.sku}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>From location</Label>
                  <Select
                    value={adjFromId || NONE}
                    onValueChange={(v) => setAdjFromId(v === NONE ? "" : v)}
                    disabled={!adjProductId || adjAtLoc.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Where to reduce stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Choose location</SelectItem>
                      {adjAtLoc.map((r) => (
                        <SelectItem key={r.location_id} value={r.location_id}>
                          {r.location_name} ({r.quantity} on hand)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="a-qty">Quantity to remove</Label>
                  <Input
                    id="a-qty"
                    type="number"
                    min={0}
                    step="any"
                    value={adjQty}
                    onChange={(e) => setAdjQty(e.target.value)}
                    placeholder={adjFromRow ? `Max ${maxAdjQty}` : "0"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="a-note">Note (optional)</Label>
                  <Textarea
                    id="a-note"
                    rows={2}
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    placeholder="e.g. Damaged in handling"
                  />
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-base">Movement history</CardTitle>
                <CardDescription>Immutable log of transfers, refills, and stock-outs.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left">When</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Product</th>
                      <th className="p-3 text-left">From</th>
                      <th className="p-3 text-left">To</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-left">Note</th>
                      <th className="p-3 text-left">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movLoading ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          Loading…
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="p-3 whitespace-nowrap">{formatWhen(m.created_at)}</td>
                          <td className="p-3">
                            <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                              {EVENT_LABELS[m.event_type]}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{m.product_name}</div>
                            {m.product_sku ? (
                              <div className="text-xs text-muted-foreground">{m.product_sku}</div>
                            ) : null}
                          </td>
                          <td className="p-3 max-w-[140px] truncate" title={m.from_label}>
                            {m.from_label}
                          </td>
                          <td className="p-3 max-w-[140px] truncate" title={m.to_label}>
                            {m.to_label}
                          </td>
                          <td className="p-3 text-right tabular-nums font-medium">{m.quantity}</td>
                          <td className="p-3 text-muted-foreground max-w-[180px] truncate" title={m.note}>
                            {m.note || "—"}
                          </td>
                          <td className="p-3 max-w-[120px] truncate text-muted-foreground" title={m.recorded_by_label}>
                            {m.recorded_by_label}
                          </td>
                        </tr>
                      ))
                    )}
                    {!movLoading && movements.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          No movements yet. Transfers and refills will appear here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Page <span className="font-medium text-foreground">{movPage}</span> / {movPages} —{" "}
                  {movTotal} event(s)
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={movPage <= 1 || movLoading}
                    onClick={() => setMovPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={movPage >= movPages || movLoading}
                    onClick={() => setMovPage((p) => Math.min(movPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppPageShell>
  );
}
