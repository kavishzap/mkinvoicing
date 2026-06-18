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
  Warehouse,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useActionProgress } from "@/contexts/action-progress-context";
import { runActionProgress } from "@/lib/action-progress-bridge";
import { AppPageShell } from "@/components/app-page-shell";
import {
  DIRECTORY_LIST_PANEL_CLASS,
  DirectoryFilterPanel,
  DirectoryFilterToggleButton,
  DirectoryListFrame,
  DirectoryListSearchHeader,
} from "@/components/directory-list-layout";
import { useDirectoryFiltersOpen } from "@/hooks/use-directory-filters-open";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { listActiveLocationsForSelect, type LocationOption } from "@/lib/locations-service";
import { listProducts, type ProductRow } from "@/lib/products-service";
import {
  listStockBalances,
  listStockBalancesForLocation,
  listInventoryMovements,
  recordInventoryTransfer,
  recordInventoryRefill,
  recordInventoryAdjustmentOut,
  type StockBalanceRow,
  type InventoryMovementRow,
} from "@/lib/inventory-stock-service";
import { QtyInput } from "@/components/qty-input";
import { cn } from "@/lib/utils";

const NONE = "__none__";
const LOCATION_ALL = "__all__";

const EVENT_LABELS: Record<InventoryMovementRow["event_type"], string> = {
  transfer: "Transfer",
  refill: "Refill",
  adjustment_out: "Stock out",
};

type MovEventFilter = "all" | InventoryMovementRow["event_type"];

type InventoryLine = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  maxQty?: number;
  qty: string;
};

