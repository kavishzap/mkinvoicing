"use client";
import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Download,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  Search,
  SlidersVertical,
  Trash2,
  User,
  Users,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { useToast } from "@/hooks/use-toast";
import {
  deleteCustomer,
  fetchCustomerListFacets,
  getCachedCustomerList,
  getCachedCustomerListFacets,
  invalidateCustomerCaches,
  listAllCustomersForExport,
  listCustomers,
  setCustomerActive,
  type CustomerListFacets,
  type CustomerRow,
} from "@/lib/customers-service";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { AppPageShell } from "@/components/app-page-shell";
import { cn } from "@/lib/utils";

function formatCity(c: CustomerRow): string {
  return c.cityName || c.city || "—";
}

function typeBadgeClasses(type: string): string {
  if (type === "company")
    return "border-sky-500/25 bg-sky-500/12 text-sky-900 dark:bg-sky-500/14 dark:text-sky-200";
  return "border-violet-500/25 bg-violet-500/12 text-violet-900 dark:bg-violet-500/14 dark:text-violet-200";
}

function iconForCustomerType(type: string): LucideIcon {
  return type === "company" ? Building2 : User;
}

const CustomersFilterSidebar = memo(function CustomersFilterSidebar({
  facets,
  typeFilter,
  onTypeChange,
}: {
  facets: CustomerListFacets;
  typeFilter: "all" | "company" | "individual";
  onTypeChange: (v: "all" | "company" | "individual") => void;
}) {
  const typeRows: {
    id: "all" | "company" | "individual";
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All types",
      icon: Users,
      count: facets.companyTotal,
    },
    {
      id: "company",
      label: "Companies",
      icon: Building2,
      count: facets.companyTypeCount,
    },
    {
      id: "individual",
      label: "Individuals",
      icon: User,
      count: facets.individualTypeCount,
    },
  ];

  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  return (
    <aside className="w-full shrink-0 lg:self-stretch">
      <div className="space-y-7 py-1">
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By type
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter customers by type">
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
});

