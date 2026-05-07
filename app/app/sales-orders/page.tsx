"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ClipboardList,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersVertical,
  TimerOff,
  Trash2,
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
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { SalesOrderPaymentStatusBadge } from "@/components/sales-order-payment-status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  listSalesOrders,
  deleteSalesOrder,
  expireStaleSalesOrders,
  getSalesOrderKpiCounts,
  updateSalesOrderPaymentStatus,
  salesOrderFulfillmentAllowsEditing,
  SALES_ORDER_FULFILLMENT_LABELS,
  type SalesOrderListRow,
  type SalesOrderStatus,
} from "@/lib/sales-orders-service";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { AppPageShell } from "@/components/app-page-shell";
import { cn } from "@/lib/utils";

type SalesOrderListFacets = {
  companyTotal: number;
  activeCount: number;
  expiredCount: number;
};

function SalesOrdersFilterSidebar({
  id,
  facets,
  statusFilter,
  onStatusChange,
}: {
  id?: string;
  facets: SalesOrderListFacets;
  statusFilter: SalesOrderStatus | "all";
  onStatusChange: (v: SalesOrderStatus | "all") => void;
}) {
  const rows: {
    id: SalesOrderStatus | "all";
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All orders",
      icon: ClipboardList,
      count: facets.companyTotal,
    },
    {
      id: "active",
      label: "Active",
      icon: BadgeCheck,
      count: facets.activeCount,
    },
    {
      id: "expired",
      label: "Expired",
      icon: TimerOff,
      count: facets.expiredCount,
    },
  ];

  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  return (
    <aside id={id} className="w-full shrink-0 lg:self-stretch">
      <div className="space-y-7 py-1">
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By validity
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by validity">
            {rows.map((item) => {
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
      </div>
    </aside>
  );
}

export default function SalesOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<SalesOrderListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<SalesOrderListFacets | null>(null);

  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [facetsLoading, setFacetsLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  const listRequestGen = useRef(0);
  const prevListDepsRef = useRef({
    debouncedSearch: "",
    statusFilter: "all" as SalesOrderStatus | "all",
    pageSize: 10,
    activeCompanyScope: 0,
  });

  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        const [, kpis] = await Promise.all([
          expireStaleSalesOrders(),
          getSalesOrderKpiCounts(),
        ]);
        if (cancelled) return;
        setFacets({
          companyTotal: kpis.total,
          activeCount: kpis.active,
          expiredCount: kpis.expired,
        });
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

  useEffect(() => {
    if (companyReady !== true) return;

    const prev = prevListDepsRef.current;
    const depsChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.statusFilter !== statusFilter ||
      prev.pageSize !== pageSize ||
      prev.activeCompanyScope !== activeCompanyScope;

    if (depsChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevListDepsRef.current = {
      debouncedSearch,
      statusFilter,
      pageSize,
      activeCompanyScope,
    };

    const gen = ++listRequestGen.current;
    let cancelled = false;

    (async () => {
      setListLoading(true);
      try {
        const listRes = await listSalesOrders({
          search: debouncedSearch || undefined,
          status: statusFilter,
          page,
          pageSize,
          skipExpireStale: true,
        });
        if (cancelled || gen !== listRequestGen.current) return;
        setRows(listRes.rows);
        setTotal(listRes.total);
      } catch (e: unknown) {
        if (cancelled || gen !== listRequestGen.current) return;
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
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
      const [, kpis, listRes] = await Promise.all([
        expireStaleSalesOrders(),
        getSalesOrderKpiCounts(),
        listSalesOrders({
          search: debouncedSearch || undefined,
          status: statusFilter,
          page,
          pageSize,
          skipExpireStale: true,
        }),
      ]);
      if (gen !== listRequestGen.current) return;
      setFacets({
        companyTotal: kpis.total,
        activeCount: kpis.active,
        expiredCount: kpis.expired,
      });
      setRows(listRes.rows);
      setTotal(listRes.total);
      prevListDepsRef.current = {
        debouncedSearch,
        statusFilter,
        pageSize,
        activeCompanyScope,
      };
    } catch (e: unknown) {
      if (gen === listRequestGen.current) {
        toast({
          title: "Failed to refresh sales orders",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      if (gen === listRequestGen.current) setListLoading(false);
    }
  }, [
    companyReady,
    debouncedSearch,
    statusFilter,
    page,
    pageSize,
    activeCompanyScope,
    toast,
  ]);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      amount,
    );

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

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
        toast({
          title: "Sales order updated",
          description: "Payment status set to Paid.",
        });
      } catch (e: unknown) {
        toast({
          title: "Could not mark as paid",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      }
    },
    [toast],
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
        id: "clientName",
        accessorFn: (r) => r.clientName ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Client" />
        ),
        cell: ({ row }) => row.original.clientName || "—",
        meta: { tdClassName: "text-muted-foreground" },
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
        id: "createdAt",
        accessorFn: (r) =>
          r.createdAt ? new Date(r.createdAt).getTime() : 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) =>
          row.original.createdAt
            ? formatDate(row.original.createdAt)
            : "—",
        meta: { tdClassName: "text-muted-foreground" },
      },
      {
        id: "issueDate",
        accessorFn: (r) => new Date(r.issueDate).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Issue date" />
        ),
        cell: ({ row }) => formatDate(row.original.issueDate),
        meta: { tdClassName: "text-muted-foreground" },
      },
      {
        id: "validUntil",
        accessorFn: (r) => new Date(r.validUntil).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Valid until" />
        ),
        cell: ({ row }) => formatDate(row.original.validUntil),
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
            ? formatDate(row.original.deliveryDate)
            : "—",
        meta: { tdClassName: "text-muted-foreground" },
      },
      {
        id: "fulfillmentStatus",
        accessorFn: (r) => r.fulfillmentStatus,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Fulfillment" />
        ),
        cell: ({ row }) => (
          <SalesOrderFulfillmentStatusBadge
            status={row.original.fulfillmentStatus}
          />
        ),
        meta: {
          tdClassName: "text-muted-foreground",
          searchValue: (row: SalesOrderListRow) =>
            SALES_ORDER_FULFILLMENT_LABELS[row.fulfillmentStatus] ??
            row.fulfillmentStatus,
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
          formatCurrency(row.original.total, row.original.currency),
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
      toast({ title: "Sales order deleted" });
      setDeleteId(null);
      await reload();
    } catch (e: unknown) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = useMemo(
    () => debouncedSearch !== "" || statusFilter !== "all",
    [debouncedSearch, statusFilter],
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
        <Button className="shrink-0 gap-2" disabled={companyReady !== true} asChild>
          <Link href="/app/sales-orders/new">
            <Plus className="h-4 w-4" />
            Create sales order
          </Link>
        </Button>
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
        <div className="h-56 animate-pulse rounded-md bg-muted/60" aria-hidden />
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
                statusFilter={statusFilter}
                onStatusChange={(v) => {
                  setPage(1);
                  setStatusFilter(v);
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
                  placeholder="Search by order # or client…"
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
                      description="Try clearing search or adjusting validity filters."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPage(1);
                            setSearchQuery("");
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
                      icon={ClipboardList}
                      title="No sales orders yet"
                      description="Create a sales order to see it listed here with validity counts in the sidebar."
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