function newInventoryLineId() {
  return `inv-line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        DIRECTORY_LIST_PANEL_CLASS,
        "flex min-h-0 min-w-0 flex-1 flex-col",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border/50 bg-muted/45 px-4 py-3 sm:px-5 dark:bg-muted/25">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-4 sm:px-5">
        {children}
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isRunning } = useActionProgress();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [tab, setTab] = useState("balances");
  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [filtersOpen, setFiltersOpen] = useDirectoryFiltersOpen();

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

  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferLines, setTransferLines] = useState<InventoryLine[]>([]);
  const [transferStockAtFrom, setTransferStockAtFrom] = useState<StockBalanceRow[]>([]);
  const [transferStockLoading, setTransferStockLoading] = useState(false);
  const [transferPickerSelected, setTransferPickerSelected] = useState<Set<string>>(
    () => new Set(),
  );
  const [transferPickerQtys, setTransferPickerQtys] = useState<Record<string, string>>(
    {},
  );
  const [transferPickerSearchQuery, setTransferPickerSearchQuery] = useState("");
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

  const [refillLocationId, setRefillLocationId] = useState("");
  const [refillNote, setRefillNote] = useState("");
  const [refillLines, setRefillLines] = useState<InventoryLine[]>([]);
  const [refillPickerSelected, setRefillPickerSelected] = useState<Set<string>>(
    () => new Set(),
  );
  const [refillPickerQtys, setRefillPickerQtys] = useState<Record<string, string>>(
    {},
  );
  const [refillPickerSearchQuery, setRefillPickerSearchQuery] = useState("");
  const [refillConfirmOpen, setRefillConfirmOpen] = useState(false);

  const [adjFromId, setAdjFromId] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjLines, setAdjLines] = useState<InventoryLine[]>([]);
  const [adjStockAtFrom, setAdjStockAtFrom] = useState<StockBalanceRow[]>([]);
  const [adjStockLoading, setAdjStockLoading] = useState(false);
  const [adjPickerSelected, setAdjPickerSelected] = useState<Set<string>>(
    () => new Set(),
  );
  const [adjPickerQtys, setAdjPickerQtys] = useState<Record<string, string>>({});
  const [adjPickerSearchQuery, setAdjPickerSearchQuery] = useState("");
  const [adjustConfirmOpen, setAdjustConfirmOpen] = useState(false);

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
      if (!transferFromId) {
        setTransferStockAtFrom([]);
        setTransferLines([]);
        setTransferPickerSelected(new Set());
        setTransferPickerQtys({});
        setTransferPickerSearchQuery("");
        return;
      }
      setTransferStockLoading(true);
      try {
        const rows = await listStockBalancesForLocation(transferFromId);
        if (!cancelled) {
          setTransferStockAtFrom(rows);
          setTransferLines((prev) =>
            prev.filter((line) =>
              rows.some(
                (r) => r.product_id === line.productId && r.quantity > 0,
              ),
            ),
          );
          setTransferPickerSelected(new Set());
          setTransferPickerQtys({});
          setTransferPickerSearchQuery("");
        }
      } catch {
        if (!cancelled) {
          setTransferStockAtFrom([]);
          setTransferLines([]);
          setTransferPickerQtys({});
          setTransferPickerSearchQuery("");
        }
      } finally {
        if (!cancelled) setTransferStockLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transferFromId]);

  useEffect(() => {
    setRefillLines([]);
    setRefillPickerSelected(new Set());
    setRefillPickerQtys({});
    setRefillPickerSearchQuery("");
  }, [refillLocationId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!adjFromId) {
        setAdjStockAtFrom([]);
        setAdjLines([]);
        setAdjPickerSelected(new Set());
        setAdjPickerQtys({});
        setAdjPickerSearchQuery("");
        return;
      }
      setAdjStockLoading(true);
      try {
        const rows = await listStockBalancesForLocation(adjFromId);
        if (!cancelled) {
          setAdjStockAtFrom(rows);
          setAdjLines((prev) =>
            prev.filter((line) =>
              rows.some(
                (r) => r.product_id === line.productId && r.quantity > 0,
              ),
            ),
          );
          setAdjPickerSelected(new Set());
          setAdjPickerQtys({});
          setAdjPickerSearchQuery("");
        }
      } catch {
        if (!cancelled) {
          setAdjStockAtFrom([]);
          setAdjLines([]);
          setAdjPickerQtys({});
          setAdjPickerSearchQuery("");
        }
      } finally {
        if (!cancelled) setAdjStockLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adjFromId]);

  const transferLineProductIds = useMemo(
    () => new Set(transferLines.map((l) => l.productId)),
    [transferLines],
  );

  const transferProductsAvailableToPick = useMemo(
    () =>
      transferStockAtFrom.filter(
        (r) => r.quantity > 0 && !transferLineProductIds.has(r.product_id),
      ),
    [transferStockAtFrom, transferLineProductIds],
  );

  const transferPickerSearchNorm = transferPickerSearchQuery.trim().toLowerCase();

  const transferProductsFilteredToPick = useMemo(() => {
    if (!transferPickerSearchNorm) return transferProductsAvailableToPick;
    return transferProductsAvailableToPick.filter((r) => {
      const name = r.product_name.toLowerCase();
      const sku = (r.product_sku ?? "").toLowerCase();
      return (
        name.includes(transferPickerSearchNorm) ||
        sku.includes(transferPickerSearchNorm)
      );
    });
  }, [transferProductsAvailableToPick, transferPickerSearchNorm]);

  const refillLineProductIds = useMemo(
    () => new Set(refillLines.map((l) => l.productId)),
    [refillLines],
  );

  const refillProductsAvailableToPick = useMemo(
    () => products.filter((p) => !refillLineProductIds.has(p.id)),
    [products, refillLineProductIds],
  );

  const refillPickerSearchNorm = refillPickerSearchQuery.trim().toLowerCase();

  const refillProductsFilteredToPick = useMemo(() => {
    if (!refillPickerSearchNorm) return refillProductsAvailableToPick;
    return refillProductsAvailableToPick.filter((p) => {
      const name = p.name.toLowerCase();
      const sku = (p.sku ?? "").toLowerCase();
      return name.includes(refillPickerSearchNorm) || sku.includes(refillPickerSearchNorm);
    });
  }, [refillProductsAvailableToPick, refillPickerSearchNorm]);

  const adjLineProductIds = useMemo(
    () => new Set(adjLines.map((l) => l.productId)),
    [adjLines],
  );

  const adjProductsAvailableToPick = useMemo(
    () =>
      adjStockAtFrom.filter(
        (r) => r.quantity > 0 && !adjLineProductIds.has(r.product_id),
      ),
    [adjStockAtFrom, adjLineProductIds],
  );

  const adjPickerSearchNorm = adjPickerSearchQuery.trim().toLowerCase();

  const adjProductsFilteredToPick = useMemo(() => {
    if (!adjPickerSearchNorm) return adjProductsAvailableToPick;
    return adjProductsAvailableToPick.filter((r) => {
      const name = r.product_name.toLowerCase();
      const sku = (r.product_sku ?? "").toLowerCase();
      return (
        name.includes(adjPickerSearchNorm) || sku.includes(adjPickerSearchNorm)
      );
    });
  }, [adjProductsAvailableToPick, adjPickerSearchNorm]);

  const toLocationOptions = useMemo(() => {
    if (!transferFromId) return locations;
    return locations.filter((l) => l.id !== transferFromId);
  }, [locations, transferFromId]);

  function toggleTransferPickerProduct(productId: string, checked: boolean) {
    setTransferPickerSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
    if (checked) {
      setTransferPickerQtys((prev) => ({
        ...prev,
        [productId]: prev[productId]?.trim() ? prev[productId] : "1",
      }));
    }
  }

  function updateTransferPickerQty(productId: string, qty: string) {
    setTransferPickerQtys((prev) => ({ ...prev, [productId]: qty }));
    if (qty.trim()) {
      setTransferPickerSelected((prev) => {
        const next = new Set(prev);
        next.add(productId);
        return next;
      });
    }
  }

  function addSelectedProductsToTransferLines() {
    const toAdd = transferStockAtFrom.filter((r) =>
      transferPickerSelected.has(r.product_id),
    );
    if (toAdd.length === 0) return;

    for (const r of toAdd) {
      const raw = transferPickerQtys[r.product_id] ?? "1";
      const q = parseFloat(raw);
      if (Number.isNaN(q) || q <= 0) {
        toast({
          title: "Invalid quantity",
          description: `Enter a quantity for “${r.product_name}”.`,
          variant: "destructive",
        });
        return;
      }
      if (q > r.quantity) {
        toast({
          title: "Not enough stock",
          description: `Only ${formatQty(r.quantity)} available for “${r.product_name}”.`,
          variant: "destructive",
        });
        return;
      }
    }

    setTransferLines((prev) => [
      ...prev,
      ...toAdd.map((r) => {
        const raw = transferPickerQtys[r.product_id] ?? "1";
        const q = parseFloat(raw);
        return {
          id: newInventoryLineId(),
          productId: r.product_id,
          productName: r.product_name,
          productSku: r.product_sku,
          maxQty: r.quantity,
          qty: String(q),
        };
      }),
    ]);
    setTransferPickerSelected(new Set());
    setTransferPickerQtys({});
  }

  function updateTransferLineQty(lineId: string, qty: string) {
    setTransferLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, qty } : l)),
    );
  }

  function removeTransferLine(lineId: string) {
    setTransferLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  function moveTransferLineUp(index: number) {
    if (index <= 0) return;
    setTransferLines((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveTransferLineDown(index: number) {
    setTransferLines((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function toggleRefillPickerProduct(productId: string, checked: boolean) {
    setRefillPickerSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
    if (checked) {
      setRefillPickerQtys((prev) => ({
        ...prev,
        [productId]: prev[productId]?.trim() ? prev[productId] : "1",
      }));
    }
  }

  function updateRefillPickerQty(productId: string, qty: string) {
    setRefillPickerQtys((prev) => ({ ...prev, [productId]: qty }));
    if (qty.trim()) {
      setRefillPickerSelected((prev) => {
        const next = new Set(prev);
        next.add(productId);
        return next;
      });
    }
  }

  function addSelectedProductsToRefillLines() {
    const toAdd = products.filter((p) => refillPickerSelected.has(p.id));
    if (toAdd.length === 0) return;

    for (const p of toAdd) {
      const raw = refillPickerQtys[p.id] ?? "1";
      const q = parseFloat(raw);
      if (Number.isNaN(q) || q <= 0) {
        toast({
          title: "Invalid quantity",
          description: `Enter a quantity for “${p.name}”.`,
          variant: "destructive",
        });
        return;
      }
    }

    setRefillLines((prev) => [
      ...prev,
      ...toAdd.map((p) => {
        const raw = refillPickerQtys[p.id] ?? "1";
        const q = parseFloat(raw);
        return {
          id: newInventoryLineId(),
          productId: p.id,
          productName: p.name,
          productSku: p.sku ?? "",
          qty: String(q),
        };
      }),
    ]);
    setRefillPickerSelected(new Set());
    setRefillPickerQtys({});
  }

  function updateRefillLineQty(lineId: string, qty: string) {
    setRefillLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, qty } : l)),
    );
  }

  function removeRefillLine(lineId: string) {
    setRefillLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  function toggleAdjPickerProduct(productId: string, checked: boolean) {
    setAdjPickerSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
    if (checked) {
      setAdjPickerQtys((prev) => ({
        ...prev,
        [productId]: prev[productId]?.trim() ? prev[productId] : "1",
      }));
    }
  }

  function updateAdjPickerQty(productId: string, qty: string) {
    setAdjPickerQtys((prev) => ({ ...prev, [productId]: qty }));
    if (qty.trim()) {
      setAdjPickerSelected((prev) => {
        const next = new Set(prev);
        next.add(productId);
        return next;
      });
    }
  }

  function addSelectedProductsToAdjLines() {
    const toAdd = adjStockAtFrom.filter((r) => adjPickerSelected.has(r.product_id));
    if (toAdd.length === 0) return;

    for (const r of toAdd) {
      const raw = adjPickerQtys[r.product_id] ?? "1";
      const q = parseFloat(raw);
      if (Number.isNaN(q) || q <= 0) {
        toast({
          title: "Invalid quantity",
          description: `Enter a quantity for “${r.product_name}”.`,
          variant: "destructive",
        });
        return;
      }
      if (q > r.quantity) {
        toast({
          title: "Not enough stock",
          description: `Only ${formatQty(r.quantity)} available for “${r.product_name}”.`,
          variant: "destructive",
        });
        return;
      }
    }

    setAdjLines((prev) => [
      ...prev,
      ...toAdd.map((r) => {
        const raw = adjPickerQtys[r.product_id] ?? "1";
        const q = parseFloat(raw);
        return {
          id: newInventoryLineId(),
          productId: r.product_id,
          productName: r.product_name,
          productSku: r.product_sku,
          maxQty: r.quantity,
          qty: String(q),
        };
      }),
    ]);
    setAdjPickerSelected(new Set());
    setAdjPickerQtys({});
  }

  function updateAdjLineQty(lineId: string, qty: string) {
    setAdjLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, qty } : l)),
    );
  }

  function removeAdjLine(lineId: string) {
    setAdjLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  function requestTransfer(e: React.FormEvent) {
    e.preventDefault();
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
    if (transferLines.length === 0) {
      toast({
        title: "No products",
        description: "Add at least one product to transfer.",
        variant: "destructive",
      });
      return;
    }

    for (const line of transferLines) {
      const q = parseFloat(line.qty);
      if (Number.isNaN(q) || q <= 0) {
        toast({
          title: "Invalid quantity",
          description: `Enter a quantity for “${line.productName}”.`,
          variant: "destructive",
        });
        return;
      }
      if (line.maxQty != null && q > line.maxQty) {
        toast({
          title: "Not enough stock",
          description: `Only ${formatQty(line.maxQty)} available for “${line.productName}” at the source.`,
          variant: "destructive",
        });
        return;
      }
    }

    setTransferConfirmOpen(true);
  }

  async function performTransfer() {
    await runActionProgress("Recording transfer…", async () => {
      try {
        const note = transferNote.trim() || null;
        for (const line of transferLines) {
          await recordInventoryTransfer({
            productId: line.productId,
            fromLocationId: transferFromId,
            toLocationId: transferToId,
            quantity: parseFloat(line.qty),
            note,
          });
        }
        const n = transferLines.length;
        toast({
          title: n === 1 ? "Transfer recorded" : "Transfers recorded",
          description:
            n === 1
              ? "Balances and history were updated."
              : `${n} products transferred. Balances and history were updated.`,
        });
        setTransferLines([]);
        setTransferPickerSelected(new Set());
        setTransferPickerQtys({});
        setTransferNote("");
        await Promise.all([refreshBalances(), refreshMovements()]);
        if (transferFromId) {
          const rows = await listStockBalancesForLocation(transferFromId);
          setTransferStockAtFrom(rows);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Please try again.";
        toast({
          title: "Transfer failed",
          description: msg,
          variant: "destructive",
        });
      }
    });
  }

  function requestRefill(e: React.FormEvent) {
    e.preventDefault();
    if (!refillLocationId) {
      toast({
        title: "Missing location",
        description: "Choose where stock arrives.",
        variant: "destructive",
      });
      return;
    }
    if (refillLines.length === 0) {
      toast({
        title: "No products",
        description: "Add at least one product to refill.",
        variant: "destructive",
      });
      return;
    }

    for (const line of refillLines) {
      const q = parseFloat(line.qty);
      if (Number.isNaN(q) || q <= 0) {
        toast({
          title: "Invalid quantity",
          description: `Enter a quantity for “${line.productName}”.`,
          variant: "destructive",
        });
        return;
      }
    }

    setRefillConfirmOpen(true);
  }

  async function performRefill() {
    await runActionProgress("Recording refill…", async () => {
      try {
        const note = refillNote.trim() || null;
        for (const line of refillLines) {
          await recordInventoryRefill({
            productId: line.productId,
            toLocationId: refillLocationId,
            quantity: parseFloat(line.qty),
            note,
          });
        }
        const n = refillLines.length;
        toast({
          title: n === 1 ? "Refill recorded" : "Refills recorded",
          description:
            n === 1
              ? "Stock increased at that location."
              : `${n} products refilled at that location.`,
        });
        setRefillLines([]);
        setRefillPickerSelected(new Set());
        setRefillPickerQtys({});
        setRefillNote("");
        await Promise.all([refreshBalances(), refreshMovements()]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Please try again.";
        toast({ title: "Refill failed", description: msg, variant: "destructive" });
      }
    });
  }

  function requestAdjustOut(e: React.FormEvent) {
    e.preventDefault();
    if (!adjFromId) {
      toast({
        title: "Missing location",
        description: "Choose where to reduce stock.",
        variant: "destructive",
      });
      return;
    }
    if (adjLines.length === 0) {
      toast({
        title: "No products",
        description: "Add at least one product to remove.",
        variant: "destructive",
      });
      return;
    }

    for (const line of adjLines) {
      const q = parseFloat(line.qty);
      if (Number.isNaN(q) || q <= 0) {
        toast({
          title: "Invalid quantity",
          description: `Enter a quantity for “${line.productName}”.`,
          variant: "destructive",
        });
        return;
      }
      if (line.maxQty != null && q > line.maxQty) {
        toast({
          title: "Not enough stock",
          description: `Only ${formatQty(line.maxQty)} available for “${line.productName}”.`,
          variant: "destructive",
        });
        return;
      }
    }

    setAdjustConfirmOpen(true);
  }

  async function performAdjustOut() {
    await runActionProgress("Recording stock out…", async () => {
      try {
        const note = adjNote.trim() || null;
        for (const line of adjLines) {
          await recordInventoryAdjustmentOut({
            productId: line.productId,
            fromLocationId: adjFromId,
            quantity: parseFloat(line.qty),
            note,
          });
        }
        const n = adjLines.length;
        toast({
          title: n === 1 ? "Stock out recorded" : "Stock outs recorded",
          description:
            n === 1
              ? "Quantity was reduced at that location."
              : `${n} products removed at that location.`,
        });
        setAdjLines([]);
        setAdjPickerSelected(new Set());
        setAdjPickerQtys({});
        setAdjNote("");
        await Promise.all([refreshBalances(), refreshMovements()]);
        if (adjFromId) {
          const rows = await listStockBalancesForLocation(adjFromId);
          setAdjStockAtFrom(rows);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Please try again.";
        toast({
          title: "Stock out failed",
          description: msg,
          variant: "destructive",
        });
      }
    });
  }

  const locationLabel = useCallback(
    (id: string) => locations.find((l) => l.id === id)?.name ?? "location",
    [locations],
  );

  const transferConfirmSummary = useMemo(() => {
    const from = locationLabel(transferFromId);
    const to = locationLabel(transferToId);
    const lineSummary =
      transferLines.length === 1
        ? `${formatQty(parseFloat(transferLines[0]?.qty ?? "0"))} × ${transferLines[0]?.productName ?? "product"}`
        : `${transferLines.length} products`;
    return { from, to, lineSummary };
  }, [transferFromId, transferToId, transferLines, locationLabel]);

  const refillConfirmSummary = useMemo(() => {
    const loc = locationLabel(refillLocationId);
    const lineSummary =
      refillLines.length === 1 ? "1 product" : `${refillLines.length} products`;
    return { loc, lineSummary };
  }, [refillLocationId, refillLines.length, locationLabel]);

  const adjustConfirmSummary = useMemo(() => {
    const loc = locationLabel(adjFromId);
    const lineSummary =
      adjLines.length === 1 ? "1 product" : `${adjLines.length} products`;
    return { loc, lineSummary };
  }, [adjFromId, adjLines.length, locationLabel]);

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
          disabled={disabled || isRunning}
        >
          Record transfers
        </Button>
      );
    }
    if (tab === "refill") {
      return (
        <Button
          type="submit"
          form="inventory-form-refill"
          className="shrink-0 gap-2"
          disabled={disabled || isRunning}
        >
          Record refill
        </Button>
      );
    }
    if (tab === "adjust") {
      return (
        <Button
          type="submit"
          form="inventory-form-adjust"
          className="shrink-0 gap-2"
          disabled={disabled || isRunning}
        >
          Record stock out
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
    isRunning,
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
          <DirectoryFilterToggleButton
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            panelId={filterPanelId}
            label="inventory filters"
          />
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
            <DirectoryListFrame filtersOpen={filtersOpen}>
              <DirectoryFilterPanel
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                panelId={filterPanelId}
                title="Inventory filters"
              >
                <InventoryLocationFilterSidebar
                  locations={locations}
                  locationFilter={balanceLocationId || LOCATION_ALL}
                  onLocationChange={(id) => {
                    setBalancePage(1);
                    setBalanceLocationId(id);
                  }}
                />
              </DirectoryFilterPanel>
              <div className={DIRECTORY_LIST_PANEL_CLASS}>
                <DirectoryListSearchHeader trailing={balanceRangeLabel}>
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
                </DirectoryListSearchHeader>
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
                        pageSizeOptions={[10, 50, 100, 200]}
                      />
                    }
                  />
                </div>
              </div>
            </DirectoryListFrame>
          </TabsContent>

          <TabsContent
            value="transfer"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <InventoryFormPanel
              title="Transfer between locations"
              description="Move stock from one location to another. Each line is saved in history."
            >
              <form
                id="inventory-form-transfer"
                onSubmit={requestTransfer}
                className="flex min-h-0 flex-1 flex-col gap-4"
              >
                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>From location</Label>
                    <Select
                      value={transferFromId || NONE}
                      onValueChange={(v) => {
                        const id = v === NONE ? "" : v;
                        setTransferFromId(id);
                        if (id === transferToId) setTransferToId("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Where stock is now" />
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
                  <div className="space-y-1.5">
                    <Label>To location</Label>
                    <Select
                      value={transferToId || NONE}
                      onValueChange={(v) => setTransferToId(v === NONE ? "" : v)}
                      disabled={!transferFromId}
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
                    <div className="space-y-1.5">
                      <Label htmlFor="t-note">Note (optional)</Label>
                      <Textarea
                        id="t-note"
                        rows={2}
                        value={transferNote}
                        onChange={(e) => setTransferNote(e.target.value)}
                        placeholder="e.g. Picked for branch display"
                        className="min-h-[4.5rem] resize-y"
                      />
                    </div>
                  </div>

                  <div className="flex min-h-[14rem] flex-col lg:min-h-0">
                {transferFromId ? (
                  <div className="flex h-full min-h-0 flex-col space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-sm font-medium text-foreground">Add products</p>
                    {transferStockLoading ? (
                      <p className="text-sm text-muted-foreground">Loading stock at source…</p>
                    ) : transferProductsAvailableToPick.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {transferStockAtFrom.length === 0
                          ? "No stock at this location."
                          : "All products with stock here are already on the list."}
                      </p>
                    ) : (
                      <>
                        <div className="relative">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                            aria-hidden
                          />
                          <Input
                            type="search"
                            value={transferPickerSearchQuery}
                            onChange={(e) =>
                              setTransferPickerSearchQuery(e.target.value)
                            }
                            placeholder="Search product or SKU…"
                            className={SEARCH_INPUT_CLASS}
                            aria-label="Search products to transfer"
                            autoComplete="off"
                          />
                        </div>
                        {transferProductsFilteredToPick.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No products match &ldquo;{transferPickerSearchQuery.trim()}
                            &rdquo;.
                          </p>
                        ) : (
                          <>
                        <div className="mb-1 grid grid-cols-[auto_1fr_7rem] gap-x-2 gap-y-0 px-1 text-xs font-medium text-muted-foreground">
                          <span className="w-4" aria-hidden />
                          <span>Product</span>
                          <span className="text-right">Quantity</span>
                        </div>
                        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                          {transferProductsFilteredToPick.map((r) => {
                            const selected = transferPickerSelected.has(r.product_id);
                            return (
                              <div
                                key={r.product_id}
                                className={cn(
                                  "grid grid-cols-[auto_1fr_7rem] items-center gap-x-2 rounded-md px-1 py-1.5 text-sm",
                                  selected && "bg-muted/50",
                                )}
                              >
                                <Checkbox
                                  checked={selected}
                                  onCheckedChange={(c) =>
                                    toggleTransferPickerProduct(
                                      r.product_id,
                                      c === true,
                                    )
                                  }
                                  aria-label={`Select ${r.product_name}`}
                                />
                                <label
                                  className="min-w-0 cursor-pointer"
                                  onClick={() =>
                                    toggleTransferPickerProduct(
                                      r.product_id,
                                      !selected,
                                    )
                                  }
                                >
                                  <span className="font-medium">{r.product_name}</span>
                                  {r.product_sku ? (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {r.product_sku}
                                    </span>
                                  ) : null}
                                  <span className="block text-xs text-muted-foreground tabular-nums">
                                    {formatQty(r.quantity)} on hand
                                  </span>
                                </label>
                                <QtyInput
                                  className="h-8"
                                  value={
                                    transferPickerQtys[r.product_id] ??
                                    (selected ? "1" : "")
                                  }
                                  onValueChange={(value) =>
                                    updateTransferPickerQty(r.product_id, value)
                                  }
                                  placeholder={selected ? "Qty" : "—"}
                                  aria-label={`Quantity for ${r.product_name}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="gap-1.5"
                          disabled={transferPickerSelected.size === 0}
                          onClick={addSelectedProductsToTransferLines}
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                          Add{" "}
                          {transferPickerSelected.size > 0
                            ? `${transferPickerSelected.size} `
                            : ""}
                          to list
                        </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[14rem] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground lg:min-h-0">
                    Choose a source location to pick products.
                  </div>
                )}
                  </div>
                </div>

                {transferLines.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Transfer lines ({transferLines.length})</Label>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[72px] text-center">Order</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="w-[100px] text-right tabular-nums">
                              On hand
                            </TableHead>
                            <TableHead className="w-[120px]">Quantity</TableHead>
                            <TableHead className="w-[50px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transferLines.map((line, index) => (
                            <TableRow key={line.id}>
                              <TableCell className="align-top">
                                <div className="flex flex-col items-center gap-0.5 pt-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={index === 0}
                                    onClick={() => moveTransferLineUp(index)}
                                    aria-label="Move line up"
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={index === transferLines.length - 1}
                                    onClick={() => moveTransferLineDown(index)}
                                    aria-label="Move line down"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="pt-1.5 text-sm font-medium">
                                  {line.productName}
                                </div>
                                {line.productSku ? (
                                  <div className="text-xs text-muted-foreground">
                                    {line.productSku}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell className="align-top text-right tabular-nums text-muted-foreground">
                                <span className="inline-block pt-1.5">
                                  {line.maxQty != null ? formatQty(line.maxQty) : "—"}
                                </span>
                              </TableCell>
                              <TableCell className="align-top">
                                <Label
                                  htmlFor={`t-line-qty-${line.id}`}
                                  className="sr-only"
                                >
                                  Quantity for {line.productName}
                                </Label>
                                <QtyInput
                                  id={`t-line-qty-${line.id}`}
                                  value={line.qty}
                                  onValueChange={(value) =>
                                    updateTransferLineQty(line.id, value)
                                  }
                                  placeholder={
                                    line.maxQty != null
                                      ? `Max ${formatQty(line.maxQty)}`
                                      : "0"
                                  }
                                  className="h-9 min-w-[5.5rem]"
                                  required
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeTransferLine(line.id)}
                                  aria-label={`Remove ${line.productName}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : transferFromId && !transferStockLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Select products above to build your transfer list.
                  </p>
                ) : null}
              </form>
            </InventoryFormPanel>
          </TabsContent>

          <TabsContent
            value="refill"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <InventoryFormPanel
              title="Refill / inbound stock"
              description="Add one or more products to a location."
            >
              <form
                id="inventory-form-refill"
                onSubmit={requestRefill}
                className="flex min-h-0 flex-1 flex-col gap-4"
              >
                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Location</Label>
                      <Select
                        value={refillLocationId || NONE}
                        onValueChange={(v) =>
                          setRefillLocationId(v === NONE ? "" : v)
                        }
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
                    <div className="space-y-1.5">
                      <Label htmlFor="r-note">Note (optional)</Label>
                      <Textarea
                        id="r-note"
                        rows={2}
                        value={refillNote}
                        onChange={(e) => setRefillNote(e.target.value)}
                        placeholder="e.g. PO #12345 delivery"
                        className="min-h-[4.5rem] resize-y"
                      />
                    </div>
                  </div>

                  <div className="flex min-h-[14rem] flex-col lg:min-h-0">
                    {refillLocationId ? (
                      <div className="flex h-full min-h-0 flex-col space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                        <p className="text-sm font-medium text-foreground">
                          Add products
                        </p>
                        {refillProductsAvailableToPick.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            All products are already on the list.
                          </p>
                        ) : (
                          <>
                            <div className="relative">
                              <Search
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                                aria-hidden
                              />
                              <Input
                                type="search"
                                value={refillPickerSearchQuery}
                                onChange={(e) =>
                                  setRefillPickerSearchQuery(e.target.value)
                                }
                                placeholder="Search product or SKU…"
                                className={SEARCH_INPUT_CLASS}
                                aria-label="Search products to refill"
                                autoComplete="off"
                              />
                            </div>
                            {refillProductsFilteredToPick.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No products match &ldquo;
                                {refillPickerSearchQuery.trim()}&rdquo;.
                              </p>
                            ) : (
                              <>
                                <div className="mb-1 grid grid-cols-[auto_1fr_7rem] gap-x-2 px-1 text-xs font-medium text-muted-foreground">
                                  <span className="w-4" aria-hidden />
                                  <span>Product</span>
                                  <span className="text-right">Quantity</span>
                                </div>
                                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                                  {refillProductsFilteredToPick.map((p) => {
                                    const selected = refillPickerSelected.has(p.id);
                                    return (
                                      <div
                                        key={p.id}
                                        className={cn(
                                          "grid grid-cols-[auto_1fr_7rem] items-center gap-x-2 rounded-md px-1 py-1.5 text-sm",
                                          selected && "bg-muted/50",
                                        )}
                                      >
                                        <Checkbox
                                          checked={selected}
                                          onCheckedChange={(c) =>
                                            toggleRefillPickerProduct(p.id, c === true)
                                          }
                                          aria-label={`Select ${p.name}`}
                                        />
                                        <label
                                          className="min-w-0 cursor-pointer"
                                          onClick={() =>
                                            toggleRefillPickerProduct(p.id, !selected)
                                          }
                                        >
                                          <span className="font-medium">{p.name}</span>
                                          {p.sku ? (
                                            <span className="text-muted-foreground">
                                              {" "}
                                              · {p.sku}
                                            </span>
                                          ) : null}
                                        </label>
                                        <QtyInput
                                          className="h-8"
                                          value={
                                            refillPickerQtys[p.id] ??
                                            (selected ? "1" : "")
                                          }
                                          onValueChange={(value) =>
                                            updateRefillPickerQty(p.id, value)
                                          }
                                          placeholder={selected ? "Qty" : "—"}
                                          aria-label={`Quantity for ${p.name}`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1.5"
                                  disabled={refillPickerSelected.size === 0}
                                  onClick={addSelectedProductsToRefillLines}
                                >
                                  <Plus className="h-4 w-4" aria-hidden />
                                  Add{" "}
                                  {refillPickerSelected.size > 0
                                    ? `${refillPickerSelected.size} `
                                    : ""}
                                  to list
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[14rem] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground lg:min-h-0">
                        Choose a location to add products.
                      </div>
                    )}
                  </div>
                </div>

                {refillLines.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Refill lines ({refillLines.length})</Label>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="w-[120px]">Quantity</TableHead>
                            <TableHead className="w-[50px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {refillLines.map((line) => (
                            <TableRow key={line.id}>
                              <TableCell className="align-top">
                                <div className="pt-1.5 text-sm font-medium">
                                  {line.productName}
                                </div>
                                {line.productSku ? (
                                  <div className="text-xs text-muted-foreground">
                                    {line.productSku}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell className="align-top">
                                <QtyInput
                                  value={line.qty}
                                  onValueChange={(value) =>
                                    updateRefillLineQty(line.id, value)
                                  }
                                  className="h-9 min-w-[5.5rem]"
                                  required
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeRefillLine(line.id)}
                                  aria-label={`Remove ${line.productName}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : refillLocationId ? (
                  <p className="text-xs text-muted-foreground">
                    Select products above to build your refill list.
                  </p>
                ) : null}
              </form>
            </InventoryFormPanel>
          </TabsContent>

          <TabsContent
            value="adjust"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <InventoryFormPanel
              title="Stock out / adjustment"
              description="Remove one or more products from a location."
            >
              <form
                id="inventory-form-adjust"
                onSubmit={requestAdjustOut}
                className="flex min-h-0 flex-1 flex-col gap-4"
              >
                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>From location</Label>
                      <Select
                        value={adjFromId || NONE}
                        onValueChange={(v) => setAdjFromId(v === NONE ? "" : v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Where to reduce stock" />
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
                    <div className="space-y-1.5">
                      <Label htmlFor="a-note">Note (optional)</Label>
                      <Textarea
                        id="a-note"
                        rows={2}
                        value={adjNote}
                        onChange={(e) => setAdjNote(e.target.value)}
                        placeholder="e.g. Damaged in handling"
                        className="min-h-[4.5rem] resize-y"
                      />
                    </div>
                  </div>

                  <div className="flex min-h-[14rem] flex-col lg:min-h-0">
                    {adjFromId ? (
                      <div className="flex h-full min-h-0 flex-col space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                        <p className="text-sm font-medium text-foreground">
                          Add products
                        </p>
                        {adjStockLoading ? (
                          <p className="text-sm text-muted-foreground">
                            Loading stock at location…
                          </p>
                        ) : adjProductsAvailableToPick.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {adjStockAtFrom.length === 0
                              ? "No stock at this location."
                              : "All products with stock here are already on the list."}
                          </p>
                        ) : (
                          <>
                            <div className="relative">
                              <Search
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                                aria-hidden
                              />
                              <Input
                                type="search"
                                value={adjPickerSearchQuery}
                                onChange={(e) =>
                                  setAdjPickerSearchQuery(e.target.value)
                                }
                                placeholder="Search product or SKU…"
                                className={SEARCH_INPUT_CLASS}
                                aria-label="Search products to remove"
                                autoComplete="off"
                              />
                            </div>
                            {adjProductsFilteredToPick.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No products match &ldquo;
                                {adjPickerSearchQuery.trim()}&rdquo;.
                              </p>
                            ) : (
                              <>
                                <div className="mb-1 grid grid-cols-[auto_1fr_7rem] gap-x-2 px-1 text-xs font-medium text-muted-foreground">
                                  <span className="w-4" aria-hidden />
                                  <span>Product</span>
                                  <span className="text-right">Quantity</span>
                                </div>
                                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                                  {adjProductsFilteredToPick.map((r) => {
                                    const selected = adjPickerSelected.has(r.product_id);
                                    return (
                                      <div
                                        key={r.product_id}
                                        className={cn(
                                          "grid grid-cols-[auto_1fr_7rem] items-center gap-x-2 rounded-md px-1 py-1.5 text-sm",
                                          selected && "bg-muted/50",
                                        )}
                                      >
                                        <Checkbox
                                          checked={selected}
                                          onCheckedChange={(c) =>
                                            toggleAdjPickerProduct(
                                              r.product_id,
                                              c === true,
                                            )
                                          }
                                          aria-label={`Select ${r.product_name}`}
                                        />
                                        <label
                                          className="min-w-0 cursor-pointer"
                                          onClick={() =>
                                            toggleAdjPickerProduct(
                                              r.product_id,
                                              !selected,
                                            )
                                          }
                                        >
                                          <span className="font-medium">
                                            {r.product_name}
                                          </span>
                                          {r.product_sku ? (
                                            <span className="text-muted-foreground">
                                              {" "}
                                              · {r.product_sku}
                                            </span>
                                          ) : null}
                                          <span className="block text-xs text-muted-foreground tabular-nums">
                                            {formatQty(r.quantity)} on hand
                                          </span>
                                        </label>
                                        <QtyInput
                                          className="h-8"
                                          value={
                                            adjPickerQtys[r.product_id] ??
                                            (selected ? "1" : "")
                                          }
                                          onValueChange={(value) =>
                                            updateAdjPickerQty(r.product_id, value)
                                          }
                                          placeholder={selected ? "Qty" : "—"}
                                          aria-label={`Quantity for ${r.product_name}`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1.5"
                                  disabled={adjPickerSelected.size === 0}
                                  onClick={addSelectedProductsToAdjLines}
                                >
                                  <Plus className="h-4 w-4" aria-hidden />
                                  Add{" "}
                                  {adjPickerSelected.size > 0
                                    ? `${adjPickerSelected.size} `
                                    : ""}
                                  to list
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[14rem] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground lg:min-h-0">
                        Choose a location to pick products.
                      </div>
                    )}
                  </div>
                </div>

                {adjLines.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Stock out lines ({adjLines.length})</Label>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="w-[100px] text-right tabular-nums">
                              On hand
                            </TableHead>
                            <TableHead className="w-[120px]">Quantity</TableHead>
                            <TableHead className="w-[50px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adjLines.map((line) => (
                            <TableRow key={line.id}>
                              <TableCell className="align-top">
                                <div className="pt-1.5 text-sm font-medium">
                                  {line.productName}
                                </div>
                                {line.productSku ? (
                                  <div className="text-xs text-muted-foreground">
                                    {line.productSku}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell className="align-top text-right tabular-nums text-muted-foreground">
                                <span className="inline-block pt-1.5">
                                  {line.maxQty != null ? formatQty(line.maxQty) : "—"}
                                </span>
                              </TableCell>
                              <TableCell className="align-top">
                                <QtyInput
                                  value={line.qty}
                                  onValueChange={(value) =>
                                    updateAdjLineQty(line.id, value)
                                  }
                                  placeholder={
                                    line.maxQty != null
                                      ? `Max ${formatQty(line.maxQty)}`
                                      : "0"
                                  }
                                  className="h-9 min-w-[5.5rem]"
                                  required
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeAdjLine(line.id)}
                                  aria-label={`Remove ${line.productName}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : adjFromId && !adjStockLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Select products above to build your stock out list.
                  </p>
                ) : null}
              </form>
            </InventoryFormPanel>
          </TabsContent>

          <TabsContent
            value="history"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <DirectoryListFrame filtersOpen={filtersOpen}>
              <DirectoryFilterPanel
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                panelId={filterPanelId}
                title="Inventory filters"
              >
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
              </DirectoryFilterPanel>
              <div className={DIRECTORY_LIST_PANEL_CLASS}>
                <DirectoryListSearchHeader trailing={movRangeLabel}>
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
                </DirectoryListSearchHeader>
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
                        pageSizeOptions={[10, 50, 100, 200]}
                      />
                    }
                  />
                </div>
              </div>
            </DirectoryListFrame>
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={transferConfirmOpen} onOpenChange={setTransferConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record transfer?</AlertDialogTitle>
            <AlertDialogDescription>
              Move {transferConfirmSummary.lineSummary} from{" "}
              {transferConfirmSummary.from} to {transferConfirmSummary.to}. Stock
              balances and movement history will be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning}
              onClick={(e) => {
                e.preventDefault();
                setTransferConfirmOpen(false);
                void performTransfer();
              }}
            >
              Record transfers
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={refillConfirmOpen} onOpenChange={setRefillConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record refill?</AlertDialogTitle>
            <AlertDialogDescription>
              Add {refillConfirmSummary.lineSummary} at{" "}
              {refillConfirmSummary.loc}. Stock at that location will increase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning}
              onClick={(e) => {
                e.preventDefault();
                setRefillConfirmOpen(false);
                void performRefill();
              }}
            >
              Record fill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={adjustConfirmOpen} onOpenChange={setAdjustConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record stock out?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {adjustConfirmSummary.lineSummary} from{" "}
              {adjustConfirmSummary.loc}. Stock at that location will be reduced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning}
              onClick={(e) => {
                e.preventDefault();
                setAdjustConfirmOpen(false);
                void performAdjustOut();
              }}
            >
              Record stock out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
