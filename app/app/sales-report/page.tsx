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
  getSalesReportData,
  type SalesReportData,
  type SalesReportFilters,
} from "@/lib/sales-report-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { generateSalesReportPDF } from "@/lib/sales-report-pdf";

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

const PAYMENT_LABELS: Record<string, string> = {
  Cash: "Cash",
  "Card Payment": "Card / Juice",
  "Credit Facilities": "Credit",
  "Bank Transfer": "Bank / Juice",
};

export default function SalesReportPage() {
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
  const [data, setData] = useState<SalesReportData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const { start, end } = getDateRange(range, customStart, customEnd);

  const loadReport = useCallback(async () => {
    if (range === "custom" && customStart > customEnd) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const filters: SalesReportFilters = {
        startDate: start,
        endDate: end,
      };
      const result = await getSalesReportData(filters);
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
      const companyName =
        profile?.companyName || profile?.fullName || "Your Company";
      await generateSalesReportPDF({ ...data, companyName }, profile);
      toast({
        title: "Report downloaded",
        description: "Your sales report has been downloaded successfully.",
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
            <h1 className="text-3xl font-bold tracking-tight">Sales Report</h1>
            <p className="text-muted-foreground mt-1">
              Total sales, paid amounts, outstanding, and breakdown by product and customer
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
            Export as PDF. All invoices in the period (excluding cancelled).
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
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Sales (Gross)</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-lg font-bold break-words">
                      {formatCurrency(data.totalSalesGross, data.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Discounts</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-lg font-bold break-words">
                      {formatCurrency(data.totalDiscounts, data.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Tax Collected</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-lg font-bold break-words">
                      {formatCurrency(data.totalTaxCollected, data.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Net Sales</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-lg font-bold break-words">
                      {formatCurrency(data.netSales, data.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Money In (Paid)</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 break-words">
                      {formatCurrency(data.totalPaid, data.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Money Pending</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400 break-words">
                      {formatCurrency(data.outstanding, data.currency)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Sales Report</CardTitle>
                  <CardDescription>
                    Same content as the PDF export for the selected period.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-sm">
                  {/* Summary */}
                  <div>
                    <p className="font-semibold mb-2">Summary</p>
                    <div className="grid grid-cols-2 gap-2">
                      <span>Total Sales (Gross)</span>
                      <span className="text-right">
                        {data.currency}{" "}
                        {data.totalSalesGross.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span>Total Discounts</span>
                      <span className="text-right">
                        {data.currency}{" "}
                        {data.totalDiscounts.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span>Total Tax Collected</span>
                      <span className="text-right">
                        {data.currency}{" "}
                        {data.totalTaxCollected.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span>Net Sales</span>
                      <span className="text-right">
                        {data.currency}{" "}
                        {data.netSales.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span>Total Paid (Money In)</span>
                      <span className="text-right">
                        {data.currency}{" "}
                        {data.totalPaid.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="font-semibold">Outstanding (Money Pending)</span>
                      <span className="text-right font-semibold">
                        {data.currency}{" "}
                        {data.outstanding.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Sales Breakdown */}
                  <div>
                    <p className="font-semibold mb-2">Sales Breakdown</p>
                    <div className="grid grid-cols-2 gap-2">
                      <span>Cash Sales</span>
                      <span className="text-right">
                        {data.currency}{" "}
                        {data.salesBreakdown.cash.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span>Credit Sales</span>
                      <span className="text-right">
                        {data.currency}{" "}
                        {data.salesBreakdown.credit.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span>Bank / Juice</span>
                      <span className="text-right">
                        {data.currency}{" "}
                        {data.salesBreakdown.bankJuice.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Sales by Product */}
                  <div>
                    <p className="font-semibold mb-2">Sales by Product</p>
                    {data.byProduct.length === 0 ? (
                      <p className="text-muted-foreground text-xs">No product data</p>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Qty Sold</TableHead>
                              <TableHead className="text-right">Unit Price</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.byProduct.map((row) => (
                              <TableRow key={row.product}>
                                <TableCell className="font-medium">{row.product}</TableCell>
                                <TableCell className="text-right">{row.qtySold}</TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(row.unitPrice, data.currency)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(row.total, data.currency)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Sales by Customer */}
                  <div>
                    <p className="font-semibold mb-2">Sales by Customer</p>
                    {data.byCustomer.length === 0 ? (
                      <p className="text-muted-foreground text-xs">No customer data</p>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Customer</TableHead>
                              <TableHead className="text-right">Total Sales</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead className="text-right">Outstanding</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.byCustomer.map((row) => (
                              <TableRow key={row.customer}>
                                <TableCell className="font-medium">{row.customer}</TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(row.totalSales, data.currency)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(row.paid, data.currency)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(row.outstanding, data.currency)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Invoice Details */}
                  <div>
                    <p className="font-semibold mb-2">Invoice Details</p>
                    <div className="rounded-md border overflow-x-auto max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.invoices.map((inv) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">{inv.number}</TableCell>
                              <TableCell>{formatDate(inv.issueDate)}</TableCell>
                              <TableCell>{inv.clientName}</TableCell>
                              <TableCell>
                                {inv.paymentMethod ? PAYMENT_LABELS[inv.paymentMethod] ?? inv.paymentMethod : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(inv.total, data.currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(inv.amountPaid, data.currency)}
                              </TableCell>
                              <TableCell>
                                {inv.amountDue > 0
                                  ? inv.amountPaid > 0
                                    ? "Partial"
                                    : "Unpaid"
                                  : "Paid"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Outstanding Invoices */}
                  {data.outstandingInvoices.length > 0 && (
                    <div>
                      <p className="font-semibold mb-2">Outstanding Invoices</p>
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invoice #</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead className="text-right">Amount Due</TableHead>
                              <TableHead>Due Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.outstandingInvoices.map((inv) => (
                              <TableRow key={inv.id}>
                                <TableCell className="font-medium">{inv.number}</TableCell>
                                <TableCell>{inv.clientName}</TableCell>
                                <TableCell className="text-right font-medium text-amber-600 dark:text-amber-400">
                                  {formatCurrency(inv.amountDue, data.currency)}
                                </TableCell>
                                <TableCell>{formatDate(inv.dueDate)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {range === "custom" && customStart > customEnd
                ? "Select a valid date range."
                : "No sales data for the selected period yet."}
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
