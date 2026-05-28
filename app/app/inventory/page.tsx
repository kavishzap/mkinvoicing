"use client";

import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Layers,
  MapPin,
  RefreshCw,
  ArrowRightLeft,
  PackagePlus,
  PackageMinus,
  History,
  LayoutGrid,
  Search,
  SlidersVertical,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { useToast } from "@/hooks/use-toast";
import { AppPageShell } from "@/components/app-page-shell";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
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
import { cn } from "@/lib/utils";

const NONE = "__none__";
const LOCATION_ALL = "__all__";

const EVENT_LABELS: Record<InventoryMovementRow["event_type"], string> = {
  transfer: "Transfer",
  refill: "Refill",
  adjustment_out: "Stock out",
};

type MovEventFilter = "all" | InventoryMovementRow["event_type"];

const LIST_PANEL_CLASS =
  "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-border/50 bg-card text-card-foreground shadow-none outline outline-1 -outline-offset-1 outline-border/40 dark:border-border/60 dark:outline-border/50";

const SEARCH_INPUT_CLASS =
  "h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background";

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

const linkClass =
  "font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

function InventoryProductLink({
  productId,
  name,
  sku,
}: {
  productId: string;
  name: string;
  sku?: string;
}) {
  return (
    <div>
      <Link
        href={`/app/products/${productId}/edit`}
        className={cn(linkClass, "font-semibold")}
        onClick={(e) => e.stopPropagation()}
      >
        {name}
      </Link>
      {sku ? (
        <div className="text-xs text-muted-foreground">{sku}</div>
      ) : null}
    </div>
  );
}

function InventoryLocationLink({
  locationId,
  label,
  className,
}: {
  locationId: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={`/app/locations/${locationId}?tab=products-line`}
      className={cn(linkClass, "block max-w-[140px] truncate", className)}
      title={label}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Link>
  );
}

