"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  FileDown,
  Loader2,
  CheckCircle2,
  Banknote,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPayrollRun,
  markPayslipPaid,
  type PayrollRunWithPayslips,
  type PayslipWithEmployee,
} from "@/lib/payroll-runs-service";
import { fetchProfile } from "@/lib/settings-service";
import { generatePayslipPDF } from "@/lib/payslip-pdf";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "MUR" }).format(amount);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PAYMENT_METHODS = ["Cash", "Card Payment", "Bank Transfer"] as const;

export default function PayrollRunDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PayrollRunWithPayslips | null>(null);
  const [profile, setProfile] = useState<{ companyName?: string; fullName?: string; logoUrl?: string } | null>(null);

  const [markingPaidPayslip, setMarkingPaidPayslip] = useState<PayslipWithEmployee | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card Payment" | "Bank Transfer">("Bank Transfer");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [creatingExpense, setCreatingExpense] = useState(true);
  const [saving, setSaving] = useState(false);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const run = await getPayrollRun(id);
    setData(run);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await reload();
      } catch (e) {
        toast({
          title: "Failed to load payroll run",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast, reload]);

  useEffect(() => {
    fetchProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  async function handleMarkPaid() {
    if (!markingPaidPayslip || !data) return;
    try {
      setSaving(true);
      await markPayslipPaid(markingPaidPayslip.id, {
        payment_method: paymentMethod,
        payment_date: paymentDate,
        create_expense: creatingExpense,
      });
      toast({
        title: "Marked as paid",
        description: creatingExpense ? "Expense created and linked." : undefined,
      });
      setMarkingPaidPayslip(null);
      await reload();
    } catch (e) {
      toast({
        title: "Failed to mark paid",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPayslip(ps: PayslipWithEmployee) {
    if (!data) return;
    try {
      setDownloadingId(ps.id);
      await generatePayslipPDF(ps, data.month, data.year, profile);
      toast({ title: "Payslip downloaded" });
    } catch (e) {
      toast({
        title: "Failed to download",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Payroll run not found.</p>
        <Button variant="link" asChild>
          <Link href="/app/payroll/runs">Back to runs</Link>
        </Button>
      </div>
    );
  }

  const unpaidCount = data.payslips.filter((p) => p.payment_status === "unpaid").length;
  const paidCount = data.payslips.length - unpaidCount;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/payroll/runs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {MONTH_NAMES[data.month - 1]} {data.year}
            </h1>
            <p className="text-muted-foreground mt-1">
              {data.payslips.length} payslip(s) · {paidCount} paid · {unpaidCount} unpaid
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Gross</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(data.total_gross)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(data.total_deductions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Net</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(data.total_net)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
          <CardDescription>Mark as paid to create expense and track payment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Employee</th>
                  <th className="text-left p-3">Position</th>
                  <th className="text-right p-3">Gross</th>
                  <th className="text-right p-3">Deductions</th>
                  <th className="text-right p-3">Net</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.payslips.map((ps) => (
                  <tr key={ps.id} className="border-t">
                    <td className="p-3 font-medium">{ps.employee.full_name}</td>
                    <td className="p-3">{ps.employee.position || "—"}</td>
                    <td className="p-3 text-right">{formatCurrency(ps.gross_salary)}</td>
                    <td className="p-3 text-right">{formatCurrency(ps.total_deductions)}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(ps.net_salary)}</td>
                    <td className="p-3">
                      {ps.payment_status === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs">
                          Unpaid
                        </span>
                      )}
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
                            onClick={() => handleDownloadPayslip(ps)}
                            disabled={!!downloadingId}
                          >
                            {downloadingId === ps.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <FileDown className="h-4 w-4 mr-2" />
                            )}
                            Download PDF
                          </DropdownMenuItem>
                          {ps.payment_status === "unpaid" && (
                            <DropdownMenuItem onClick={() => setMarkingPaidPayslip(ps)}>
                              <Banknote className="h-4 w-4 mr-2" />
                              Mark as paid
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mark as paid dialog */}
      <Dialog open={!!markingPaidPayslip} onOpenChange={() => setMarkingPaidPayslip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as paid</DialogTitle>
            <DialogDescription>
              {markingPaidPayslip?.employee.full_name} — {formatCurrency(markingPaidPayslip?.net_salary ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={creatingExpense}
                onChange={(e) => setCreatingExpense(e.target.checked)}
              />
              <span className="text-sm">Create expense (for P&amp;L / reports)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkingPaidPayslip(null)}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={saving}>
              {saving ? "Saving…" : "Mark paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
