"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  LayoutList,
  ListOrdered,
  Loader2,
  Tags,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportTabSkeleton } from "@/components/page-skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  getExpenseReportData,
  type ExpenseReportData,
  type ExpenseReportFilters,
} from "@/lib/expense-report-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { generateExpenseReportPDF } from "@/lib/expense-report-pdf";
import { ReportPeriodTabs } from "@/components/report-period-tabs";
import {
  REPORT_TONE,
  ReportLineGrid,
  ReportTableSection,
} from "@/components/report-table-section";
import type { ReportTabExportProps } from "@/components/report-tab-export";

type ReportRange = "monthly" | "yearly" | "custom";

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDateRange(
  range: ReportRange,
  customStart?: string,
  customEnd?: string
): { start: string; end: string } {
  const today = new Date();
  const y = today.getFullYear();
  if (range === "monthly") {
    const start = new Date(y, today.getMonth(), 1);
    return { start: toLocalDateStr(start), end: toLocalDateStr(today) };
  }
  if (range === "yearly") {
    return {
      start: toLocalDateStr(new Date(y, 0, 1)),
      end: toLocalDateStr(new Date(y, 11, 31)),
    };
  }
  return {
    start: customStart || toLocalDateStr(today),
    end: customEnd || toLocalDateStr(today),
  };
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ExpenseReportTab({ onExportReady }: ReportTabExportProps) {
  const { toast } = useToast();
  const [range, setRange] = useState<ReportRange>("yearly");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [data, setData] = useState<ExpenseReportData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const { start, end } = getDateRange(range, customStart, customEnd);

  const loadReport = useCallback(async () => {
    if (range === "custom" && customStart > customEnd) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const filters: ExpenseReportFilters = {
        startDate: start,
        endDate: end,
      };
      const result = await getExpenseReportData(filters);
      setData(result);
    } catch (e: unknown) {
      toast({
        title: "Failed to load report",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [start, end, range, customStart, customEnd, toast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    fetchProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  const handleDownload = useCallback(async () => {
    if (!data) return;
    if (range === "custom" && customStart > customEnd) {
      toast({
        title: "Invalid date range",
        description: "Start date must be before or equal to end date.",
        variant: "destructive",
      });
      return;
    }
    setDownloading(true);
    try {
      const companyName = profile?.companyName || profile?.fullName || "Your Company";
      await generateExpenseReportPDF({ ...data, companyName }, profile);
      toast({
        title: "Report downloaded",
        description: "Your expense report has been downloaded successfully.",
      });
    } catch (e: unknown) {
      toast({
        title: "Failed to generate PDF",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  }, [data, range, customStart, customEnd, profile, toast]);

  useEffect(() => {
    onExportReady?.({
      exportPdf: handleDownload,
      exporting: downloading,
      canExport: !!data && !downloading,
    });
  }, [onExportReady, handleDownload, downloading, data]);

  const periodOptions = [
    { value: "monthly" as const, label: "Monthly" },
    { value: "yearly" as const, label: "Yearly" },
    { value: "custom" as const, label: "Custom range" },
  ];

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-3">
          <Label>Report period</Label>
          <ReportPeriodTabs
            value={range}
            onChange={setRange}
            options={periodOptions}
          />
        </div>

        {range === "custom" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expense-start">Start date</Label>
              <Input
                id="expense-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-end">End date</Label>
              <Input
                id="expense-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}

          {loading ? (
            <ReportTabSkeleton />
          ) : data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{formatCurrency(data.totalExpenses, data.currency)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Expense Count</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{data.expenseCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Average Daily Expense</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {formatCurrency(data.averageDailyExpense, data.currency)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4 text-sm">
                <ReportTableSection title="Summary" icon={LayoutList} tone="sky">
                  <ReportLineGrid
                    lines={[
                      {
                        label: "Total Expenses",
                        value: formatCurrency(data.totalExpenses, data.currency),
                      },
                      {
                        label: "Expense Count",
                        value: String(data.expenseCount),
                      },
                      {
                        label: "Average Daily Expense",
                        value: formatCurrency(data.averageDailyExpense, data.currency),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>

                <ReportTableSection
                  title="Expenses by Category"
                  icon={Tags}
                  tone="violet"
                  count={data.byCategory.length}
                >
                  {data.byCategory.length === 0 ? (
                    <p className="px-4 py-6 text-xs text-muted-foreground">
                      No category data
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className={REPORT_TONE.violet.headerRow}>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.byCategory.map((row) => (
                            <TableRow key={row.category}>
                              <TableCell className="font-medium">
                                {row.category}
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                                {formatCurrency(row.amount, data.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </ReportTableSection>

                <ReportTableSection
                  title="Expense Timeline"
                  icon={CalendarDays}
                  tone="indigo"
                  count={data.timeline.length}
                >
                  {data.timeline.length === 0 ? (
                    <p className="px-4 py-6 text-xs text-muted-foreground">
                      No timeline data
                    </p>
                  ) : (
                    <div className="max-h-[200px] overflow-x-auto overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-10">
                          <TableRow className={REPORT_TONE.indigo.headerRow}>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.timeline.map((row) => (
                            <TableRow key={row.date}>
                              <TableCell className="tabular-nums">
                                {formatDate(row.date)}
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                                {formatCurrency(row.amount, data.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </ReportTableSection>

                <ReportTableSection
                  title="Detailed Expense List"
                  icon={ListOrdered}
                  tone="amber"
                  count={data.expenses.length}
                  defaultOpen={false}
                >
                  {data.expenses.length === 0 ? (
                    <p className="px-4 py-6 text-xs text-muted-foreground">
                      No expenses
                    </p>
                  ) : (
                    <div className="max-h-[300px] overflow-x-auto overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-10">
                          <TableRow className={REPORT_TONE.amber.headerRow}>
                            <TableHead>Ref No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.expenses.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium">{e.refNo}</TableCell>
                              <TableCell className="tabular-nums">
                                {formatDate(e.date)}
                              </TableCell>
                              <TableCell>{e.description}</TableCell>
                              <TableCell className="text-right font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                                {formatCurrency(e.amount, data.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </ReportTableSection>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {range === "custom" && customStart > customEnd
                ? "Select a valid date range."
                : "No expense data for the selected period yet."}
            </p>
          )}

      </CardContent>
    </Card>
  );
}
