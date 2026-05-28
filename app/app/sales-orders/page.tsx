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
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FileText,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  Search,
  SlidersVertical,
  StickyNote,
  Trash2,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { SalesOrderPaymentStatusBadge } from "@/components/sales-order-payment-status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  listSalesOrders,
  listAllSalesOrdersForExport,
  deleteSalesOrder,
  expireStaleSalesOrders,
  getSalesOrderListFacets,
  getCachedSalesOrderListFacets,
  getCachedSalesOrderList,
  invalidateSalesOrderCaches,
  updateSalesOrderPaymentStatus,
  salesOrderFulfillmentAllowsEditing,
  salesOrderFulfillmentFilterLabel,
  salesOrderPaymentFilterLabel,
  type SalesOrderFulfillmentStatus,
  type SalesOrderPaymentStatusDb,
  type SalesOrderListFacets,
  type SalesOrderListRow,
} from "@/lib/sales-orders-service";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { AppPageShell } from "@/components/app-page-shell";
import { cn } from "@/lib/utils";

const FULFILLMENT_FILTER_ICONS: Partial<
  Record<SalesOrderFulfillmentStatus, LucideIcon>
> = {
  new: FilePlus2,
  pending: Clock,
  "delivery note created": FileText,
  "delivered to driver": Truck,
  "delivered to customer": PackageCheck,
  completed: CheckCircle2,
  cancelled: XCircle,
  rescheduled: CalendarClock,
};

const PAYMENT_FILTER_ICONS: Partial<
  Record<SalesOrderPaymentStatusDb, LucideIcon>
> = {
  unpaid: Clock,
  "partial paid": StickyNote,
  paid: BadgeCheck,
};

function fulfillmentFilterIcon(status: SalesOrderFulfillmentStatus): LucideIcon {
  return FULFILLMENT_FILTER_ICONS[status] ?? ClipboardList;
}

function paymentFilterIcon(status: SalesOrderPaymentStatusDb): LucideIcon {
  return PAYMENT_FILTER_ICONS[status] ?? Wallet;
}

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

