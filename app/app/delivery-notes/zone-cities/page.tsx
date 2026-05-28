"use client";
import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Ban,
  Building2,
  Check,
  MapPinned,
  Plus,
  Search,
  SlidersVertical,
  Truck,
  UserX,
} from "lucide-react";
import { AppPageShell } from "@/components/app-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { useToast } from "@/hooks/use-toast";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import {
  createDeliveryCity,
  loadDeliveryZoneCitiesPageData,
  type DeliveryCityRow,
  type DeliveryZoneWithCityCount,
} from "@/lib/delivery-zones-service";
import type { TeamMemberRow } from "@/lib/company-team-service";
import { cn } from "@/lib/utils";

type ZoneListFacets = {
  companyTotal: number;
  activeCount: number;
  inactiveCount: number;
  unassignedCount: number;
  driverRows: { userId: string; label: string; count: number }[];
};

function teamDriverMembers(team: TeamMemberRow[]): TeamMemberRow[] {
  return team.filter((m) => m.roleName.toLowerCase().includes("driver"));
}

function memberLabel(m: TeamMemberRow): string {
  return (
    m.profile?.full_name?.trim() ||
    m.profile?.email?.trim() ||
    m.userId.slice(0, 8)
  );
}

function buildZoneFacets(
  zones: DeliveryZoneWithCityCount[],
  drivers: TeamMemberRow[],
): ZoneListFacets {
  const activeCount = zones.filter((z) => z.isActive).length;
  const inactiveCount = zones.filter((z) => !z.isActive).length;
  const unassignedCount = zones.filter((z) => !z.driverUserId).length;
  const driverRows = drivers.map((d) => ({
    userId: d.userId,
    label: memberLabel(d),
    count: zones.filter((z) => z.driverUserId === d.userId).length,
  }));
  return {
    companyTotal: zones.length,
    activeCount,
    inactiveCount,
    unassignedCount,
    driverRows,
  };
}