function InventoryLocationFilterSidebar({
  id,
  locations,
  locationFilter,
  onLocationChange,
}: {
  id?: string;
  locations: LocationOption[];
  locationFilter: string;
  onLocationChange: (locationId: string) => void;
}) {
  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  const rows = [
    { id: LOCATION_ALL, label: "All locations", icon: Warehouse },
    ...locations.map((l) => ({
      id: l.id,
      label: l.code ? `${l.name} (${l.code})` : l.name,
      icon: MapPin,
    })),
  ];

  return (
    <aside id={id} className="w-full shrink-0 lg:self-stretch">
      <div className="space-y-7 py-1">
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By location
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by location">
            {rows.map((item) => {
              const Icon = item.icon;
              const selected =
                locationFilter === item.id ||
                (item.id === LOCATION_ALL && locationFilter === "");
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onLocationChange(item.id === LOCATION_ALL ? "" : item.id)
                  }
                  aria-pressed={selected}
                  className={cn(
                    rowBtn,
                    selected
                      ? "bg-muted/90 font-semibold text-foreground shadow-none"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-75" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}

function InventoryHistoryFilterSidebar({
  id,
  locations,
  eventFilter,
  locationFilter,
  onEventChange,
  onLocationChange,
}: {
  id?: string;
  locations: LocationOption[];
  eventFilter: MovEventFilter;
  locationFilter: string;
  onEventChange: (v: MovEventFilter) => void;
  onLocationChange: (locationId: string) => void;
}) {
  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  const eventRows: {
    id: MovEventFilter;
    label: string;
    icon: typeof History;
  }[] = [
    { id: "all", label: "All types", icon: History },
    { id: "transfer", label: "Transfers", icon: ArrowRightLeft },
    { id: "refill", label: "Refills", icon: PackagePlus },
    { id: "adjustment_out", label: "Stock outs", icon: PackageMinus },
  ];

  const locationRows = [
    { id: LOCATION_ALL, label: "All locations", icon: Warehouse },
    ...locations.map((l) => ({
      id: l.id,
      label: l.code ? `${l.name} (${l.code})` : l.name,
      icon: MapPin,
    })),
  ];

  return (
    <aside id={id} className="w-full shrink-0 lg:self-stretch">
      <div className="space-y-7 py-1">
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By type
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by movement type">
            {eventRows.map((item) => {
              const Icon = item.icon;
              const selected = eventFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onEventChange(item.id)}
                  aria-pressed={selected}
                  className={cn(
                    rowBtn,
                    selected
                      ? "bg-muted/90 font-semibold text-foreground shadow-none"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-75" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By location
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by location">
            {locationRows.map((item) => {
              const Icon = item.icon;
              const selected =
                locationFilter === item.id ||
                (item.id === LOCATION_ALL && locationFilter === "");
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onLocationChange(item.id === LOCATION_ALL ? "" : item.id)
                  }
                  aria-pressed={selected}
                  className={cn(
                    rowBtn,
                    selected
                      ? "bg-muted/90 font-semibold text-foreground shadow-none"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-75" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}

function InventoryFormPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className={LIST_PANEL_CLASS}>
      <div className="shrink-0 border-b border-border/50 bg-muted/45 px-5 py-4 dark:bg-muted/25">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
    </div>
  );
}

function FilterPanelShell({
  open,
  panelId,
  children,
}: {
  open: boolean;
  panelId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={panelId}
      className={cn(
        "shrink-0 overflow-hidden",
        "transition-[width,margin-inline-end,max-height,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "motion-reduce:transition-none motion-reduce:duration-0",
        open
          ? "pointer-events-auto max-h-[2000px] opacity-100 lg:me-10 lg:w-56 xl:w-[15rem]"
          : "pointer-events-none max-h-0 opacity-0 lg:pointer-events-none lg:max-h-none lg:w-0 lg:opacity-100 xl:w-0 lg:me-0",
      )}
      aria-hidden={!open}
    >
      <div className="h-full min-w-0 w-full lg:min-w-[14rem] xl:min-w-[15rem]">
        {children}
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [tab, setTab] = useState("balances");
  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  const [balanceSearchQuery, setBalanceSearchQuery] = useState("");
  const [debouncedBalanceSearch, setDebouncedBalanceSearch] = useState("");
  const [balanceLocationId, setBalanceLocationId] = useState("");
  const [balancePage, setBalancePage] = useState(1);
  const [balancePageSize, setBalancePageSize] = useState(10);
  const [balances, setBalances] = useState<StockBalanceRow[]>([]);
  const [balanceTotal, setBalanceTotal] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [movSearchQuery, setMovSearchQuery] = useState("");
  const [debouncedMovSearch, setDebouncedMovSearch] = useState("");
  const [movEventFilter, setMovEventFilter] = useState<MovEventFilter>("all");
  const [movLocationId, setMovLocationId] = useState("");
  const [movPage, setMovPage] = useState(1);
  const [movPageSize, setMovPageSize] = useState(10);
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movLoading, setMovLoading] = useState(true);

  const balanceListGen = useRef(0);
  const movListGen = useRef(0);

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
    const t = window.setTimeout(
      () => setDebouncedBalanceSearch(balanceSearchQuery.trim()),
      220,
    );
    return () => window.clearTimeout(t);
  }, [balanceSearchQuery]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedMovSearch(movSearchQuery.trim()),
      220,
    );
    return () => window.clearTimeout(t);
  }, [movSearchQuery]);

  useEffect(() => {
    const bump = () => setActiveCompanyScope((n) => n + 1);
    window.addEventListener(ACTIVE_COMPANY_CHANGED_EVENT, bump);
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_COMPANY_ID_STORAGE_KEY) bump();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ACTIVE_COMPANY_CHANGED_EVENT, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getActiveCompanyId();
      if (cancelled) return;
      setCompanyReady(!!id);
      if (!id) {
        setProducts([]);
        setLocations([]);
        return;
      }
      try {
        const [{ rows: prows }, locs] = await Promise.all([
          listProducts({ page: 1, pageSize: 500, includeInactive: false }),
          listActiveLocationsForSelect(),
        ]);
        if (!cancelled) {
          setProducts(prows);
          setLocations(locs);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Please try again.";
          toast({ title: "Failed to load catalog", description: msg, variant: "destructive" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable
  }, [activeCompanyScope]);

  useEffect(() => {
    setBalancePage(1);
  }, [debouncedBalanceSearch, balanceLocationId, balancePageSize, activeCompanyScope]);

  useEffect(() => {
    setMovPage(1);
  }, [
    debouncedMovSearch,
    movEventFilter,
    movLocationId,
    movPageSize,
    activeCompanyScope,
  ]);

  useEffect(() => {
    if (companyReady !== true) return;

    const gen = ++balanceListGen.current;
    let cancelled = false;

    (async () => {
      setBalanceLoading(true);
      try {
        const res = await listStockBalances({
          search: debouncedBalanceSearch || undefined,
          locationId: balanceLocationId || undefined,
          page: balancePage,
          pageSize: balancePageSize,
          includeZero: false,
        });
        if (cancelled || gen !== balanceListGen.current) return;
        setBalances(res.rows);
        setBalanceTotal(res.total);
      } catch (e: unknown) {
        if (cancelled || gen !== balanceListGen.current) return;
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({ title: "Could not load balances", description: msg, variant: "destructive" });
      } finally {
        if (!cancelled && gen === balanceListGen.current) {
          setBalanceLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable
  }, [
    companyReady,
    debouncedBalanceSearch,
    balanceLocationId,
    balancePage,
    balancePageSize,
    activeCompanyScope,
  ]);

  useEffect(() => {
    if (companyReady !== true) return;

    const gen = ++movListGen.current;
    let cancelled = false;

    (async () => {
      setMovLoading(true);
      try {
        const res = await listInventoryMovements({
          page: movPage,
          pageSize: movPageSize,
          locationId: movLocationId || undefined,
          eventType: movEventFilter === "all" ? undefined : movEventFilter,
          search: debouncedMovSearch || undefined,
        });
        if (cancelled || gen !== movListGen.current) return;
        setMovements(res.rows);
        setMovTotal(res.total);
      } catch (e: unknown) {
        if (cancelled || gen !== movListGen.current) return;
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({ title: "Could not load history", description: msg, variant: "destructive" });
      } finally {
        if (!cancelled && gen === movListGen.current) {
          setMovLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable
  }, [
    companyReady,
    movPage,
    movPageSize,
    movLocationId,
    movEventFilter,
    debouncedMovSearch,
    activeCompanyScope,
  ]);

  const refreshBalances = useCallback(async () => {
    if (companyReady !== true) return;
    const gen = ++balanceListGen.current;
    setBalanceLoading(true);
    try {
      const res = await listStockBalances({
        search: debouncedBalanceSearch || undefined,
        locationId: balanceLocationId || undefined,
        page: balancePage,
        pageSize: balancePageSize,
        includeZero: false,
      });
      if (gen !== balanceListGen.current) return;
      setBalances(res.rows);
      setBalanceTotal(res.total);
    } catch (e: unknown) {
      if (gen !== balanceListGen.current) return;
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Could not load balances", description: msg, variant: "destructive" });
    } finally {
      if (gen === balanceListGen.current) setBalanceLoading(false);
    }
  }, [
    companyReady,
    debouncedBalanceSearch,
    balanceLocationId,
    balancePage,
    balancePageSize,
    toast,
  ]);

  const refreshMovements = useCallback(async () => {
    if (companyReady !== true) return;
    const gen = ++movListGen.current;
    setMovLoading(true);
    try {
      const res = await listInventoryMovements({
        page: movPage,
        pageSize: movPageSize,
        locationId: movLocationId || undefined,
        eventType: movEventFilter === "all" ? undefined : movEventFilter,
        search: debouncedMovSearch || undefined,
      });
      if (gen !== movListGen.current) return;
      setMovements(res.rows);
      setMovTotal(res.total);
    } catch (e: unknown) {
      if (gen !== movListGen.current) return;
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Could not load history", description: msg, variant: "destructive" });
    } finally {
      if (gen === movListGen.current) setMovLoading(false);
    }
  }, [
    companyReady,
    movPage,
    movPageSize,
    movLocationId,
    movEventFilter,
    debouncedMovSearch,
    toast,
  ]);

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
            prev && rows.some((r) => r.location_id === prev) ? prev : "",
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
            prev && rows.some((r) => r.location_id === prev) ? prev : "",
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
    [transferAtLoc, transferFromId],
  );
  const maxTransferQty = transferFromRow?.quantity ?? 0;

  const adjFromRow = useMemo(
    () => adjAtLoc.find((r) => r.location_id === adjFromId),
    [adjAtLoc, adjFromId],
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

  const balanceColumns = useMemo<ColumnDef<StockBalanceRow>[]>(
    () => [
      {
        id: "location",
        accessorFn: (r) => r.location_name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Location" />
        ),
        meta: { stopRowClick: true },
        cell: ({ row }) => {
          const b = row.original;
          const label = b.location_code
            ? `${b.location_name} (${b.location_code})`
            : b.location_name;
          return (
            <InventoryLocationLink locationId={b.location_id} label={label} />
          );
        },
      },
      {
        id: "product",
        accessorFn: (r) => r.product_name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product" />
        ),
        meta: { stopRowClick: true },
        cell: ({ row }) => (
          <InventoryProductLink
            productId={row.original.product_id}
            name={row.original.product_name}
            sku={row.original.product_sku || undefined}
          />
        ),
      },
      {
        id: "sku",
        accessorFn: (r) => r.product_sku ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="SKU" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.product_sku || "—"}
          </span>
        ),
      },
      {
        id: "quantity",
        accessorFn: (r) => r.quantity,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="On hand"
            className="flex w-full justify-center"
          />
        ),
        meta: { thClassName: "text-center", tdClassName: "text-center" },
        cell: ({ row }) => (
          <span className="inline-block tabular-nums font-medium">
            {formatQty(row.original.quantity)}
          </span>
        ),
      },
    ],
    [],
  );

  const movementColumns = useMemo<ColumnDef<InventoryMovementRow>[]>(
    () => [
      {
        id: "when",
        accessorFn: (r) => r.created_at,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="When" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {formatWhen(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "type",
        accessorFn: (r) => r.event_type,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        cell: ({ row }) => (
          <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
            {EVENT_LABELS[row.original.event_type]}
          </span>
        ),
      },
      {
        id: "product",
        accessorFn: (r) => r.product_name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Product" />
        ),
        meta: { stopRowClick: true },
        cell: ({ row }) => (
          <InventoryProductLink
            productId={row.original.product_id}
            name={row.original.product_name}
            sku={row.original.product_sku || undefined}
          />
        ),
      },
      {
        id: "from",
        accessorFn: (r) => r.from_label,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="From" />
        ),
        meta: { stopRowClick: true },
        cell: ({ row }) => {
          const m = row.original;
          if (!m.from_location_id || m.from_label === "—") {
            return (
              <span className="max-w-[140px] truncate block text-muted-foreground">
                {m.from_label}
              </span>
            );
          }
          return (
            <InventoryLocationLink
              locationId={m.from_location_id}
              label={m.from_label}
            />
          );
        },
      },
      {
        id: "to",
        accessorFn: (r) => r.to_label,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="To" />
        ),
        meta: { stopRowClick: true },
        cell: ({ row }) => {
          const m = row.original;
          if (!m.to_location_id || m.to_label === "—") {
            return (
              <span className="max-w-[140px] truncate block text-muted-foreground">
                {m.to_label}
              </span>
            );
          }
          return (
            <InventoryLocationLink
              locationId={m.to_location_id}
              label={m.to_label}
            />
          );
        },
      },
      {
        id: "qty",
        accessorFn: (r) => r.quantity,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Qty" className="justify-end" />
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums font-medium">
            {row.original.quantity}
          </span>
        ),
      },
      {
        id: "note",
        accessorFn: (r) => r.note,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Note" />
        ),
        cell: ({ row }) => (
          <span
            className="max-w-[180px] truncate block text-muted-foreground"
            title={row.original.note}
          >
            {row.original.note || "—"}
          </span>
        ),
      },
      {
        id: "by",
        accessorFn: (r) => r.recorded_by_label,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="By" />
        ),
        cell: ({ row }) => (
          <span
            className="max-w-[120px] truncate block text-muted-foreground"
            title={row.original.recorded_by_label}
          >
            {row.original.recorded_by_label}
          </span>
        ),
      },
    ],
    [],
  );

  const hasBalanceFilters = useMemo(
    () => debouncedBalanceSearch !== "" || balanceLocationId !== "",
    [debouncedBalanceSearch, balanceLocationId],
  );

  const hasMovFilters = useMemo(
    () =>
      debouncedMovSearch !== "" ||
      movEventFilter !== "all" ||
      movLocationId !== "",
    [debouncedMovSearch, movEventFilter, movLocationId],
  );

  const balanceRangeLabel = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(balanceTotal / balancePageSize));
    const safePage = Math.min(Math.max(1, balancePage), totalPages);
    const from = balanceTotal === 0 ? 0 : (safePage - 1) * balancePageSize + 1;
    const to = Math.min(safePage * balancePageSize, balanceTotal);
    if (balanceTotal === 0) return "0–0 of 0";
    return `${from}–${to} of ${balanceTotal}`;
  }, [balanceTotal, balancePage, balancePageSize]);

  const movRangeLabel = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(movTotal / movPageSize));
    const safePage = Math.min(Math.max(1, movPage), totalPages);
    const from = movTotal === 0 ? 0 : (safePage - 1) * movPageSize + 1;
    const to = Math.min(safePage * movPageSize, movTotal);
    if (movTotal === 0) return "0–0 of 0";
    return `${from}–${to} of ${movTotal}`;
  }, [movTotal, movPage, movPageSize]);

  const showListChrome = tab === "balances" || tab === "history";
  const showDirectory = companyReady === true;

  const shellActions = useMemo(() => {
    const disabled = companyReady !== true;
    if (tab === "balances") {
      return (
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2"
          disabled={disabled || balanceLoading}
          onClick={() => void refreshBalances()}
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
          onClick={() => void refreshMovements()}
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

  const filterPanelId =
    tab === "balances" ? "inventory-balances-filter-panel" : "inventory-history-filter-panel";

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      actions={shellActions}
      topbarTrailingBeforeTheme={
        showListChrome && showDirectory ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 text-muted-foreground",
              filtersOpen && "bg-primary/15 text-primary",
            )}
            aria-label={
              filtersOpen ? "Hide inventory filters" : "Show inventory filters"
            }
            aria-expanded={filtersOpen}
            aria-controls={filterPanelId}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersVertical className="h-4 w-4" aria-hidden />
          </Button>
        ) : null
      }
    >
      {companyReady === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company is linked to this account. Stock operations require a company context.
          </CardContent>
        </Card>
      )}

      {companyReady === null ? (
        <DirectoryListPageSkeleton className="min-h-0 flex-1" />
      ) : null}

      {companyReady === true && (
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <TabsList className="flex h-auto w-full shrink-0 flex-wrap justify-start gap-1">
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

          <TabsContent
            value="balances"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0",
                filtersOpen ? "gap-6" : "gap-0",
              )}
            >
              <FilterPanelShell open={filtersOpen} panelId={filterPanelId}>
                <InventoryLocationFilterSidebar
                  locations={locations}
                  locationFilter={balanceLocationId || LOCATION_ALL}
                  onLocationChange={(id) => {
                    setBalancePage(1);
                    setBalanceLocationId(id);
                  }}
                />
              </FilterPanelShell>
              <div className={LIST_PANEL_CLASS}>
                <div className="flex shrink-0 flex-col gap-3 border-b border-border/50 bg-muted/45 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 dark:bg-muted/25">
                  <div className="relative min-w-0 flex-1 sm:max-w-xl lg:max-w-2xl">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                      aria-hidden
                    />
                    <Input
                      type="search"
                      value={balanceSearchQuery}
                      onChange={(e) => setBalanceSearchQuery(e.target.value)}
                      placeholder="Search product, SKU, or location…"
                      className={SEARCH_INPUT_CLASS}
                      aria-label="Search stock balances"
                      autoComplete="off"
                    />
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-right">
                    {balanceRangeLabel}
                  </p>
                </div>
                <div
                  className={cn(
                    "relative flex min-h-0 flex-1 flex-col transition-opacity duration-150 ease-out",
                    balanceLoading &&
                      "pointer-events-none opacity-[0.58] motion-reduce:transition-none",
                  )}
                  aria-busy={balanceLoading}
                >
                  <DataTable
                    className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
                    tableContainerClassName="min-h-0 flex-1 overflow-auto"
                    variant="minimal"
                    columns={balanceColumns}
                    data={balances}
                    manualFiltering
                    hideSearch
                    onRowClick={(r) =>
                      router.push(`/app/products/${r.product_id}/edit`)
                    }
                    getRowId={(r) => `${r.location_id}-${r.product_id}`}
                    emptyMessage={
                      hasBalanceFilters ? (
                        <FeatureEmptyState
                          title="No balances match your filters"
                          description="Try clearing search or choosing another location."
                          action={
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setBalancePage(1);
                                setBalanceSearchQuery("");
                                setBalanceLocationId("");
                              }}
                            >
                              Clear filters
                            </Button>
                          }
                          className="border-0 bg-transparent py-8"
                        />
                      ) : (
                        <FeatureEmptyState
                          icon={Layers}
                          title="No stock on hand yet"
                          description="Use Refill to add inventory at a location."
                          className="border-0 bg-transparent py-8"
                        />
                      )
                    }
                    footer={
                      <DataTablePaginationFooter
                        variant="minimal"
                        total={balanceTotal}
                        page={balancePage}
                        pageSize={balancePageSize}
                        onPageChange={setBalancePage}
                        onPageSizeChange={setBalancePageSize}
                        pageSizeOptions={[10, 25, 50]}
                      />
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="transfer"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <InventoryFormPanel
              title="Transfer between locations"
              description="Moves quantity from one warehouse to another for the same product. Creates a history entry and updates balances automatically."
            >
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
            </InventoryFormPanel>
          </TabsContent>

          <TabsContent
            value="refill"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <InventoryFormPanel
              title="Refill / inbound stock"
              description="Increase quantity at a location (new delivery, production, etc.)."
            >
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
            </InventoryFormPanel>
          </TabsContent>

          <TabsContent
            value="adjust"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <InventoryFormPanel
              title="Stock out / adjustment"
              description="Reduce quantity at one location (damage, shrinkage, samples). Does not move stock to another location."
            >
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
            </InventoryFormPanel>
          </TabsContent>

          <TabsContent
            value="history"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0",
                filtersOpen ? "gap-6" : "gap-0",
              )}
            >
              <FilterPanelShell open={filtersOpen} panelId={filterPanelId}>
                <InventoryHistoryFilterSidebar
                  locations={locations}
                  eventFilter={movEventFilter}
                  locationFilter={movLocationId || LOCATION_ALL}
                  onEventChange={(v) => {
                    setMovPage(1);
                    setMovEventFilter(v);
                  }}
                  onLocationChange={(id) => {
                    setMovPage(1);
                    setMovLocationId(id);
                  }}
                />
              </FilterPanelShell>
              <div className={LIST_PANEL_CLASS}>
                <div className="flex shrink-0 flex-col gap-3 border-b border-border/50 bg-muted/45 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 dark:bg-muted/25">
                  <div className="relative min-w-0 flex-1 sm:max-w-xl lg:max-w-2xl">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                      aria-hidden
                    />
                    <Input
                      type="search"
                      value={movSearchQuery}
                      onChange={(e) => setMovSearchQuery(e.target.value)}
                      placeholder="Search product, SKU, or note…"
                      className={SEARCH_INPUT_CLASS}
                      aria-label="Search movement history"
                      autoComplete="off"
                    />
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-right">
                    {movRangeLabel}
                  </p>
                </div>
                <div
                  className={cn(
                    "relative flex min-h-0 flex-1 flex-col transition-opacity duration-150 ease-out",
                    movLoading &&
                      "pointer-events-none opacity-[0.58] motion-reduce:transition-none",
                  )}
                  aria-busy={movLoading}
                >
                  <DataTable
                    className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
                    tableContainerClassName="min-h-0 flex-1 overflow-auto"
                    variant="minimal"
                    columns={movementColumns}
                    data={movements}
                    manualFiltering
                    hideSearch
                    getRowId={(r) => r.id}
                    emptyMessage={
                      hasMovFilters ? (
                        <FeatureEmptyState
                          title="No movements match your filters"
                          description="Try clearing search or adjusting filters."
                          action={
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setMovPage(1);
                                setMovSearchQuery("");
                                setMovEventFilter("all");
                                setMovLocationId("");
                              }}
                            >
                              Clear filters
                            </Button>
                          }
                          className="border-0 bg-transparent py-8"
                        />
                      ) : (
                        <FeatureEmptyState
                          icon={History}
                          title="No movements yet"
                          description="Transfers, refills, and stock-outs will appear here."
                          className="border-0 bg-transparent py-8"
                        />
                      )
                    }
                    footer={
                      <DataTablePaginationFooter
                        variant="minimal"
                        total={movTotal}
                        page={movPage}
                        pageSize={movPageSize}
                        onPageChange={setMovPage}
                        onPageSizeChange={setMovPageSize}
                        pageSizeOptions={[10, 25, 50]}
                      />
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </AppPageShell>
  );
}