const SalesOrdersFilterSidebar = memo(function SalesOrdersFilterSidebar({
  id,
  facets,
  fulfillmentFilter,
  onFulfillmentChange,
  paymentFilter,
  onPaymentChange,
}: {
  id?: string;
  facets: SalesOrderListFacets;
  fulfillmentFilter: SalesOrderFulfillmentStatus | "all";
  onFulfillmentChange: (v: SalesOrderFulfillmentStatus | "all") => void;
  paymentFilter: SalesOrderPaymentStatusDb | "all";
  onPaymentChange: (v: SalesOrderPaymentStatusDb | "all") => void;
}) {
  const fulfillmentRows: {
    id: SalesOrderFulfillmentStatus | "all";
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All orders",
      icon: ClipboardList,
      count: facets.total,
    },
    ...facets.fulfillmentEnum.map((s) => ({
      id: s,
      label: salesOrderFulfillmentFilterLabel(s),
      icon: fulfillmentFilterIcon(s),
      count: facets.byFulfillment[s] ?? 0,
    })),
  ];

  const paymentRows: {
    id: SalesOrderPaymentStatusDb | "all";
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All payments",
      icon: Wallet,
      count: facets.total,
    },
    ...facets.paymentEnum.map((s) => ({
      id: s,
      label: salesOrderPaymentFilterLabel(s),
      icon: paymentFilterIcon(s),
      count: facets.byPayment[s] ?? 0,
    })),
  ];

  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  return (
    <aside id={id} className="w-full shrink-0 lg:self-stretch">
      <div className="space-y-7 py-1">
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By fulfillment
          </h3>
          <nav
            className="flex flex-col gap-px"
            aria-label="Filter by fulfillment status"
          >
            {fulfillmentRows.map((item) => {
              const Icon = item.icon;
              const selected = fulfillmentFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onFulfillmentChange(item.id)}
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
            By payment
          </h3>
          <nav
            className="flex flex-col gap-px"
            aria-label="Filter by payment status"
          >
            {paymentRows.map((item) => {
              const Icon = item.icon;
              const selected = paymentFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPaymentChange(item.id)}
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

export default function SalesOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<SalesOrderListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<SalesOrderListFacets | null>(null);

  const [fulfillmentFilter, setFulfillmentFilter] = useState<
    SalesOrderFulfillmentStatus | "all"
  >("all");
  const [paymentFilter, setPaymentFilter] = useState<
    SalesOrderPaymentStatusDb | "all"
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
    fulfillmentFilter: "all" as SalesOrderFulfillmentStatus | "all",
    paymentFilter: "all" as SalesOrderPaymentStatusDb | "all",
    pageSize: 10,
    activeCompanyScope: 0,
  });

  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      350,
    );
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const bump = () => {
      invalidateSalesOrderCaches();
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
        setListLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCompanyScope]);

  useEffect(() => {
    if (companyReady !== true) return;

    let cancelled = false;

    (async () => {
      const companyId = await getActiveCompanyId();
      if (cancelled) return;

      const cachedFacets = companyId
        ? getCachedSalesOrderListFacets(companyId)
        : null;
      if (cachedFacets) {
        setFacets(cachedFacets);
        setFacetsLoading(false);
      } else {
        setFacetsLoading(true);
      }

      try {
        await expireStaleSalesOrders();
        const facetData = await getSalesOrderListFacets();
        if (cancelled) return;
        setFacets(facetData);
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
  }, [activeCompanyScope, companyReady]);

  useEffect(() => {
    if (companyReady !== true) return;

    const prev = prevListDepsRef.current;
    const depsChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.fulfillmentFilter !== fulfillmentFilter ||
      prev.paymentFilter !== paymentFilter ||
      prev.pageSize !== pageSize ||
      prev.activeCompanyScope !== activeCompanyScope;

    if (depsChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevListDepsRef.current = {
      debouncedSearch,
      fulfillmentFilter,
      paymentFilter,
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
        fulfillmentStatus: fulfillmentFilter,
        paymentStatus: paymentFilter,
        page,
        pageSize,
      };

      const cachedList = companyId
        ? getCachedSalesOrderList(companyId, listOpts)
        : null;
      if (cachedList) {
        setRows(cachedList.rows);
        setTotal(cachedList.total);
        setListLoading(false);
      } else {
        setListLoading(true);
      }

      try {
        const listRes = await listSalesOrders({
          ...listOpts,
          skipExpireStale: true,
        });
        if (cancelled || gen !== listRequestGen.current) return;
        setRows(listRes.rows);
        setTotal(listRes.total);
      } catch (e: unknown) {
        if (cancelled || gen !== listRequestGen.current) return;
        const msg = e instanceof Error ? e.message : "Please try again.";
        toastRef.current({
          title: "Failed to load sales orders",
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
    fulfillmentFilter,
    paymentFilter,
    page,
    pageSize,
    activeCompanyScope,
  ]);

  const reload = useCallback(async () => {
    if (companyReady !== true) return;
    listRequestGen.current += 1;
    const gen = listRequestGen.current;
    setListLoading(true);
    setFacetsLoading(true);
    try {
      await expireStaleSalesOrders();
      const [facetData, listRes] = await Promise.all([
        getSalesOrderListFacets({ force: true }),
        listSalesOrders({
          search: debouncedSearch || undefined,
          fulfillmentStatus: fulfillmentFilter,
          paymentStatus: paymentFilter,
          page,
          pageSize,
          skipExpireStale: true,
        }),
      ]);
      if (gen !== listRequestGen.current) return;
      setFacets(facetData);
      setRows(listRes.rows);
      setTotal(listRes.total);
      prevListDepsRef.current = {
        debouncedSearch,
        fulfillmentFilter,
        paymentFilter,
        pageSize,
        activeCompanyScope,
      };
    } catch (e: unknown) {
      if (gen === listRequestGen.current) {
        toastRef.current({
          title: "Failed to refresh sales orders",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      if (gen === listRequestGen.current) {
        setListLoading(false);
        setFacetsLoading(false);
      }
    }
  }, [
    companyReady,
    debouncedSearch,
    fulfillmentFilter,
    paymentFilter,
    page,
    pageSize,
    activeCompanyScope,
  ]);

  const fetchExportRows = useCallback(async () => {
    await expireStaleSalesOrders();
    return listAllSalesOrdersForExport({
      search: debouncedSearch || undefined,
      fulfillmentStatus: fulfillmentFilter,
      paymentStatus: paymentFilter,
      skipExpireStale: true,
    });
  }, [debouncedSearch, fulfillmentFilter, paymentFilter]);

  const exportFilenameStem = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `sales-orders-${yyyy}${mm}${dd}`;
  }, []);

  const handleExportCsv = useCallback(async () => {
    if (exportingCsv) return;
    try {
      setExportingCsv(true);
      const data = await fetchExportRows();
      if (data.length === 0) {
        toastRef.current({
          title: "Nothing to export",
          description: "No sales orders match the current filters.",
        });
        return;
      }
      const headers = [
        "Order #",
        "Customer",
        "City",
        "Created by",
        "Delivery date",
        "Fulfillment",
        "Payment",
        "Total",
      ];
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines = [headers.map(esc).join(",")];
      for (const r of data) {
        lines.push(
          [
            r.number,
            r.clientName || "",
            r.cityName || "",
            r.createdByName || "",
            r.deliveryDate ? formatListDate(r.deliveryDate) : "",
            salesOrderFulfillmentFilterLabel(r.fulfillmentStatus),
            salesOrderPaymentFilterLabel(r.paymentStatus),
            formatListCurrency(r.total, r.currency),
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
        description: `${data.length} sales order${data.length === 1 ? "" : "s"} exported.`,
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
  }, [exportingCsv, fetchExportRows, exportFilenameStem]);

  const handlePrint = useCallback(async () => {
    if (printing) return;
    try {
      setPrinting(true);
      const data = await fetchExportRows();
      if (data.length === 0) {
        toastRef.current({
          title: "Nothing to print",
          description: "No sales orders match the current filters.",
        });
        return;
      }
      const { buildSalesOrdersListPdfDoc } = await import(
        "@/lib/sales-orders-list-pdf"
      );
      const doc = await buildSalesOrdersListPdfDoc({
        rows: data,
        fulfillmentFilter,
        paymentFilter,
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
    fulfillmentFilter,
    paymentFilter,
    debouncedSearch,
    exportFilenameStem,
  ]);

  const handleDuplicate = useCallback(
    (idParam: string) => {
      router.push(
        `/app/sales-orders/new?duplicate=${encodeURIComponent(idParam)}`,
      );
    },
    [router],
  );

  const handleMarkAsPaid = useCallback(
    async (idParam: string) => {
      try {
        await updateSalesOrderPaymentStatus(idParam, "paid");
        setRows((prev) =>
          prev.map((r) =>
            r.id === idParam ? { ...r, paymentStatus: "paid" } : r,
          ),
        );
        toastRef.current({
          title: "Sales order updated",
          description: "Payment status set to Paid.",
        });
      } catch (e: unknown) {
        toastRef.current({
          title: "Could not mark as paid",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      }
    },
    [],
  );

  const columns = useMemo<ColumnDef<SalesOrderListRow>[]>(
    () => [
      {
        id: "number",
        accessorFn: (r) => r.number,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order #" />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {row.original.number}
          </span>
        ),
      },
      {
        id: "customer",
        accessorFn: (r) => r.clientName ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        meta: {
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
        id: "city",
        accessorFn: (r) => r.cityName ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="City" />
        ),
        cell: ({ row }) => row.original.cityName || "—",
        meta: { tdClassName: "text-muted-foreground" },
      },
      {
        id: "createdBy",
        accessorFn: (r) => r.createdByName ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created by" />
        ),
        cell: ({ row }) => row.original.createdByName || "—",
        meta: { tdClassName: "text-muted-foreground" },
      },
      {
        id: "deliveryDate",
        accessorFn: (r) =>
          r.deliveryDate ? new Date(r.deliveryDate).getTime() : 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Delivery date" />
        ),
        cell: ({ row }) =>
          row.original.deliveryDate
            ? formatListDate(row.original.deliveryDate)
            : "—",
        meta: { tdClassName: "text-muted-foreground" },
      },
      {
        id: "fulfillmentStatus",
        accessorFn: (r) => r.fulfillmentStatus,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Fulfillment" />
        ),
        cell: ({ row }) => {
          const so = row.original;
          const showNoteHint =
            so.fulfillmentStatus === "pending" && so.notes.length > 0;
          return (
            <div className="flex items-center gap-1.5">
              <SalesOrderFulfillmentStatusBadge
                status={so.fulfillmentStatus}
              />
              {showNoteHint ? (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Pending sales order has notes"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-300/70 bg-amber-100 text-amber-900 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:border-amber-700/60 dark:bg-amber-900/40 dark:text-amber-100"
                      >
                        <StickyNote className="h-3 w-3" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="start"
                      className="max-w-xs whitespace-pre-line text-left"
                    >
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-background/70">
                        Pending — notes
                      </p>
                      <p className="text-xs leading-snug">
                        {so.notes.length > 240
                          ? `${so.notes.slice(0, 240)}…`
                          : so.notes}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
          );
        },
        meta: {
          tdClassName: "text-muted-foreground",
          searchValue: (row: SalesOrderListRow) =>
            salesOrderFulfillmentFilterLabel(row.fulfillmentStatus),
        },
      },
      {
        id: "paymentStatus",
        accessorFn: (r) => r.paymentStatus,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Payment" />
        ),
        cell: ({ row }) => (
          <SalesOrderPaymentStatusBadge status={row.original.paymentStatus} />
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
          thClassName: "w-[52px] text-right",
          tdClassName: "text-right",
        },
        cell: ({ row }) => {
          const so = row.original;
          return (
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
                  onClick={() => router.push(`/app/sales-orders/${so.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                {salesOrderFulfillmentAllowsEditing(so.fulfillmentStatus) ? (
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/app/sales-orders/${so.id}/edit`)
                    }
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => handleDuplicate(so.id)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                {so.paymentStatus !== "paid" ? (
                  <DropdownMenuItem onClick={() => void handleMarkAsPaid(so.id)}>
                    <BadgeCheck className="mr-2 h-4 w-4" />
                    Mark as paid
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteId(so.id)}
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
    [router, handleDuplicate, handleMarkAsPaid],
  );

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteSalesOrder(deleteId);
      toastRef.current({ title: "Sales order deleted" });
      setDeleteId(null);
      await reload();
    } catch (e: unknown) {
      toastRef.current({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = useMemo(
    () =>
      debouncedSearch !== "" ||
      fulfillmentFilter !== "all" ||
      paymentFilter !== "all",
    [debouncedSearch, fulfillmentFilter, paymentFilter],
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
          <Button className="shrink-0 gap-2" disabled={companyReady !== true} asChild>
            <Link href="/app/sales-orders/new">
              <Plus className="h-4 w-4" />
              Create sales order
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
              filtersOpen ? "Hide sales order filters" : "Show sales order filters"
            }
            aria-expanded={filtersOpen}
            aria-controls="sales-orders-filter-panel"
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
            sales orders load for{" "}
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
            id="sales-orders-filter-panel"
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
              <SalesOrdersFilterSidebar
                facets={facets}
                fulfillmentFilter={fulfillmentFilter}
                onFulfillmentChange={(v) => {
                  setPage(1);
                  setFulfillmentFilter(v);
                }}
                paymentFilter={paymentFilter}
                onPaymentChange={(v) => {
                  setPage(1);
                  setPaymentFilter(v);
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
                  placeholder="Search by order #, client, or phone…"
                  className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                  aria-label="Search sales orders"
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
                onRowClick={(r) => router.push(`/app/sales-orders/${r.id}`)}
                getRowId={(r) => r.id}
                emptyMessage={
                  hasActiveFilters ? (
                    <FeatureEmptyState
                      title="No sales orders match your filters"
                      description="Try clearing search or adjusting filters."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPage(1);
                            setSearchQuery("");
                            setFulfillmentFilter("all");
                            setPaymentFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : facets.total === 0 ? (
                    <FeatureEmptyState
                      icon={ClipboardList}
                      title="No sales orders yet"
                      description="Create a sales order to see it listed here with fulfillment counts in the sidebar."
                      action={
                        <Button className="gap-2" asChild>
                          <Link href="/app/sales-orders/new">
                            <Plus className="h-4 w-4" />
                            Create sales order
                          </Link>
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : (
                    <FeatureEmptyState
                      title="No sales orders on this page"
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sales order?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The sales order and its line items will be
              removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
