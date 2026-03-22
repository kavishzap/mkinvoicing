"use client";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  Copy,
  FileText,
} from "lucide-react";
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
import { SalesOrderStatusBadge } from "@/components/sales-order-status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  listSalesOrders,
  deleteSalesOrder,
  type SalesOrderListRow,
  type SalesOrderStatus,
} from "@/lib/sales-orders-service";

export default function SalesOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<SalesOrderListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | "all">(
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
        const { rows, total } = await listSalesOrders({
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
            title: "Failed to load sales orders",
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

  const handleDuplicate = (id: string) => {
    router.push(`/app/sales-orders/new?duplicate=${encodeURIComponent(id)}`);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteSalesOrder(deleteId);
      toast({ title: "Sales order deleted" });
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

  if (isLoading && rows.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales Orders</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage sales orders
            </p>
          </div>
          <Button
            onClick={() => router.push("/app/sales-orders/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Sales Order
          </Button>
        </div>
        <Card className="p-6">
          <div className="h-40 rounded bg-muted animate-pulse" />
        </Card>
      </div>
    );
  }

  if (!isLoading && total === 0 && !hasActiveFilters) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales Orders</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage sales orders
            </p>
          </div>
          <Button
            onClick={() => router.push("/app/sales-orders/new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Sales Order
          </Button>
        </div>
        <Card className="p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium text-foreground mb-2">
            No sales orders yet
          </p>
          <p className="mb-4">Create your first sales order to get started.</p>
          <Button onClick={() => router.push("/app/sales-orders/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Sales Order
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Orders</h1>
          <p className="text-muted-foreground mt-1">
            Create, view, edit, and delete sales orders
          </p>
        </div>
        <Button
          onClick={() => router.push("/app/sales-orders/new")}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Sales Order
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by order # or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as SalesOrderStatus | "all")}
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
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
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
                        <div>No sales orders match your filters.</div>
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
                      "No sales orders."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((so) => (
                  <TableRow key={so.id}>
                    <TableCell className="font-medium">{so.number}</TableCell>
                    <TableCell>{so.clientName || "—"}</TableCell>
                    <TableCell>{formatDate(so.issueDate)}</TableCell>
                    <TableCell>{formatDate(so.validUntil)}</TableCell>
                    <TableCell>
                      <SalesOrderStatusBadge status={so.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(so.total, so.currency)}
                    </TableCell>
                    <TableCell className="text-right">
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
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/app/sales-orders/${so.id}/edit`)
                            }
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(so.id)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate (prefill new)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/app/invoices/new?convertFromSalesOrder=${encodeURIComponent(so.id)}`
                              )
                            }
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Convert to Invoice
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(so.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
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
    </div>
  );
}