function ZonesFilterSidebar({
  facets,
  statusFilter,
  onStatusChange,
  driverFilter,
  onDriverChange,
}: {
  facets: ZoneListFacets;
  statusFilter: "all" | "active" | "inactive";
  onStatusChange: (v: "all" | "active" | "inactive") => void;
  driverFilter: "all" | "unassigned" | string;
  onDriverChange: (v: "all" | "unassigned" | string) => void;
}) {
  const statusRows: {
    id: "all" | "active" | "inactive";
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All zones",
      icon: MapPinned,
      count: facets.companyTotal,
    },
    {
      id: "active",
      label: "Active",
      icon: Check,
      count: facets.activeCount,
    },
    {
      id: "inactive",
      label: "Inactive",
      icon: Ban,
      count: facets.inactiveCount,
    },
  ];

  const driverRows: {
    id: "all" | "unassigned" | string;
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All drivers",
      icon: Truck,
      count: facets.companyTotal,
    },
    {
      id: "unassigned",
      label: "Unassigned",
      icon: UserX,
      count: facets.unassignedCount,
    },
    ...facets.driverRows.map((d) => ({
      id: d.userId,
      label: d.label,
      icon: Truck,
      count: d.count,
    })),
  ];

  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  return (
    <aside className="w-full shrink-0 lg:self-stretch">
      <div className="space-y-7 py-1">
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By status
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter zones by status">
            {statusRows.map((item) => {
              const Icon = item.icon;
              const selected = statusFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onStatusChange(item.id)}
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
                  <span
                    className={cn(
                      "inline-flex min-w-[1.625rem] shrink-0 items-center justify-center rounded-full",
                      "bg-muted/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-muted-foreground",
                      "dark:bg-muted/70",
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By driver
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter zones by driver">
            {driverRows.map((item) => {
              const Icon = item.icon;
              const selected = driverFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onDriverChange(item.id)}
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
                  <span
                    className={cn(
                      "inline-flex min-w-[1.625rem] shrink-0 items-center justify-center rounded-full",
                      "bg-muted/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-muted-foreground",
                      "dark:bg-muted/70",
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}

export default function DeliveryZoneCitiesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [zones, setZones] = useState<DeliveryZoneWithCityCount[]>([]);
  const [cities, setCities] = useState<DeliveryCityRow[]>([]);
  const [cityName, setCityName] = useState("");
  const [savingCity, setSavingCity] = useState(false);

  const [facets, setFacets] = useState<ZoneListFacets | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [driverFilter, setDriverFilter] = useState<"all" | "unassigned" | string>(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [mainTab, setMainTab] = useState<"zones" | "cities">("zones");

  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [debouncedCitySearch, setDebouncedCitySearch] = useState("");
  const [cityPage, setCityPage] = useState(1);
  const [cityPageSize, setCityPageSize] = useState(10);

  const prevListDepsRef = useRef({
    debouncedSearch: "",
    statusFilter: "all" as "all" | "active" | "inactive",
    driverFilter: "all" as "all" | "unassigned" | string,
    pageSize: 10,
    activeCompanyScope: 0,
  });

  const prevCityListDepsRef = useRef({
    debouncedCitySearch: "",
    cityPageSize: 10,
    activeCompanyScope: 0,
  });

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      220,
    );
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedCitySearch(citySearchQuery.trim()),
      220,
    );
    return () => window.clearTimeout(t);
  }, [citySearchQuery]);

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

  const loadAll = useCallback(async () => {
    const id = await getActiveCompanyId();
    if (!id) {
      setCompanyReady(false);
      setZones([]);
      setCities([]);
      setFacets(null);
      return;
    }
    setCompanyReady(true);
    setListLoading(true);
    try {
      const { zones: zoneRows, cities: cityRows, teamMembers: teamRows } =
        await loadDeliveryZoneCitiesPageData();
      setZones(zoneRows);
      setCities(cityRows);
      const drivers = teamDriverMembers(teamRows);
      setFacets(buildZoneFacets(zoneRows, drivers));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Failed to load zones",
        description: msg,
        variant: "destructive",
      });
      setFacets(null);
    } finally {
      setListLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity unstable
  }, []);

  useEffect(() => {
    void loadAll();
  }, [activeCompanyScope, loadAll]);

  const filteredZones = useMemo(() => {
    let r = zones;
    if (statusFilter === "active") r = r.filter((z) => z.isActive);
    else if (statusFilter === "inactive") r = r.filter((z) => !z.isActive);
    if (driverFilter === "unassigned") r = r.filter((z) => !z.driverUserId);
    else if (driverFilter !== "all")
      r = r.filter((z) => z.driverUserId === driverFilter);
    const q = debouncedSearch.toLowerCase();
    if (q) {
      r = r.filter(
        (z) =>
          z.name.toLowerCase().includes(q) ||
          z.driverDisplay.toLowerCase().includes(q),
      );
    }
    return r;
  }, [zones, statusFilter, driverFilter, debouncedSearch]);

  useEffect(() => {
    const prev = prevListDepsRef.current;
    const depsChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.statusFilter !== statusFilter ||
      prev.driverFilter !== driverFilter ||
      prev.pageSize !== pageSize ||
      prev.activeCompanyScope !== activeCompanyScope;

    if (depsChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevListDepsRef.current = {
      debouncedSearch,
      statusFilter,
      driverFilter,
      pageSize,
      activeCompanyScope,
    };
  }, [
    debouncedSearch,
    statusFilter,
    driverFilter,
    pageSize,
    activeCompanyScope,
    page,
  ]);

  const totalFiltered = filteredZones.length;
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredZones.slice(start, start + pageSize);
  }, [filteredZones, page, pageSize]);

  const listRangeLabel = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const from = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, totalFiltered);
    if (totalFiltered === 0) return "0–0 of 0";
    return `${from}–${to} of ${totalFiltered}`;
  }, [totalFiltered, page, pageSize]);

  const filteredCities = useMemo(() => {
    const q = debouncedCitySearch.toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.name.toLowerCase().includes(q));
  }, [cities, debouncedCitySearch]);

  useEffect(() => {
    const prev = prevCityListDepsRef.current;
    const depsChanged =
      prev.debouncedCitySearch !== debouncedCitySearch ||
      prev.cityPageSize !== cityPageSize ||
      prev.activeCompanyScope !== activeCompanyScope;

    if (depsChanged && cityPage !== 1) {
      setCityPage(1);
      return;
    }

    prevCityListDepsRef.current = {
      debouncedCitySearch,
      cityPageSize,
      activeCompanyScope,
    };
  }, [
    debouncedCitySearch,
    cityPageSize,
    activeCompanyScope,
    cityPage,
  ]);

  const totalFilteredCities = filteredCities.length;
  const cityPageRows = useMemo(() => {
    const start = (cityPage - 1) * cityPageSize;
    return filteredCities.slice(start, start + cityPageSize);
  }, [filteredCities, cityPage, cityPageSize]);

  const cityListRangeLabel = useMemo(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(totalFilteredCities / cityPageSize),
    );
    const safePage = Math.min(Math.max(1, cityPage), totalPages);
    const from =
      totalFilteredCities === 0 ? 0 : (safePage - 1) * cityPageSize + 1;
    const to = Math.min(safePage * cityPageSize, totalFilteredCities);
    if (totalFilteredCities === 0) return "0–0 of 0";
    return `${from}–${to} of ${totalFilteredCities}`;
  }, [totalFilteredCities, cityPage, cityPageSize]);

  const columns = useMemo<ColumnDef<DeliveryZoneWithCityCount>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => r.name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Zone" />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">{row.original.name}</span>
        ),
      },
      {
        id: "driver",
        accessorFn: (r) => r.driverDisplay,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Driver" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.driverUserId ? row.original.driverDisplay : "—"}
          </span>
        ),
      },
      {
        id: "cityCount",
        accessorFn: (r) => r.cityCount,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cities" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">
            {row.original.cityCount}
          </span>
        ),
        meta: { tdClassName: "text-right", thClassName: "text-right" },
      },
      {
        id: "status",
        accessorFn: (r) => (r.isActive ? 1 : 0),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) =>
          row.original.isActive ? (
            <span className="inline-flex rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              Active
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-muted/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Inactive
            </span>
          ),
      },
    ],
    [],
  );

  const cityColumns = useMemo<ColumnDef<DeliveryCityRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => r.name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="City" />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {row.original.name}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => (r.isActive ? 1 : 0),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) =>
          row.original.isActive ? (
            <span className="inline-flex rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              Active
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-muted/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Inactive
            </span>
          ),
      },
    ],
    [],
  );

  const hasActiveCityFilters = debouncedCitySearch !== "";

  const hasActiveFilters = useMemo(
    () =>
      debouncedSearch !== "" ||
      statusFilter !== "all" ||
      driverFilter !== "all",
    [debouncedSearch, statusFilter, driverFilter],
  );

  async function handleCreateCity() {
    if (!cityName.trim()) return;
    try {
      setSavingCity(true);
      await createDeliveryCity(cityName);
      setCityName("");
      await loadAll();
      toast({ title: "City created" });
    } catch (e: unknown) {
      toast({
        title: "Could not create city",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingCity(false);
    }
  }

  const showSkeleton =
    companyReady !== false &&
    zones.length === 0 &&
    facets === null &&
    (companyReady === null || listLoading);

  const showDirectory = companyReady === true && facets !== null && !showSkeleton;

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to delivery notes">
          <Link href="/app/delivery-notes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <Button className="shrink-0 gap-2" disabled={companyReady !== true} asChild>
          <Link href="/app/delivery-notes/zone-cities/new">
            <Plus className="h-4 w-4" />
            Add zone
          </Link>
        </Button>
      }
      topbarTrailingBeforeTheme={
        showDirectory && mainTab === "zones" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 text-muted-foreground",
              filtersOpen && "bg-primary/15 text-primary",
            )}
            aria-label={filtersOpen ? "Hide zone filters" : "Show zone filters"}
            aria-expanded={filtersOpen}
            aria-controls="zones-filter-panel"
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
            No active company is linked to this account yet. Link a company so
            zones and cities can be saved.
          </CardContent>
        </Card>
      )}

      {showSkeleton ? (
        <DirectoryListPageSkeleton className="min-h-0 flex-1" />
      ) : null}

      {showDirectory ? (
        <Tabs
          value={mainTab}
          onValueChange={(v) => setMainTab(v as "zones" | "cities")}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1 p-1 sm:inline-flex sm:w-auto sm:max-w-md">
            <TabsTrigger value="zones" className="gap-1.5 text-xs sm:text-sm">
              <MapPinned className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Zones
            </TabsTrigger>
            <TabsTrigger value="cities" className="gap-1.5 text-xs sm:text-sm">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Cities
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="zones"
            className="mt-0 flex min-h-0 flex-1 flex-col outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0",
                filtersOpen ? "gap-6" : "gap-0",
              )}
            >
              <div
                id="zones-filter-panel"
                className={cn(
                  "shrink-0 overflow-hidden",
                  "transition-[width,margin-inline-end,max-height,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  "motion-reduce:transition-none motion-reduce:duration-0",
                  filtersOpen
                    ? "pointer-events-auto max-h-[2000px] opacity-100 lg:me-10 lg:w-56 xl:w-[15rem]"
                    : "pointer-events-none max-h-0 opacity-0 lg:pointer-events-none lg:max-h-none lg:w-0 lg:opacity-100 xl:w-0 lg:me-0",
                )}
                aria-hidden={!filtersOpen}
              >
                <div className="h-full min-w-0 w-full lg:min-w-[14rem] xl:min-w-[15rem]">
                  <ZonesFilterSidebar
                    facets={facets}
                    statusFilter={statusFilter}
                    onStatusChange={(v) => {
                      setPage(1);
                      setStatusFilter(v);
                    }}
                    driverFilter={driverFilter}
                    onDriverChange={(v) => {
                      setPage(1);
                      setDriverFilter(v);
                    }}
                  />
                </div>
              </div>
              <div className="flex min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-border/50 bg-card text-card-foreground shadow-none outline outline-1 -outline-offset-1 outline-border/40 dark:border-border/60 dark:outline-border/50 sm:min-h-[320px] lg:min-h-[360px]">
                <div className="flex shrink-0 flex-col gap-3 border-b border-border/50 bg-muted/45 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 dark:bg-muted/25">
                  <div className="relative min-w-0 flex-1 sm:max-w-xl lg:max-w-2xl">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                      aria-hidden
                    />
                    <Input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search zones or drivers…"
                      className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                      aria-label="Search zones"
                      autoComplete="off"
                    />
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-right">
                    {listRangeLabel}
                  </p>
                </div>
                <div
                  className={cn(
                    "relative flex min-h-0 flex-1 flex-col transition-opacity duration-150 ease-out",
                    listLoading &&
                      "pointer-events-none opacity-[0.58] motion-reduce:transition-none",
                  )}
                  aria-busy={listLoading}
                >
                  <DataTable
                    className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
                    tableContainerClassName="min-h-0 flex-1 overflow-auto"
                    variant="minimal"
                    columns={columns}
                    data={pageRows}
                    manualFiltering
                    hideSearch
                    onRowClick={(r) =>
                      router.push(`/app/delivery-notes/zone-cities/${r.id}`)
                    }
                    getRowId={(r) => r.id}
                    emptyMessage={
                      hasActiveFilters ? (
                        <FeatureEmptyState
                          title="No zones match your filters"
                          description="Try clearing search or adjusting filters."
                          action={
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPage(1);
                                setSearchQuery("");
                                setStatusFilter("all");
                                setDriverFilter("all");
                              }}
                            >
                              Clear filters
                            </Button>
                          }
                          className="border-0 bg-transparent py-8"
                        />
                      ) : facets.companyTotal === 0 ? (
                        <FeatureEmptyState
                          icon={MapPinned}
                          title="No zones yet"
                          description="Create a zone, assign a driver, then open it to add cities in route order."
                          action={
                            <Button className="gap-2" asChild>
                              <Link href="/app/delivery-notes/zone-cities/new">
                                <Plus className="h-4 w-4" />
                                Add zone
                              </Link>
                            </Button>
                          }
                          className="border-0 bg-transparent py-8"
                        />
                      ) : (
                        <FeatureEmptyState
                          title="No zones on this page"
                          description="Try another page."
                          className="border-0 bg-transparent py-8"
                        />
                      )
                    }
                    footer={
                      <DataTablePaginationFooter
                        variant="minimal"
                        total={totalFiltered}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                        pageSizeOptions={[10, 25, 50]}
                      />
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="cities"
            className="mt-0 flex min-h-0 flex-1 flex-col outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <div className="flex min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-border/50 bg-card text-card-foreground shadow-none outline outline-1 -outline-offset-1 outline-border/40 dark:border-border/60 dark:outline-border/50 sm:min-h-[320px] lg:min-h-[360px]">
              <div className="flex shrink-0 flex-col gap-3 border-b border-border/50 bg-muted/45 px-4 py-3.5 sm:px-5 dark:bg-muted/25">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Cities are shared across zones. Assign them to a zone from
                  the zone detail page.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="relative min-w-0 flex-1 sm:max-w-xl lg:max-w-2xl">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                      aria-hidden
                    />
                    <Input
                      type="search"
                      value={citySearchQuery}
                      onChange={(e) => setCitySearchQuery(e.target.value)}
                      placeholder="Search cities…"
                      className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                      aria-label="Search cities"
                      autoComplete="off"
                    />
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-right">
                    {cityListRangeLabel}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <Input
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    placeholder="New city name"
                    disabled={savingCity}
                    className="h-10"
                  />
                  <Button
                    type="button"
                    className="shrink-0 sm:justify-self-end"
                    onClick={() => void handleCreateCity()}
                    disabled={savingCity || !cityName.trim()}
                  >
                    Add city
                  </Button>
                </div>
              </div>
              <div
                className={cn(
                  "relative flex min-h-0 flex-1 flex-col transition-opacity duration-150 ease-out",
                  listLoading &&
                    "pointer-events-none opacity-[0.58] motion-reduce:transition-none",
                )}
                aria-busy={listLoading}
              >
                <DataTable
                  className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
                  tableContainerClassName="min-h-0 flex-1 overflow-auto"
                  variant="minimal"
                  columns={cityColumns}
                  data={cityPageRows}
                  manualFiltering
                  hideSearch
                  getRowId={(r) => r.id}
                  emptyMessage={
                    hasActiveCityFilters ? (
                      <FeatureEmptyState
                        title="No cities match your search"
                        description="Try a different search term."
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCityPage(1);
                              setCitySearchQuery("");
                            }}
                          >
                            Clear search
                          </Button>
                        }
                        className="border-0 bg-transparent py-8"
                      />
                    ) : cities.length === 0 ? (
                      <FeatureEmptyState
                        icon={Building2}
                        title="No cities yet"
                        description="Add a city name below. You can assign it to zones from each zone’s detail page."
                        className="border-0 bg-transparent py-8"
                      />
                    ) : (
                      <FeatureEmptyState
                        title="No cities on this page"
                        description="Try another page."
                        className="border-0 bg-transparent py-8"
                      />
                    )
                  }
                  footer={
                    <DataTablePaginationFooter
                      variant="minimal"
                      total={totalFilteredCities}
                      page={cityPage}
                      pageSize={cityPageSize}
                      onPageChange={setCityPage}
                      onPageSizeChange={setCityPageSize}
                      pageSizeOptions={[10, 25, 50]}
                    />
                  }
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      ) : null}
    </AppPageShell>
  );
}
