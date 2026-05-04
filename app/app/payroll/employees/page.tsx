"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowLeft,
  Wallet,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { AppPageShell } from "@/components/app-page-shell";
import {
  listEmployees,
  deleteEmployee,
  type EmployeeRow,
} from "@/lib/employees-service";
import {
  listAdvancesByEmployee,
  addAdvance,
  type EmployeeAdvanceRow,
} from "@/lib/employee-advances-service";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "MUR" }).format(amount);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PayrollEmployeesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isAdvancesDialogOpen, setIsAdvancesDialogOpen] = useState(false);
  const [advancesEmployee, setAdvancesEmployee] = useState<EmployeeRow | null>(null);
  const [advances, setAdvances] = useState<EmployeeAdvanceRow[]>([]);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceDeduction, setAdvanceDeduction] = useState("");
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [addingAdvance, setAddingAdvance] = useState(false);

  const reload = useCallback(async () => {
    const { rows: r, total: t } = await listEmployees({
      search: searchQuery,
      includeInactive,
      page,
      pageSize,
    });
    setRows(r);
    setTotal(t);
  }, [searchQuery, includeInactive, page, pageSize]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await reload();
      } catch (e) {
        toast({
          title: "Failed to load employees",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast, reload]);

  useEffect(() => setPage(1), [searchQuery, includeInactive, pageSize]);

  async function handleDelete(id: string) {
    try {
      await deleteEmployee(id);
      toast({ title: "Employee deleted" });
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else await reload();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
    setConfirmDeleteId(null);
  }

  async function openAdvancesDialog(emp: EmployeeRow) {
    setAdvancesEmployee(emp);
    setAdvanceAmount("");
    setAdvanceDeduction("");
    setAdvanceNotes("");
    try {
      const list = await listAdvancesByEmployee(emp.id);
      setAdvances(list);
    } catch {
      setAdvances([]);
    }
    setIsAdvancesDialogOpen(true);
  }

  async function handleAddAdvance() {
    if (!advancesEmployee) return;
    const amt = Number(advanceAmount);
    const ded = Number(advanceDeduction);
    if (!amt || amt <= 0) {
      toast({ title: "Enter valid amount", variant: "destructive" });
      return;
    }
    if (!ded || ded <= 0 || ded > amt) {
      toast({ title: "Enter valid deduction per period", variant: "destructive" });
      return;
    }
    try {
      setAddingAdvance(true);
      await addAdvance({
        employee_id: advancesEmployee.id,
        amount: amt,
        deduction_per_period: ded,
        notes: advanceNotes || undefined,
      });
      toast({ title: "Advance added" });
      const list = await listAdvancesByEmployee(advancesEmployee.id);
      setAdvances(list);
      setAdvanceAmount("");
      setAdvanceDeduction("");
      setAdvanceNotes("");
    } catch (e) {
      toast({
        title: "Failed to add advance",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingAdvance(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <AppPageShell
      leading={
        <Link href="/app/payroll">
          <Button variant="ghost" size="icon" aria-label="Back to payroll">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Add or edit employees, set salaries, and manage advances for payroll runs."
      actions={
        <Button asChild className="gap-2">
          <Link href="/app/payroll/employees/new">
            <Plus className="h-4 w-4" />
            Add Employee
          </Link>
        </Button>
      }
    >
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Include inactive
            </label>
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

      {loading ? (
        <div className="h-64 rounded-md border bg-muted/30 animate-pulse" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Position</th>
                <th className="text-left p-3">Basic Salary</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.full_name}</td>
                  <td className="p-3">{r.position || "—"}</td>
                  <td className="p-3">{formatCurrency(r.basic_salary)}</td>
                  <td className="p-3">
                    <span
                      className={
                        r.status === "active"
                          ? "inline-flex px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs"
                          : "inline-flex px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/app/payroll/employees/${r.id}/edit`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAdvancesDialog(r)}>
                          <Wallet className="h-4 w-4 mr-2" />
                          Advances
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirmDeleteId(r.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {searchQuery
                      ? "No matches. Try a different search."
                      : "No employees yet. Add your first one!"}
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
            Showing {start}–{end} of {total}
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
              Page {page} / {pages}
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

      {/* Advances Dialog */}
      <Dialog open={isAdvancesDialogOpen} onOpenChange={setIsAdvancesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salary Advances</DialogTitle>
            <DialogDescription>
              {advancesEmployee?.full_name} — Add or view advances to deduct from payroll
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (Rs)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="e.g. 5000"
                />
              </div>
              <div>
                <Label>Deduct per period (Rs)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={advanceDeduction}
                  onChange={(e) => setAdvanceDeduction(e.target.value)}
                  placeholder="e.g. 1000"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={advanceNotes}
                onChange={(e) => setAdvanceNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <Button
              size="sm"
              onClick={handleAddAdvance}
              disabled={addingAdvance}
              className="gap-2"
            >
              {addingAdvance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Advance
            </Button>
            <div>
              <p className="text-sm font-medium mb-2">Existing advances</p>
              {advances.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {advances.map((a) => (
                    <div
                      key={a.id}
                      className="flex justify-between items-center p-2 rounded border text-sm"
                    >
                      <span>
                        {formatCurrency(a.amount)} — {formatCurrency(a.deduction_per_period)}/period
                      </span>
                      <span className="text-muted-foreground">
                        {a.status === "active"
                          ? `${formatCurrency(a.amount - a.amount_deducted)} left`
                          : "Fully deducted"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdvancesDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Are you sure? This will remove the employee from payroll. Advances and past payslips
              are not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
