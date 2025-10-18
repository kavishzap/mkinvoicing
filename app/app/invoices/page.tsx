"use client";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, MoreHorizontal, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { InvoiceEmptyState } from "@/components/invoice-empty-state";
import { InvoiceTableSkeleton } from "@/components/invoice-table-skeleton";
import { useToast } from "@/hooks/use-toast";

import {
  listInvoices,
  type InvoiceListRow,
  type InvoiceStatus,
  markInvoicePaid, // ⬅️ NEW
} from "@/lib/invoices-service";

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
      .filter((r) => r.status !== "paid")
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

  async function onMarkPaid(id: string) {
    try {
      await markInvoicePaid(id);
      toast({ title: "Marked as paid" });
      await load(); // refresh the list so status/option updates
    } catch (e: any) {
      toast({
        title: "Failed to mark as paid",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  }

  // UI skeletons/empty
  if (isLoading && rows.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground mt-1">
              Manage and track your invoices
            </p>
          </div>
          <Button
            onClick={() => router.push("/app/invoices/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        </div>
        <Card className="p-6">
          <InvoiceTableSkeleton />
        </Card>
      </div>
    );
  }

  // ✅ show first-time empty state ONLY when there is truly no data and no filters
  if (!isLoading && total === 0 && !hasActiveFilters) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground mt-1">
              Manage and track your invoices
            </p>
          </div>
          <Button
            onClick={() => router.push("/app/invoices/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        </div>
        <InvoiceEmptyState />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track your invoices
          </p>
        </div>
        <Button
          onClick={() => router.push("/app/invoices/new")}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Invoice
        </Button>
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Total Paid</div>
          <div className="mt-1 text-2xl font-bold">
            {formatCurrency(totalPaidAmount, currencyForSummary)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Total Overdue</div>
          <div className="mt-1 text-2xl font-bold">
            {formatCurrency(totalOverdueAmount, currencyForSummary)}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by invoice # or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Only 'unpaid' and 'paid' are valid now */}
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as any)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">OverDue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {hasActiveFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div>No invoices match your current filters.</div>
                        <div className="text-xs">
                          Try adjusting search or status.
                        </div>
                        <div className="flex gap-2">
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
                      </div>
                    ) : (
                      <div>No invoices to display.</div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((inv) => (
                  <TableRow key={inv.id} className="group">
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>{inv.clientName}</TableCell>
                    <TableCell>{formatDate(inv.issueDate)}</TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(inv.total, inv.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/app/invoices/${inv.id}`)}
                          className="h-8 gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">View</span>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">More actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Hide "Mark as Paid" if already paid */}
                            {inv.status !== "paid" && (
                              <DropdownMenuItem
                                onClick={() => onMarkPaid(inv.id)}
                              >
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
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
      </Card>
    </div>
  );
}
