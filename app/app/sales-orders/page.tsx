"use client";
export const dynamic = "force-dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  Copy,
  FileText,
  ClipboardList,
  BadgeCheck,
  TimerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { FeatureKpiItem } from "@/components/feature-kpi-strip";
import { FeatureListSection } from "@/components/feature-list-section";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { SalesOrderPaymentStatusBadge } from "@/components/sales-order-payment-status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  listSalesOrders,
  deleteSalesOrder,
  expireStaleSalesOrders,
  getSalesOrderKpiCounts,
  type SalesOrderListRow,
  type SalesOrderStatus,
} from "@/lib/sales-orders-service";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
} from "@/lib/active-company";
import { AppPageShell } from "@/components/app-page-shell";

export default function SalesOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<SalesOrderListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | "all">(
    "all",
  );
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Bumped when the active tenant changes so `listSalesOrders` re-runs for the right `company_id`. */
  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  /** Bumped after mutations so KPI counts stay in sync. */
  const [kpiRev, setKpiRev] = useState(0);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiTotal, setKpiTotal] = useState(0);
  const [kpiActive, setKpiActive] = useState(0);
  const [kpiExpired, setKpiExpired] = useState(0);

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
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const hasActiveFilters = useMemo(
    () => searchQuery.trim() !== "" || statusFilter !== "all",
    [searchQuery, statusFilter],
  );

  useEffect(() => {
    let cancelled = false;
    setKpiLoading(true);
    setIsLoading(true);
    (async () => {
      try {
        await expireStaleSalesOrders();
        const [kpis, listRes] = await Promise.all([
          getSalesOrderKpiCounts(),
          listSalesOrders({
            search: debouncedSearch || undefined,
            status: statusFilter,
            page: currentPage,
            pageSize: itemsPerPage,
            skipExpireStale: true,
          }),
        ]);
        if (cancelled) return;
        setKpiTotal(kpis.total);
        setKpiActive(kpis.active);
        setKpiExpired(kpis.expired);
        setRows(listRes.rows);
        setTotal(listRes.total);
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Failed to load sales orders",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
          setKpiTotal(0);
          setKpiActive(0);
          setKpiExpired(0);
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setKpiLoading(false);
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable; errors only
  }, [
    debouncedSearch,
    statusFilter,
    currentPage,
    itemsPerPage,
    activeCompanyScope,
    kpiRev,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, itemsPerPage, activeCompanyScope]);

  const kpiItems = useMemo<FeatureKpiItem[]>(
    () => [
      {
        label: "Total sales orders",
        value: kpiTotal,
        icon: ClipboardList,
        valueLabel: String(kpiTotal),
      },
      {
        label: "Active",
        value: kpiActive,
        icon: BadgeCheck,
        valueLabel: String(kpiActive),
      },
      {
        label: "Expired",
        value: kpiExpired,
        icon: TimerOff,
        valueLabel: String(kpiExpired),
      },
    ],
    [kpiTotal, kpiActive, kpiExpired],
  );

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
    (id: string) => {
      router.push(`/app/sales-orders/new?duplicate=${encodeURIComponent(id)}`);
    },
    [router],
  );

  const columns = useMemo<ColumnDef<SalesOrderListRow>[]>(
    () => [
      {
        id: "number",
        accessorFn: (r) => r.number,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order #" />
        ),
        meta: {
          searchValue: (row: SalesOrderListRow) =>
            [row.number, row.clientName].filter(Boolean).join(" "),
        },
        cell: ({ row }) => (
          <span className="font-medium">{row.original.number}</span>
        ),
      },
      {
        id: "clientName",
        accessorFn: (r) => r.clientName ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Client" />
        ),
        meta: {
          searchValue: (row: SalesOrderListRow) => row.clientName ?? "",
        },
        cell: ({ row }) => row.original.clientName || "—",
      },
      {
        id: "issueDate",
        accessorFn: (r) => new Date(r.issueDate).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Issue date" />
        ),
        meta: { searchValue: (row: SalesOrderListRow) => row.issueDate },
        cell: ({ row }) => formatDate(row.original.issueDate),
      },
      {
        id: "validUntil",
        accessorFn: (r) => new Date(r.validUntil).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Valid until" />
        ),
        meta: { searchValue: (row: SalesOrderListRow) => row.validUntil },
        cell: ({ row }) => formatDate(row.original.validUntil),
      },
      {
        id: "fulfillmentStatus",
        accessorFn: (r) => r.fulfillmentStatus,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Fulfillment status"
          />
        ),
        meta: {
          searchValue: (row: SalesOrderListRow) =>
            `${row.status} ${row.fulfillmentStatus} ${row.paymentStatus}`,
        },
        cell: ({ row }) => (
          <SalesOrderFulfillmentStatusBadge
            status={row.original.fulfillmentStatus}
          />
        ),
      },
      {
        id: "paymentStatus",
        accessorFn: (r) => r.paymentStatus,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Payment status" />
        ),
        meta: {
          searchValue: (row: SalesOrderListRow) => row.paymentStatus,
        },
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
          tdClassName: "text-right font-medium",
          searchValue: (row: SalesOrderListRow) =>
            String(row.total) + " " + row.currency,
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
          thClassName: "w-[120px] text-right",
          tdClassName: "text-right",
        },
        cell: ({ row }) => {
          const so = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => router.push(`/app/sales-orders/${so.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                {so.fulfillmentStatus === "new" ? (
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
                  Duplicate (prefill new)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(
                      `/app/invoices/new?convertFromSalesOrder=${encodeURIComponent(so.id)}&markSalesOrderPaid=1`,
                    )
                  }
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Convert to invoice and mark as paid
                </DropdownMenuItem>
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
    [router, handleDuplicate],
  );

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteSalesOrder(deleteId);
      toast({ title: "Sales order deleted" });
      setRows((r) => r.filter((x) => x.id !== deleteId));
      setTotal((t) => Math.max(0, t - 1));
      setDeleteId(null);
      setKpiRev((n) => n + 1);
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

  const salesOrderSubtitle =
    "Confirm what you’ll deliver or bill next—then turn orders into invoices when work is done.";

  const showEmptyZero = !isLoading && total === 0 && !hasActiveFilters;
  const showPagination = !showEmptyZero;

  const listDescription =
    "Newest orders first. Click a row to open the sales order, then use Edit on the detail page when the order is still in New fulfillment.";

  return (
    <AppPageShell
      subtitle={salesOrderSubtitle}
      actions={
        <Button
          onClick={() => router.push("/app/sales-orders/new")}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create sales order
        </Button>
      }
    >
      <FeatureListSection
        kpiItems={kpiItems}
        kpiLoading={kpiLoading}
        listTitle="Sales orders"
        listDescription={listDescription}
      >
        {isLoading && rows.length === 0 ? (
          <div
            className="h-56 animate-pulse rounded-md bg-muted/60"
            aria-hidden
          />
        ) : showEmptyZero ? (
          <FeatureEmptyState
            icon={ClipboardList}
            title="No sales orders yet"
            description="When you create a sales order it appears in this directory. Use the KPI cards above for a quick snapshot of volume by status."
            action={
              <Button
                onClick={() => router.push("/app/sales-orders/new")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Create sales order
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            manualFiltering
            onRowClick={(r) => router.push(`/app/sales-orders/${r.id}`)}
            searchPlaceholder="Search by order # or client…"
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            toolbarLeft={
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as SalesOrderStatus | "all")
                }
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Validity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            }
            getRowId={(r) => r.id}
            emptyMessage={
              hasActiveFilters ? (
                <FeatureEmptyState
                  title="No sales orders match your filters"
                  description="Try another search keyword, set validity back to “All”, or clear filters to see everything again."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                  className="border-0 bg-transparent py-8"
                />
              ) : (
                <FeatureEmptyState
                  title="No sales orders"
                  description="Nothing to show on this page."
                  className="border-0 bg-transparent py-8"
                />
              )
            }
            footer={
              showPagination ? (
                <DataTablePaginationFooter
                  total={total}
                  page={currentPage}
                  pageSize={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setItemsPerPage}
                />
              ) : null
            }
          />
        )}
      </FeatureListSection>

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
