"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Check,
  Download,
  MapPin,
  Plus,
  Printer,
  Search,
  Store,
  Truck,
  Warehouse,
  SlidersVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { AppPageShell } from "@/components/app-page-shell";
import {
  fetchLocationListFacets,
  listAllLocationsForExport,
  listLocations,
  formatLocationTypeLabel,
  type LocationListFacets,
  type LocationRow,
} from "@/lib/locations-service";
import { cn } from "@/lib/utils";

function iconForLocationType(type: string): LucideIcon {
  const x = type.toLowerCase();
  if (x === "warehouse" || x.includes("warehouse")) return Warehouse;
  if (x === "store" || x.includes("store")) return Store;
  if (x.includes("driver")) return Truck;
  return MapPin;
}

function typeBadgeClasses(type: string): string {
  const x = type.toLowerCase();
  if (x === "warehouse" || x.includes("warehouse"))
    return "border-amber-500/25 bg-amber-500/12 text-amber-900 dark:bg-amber-500/14 dark:text-amber-200";
  if (x === "store" || x.includes("store"))
    return "border-sky-500/25 bg-sky-500/12 text-sky-900 dark:bg-sky-500/14 dark:text-sky-200";
  if (x.includes("driver"))
    return "border-violet-500/25 bg-violet-500/12 text-violet-900 dark:bg-violet-500/14 dark:text-violet-200";
  return "border-border bg-muted/80 text-muted-foreground";
}

