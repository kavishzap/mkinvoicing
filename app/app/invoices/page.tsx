"use client";
import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  Copy,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  SlidersVertical,
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
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  listInvoices,
  listAllInvoicesForExport,
  fetchInvoiceListFacets,
  getCachedInvoiceFacets,
  getCachedInvoiceList,
  invalidateInvoiceCaches,
  type InvoiceListRow,
  type InvoiceListFacets,
  type InvoiceStatus,
} from "@/lib/invoices-service";
import { AppPageShell } from "@/components/app-page-shell";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { cn } from "@/lib/utils";

type PeriodFilter = "all" | "month" | "quarter" | "year";

function formatListCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}

function formatListDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const InvoicesFilterSidebar = memo(function InvoicesFilterSidebar({
  id,
  facets,
  statusFilter,
  onStatusChange,
  periodFilter,
  onPeriodChange,
}: {
  id?: string;
  facets: InvoiceListFacets;
  statusFilter: InvoiceStatus | "all";
  onStatusChange: (v: InvoiceStatus | "all") => void;
  periodFilter: PeriodFilter;
  onPeriodChange: (v: PeriodFilter) => void;
}) {
  const statusRows: {
    id: InvoiceStatus | "all";
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All invoices",
      icon: FileText,
      count: facets.companyTotal,
    },
    {
      id: "unpaid",
      label: "Unpaid",
      icon: CalendarDays,
      count: facets.unpaidCount,
    },
    {
      id: "paid",
      label: "Paid",
      icon: Check,
      count: facets.paidCount,
    },
    {
      id: "cancelled",
      label: "Cancelled",
      icon: Ban,
      count: facets.cancelledCount,
    },
  ];

  const periodRows: {
    id: PeriodFilter;
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All time",
      icon: Calendar,
      count: facets.companyTotal,
    },
    {
      id: "month",
      label: "This month",
      icon: CalendarDays,
      count: facets.thisMonthCount,
    },
    {
      id: "quarter",
      label: "This quarter",
      icon: CalendarRange,
      count: facets.thisQuarterCount,
    },
    {
      id: "year",
      label: "This year",
      icon: CalendarClock,
      count: facets.thisYearCount,
    },
  ];

  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  return (
    <aside id={id} className="w-full shrink-0 lg:self-stretch">
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
            By issue period
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by issue period">
            {periodRows.map((item) => {
              const Icon = item.icon;
              const selected = periodFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPeriodChange(item.id)}
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

export default function InvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<InvoiceListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<InvoiceListFacets | null>(null);

  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [facetsLoading, setFacetsLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<{
    id: string;
    number: string;
  } | null>(null);

  const listRequestGen = useRef(0);
  const prevListDepsRef = useRef({
    debouncedSearch: "",
    statusFilter: "all" as InvoiceStatus | "all",
    periodFilter: "all" as PeriodFilter,
    pageSize: 10,
    activeCompanyScope: 0,
  });

  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 220);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const bump = () => {
      invalidateInvoiceCaches();
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

      // Show cached facets immediately while revalidating in the background
      // so the sidebar doesn't blank out on every navigation back to the page.
      const cached = getCachedInvoiceFacets(id);
      if (cached) {
        setFacets(cached);
        setFacetsLoading(false);
      } else {
        setFacetsLoading(true);
      }

      try {
        const facetData = await fetchInvoiceListFacets();
        if (!cancelled) setFacets(facetData);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Please try again.";
          toastRef.current({
            title: "Failed to load filters",
            description: msg,
            variant: "destructive",
          });
          if (!cached) setFacets(null);
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
      prev.statusFilter !== statusFilter ||
      prev.periodFilter !== periodFilter ||
      prev.pageSize !== pageSize ||
      prev.activeCompanyScope !== activeCompanyScope;

    if (depsChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevListDepsRef.current = {
      debouncedSearch,
      statusFilter,
      periodFilter,
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
        status: statusFilter,
        period: periodFilter,
        page,
        pageSize,
        sortBy: "issueDate" as const,
        sort: "desc" as const,
      };

      // Show cached rows immediately if we have them; still revalidate in the
      // background so the data stays current. Visual loading state stays off
      // for cache hits so the table doesn't dim on every navigation back.
      const cached = companyId
        ? getCachedInvoiceList(companyId, listOpts)
        : null;
      if (cached) {
        setRows(cached.rows);
        setTotal(cached.total);
        setListLoading(false);
      } else {
        setListLoading(true);
      }

      try {
        const listRes = await listInvoices(listOpts);
        if (cancelled || gen !== listRequestGen.current) return;
        setRows(listRes.rows);
        setTotal(listRes.total);
      } catch (e: unknown) {
        if (cancelled || gen !== listRequestGen.current) return;
        toastRef.current({
          title: "Failed to load invoices",
          description: e instanceof Error ? e.message : "Please try again.",
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
    statusFilter,
    periodFilter,
    page,
    pageSize,
    activeCompanyScope,
  ]);

  const fetchExportRows = useCallback(
    async () =>
      listAllInvoicesForExport({
        search: debouncedSearch || undefined,
        status: statusFilter,
        period: periodFilter,
        sortBy: "issueDate",
        sort: "desc",
      }),
    [debouncedSearch, statusFilter, periodFilter],
  );

  const exportFilenameStem = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `invoices-${yyyy}${mm}${dd}`;
  }, []);

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    try {
      setExportingPdf(true);
      const data = await fetchExportRows();
      if (data.length === 0) {
        toastRef.current({
          title: "Nothing to export",
          description: "No invoices match the current filters.",
        });
        return;
      }

      const { buildInvoicesListPdfDoc } = await import("@/lib/invoices-list-pdf");
      const doc = await buildInvoicesListPdfDoc({
        rows: data,
        statusFilter,
        periodFilter,
        searchQuery: debouncedSearch,
      });
      const filename = `${exportFilenameStem}.pdf`;
      doc.save(filename);
      toastRef.current({
        title: "PDF exported",
        description: `${data.length} invoice${data.length === 1 ? "" : "s"} exported.`,
      });
    } catch (e: unknown) {
      toastRef.current({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = useCallback(async () => {
    if (printing) return;
    try {
      setPrinting(true);
      const data = await fetchExportRows();
      if (data.length === 0) {
        toastRef.current({
          title: "Nothing to print",
          description: "No invoices match the current filters.",
        });
        return;
      }
      const { buildInvoicesListPdfDoc } = await import("@/lib/invoices-list-pdf");
      const doc = await buildInvoicesListPdfDoc({
        rows: data,
        statusFilter,
        periodFilter,
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
  }, [printing, fetchExportRows, exportFilenameStem]);

  const columns = useMemo<ColumnDef<InvoiceListRow>[]>(
    () => [
      {
        id: "number",
        accessorFn: (r) => r.number,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Invoice #" />
        ),
        meta: {
          searchValue: (row: InvoiceListRow) =>
            [row.number, row.clientName].join(" "),
        },
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">{row.original.number}</span>
        ),
      },
      {
        id: "customer",
        accessorFn: (r) => r.clientName,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        meta: {
          searchValue: (row: InvoiceListRow) => row.clientName,
          stopRowClick: true,
          tdClassName: "text-muted-foreground",
        },
        cell: ({ row }) => {
          const { customerId, clientName } = row.original;
          if (!customerId) return clientName || "—";
          return (
            <Link
              href={`/app/customers/${customerId}/edit`}
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={(e) => e.stopPropagation()}
            >
              {clientName || "View customer"}
            </Link>
          );
        },
      },
      {
        id: "salesOrder",
        accessorFn: (r) => r.salesOrderNumber ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Sales order" />
        ),
        meta: {
          searchValue: (row: InvoiceListRow) => row.salesOrderNumber ?? "",
          stopRowClick: true,
          tdClassName: "text-muted-foreground",
        },
        cell: ({ row }) => {
          const { salesOrderId, salesOrderNumber } = row.original;
          if (!salesOrderId) return "—";
          return (
            <Link
              href={`/app/sales-orders/${salesOrderId}`}
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={(e) => e.stopPropagation()}
            >
              {salesOrderNumber || "View sales order"}
            </Link>
          );
        },
      },
      {
        id: "issueDate",
        accessorFn: (r) => new Date(r.issueDate).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Issue date" />
        ),
        meta: {
          searchValue: (row: InvoiceListRow) => row.issueDate,
          tdClassName: "text-muted-foreground",
        },
        cell: ({ row }) => formatListDate(row.original.issueDate),
      },
      {
        id: "dueDate",
        accessorFn: (r) => new Date(r.dueDate).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Due date" />
        ),
        meta: {
          searchValue: (row: InvoiceListRow) => row.dueDate,
          tdClassName: "text-muted-foreground",
        },
        cell: ({ row }) => formatListDate(row.original.dueDate),
      },
      {
        id: "status",
        accessorFn: (r) => r.status,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        meta: {
          searchValue: (row: InvoiceListRow) => row.status,
        },
        cell: ({ row }) => (
          <InvoiceStatusBadge
            status={row.original.status}
            dueDate={row.original.dueDate}
          />
        ),
      },
      {
        id: "total",
        accessorFn: (r) => Number(r.total),
        header: ({ column }) => (
          <div className="flex justify-end">
            <DataTableColumnHeader column={column} title="Total" />
          </div>
        ),
        meta: {
          thClassName: "text-right",
          tdClassName: "text-right font-medium tabular-nums",
          searchValue: (row: InvoiceListRow) =>
            String(row.total) + " " + row.currency,
        },
        cell: ({ row }) =>
          formatListCurrency(row.original.total, row.original.currency),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        meta: {
          searchable: false,
          stopRowClick: true,
          thClassName: "w-[52px] text-right",
          tdClassName: "text-right",
        },
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
                aria-label="Open menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={() => router.push(`/app/invoices/${row.original.id}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setDuplicateTarget({
                    id: row.original.id,
                    number: row.original.number,
                  })
                }
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [router],
  );

  const hasActiveFilters = useMemo(
    () =>
      debouncedSearch !== "" ||
      statusFilter !== "all" ||
      periodFilter !== "all",
    [debouncedSearch, statusFilter, periodFilter],
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

  const showDirectory = companyReady === true && facets !== null && !showSkeleton;

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      actions={
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-2"
            disabled={
              companyReady !== true ||
              exportingPdf ||
              printing ||
              listLoading ||
              facetsLoading
            }
            onClick={() => void handleExportPdf()}
          >
            <FileText className="h-4 w-4" />
            {exportingPdf ? "Exporting…" : "Export PDF"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-2"
            disabled={
              companyReady !== true ||
              printing ||
              exportingPdf ||
              listLoading ||
              facetsLoading
            }
            onClick={() => void handlePrint()}
          >
            <Printer className="h-4 w-4" />
            {printing ? "Preparing…" : "Print"}
          </Button>
          <Button className="shrink-0 gap-2" disabled={companyReady !== true} asChild>
            <Link href="/app/invoices/new">
              <Plus className="h-4 w-4" />
              Create invoice
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
            aria-label={filtersOpen ? "Hide invoice filters" : "Show invoice filters"}
            aria-expanded={filtersOpen}
            aria-controls="invoices-filter-panel"
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
            No active company is linked to this account yet. Create or join a company in
            Supabase (company_users / companies) so invoices can be saved against{" "}
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

      {showDirectory ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0",
            filtersOpen ? "gap-6" : "gap-0",
          )}
        >
          <div
            id="invoices-filter-panel"
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
              <InvoicesFilterSidebar
                facets={facets}
                statusFilter={statusFilter}
                onStatusChange={(v) => {
                  setPage(1);
                  setStatusFilter(v);
                }}
                periodFilter={periodFilter}
                onPeriodChange={(v) => {
                  setPage(1);
                  setPeriodFilter(v);
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
                  placeholder="Search by invoice # or client…"
                  className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                  aria-label="Search invoices"
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
                onRowClick={(r) => router.push(`/app/invoices/${r.id}`)}
                getRowId={(r) => r.id}
                emptyMessage={
                  hasActiveFilters ? (
                    <FeatureEmptyState
                      title="No invoices match your filters"
                      description="Try clearing search or adjusting filters."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPage(1);
                            setSearchQuery("");
                            setStatusFilter("all");
                            setPeriodFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : facets.companyTotal === 0 ? (
                    <FeatureEmptyState
                      icon={FileText}
                      title="No invoices yet"
                      description="Create your first invoice to start billing customers."
                      action={
                        <Button className="gap-2" asChild>
                          <Link href="/app/invoices/new">
                            <Plus className="h-4 w-4" />
                            Create invoice
                          </Link>
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : (
                    <FeatureEmptyState
                      title="No invoices on this page"
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

      <AlertDialog
        open={!!duplicateTarget}
        onOpenChange={(open) => {
          if (!open) setDuplicateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateTarget
                ? `Create a new invoice prefilled from ${duplicateTarget.number}? You can review and edit it before saving.`
                : "Create a new invoice from this one?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!duplicateTarget) return;
                router.push(
                  `/app/invoices/new?duplicateFrom=${encodeURIComponent(duplicateTarget.id)}`,
                );
                setDuplicateTarget(null);
              }}
            >
              Duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
