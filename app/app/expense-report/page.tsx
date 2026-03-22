"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function ExpenseReportPage() {
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

  const handleDownload = async () => {
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
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/app/reportings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expense Report</h1>
            <p className="text-muted-foreground mt-1">
              Total expenses, breakdown by category, and detailed expense list
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={handleDownload}
          disabled={!data || downloading}
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting…
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Export PDF
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download Report</CardTitle>
          <CardDescription>
            Export as PDF. All expenses in the period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Report period</Label>
            <div className="flex flex-wrap gap-2">
              {(["monthly", "yearly", "custom"] as const).map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={range === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRange(r)}
                >
                  {r === "monthly" ? "Monthly" : r === "yearly" ? "Yearly" : "Custom range"}
                </Button>
              ))}
            </div>
          </div>

          {range === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start date</Label>
                <Input
                  id="start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End date</Label>
                <Input
                  id="end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(data.totalExpenses, data.currency)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Expense Count</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{data.expenseCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Average Daily Expense</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {formatCurrency(data.averageDailyExpense, data.currency)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Expense Report</CardTitle>
                  <CardDescription>
                    Same content as the PDF export for the selected period.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-sm">
                  {/* Summary */}
                  <div>
                    <p className="font-semibold mb-2">Summary</p>
                    <div className="grid grid-cols-2 gap-2">
                      <span>Total Expenses</span>
                      <span className="text-right">
                        {data.currency}{" "}
                        {data.totalExpenses.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span>Expense Count</span>
                      <span className="text-right">{data.expenseCount}</span>
                      <span>Average Daily Expense</span>
                      <span className="text-right">
                        {data.currency}{" "}
                        {data.averageDailyExpense.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Expenses by Category */}
                  <div>
                    <p className="font-semibold mb-2">Expenses by Category</p>
                    {data.byCategory.length === 0 ? (
                      <p className="text-muted-foreground text-xs">No category data</p>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.byCategory.map((row) => (
                              <TableRow key={row.category}>
                                <TableCell className="font-medium">{row.category}</TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(row.amount, data.currency)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Expense Timeline */}
                  <div>
                    <p className="font-semibold mb-2">Expense Timeline</p>
                    {data.timeline.length === 0 ? (
                      <p className="text-muted-foreground text-xs">No timeline data</p>
                    ) : (
                      <div className="rounded-md border overflow-x-auto max-h-[200px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.timeline.map((row) => (
                              <TableRow key={row.date}>
                                <TableCell>{formatDate(row.date)}</TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(row.amount, data.currency)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Detailed Expense List */}
                  <div>
                    <p className="font-semibold mb-2">Detailed Expense List</p>
                    {data.expenses.length === 0 ? (
                      <p className="text-muted-foreground text-xs">No expenses</p>
                    ) : (
                      <div className="rounded-md border overflow-x-auto max-h-[300px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
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
                                <TableCell>{formatDate(e.date)}</TableCell>
                                <TableCell>{e.description}</TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(e.amount, data.currency)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {range === "custom" && customStart > customEnd
                ? "Select a valid date range."
                : "No expense data for the selected period yet."}
            </p>
          )}

          <Button
            className="gap-2"
            onClick={handleDownload}
            disabled={!data || downloading}
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Download PDF Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
