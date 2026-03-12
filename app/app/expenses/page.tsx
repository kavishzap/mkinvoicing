"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  addExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
  type ExpenseLineItem,
  type ExpensePayload,
  type ExpenseRow,
} from "@/lib/expenses-service";
import { getExpenseOverTime } from "@/lib/dashboard-service";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

type LineItemRow = { id: string; item: string; price: number };

const CURRENCIES = ["MUR", "USD", "EUR", "GBP"] as const;

const chartConfig = {
  expense: {
    label: "Expense",
    color: "hsl(0, 84%, 60%)",
  },
} satisfies ChartConfig;

function emptyLineItems(): LineItemRow[] {
  return [{ id: "1", item: "", price: 0 }];
}

function toPayload(
  lineItems: LineItemRow[],
  currency: string,
  expense_date: string,
  notes: string,
  description: string
): ExpensePayload {
  const items: ExpenseLineItem[] = lineItems
    .filter((li) => li.item.trim() || li.price > 0)
    .map((li) => ({ item: li.item.trim(), price: Number(li.price) || 0 }));
  const amount = items.reduce((s, li) => s + li.price, 0);
  const resolvedDescription =
    description.trim() || items[0]?.item || "Expense";
  return {
    description: resolvedDescription,
    amount,
    currency,
    expense_date,
    line_items: items.length ? items : [{ item: "Expense", price: 0 }],
    notes: notes.trim() || null,
  };
}

export default function ExpensesPage() {
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [lineItems, setLineItems] = useState<LineItemRow[]>(emptyLineItems());
  const [currency, setCurrency] = useState("MUR");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ lineItems?: string }>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chartData, setChartData] = useState<
    { month: string; label: string; expense: number }[]
  >([]);

  async function loadChart() {
    try {
      const data = await getExpenseOverTime();
      setChartData(data);
    } catch {
      // ignore chart errors
    }
  }

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

  useEffect(() => {
    loadChart();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize]);

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: String(Date.now()), item: "", price: 0 },
    ]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) =>
      prev.length > 1 ? prev.filter((li) => li.id !== id) : prev
    );
  }

  function updateLineItem(
    id: string,
    field: "item" | "price",
    value: string | number
  ) {
    setLineItems((prev) =>
      prev.map((li) =>
        li.id === id ? { ...li, [field]: value } : li
      )
    );
  }

  function handleOpenDialog(expense?: ExpenseRow) {
    if (expense?.line_items?.length) {
      setEditingExpense(expense);
      setDescription(expense.description ?? "");
      setLineItems(
        expense.line_items.map((li, i) => ({
          id: String(i + 1),
          item: li.item,
          price: li.price,
        }))
      );
    } else if (expense) {
      setEditingExpense(expense);
      setDescription(expense.description ?? "");
      setLineItems([
        { id: "1", item: "", price: expense.amount || 0 },
      ]);
    } else {
      setEditingExpense(null);
      setDescription("");
      setLineItems(emptyLineItems());
    }
    setCurrency(expense?.currency ?? "MUR");
    setExpenseDate(
      expense?.expense_date ?? new Date().toISOString().slice(0, 10)
    );
    setNotes(expense?.notes ?? "");
    setErrors({});
    setIsDialogOpen(true);
  }

  function validate(): boolean {
    const valid = lineItems.some(
      (li) => li.item.trim() || (li.price && li.price > 0)
    );
    if (!valid) {
      setErrors({ lineItems: "Add at least one line item with item and price" });
      return false;
    }
    setErrors({});
    return true;
  }

  async function handleSave() {
    if (!validate()) return;

    try {
      setSaving(true);
      const payload = toPayload(
        lineItems,
        currency,
        expenseDate,
        notes,
        description
      );
      if (editingExpense) {
        await updateExpense(editingExpense.id, payload);
        toast({
          title: "Expense updated",
          description: "Expense has been updated successfully.",
        });
      } else {
        await addExpense(payload);
        toast({
          title: "Expense added",
          description: "New expense has been added successfully.",
        });
      }
      await load();
      loadChart();
      setIsDialogOpen(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Save failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      toast({
        title: "Expense deleted",
        description: "Expense has been removed successfully.",
      });
      if (expenses.length === 1 && page > 1) setPage((p) => p - 1);
      else await load();
      loadChart();
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your expenses
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {!loading && (
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Total Expenses</div>
          <div className="mt-1 text-2xl font-bold">
            {currencyForSummary}{" "}
            {totalExpenseAmount.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expenses Over Time</CardTitle>
          <p className="text-sm text-muted-foreground">
            Monthly expenses (Jan–Dec, current year)
          </p>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={chartData} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v) =>
                    currencyForSummary + " " + (v >= 1000 ? v / 1000 + "k" : v)
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) =>
                        currencyForSummary +
                        " " +
                        Number(value).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      }
                    />
                  }
                />
                <Bar
                  dataKey="expense"
                  fill="var(--color-expense)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No expense data yet
            </div>
          )}
        </CardContent>
      </Card>

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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                        <DropdownMenuItem onClick={() => handleOpenDialog(e)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? "Update expense details"
                : "Add a new expense to track"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="exp-description">Description</Label>
              <Input
                id="exp-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Office supplies, Travel"
              />
            </div>
            {errors.lineItems && (
              <p className="text-xs text-destructive">{errors.lineItems}</p>
            )}
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Item *</th>
                    <th className="text-right p-2 w-28">Price *</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li) => (
                    <tr key={li.id} className="border-t">
                      <td className="p-2">
                        <Input
                          value={li.item}
                          onChange={(e) =>
                            updateLineItem(li.id, "item", e.target.value)
                          }
                          placeholder="e.g. Office supplies"
                          className="h-9"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={li.price || ""}
                          onChange={(e) =>
                            updateLineItem(
                              li.id,
                              "price",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className="h-9 text-right"
                        />
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(li.id)}
                          disabled={lineItems.length === 1}
                          className="h-9 w-9"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addLineItem}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Row
            </Button>

            <div className="pt-2 border-t">
              <p className="text-sm font-medium">
                Total: {currency}{" "}
                {lineItems
                  .reduce((s, li) => s + (Number(li.price) || 0), 0)
                  .toFixed(2)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="exp-date">Date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="exp-currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="exp-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="exp-notes">Notes</Label>
              <Input
                id="exp-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingExpense ? "Update" : "Add"} Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