function LocationsFilterSidebar({
  id,
  facets,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
}: {
  id?: string;
  facets: LocationListFacets;
  statusFilter: "all" | "active" | "inactive";
  onStatusChange: (v: "all" | "active" | "inactive") => void;
  typeFilter: string;
  onTypeChange: (v: string) => void;
}) {
  const statusRows: {
    id: "all" | "active" | "inactive";
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All locations",
      icon: MapPin,
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

  const typeRows: { id: string; label: string; icon: LucideIcon; count: number }[] =
    [
      {
        id: "all",
        label: "All types",
        icon: MapPin,
        count: facets.companyTotal,
      },
      ...facets.enumTypes.map((t) => ({
        id: t,
        label: formatLocationTypeLabel(t),
        icon: iconForLocationType(t),
        count: facets.typeCounts.find((x) => x.type === t)?.count ?? 0,
      })),
    ];

  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  return (
    <aside
      id={id}
      className="w-full shrink-0 lg:self-stretch"
    >
      <div className="space-y-7 py-1">
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By status
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by status">
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
            By type
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by type">
            {typeRows.map((item) => {
              const Icon = item.icon;
              const selected = typeFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTypeChange(item.id)}
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

export default function InventoryLocationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);

  const [rows, setRows] = useState<LocationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<LocationListFacets | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  /** Sidebar facet counts (refetch only when company scope changes or after mutations). */
  const [facetsLoading, setFacetsLoading] = useState(true);
  /** Current page of rows (refetch on filters/search/pagination). */
  const [listLoading, setListLoading] = useState(false);

  const listRequestGen = useRef(0);
  /** Tracks list-driving deps so we reset to page 1 before fetching when filters/search/size/company change. */
  const prevListDepsRef = useRef({
    debouncedSearch: "",
    typeFilter: "all",
    statusFilter: "all" as "all" | "active" | "inactive",
    pageSize: 10,
    activeCompanyScope: 0,
  });

  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      220,
    );
    return () => window.clearTimeout(t);
  }, [searchQuery]);

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

  /** Facet counts only depend on company — not on list filters (saves several DB round-trips per click). */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setFacetsLoading(true);
      const id = await getActiveCompanyId();
      if (cancelled) return;

      setCompanyReady(!!id);
      if (!id) {
        setRows([]);
        setTotal(0);
        setFacets(null);
        setFacetsLoading(false);
        return;
      }

      try {
        const facetData = await fetchLocationListFacets();
        if (!cancelled) setFacets(facetData);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Please try again.";
          toast({
            title: "Failed to load filters",
            description: msg,
            variant: "destructive",
          });
          setFacets(null);
        }
      } finally {
        if (!cancelled) setFacetsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable; errors only
  }, [activeCompanyScope]);

  /** Paginated list — only hits listLocations (facets load separately). */
  useEffect(() => {
    if (companyReady !== true) return;

    const prev = prevListDepsRef.current;
    const depsChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.typeFilter !== typeFilter ||
      prev.statusFilter !== statusFilter ||
      prev.pageSize !== pageSize ||
      prev.activeCompanyScope !== activeCompanyScope;

    if (depsChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevListDepsRef.current = {
      debouncedSearch,
      typeFilter,
      statusFilter,
      pageSize,
      activeCompanyScope,
    };

    const gen = ++listRequestGen.current;
    let cancelled = false;

    (async () => {
      setListLoading(true);
      try {
        const listRes = await listLocations({
          search: debouncedSearch || undefined,
          locationType: typeFilter === "all" ? undefined : typeFilter,
          statusFilter,
          page,
          pageSize,
        });
        if (cancelled || gen !== listRequestGen.current) return;
        setRows(listRes.rows);
        setTotal(listRes.total);
      } catch (e: unknown) {
        if (cancelled || gen !== listRequestGen.current) return;
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Failed to load locations",
          description: msg,
          variant: "destructive",
        });
      } finally {
        if (!cancelled && gen === listRequestGen.current) {
          setListLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable; errors only
  }, [
    companyReady,
    debouncedSearch,
    typeFilter,
    statusFilter,
    page,
    pageSize,
    activeCompanyScope,
  ]);

  const reload = useCallback(async () => {
    if (companyReady !== true) return;
    listRequestGen.current += 1;
    const gen = listRequestGen.current;
    setListLoading(true);
    try {
      const [facetData, listRes] = await Promise.all([
        fetchLocationListFacets(),
        listLocations({
          search: debouncedSearch || undefined,
          locationType: typeFilter === "all" ? undefined : typeFilter,
          statusFilter,
          page,
          pageSize,
        }),
      ]);
      if (gen !== listRequestGen.current) return;
      setFacets(facetData);
      setRows(listRes.rows);
      setTotal(listRes.total);
      prevListDepsRef.current = {
        debouncedSearch,
        typeFilter,
        statusFilter,
        pageSize,
        activeCompanyScope,
      };
    } catch (e: unknown) {
      if (gen === listRequestGen.current) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Failed to refresh locations",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      if (gen === listRequestGen.current) setListLoading(false);
    }
  }, [
    companyReady,
    typeFilter,
    statusFilter,
    debouncedSearch,
    page,
    pageSize,
    activeCompanyScope,
  ]);

  const fetchExportRows = useCallback(
    () =>
      listAllLocationsForExport({
        search: debouncedSearch || undefined,
        locationType: typeFilter === "all" ? undefined : typeFilter,
        statusFilter,
      }),
    [debouncedSearch, typeFilter, statusFilter],
  );

  const exportFilenameStem = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `locations-${yyyy}${mm}${dd}`;
  }, []);

  const handleExportCsv = useCallback(async () => {
    if (exportingCsv) return;
    try {
      setExportingCsv(true);
      const data = await fetchExportRows();
      if (data.length === 0) {
        toast({
          title: "Nothing to export",
          description: "No locations match the current filters.",
        });
        return;
      }
      const headers = [
        "Name",
        "Code",
        "Type",
        "Primary warehouse",
        "Status",
        "Default",
        "Address line 1",
        "Address line 2",
        "City",
        "Postal",
        "Country",
        "Map link",
        "Description",
      ];
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines = [headers.map(esc).join(",")];
      for (const r of data) {
        lines.push(
          [
            r.name,
            r.code,
            r.locationType ? formatLocationTypeLabel(r.locationType) : "",
            r.locationType === "warehouse"
              ? r.isPrimaryWarehouse
                ? "Yes"
                : "No"
              : "",
            r.isActive ? "Active" : "Inactive",
            r.isDefault ? "Yes" : "No",
            r.address_line_1,
            r.address_line_2,
            r.city,
            r.postal,
            r.country,
            r.map_link,
            r.description,
          ]
            .map((v) => esc(String(v ?? "")))
            .join(","),
        );
      }
      const csv = `\uFEFF${lines.join("\r\n")}\r\n`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exportFilenameStem}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "CSV exported",
        description: `${data.length} location${data.length === 1 ? "" : "s"} exported.`,
      });
    } catch (e: unknown) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingCsv(false);
    }
  }, [exportingCsv, fetchExportRows, exportFilenameStem, toast]);

  const handlePrint = useCallback(async () => {
    if (printing) return;
    try {
      setPrinting(true);
      const data = await fetchExportRows();
      if (data.length === 0) {
        toast({
          title: "Nothing to print",
          description: "No locations match the current filters.",
        });
        return;
      }
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod.default;

      const doc = new jsPDF({
        unit: "pt",
        format: "a4",
        orientation: "landscape",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const M = 36;

      doc.setFont("helvetica", "bold").setFontSize(16);
      doc.text("Locations", M, M + 6);
      doc.setFont("helvetica", "normal").setFontSize(10);
      const filterBits: string[] = [];
      if (statusFilter !== "all") filterBits.push(`Status: ${statusFilter}`);
      if (typeFilter !== "all") {
        filterBits.push(`Type: ${formatLocationTypeLabel(typeFilter)}`);
      }
      if (debouncedSearch) filterBits.push(`Search: "${debouncedSearch}"`);
      const subtitle = [
        new Date().toLocaleString(),
        `${data.length} location${data.length === 1 ? "" : "s"}`,
        ...filterBits,
      ].join("  •  ");
      doc.setTextColor(120);
      doc.text(subtitle, M, M + 24);
      doc.setTextColor(0);

      const body = data.map((r) => {
        const cityCountry = [r.city, r.country].filter(Boolean).join(", ");
        return [
          r.name,
          r.code || "",
          r.locationType ? formatLocationTypeLabel(r.locationType) : "",
          r.locationType === "warehouse"
            ? r.isPrimaryWarehouse
              ? "Primary"
              : ""
            : "",
          r.isActive ? "Active" : "Inactive",
          r.address_line_1 || "",
          cityCountry,
          r.postal || "",
        ];
      });

      autoTable(doc, {
        startY: M + 36,
        head: [
          [
            "Name",
            "Code",
            "Type",
            "Primary WH",
            "Status",
            "Address",
            "City / Country",
            "Postal",
          ],
        ],
        body,
        styles: { font: "helvetica", fontSize: 8, cellPadding: 3 },
        headStyles: {
          fillColor: [243, 244, 246],
          textColor: 20,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [250, 250, 251] },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { cellWidth: 60 },
          2: { cellWidth: 80 },
          3: { cellWidth: 56 },
          4: { cellWidth: 52 },
          5: { cellWidth: 160 },
          6: { cellWidth: 130 },
          7: { cellWidth: 60 },
        },
        margin: { left: M, right: M },
        didDrawPage: () => {
          const pageH = doc.internal.pageSize.getHeight();
          const pageNumber = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(140);
          doc.text(`Page ${pageNumber}`, pageW - M, pageH - 14, {
            align: "right",
          });
          doc.setTextColor(0);
        },
      });

      const filename = `${exportFilenameStem}.pdf`;
      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => printWindow.print(), 250);
        };
      } else {
        doc.save(filename);
        toast({
          title: "Print blocked",
          description: "Allow popups to print. PDF downloaded instead.",
        });
      }
    } catch (e: unknown) {
      toast({
        title: "Print failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  }, [
    printing,
    fetchExportRows,
    statusFilter,
    typeFilter,
    debouncedSearch,
    exportFilenameStem,
    toast,
  ]);

  const columns = useMemo<ColumnDef<LocationRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => r.name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {row.original.name}
          </span>
        ),
      },
      {
        id: "locationType",
        accessorFn: (r) =>
          r.locationType ? formatLocationTypeLabel(r.locationType) : "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        cell: ({ row }) => {
          const t = row.original.locationType;
          if (!t) return <span className="text-muted-foreground">—</span>;
          const Icon = iconForLocationType(t);
          return (
            <span
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
                typeBadgeClasses(t),
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="min-w-0 truncate">
                {formatLocationTypeLabel(t)}
              </span>
            </span>
          );
        },
      },
      {
        id: "primaryWarehouse",
        accessorFn: (r) =>
          r.locationType === "warehouse" && r.isPrimaryWarehouse ? 1 : 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Primary WH" />
        ),
        cell: ({ row }) => {
          const r = row.original;
          if (r.locationType !== "warehouse") {
            return <span className="text-muted-foreground">—</span>;
          }
          return r.isPrimaryWarehouse ? (
            <span className="inline-flex rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/14 dark:text-amber-200">
              Primary
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "code",
        accessorFn: (r) => r.code ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Code" />
        ),
        cell: ({ row }) => row.original.code || "—",
        meta: { tdClassName: "text-muted-foreground" },
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

  const hasActiveFilters = useMemo(
    () =>
      debouncedSearch !== "" ||
      typeFilter !== "all" ||
      statusFilter !== "all",
    [debouncedSearch, typeFilter, statusFilter],
  );

  const listRangeLabel = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, total);
    if (total === 0) return "0–0 of 0";
    return `${from}–${to} of ${total}`;
  }, [total, page, pageSize]);

  const showSkeleton =
    companyReady !== false &&
    rows.length === 0 &&
    facets === null &&
    (companyReady === null || facetsLoading);

  /** Same bordered layout as when data exists; empty state lives inside the table. */
  const showDirectory =
    companyReady === true && facets !== null && !showSkeleton;

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      actions={
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={
              companyReady !== true ||
              exportingCsv ||
              listLoading ||
              facetsLoading
            }
            onClick={() => void handleExportCsv()}
          >
            <Download className="h-4 w-4" />
            {exportingCsv ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={
              companyReady !== true ||
              printing ||
              listLoading ||
              facetsLoading
            }
            onClick={() => void handlePrint()}
          >
            <Printer className="h-4 w-4" />
            {printing ? "Preparing…" : "Print"}
          </Button>
          <Button className="gap-2" disabled={companyReady !== true} asChild>
            <Link href="/app/locations/new">
              <Plus className="h-4 w-4" />
              Add location
            </Link>
          </Button>
        </div>
      }
      topbarTrailingBeforeTheme={
        showDirectory ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 text-muted-foreground",
              filtersOpen && "bg-primary/15 text-primary",
            )}
            aria-label={
              filtersOpen ? "Hide location filters" : "Show location filters"
            }
            aria-expanded={filtersOpen}
            aria-controls="locations-filter-panel"
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
            No active company is linked to this account yet. Create or join a
            company in Supabase (company_users / companies) so locations can be
            saved against{" "}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">
              company_id
            </code>
            .
          </CardContent>
        </Card>
      )}

      {showSkeleton ? (
        <div className="h-56 animate-pulse rounded-md bg-muted/60" aria-hidden />
      ) : null}

      {showDirectory ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0",
            filtersOpen ? "gap-6" : "gap-0",
          )}
        >
          <div
            id="locations-filter-panel"
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
              <LocationsFilterSidebar
                facets={facets}
                statusFilter={statusFilter}
                onStatusChange={(v) => {
                  setPage(1);
                  setStatusFilter(v);
                }}
                typeFilter={typeFilter}
                onTypeChange={(v) => {
                  setPage(1);
                  setTypeFilter(v);
                }}
              />
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-border/50 bg-card text-card-foreground shadow-none outline outline-1 -outline-offset-1 outline-border/40 dark:border-border/60 dark:outline-border/50">
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
                  placeholder="Search by name, code, or city…"
                  className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                  aria-label="Search locations"
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
              data={rows}
              manualFiltering
              hideSearch
              onRowClick={(r) =>
                router.push(`/app/locations/${r.id}`)
              }
              getRowId={(r) => r.id}
              emptyMessage={
                hasActiveFilters ? (
                  <FeatureEmptyState
                    title="No locations match your filters"
                    description="Try clearing search or adjusting filters."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPage(1);
                          setSearchQuery("");
                          setTypeFilter("all");
                          setStatusFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                    className="border-0 bg-transparent py-8"
                  />
                ) : facets.companyTotal === 0 ? (
                  <FeatureEmptyState
                    icon={MapPin}
                    title="No locations yet"
                    description="Add warehouses, stores, or driver locations for your active company."
                    action={
                      <Button className="gap-2" asChild>
                        <Link href="/app/locations/new">
                          <Plus className="h-4 w-4" />
                          Add location
                        </Link>
                      </Button>
                    }
                    className="border-0 bg-transparent py-8"
                  />
                ) : (
                  <FeatureEmptyState
                    title="No locations on this page"
                    description="Try another page."
                    className="border-0 bg-transparent py-8"
                  />
                )
              }
              footer={
                <DataTablePaginationFooter
                  variant="minimal"
                  total={total}
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
      ) : null}
    </AppPageShell>
  );
}
