"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  MoreVertical,
  Eye,
  Trash2,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  deleteExpense,
  listExpenses,
  type ExpenseRow,
} from "@/lib/expenses-service";
import { AppPageShell } from "@/components/app-page-shell";

export default function ExpensesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  async function load() {
    try {
      setLoading(true);
      const result = await listExpenses({
        search: searchQuery,
        page,
        pageSize,
      });
      setExpenses(result.rows);
      setTotal(result.total);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Failed to load expenses",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [searchQuery, page, pageSize]);

  // Debounce search input for smoother filtering
  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput, pageSize]);

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      toast({
        title: "Expense deleted",
        description: "Expense has been removed successfully.",
      });
      if (expenses.length === 1 && page > 1) setPage((p) => p - 1);
      else await load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Delete failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const totalExpenseAmount = useMemo(
    () => expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0),
    [expenses]
  );
  const currencyForSummary = expenses[0]?.currency ?? "MUR";

  return (
    <AppPageShell
      subtitle="Record money going out—search and review spending whenever you reconcile."
      actions={
        <Button onClick={() => router.push("/app/expenses/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      }
    >
      {!loading && (
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Total Expenses</div>
          <div className="mt-1 text-xl font-bold">
            {currencyForSummary}{" "}
            {totalExpenseAmount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex gap-3">
              <div className="h-9 flex-1 bg-muted rounded animate-pulse" />
              <div className="h-9 w-32 bg-muted rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by description..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Description</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3">
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                  </td>
                  <td className="p-3">
                    <div className="h-5 w-40 bg-muted rounded animate-pulse" />
                  </td>
                  <td className="p-3 text-right">
                    <div className="h-5 w-20 bg-muted rounded animate-pulse ml-auto" />
                  </td>
                  <td className="p-3 text-right">
                    <div className="h-8 w-8 bg-muted rounded ml-auto animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Description</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">
                    {e.expense_date
                      ? new Date(e.expense_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="p-3 font-medium">{e.description}</td>
                  <td className="p-3 text-right font-medium">
                    {e.currency} {Number(e.amount).toFixed(2)}
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/app/expenses/${e.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirmDeleteId(e.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-8 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-10 w-10" />
                      {searchQuery
                        ? "No matching expenses. Try a different search."
                        : "No expenses yet. Add your first one!"}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing <span className="font-medium text-foreground">{start}</span>–
            <span className="font-medium text-foreground">{end}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span>
              Page <span className="font-medium text-foreground">{page}</span> /{" "}
              {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={() => setConfirmDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmDeleteId && handleDelete(confirmDeleteId)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
