"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listPayrollRuns, runPayroll } from "@/lib/payroll-runs-service";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "MUR" }).format(amount);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PayrollRunsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<{ id: string; month: number; year: number; total_net: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const reload = useCallback(async () => {
    const { rows, total: t } = await listPayrollRuns({
      page,
      pageSize,
    });
    setRuns(rows.map((r) => ({ id: r.id, month: r.month, year: r.year, total_net: r.total_net })));
    setTotal(t);
  }, [page, pageSize]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await reload();
      } catch (e) {
        toast({
          title: "Failed to load payroll runs",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast, reload]);

  async function handleRunPayroll() {
    try {
      setRunning(true);
      const result = await runPayroll(selectedMonth, selectedYear);
      toast({
        title: "Payroll processed",
        description: `${result.payslips.length} payslip(s) generated for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}.`,
      });
      await reload();
      window.location.href = `/app/payroll/runs/${result.id}`;
    } catch (e) {
      toast({
        title: "Failed to run payroll",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <AppPageShell
      leading={
        <Link href="/app/payroll">
          <Button variant="ghost" size="icon" aria-label="Back to payroll">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Pick a month, run payroll to generate payslips, then open a run to pay staff or download PDFs."
    >
      <Card>
        <CardHeader>
          <CardTitle>Process Payroll</CardTitle>
          <CardDescription>
            Select month and year, then run payroll. Payslips will be generated for all active
            employees. Advances are deducted automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="text-sm font-medium mb-1 block">Month</label>
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(Number(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Year</label>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleRunPayroll}
            disabled={running}
            className="gap-2 shrink-0"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                Run Payroll
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll History</CardTitle>
          <CardDescription>Past payroll runs</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No payroll runs yet.
            </p>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <Link key={r.id} href={`/app/payroll/runs/${r.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50">
                    <span className="font-medium">
                      {MONTH_NAMES[r.month - 1]} {r.year}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{formatCurrency(r.total_net)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