export default function CustomersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<CustomerListFacets | null>(null);

  const [typeFilter, setTypeFilter] = useState<
    "all" | "company" | "individual"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [facetsLoading, setFacetsLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  const listRequestGen = useRef(0);
  const prevListDepsRef = useRef({
    debouncedSearch: "",
    typeFilter: "all" as "all" | "company" | "individual",
    pageSize: 10,
    activeCompanyScope: 0,
  });

  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [singleDeleting, setSingleDeleting] = useState(false);

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
    const bump = () => {
      invalidateCustomerCaches();
      setActiveCompanyScope((n) => n + 1);
    };
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
        setRows([]);
        setTotal(0);
        setFacets(null);
        setFacetsLoading(false);
        return;
      }

      const cachedFacets = getCachedCustomerListFacets(id);
      if (cachedFacets) {
        setFacets(cachedFacets);
        setFacetsLoading(false);
      } else {
        setFacetsLoading(true);
      }

      try {
        const facetData = await fetchCustomerListFacets();
        if (!cancelled) setFacets(facetData);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Please try again.";
          toastRef.current({
            title: "Failed to load filters",
            description: msg,
            variant: "destructive",
          });
          if (!cachedFacets) setFacets(null);
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

  useEffect(() => {
    if (companyReady !== true) return;

    const prev = prevListDepsRef.current;
    const depsChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.typeFilter !== typeFilter ||
      prev.pageSize !== pageSize ||
      prev.activeCompanyScope !== activeCompanyScope;

    if (depsChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevListDepsRef.current = {
      debouncedSearch,
      typeFilter,
      pageSize,
      activeCompanyScope,
    };

    const gen = ++listRequestGen.current;
    let cancelled = false;

    (async () => {
      const companyId = await getActiveCompanyId();
      if (cancelled || gen !== listRequestGen.current) return;

      const listOpts = {
        search: debouncedSearch || undefined,
        statusFilter: "all" as const,
        type: typeFilter === "all" ? undefined : typeFilter,
        page,
        pageSize,
      };

      const cached = companyId
        ? getCachedCustomerList(companyId, listOpts)
        : null;
      if (cached) {
        setRows(cached.rows);
        setTotal(cached.total);
        setListLoading(false);
      } else {
        setListLoading(true);
      }

      try {
        const listRes = await listCustomers(listOpts);
        if (cancelled || gen !== listRequestGen.current) return;
        setRows(listRes.rows);
        setTotal(listRes.total);
      } catch (e: unknown) {
        if (cancelled || gen !== listRequestGen.current) return;
        const msg = e instanceof Error ? e.message : "Please try again.";
        toastRef.current({
          title: "Failed to load customers",
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
        fetchCustomerListFacets(),
        listCustomers({
          search: debouncedSearch || undefined,
          statusFilter: "all",
          type: typeFilter === "all" ? undefined : typeFilter,
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
        pageSize,
        activeCompanyScope,
      };
    } catch (e: unknown) {
      if (gen === listRequestGen.current) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toastRef.current({
          title: "Failed to refresh customers",
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
    debouncedSearch,
    page,
    pageSize,
    activeCompanyScope,
    toast,
  ]);

  const handleToggleActive = useCallback(
    async (c: CustomerRow) => {
      try {
        await setCustomerActive(c.id, !c.isActive);
        toastRef.current({
          title: c.isActive ? "Customer set inactive" : "Customer activated",
          description: c.isActive
            ? "They will be hidden from default lists."
            : "They are visible in lists again.",
        });
        await reload();
      } catch (e: unknown) {
        toastRef.current({
          title: "Update failed",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      }
    },
    [reload, toast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      let ok = false;
      try {
        setSingleDeleting(true);
        await deleteCustomer(id);
        ok = true;
        toastRef.current({
          title: "Customer deleted",
          description: "Customer has been removed successfully.",
        });
      } catch (e: unknown) {
        toastRef.current({
          title: "Delete failed",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setSingleDeleting(false);
        setConfirmDeleteId(null);
        if (ok) {
          if (rows.length === 1 && page > 1) setPage((p) => p - 1);
          else await reload();
        }
      }
    },
    [rows.length, page, reload, toast],
  );

  const fetchExportRows = useCallback(
    () =>
      listAllCustomersForExport({
        search: debouncedSearch || undefined,
        statusFilter: "all",
        type: typeFilter === "all" ? undefined : typeFilter,
      }),
    [debouncedSearch, typeFilter],
  );

  const exportFilenameStem = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `customers-${yyyy}${mm}${dd}`;
  }, []);

  const handleExportCsv = useCallback(async () => {
    if (exportingCsv) return;
    try {
      setExportingCsv(true);
      const data = await fetchExportRows();
      if (data.length === 0) {
        toastRef.current({
          title: "Nothing to export",
          description: "No customers match the current filters.",
        });
        return;
      }
      const headers = [
        "Type",
        "Name",
        "Contact",
        "Email",
        "Phone",
        "City",
        "Address line 1",
      ];
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines = [headers.map(esc).join(",")];
      for (const c of data) {
        const name =
          (c.type === "company" ? c.companyName : c.fullName)?.trim() || "";
        const contact = c.type === "company" ? c.contactName?.trim() || "" : "";
        lines.push(
          [
            c.type === "company" ? "Company" : "Individual",
            name,
            contact,
            c.email ?? "",
            c.phone ?? "",
            c.cityName || c.city || "",
            (c.address_line_1 ?? "").trim(),
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
      toastRef.current({
        title: "CSV exported",
        description: `${data.length} customer${data.length === 1 ? "" : "s"} exported.`,
      });
    } catch (e: unknown) {
      toastRef.current({
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
        toastRef.current({
          title: "Nothing to print",
          description: "No customers match the current filters.",
        });
        return;
      }
      const { buildCustomersListPdfDoc } = await import("@/lib/customers-list-pdf");
      const doc = await buildCustomersListPdfDoc({
        rows: data,
        typeFilter,
        searchQuery: debouncedSearch,
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
        toastRef.current({
          title: "Print blocked",
          description: "Allow popups to print. PDF downloaded instead.",
        });
      }
    } catch (e: unknown) {
      toastRef.current({
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
    typeFilter,
    debouncedSearch,
    exportFilenameStem,
    toast,
  ]);

  const columns = useMemo<ColumnDef<CustomerRow>[]>(
    () => [
      {
        id: "type",
        accessorFn: (r) => r.type,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        meta: {
          searchValue: (row: CustomerRow) => row.type,
        },
        cell: ({ row }) => {
          const c = row.original;
          const Icon = iconForCustomerType(c.type);
          const label = c.type === "company" ? "Company" : "Individual";
          return (
            <span
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
                typeBadgeClasses(c.type),
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="min-w-0 truncate capitalize">{label}</span>
            </span>
          );
        },
      },
      {
        id: "name",
        accessorFn: (r) =>
          (r.type === "company" ? r.companyName : r.fullName) ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        meta: {
          searchValue: (row: CustomerRow) =>
            [
              row.companyName,
              row.fullName,
              row.email,
              row.phone,
              row.phone_2,
            ]
              .filter(Boolean)
              .join(" "),
        },
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {row.original.type === "company"
              ? row.original.companyName
              : row.original.fullName}
          </span>
        ),
      },
      {
        id: "email",
        accessorFn: (r) => r.email ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        meta: {
          tdClassName: "text-muted-foreground max-w-[14rem] truncate",
          searchValue: (row: CustomerRow) => row.email ?? "",
        },
        cell: ({ row }) => row.original.email || "—",
      },
      {
        id: "phone",
        accessorFn: (r) => r.phone ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Phone" />
        ),
        meta: {
          thClassName: "hidden md:table-cell",
          tdClassName: "hidden md:table-cell text-muted-foreground",
          searchValue: (row: CustomerRow) => row.phone ?? "",
        },
        cell: ({ row }) => row.original.phone || "—",
      },
      {
        id: "phone_2",
        accessorFn: (r) => r.phone_2 ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Phone 2" />
        ),
        meta: {
          thClassName: "hidden md:table-cell",
          tdClassName: "hidden md:table-cell text-muted-foreground",
          searchValue: (row: CustomerRow) => row.phone_2 ?? "",
        },
        cell: ({ row }) => row.original.phone_2 || "—",
      },
      {
        id: "city",
        accessorFn: (r) => formatCity(r),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="City" />
        ),
        meta: {
          searchValue: (row: CustomerRow) => formatCity(row),
        },
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[14rem] text-muted-foreground">
            {formatCity(row.original)}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        meta: {
          searchable: false,
          thClassName: "w-[70px] text-right",
          tdClassName: "text-right",
        },
        cell: ({ row }) => {
          const c = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/app/customers/${c.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleToggleActive(c)}>
                  {c.isActive ? (
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
                  onClick={() => setConfirmDeleteId(c.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [handleToggleActive],
  );

  const hasActiveFilters = useMemo(
    () =>
      debouncedSearch !== "" ||
      typeFilter !== "all",
    [debouncedSearch, typeFilter],
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
            <Link href="/app/customers/new">
              <Plus className="h-4 w-4" />
              Add customer
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
              filtersOpen ? "Hide customer filters" : "Show customer filters"
            }
            aria-expanded={filtersOpen}
            aria-controls="customers-filter-panel"
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
            company so customers can be saved against{" "}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">
              company_id
            </code>
            .
          </CardContent>
        </Card>
      )}

      {showSkeleton ? (
        <DirectoryListPageSkeleton className="min-h-0 flex-1" />
      ) : null}

      {showDirectory && facets ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0",
            filtersOpen ? "gap-6" : "gap-0",
          )}
        >
          <div
            id="customers-filter-panel"
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
              <CustomersFilterSidebar
                facets={facets}
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
                  placeholder="Search by name, email, phone, phone 2, or company…"
                  className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                  aria-label="Search customers"
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
                onRowClick={(r) => router.push(`/app/customers/${r.id}/edit`)}
                getRowId={(r) => r.id}
                emptyMessage={
                  hasActiveFilters ? (
                    <FeatureEmptyState
                      title="No customers match your filters"
                      description="Try clearing search or adjusting filters."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPage(1);
                            setSearchQuery("");
                            setTypeFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : facets.companyTotal === 0 ? (
                    <FeatureEmptyState
                      icon={Users}
                      title="No customers yet"
                      description="Add your first customer to use them on quotations and invoices."
                      action={
                        <Button className="gap-2" asChild>
                          <Link href="/app/customers/new">
                            <Plus className="h-4 w-4" />
                            Add customer
                          </Link>
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : (
                    <FeatureEmptyState
                      title="No customers on this page"
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
                    pageSizeOptions={[10, 50, 100, 200]}
                  />
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The customer record will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={singleDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={singleDeleting}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDeleteId) void handleDelete(confirmDeleteId);
              }}
            >
              {singleDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
