"use client";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Eye, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { InvoiceEmptyState } from "@/components/invoice-empty-state";
import { InvoiceTableSkeleton } from "@/components/invoice-table-skeleton";
import { useToast } from "@/hooks/use-toast";

import {
  listInvoices,
  type InvoiceListRow,
  type InvoiceStatus,
} from "@/lib/invoices-service";
import { AppPageShell } from "@/components/app-page-shell";

export default function InvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();

  // table data
  const [rows, setRows] = useState<InvoiceListRow[]>([]);
  const [total, setTotal] = useState(0);

  // ui state
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">(
    "all"
  );
  const [periodFilter, setPeriodFilter] = useState<
    "all" | "month" | "quarter" | "year"
  >("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // ✅ detect if any filters/search are active
  const hasActiveFilters = useMemo(
    () =>
      searchQuery.trim() !== "" ||
      statusFilter !== "all" ||
      periodFilter !== "all",
    [searchQuery, statusFilter, periodFilter]
  );
  const currencyForSummary = useMemo(() => rows[0]?.currency ?? "USD", [rows]);

  const totalPaidAmount = useMemo(() => {
    return rows
      .filter((r) => r.status === "paid")
      .reduce((acc, r) => acc + Number(r.total || 0), 0);
  }, [rows]);

  const totalOverdueAmount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows
      .filter((r) => r.status !== "paid" && r.status !== "cancelled")
      .reduce((acc, r) => acc + Number(r.total || 0), 0);
  }, [rows]);
  async function load() {
    setIsLoading(true);
    const { rows, total } = await listInvoices({
      search: searchQuery,
      status: statusFilter,
      period: periodFilter,
      page: currentPage,
      pageSize: itemsPerPage,
      sortBy: "issueDate",
      sort: "desc",
    });
    setRows(rows);
    setTotal(total);
    setIsLoading(false);
  }

  // load data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const { rows, total } = await listInvoices({
          search: searchQuery,
          status: statusFilter,
          period: periodFilter,
          page: currentPage,
          pageSize: itemsPerPage,
        });
        if (!cancelled) {
          setRows(rows);
          setTotal(total);
        }
      } catch (e: any) {
        if (!cancelled) {
          toast({
            title: "Failed to load invoices",
            description: e?.message ?? "Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    searchQuery,
    statusFilter,
    periodFilter,
    currentPage,
    itemsPerPage,
    toast,
  ]);

  // reset to page 1 when filters/search/page-size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, periodFilter, itemsPerPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / itemsPerPage)),
    [total, itemsPerPage]
  );

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      amount
    );

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

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
          <span className="font-medium">{row.original.number}</span>
        ),
      },
      {
        id: "clientName",
        accessorFn: (r) => r.clientName,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Client" />
        ),
        meta: {
          searchValue: (row: InvoiceListRow) => row.clientName,
        },
        cell: ({ row }) => row.original.clientName,
      },
      {
        id: "issueDate",
        accessorFn: (r) => new Date(r.issueDate).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Issue Date" />
        ),
        meta: {
          searchValue: (row: InvoiceListRow) => row.issueDate,
        },
        cell: ({ row }) => formatDate(row.original.issueDate),
      },
      {
        id: "dueDate",
        accessorFn: (r) => new Date(r.dueDate).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Due Date" />
        ),
        meta: {
          searchValue: (row: InvoiceListRow) => row.dueDate,
        },
        cell: ({ row }) => formatDate(row.original.dueDate),
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
          <InvoiceStatusBadge status={row.original.status} />
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
          searchValue: (row: InvoiceListRow) =>
            String(row.total) + " " + row.currency,
        },
        cell: ({ row }) =>
          formatCurrency(row.original.total, row.original.currency),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => (
          <span className="sr-only">Actions</span>
        ),
        meta: {
          searchable: false,
          thClassName: "w-[120px] text-right",
          tdClassName: "text-right",
        },
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/app/invoices/${row.original.id}`)
                }
              >
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [router],
  );

  const invoiceSubtitle =
    "Bill customers and stay on top of what’s paid, pending, or overdue.";

  // UI skeletons/empty
  if (isLoading && rows.length === 0) {
    return (
      <AppPageShell
        subtitle={invoiceSubtitle}
        actions={
          <Button
            onClick={() => router.push("/app/invoices/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        }
      >
        <Card className="p-6">
          <InvoiceTableSkeleton />
        </Card>
      </AppPageShell>
    );
  }

  // ✅ show first-time empty state ONLY when there is truly no data and no filters
  if (!isLoading && total === 0 && !hasActiveFilters) {
    return (
      <AppPageShell
        subtitle={invoiceSubtitle}
        actions={
          <Button
            onClick={() => router.push("/app/invoices/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        }
      >
        <InvoiceEmptyState />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      subtitle={invoiceSubtitle}
      actions={
        <Button
          onClick={() => router.push("/app/invoices/new")}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Invoice
        </Button>
      }
    >
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Total Paid</div>
          <div className="mt-1 text-xl font-bold">
            {formatCurrency(totalPaidAmount, currencyForSummary)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Total Overdue</div>
          <div className="mt-1 text-xl font-bold">
            {formatCurrency(totalOverdueAmount, currencyForSummary)}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <DataTable
          columns={columns}
          data={rows}
          manualFiltering
          searchPlaceholder="Search by invoice # or client…"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          toolbarLeft={
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as InvoiceStatus | "all")
              }
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          }
          getRowId={(r) => r.id}
          emptyMessage={
            hasActiveFilters ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div>No invoices match your current filters.</div>
                <div className="text-xs text-muted-foreground">
                  Try adjusting search or status.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setPeriodFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              "No invoices to display."
            )
          }
          footer={
            <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Rows per page:
                </span>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(v) => setItemsPerPage(Number(v))}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          }
        />
      </Card>
    </AppPageShell>
  );
}
