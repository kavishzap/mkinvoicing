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
  ShoppingCart,
  FileText,
} from "lucide-react";
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
import { QuotationStatusBadge } from "@/components/quotation-status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  listQuotations,
  deleteQuotation,
  type QuotationListRow,
  type QuotationStatus,
} from "@/lib/quotations-service";
import { AppPageShell } from "@/components/app-page-shell";

export default function QuotationsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<QuotationListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "all">(
    "all"
  );
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hasActiveFilters = useMemo(
    () => searchQuery.trim() !== "" || statusFilter !== "all",
    [searchQuery, statusFilter]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const { rows, total } = await listQuotations({
          search: searchQuery,
          status: statusFilter,
          page: currentPage,
          pageSize: itemsPerPage,
        });
        if (!cancelled) {
          setRows(rows);
          setTotal(total);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Failed to load quotations",
            description: e instanceof Error ? e.message : "Please try again.",
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
  }, [searchQuery, statusFilter, currentPage, itemsPerPage, toast]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

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

  const handleDuplicate = useCallback(
    (id: string) => {
      router.push(`/app/quotations/new?duplicate=${encodeURIComponent(id)}`);
    },
    [router],
  );

  const columns = useMemo<ColumnDef<QuotationListRow>[]>(
    () => [
      {
        id: "number",
        accessorFn: (r) => r.number,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Quotation #" />
        ),
        meta: {
          searchValue: (row: QuotationListRow) =>
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
          searchValue: (row: QuotationListRow) => row.clientName ?? "",
        },
        cell: ({ row }) => row.original.clientName || "—",
      },
      {
        id: "issueDate",
        accessorFn: (r) => new Date(r.issueDate).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Issue Date" />
        ),
        meta: { searchValue: (row: QuotationListRow) => row.issueDate },
        cell: ({ row }) => formatDate(row.original.issueDate),
      },
      {
        id: "validUntil",
        accessorFn: (r) => new Date(r.validUntil).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Valid Until" />
        ),
        meta: { searchValue: (row: QuotationListRow) => row.validUntil },
        cell: ({ row }) => formatDate(row.original.validUntil),
      },
      {
        id: "status",
        accessorFn: (r) => r.status,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        meta: { searchValue: (row: QuotationListRow) => row.status },
        cell: ({ row }) => (
          <QuotationStatusBadge status={row.original.status} />
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
          searchValue: (row: QuotationListRow) =>
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
          const q = row.original;
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
                  onClick={() => router.push(`/app/quotations/${q.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/app/quotations/${q.id}/edit`)
                  }
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDuplicate(q.id)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate (prefill new)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(
                      `/app/sales-orders/new?convertFromQuotation=${encodeURIComponent(q.id)}`,
                    )
                  }
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Convert to Sales Order
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(
                      `/app/invoices/new?convertFromQuotation=${encodeURIComponent(q.id)}`,
                    )
                  }
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Convert to Invoice
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteId(q.id)}
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
      await deleteQuotation(deleteId);
      toast({ title: "Quotation deleted" });
      setRows((r) => r.filter((x) => x.id !== deleteId));
      setTotal((t) => Math.max(0, t - 1));
      setDeleteId(null);
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

  const quotationSubtitle =
    "Send price proposals before you invoice—convert accepted quotes to orders or invoices when you’re ready.";

  if (isLoading && rows.length === 0) {
    return (
      <AppPageShell
        subtitle={quotationSubtitle}
        actions={
          <Button
            onClick={() => router.push("/app/quotations/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Quotation
          </Button>
        }
      >
        <Card className="p-6">
          <div className="h-40 rounded bg-muted animate-pulse" />
        </Card>
      </AppPageShell>
    );
  }

  if (!isLoading && total === 0 && !hasActiveFilters) {
    return (
      <AppPageShell
        subtitle={quotationSubtitle}
        actions={
          <Button
            onClick={() => router.push("/app/quotations/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Quotation
          </Button>
        }
      >
        <Card className="p-12 text-center text-muted-foreground">
          <p className="text-base font-medium text-foreground mb-2">
            No quotations yet
          </p>
          <p className="mb-4">Create your first quotation to get started.</p>
          <Button onClick={() => router.push("/app/quotations/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Quotation
          </Button>
        </Card>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      subtitle={quotationSubtitle}
      actions={
        <Button
          onClick={() => router.push("/app/quotations/new")}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Quotation
        </Button>
      }
    >
      <Card className="p-6">
        <DataTable
          columns={columns}
          data={rows}
          manualFiltering
          searchPlaceholder="Search by quotation # or client…"
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          toolbarLeft={
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as QuotationStatus | "all")
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          }
          getRowId={(r) => r.id}
          emptyMessage={
            hasActiveFilters ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div>No quotations match your filters.</div>
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
              </div>
            ) : (
              "No quotations."
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quotation?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The quotation and its line items will be
              removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
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
