"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  FileDown,
  FileText,
  Loader2,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  getSalesReportData,
  type SalesReportData,
  type SalesReportFilters,
} from "@/lib/sales-report-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { generateSalesReportPDF } from "@/lib/sales-report-pdf";
import { AppPageShell } from "@/components/app-page-shell";

type ReportRange = "today" | "monthly" | "yearly" | "custom";

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
  if (range === "today") {
    const t = toLocalDateStr(today);
    return { start: t, end: t };
  }
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

/** Tailwind classes for the payment-method pill in the Invoice Details table. */
const PAYMENT_BADGE: Record<string, string> = {
  Cash: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "Card Payment":
    "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "Credit Facilities":
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "Bank Transfer":
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};

type InvoiceStatus = "paid" | "partial" | "unpaid";

function getInvoiceStatus(amountPaid: number, amountDue: number): InvoiceStatus {
  if (amountDue <= 0) return "paid";
  return amountPaid > 0 ? "partial" : "unpaid";
}

/** Per-status colors for the pill, plus a row tint so partial/unpaid stand out. */
const STATUS_BADGE: Record<
  InvoiceStatus,
  { label: string; pill: string; row: string }
> = {
  paid: {
    label: "Paid",
    pill: "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    row: "",
  },
  partial: {
    label: "Partial",
    pill: "border-amber-500/30 bg-amber-500/12 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    row: "bg-amber-50/50 dark:bg-amber-950/15",
  },
  unpaid: {
    label: "Unpaid",
    pill: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    row: "bg-rose-50/50 dark:bg-rose-950/15",
  },
};

const PILL_BASE =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none tabular-nums";

/**
 * Per-section colour scheme so the three breakdown tables are easy to tell apart
 * at a glance. Each tone styles: the card frame, the title capsule, the table
 * header row, and the small icon.
 */
type ReportTone = "sky" | "violet" | "indigo" | "amber";

const REPORT_TONE: Record<
  ReportTone,
  { card: string; pill: string; headerRow: string; icon: string }
> = {
  sky: {
    card: "border-sky-300/70 bg-sky-50/40 dark:border-sky-800/50 dark:bg-sky-950/15",
    pill: "border-sky-500/30 bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    headerRow: "bg-sky-100/70 dark:bg-sky-900/30",
    icon: "text-sky-600 dark:text-sky-300",
  },
  violet: {
    card: "border-violet-300/70 bg-violet-50/40 dark:border-violet-800/50 dark:bg-violet-950/15",
    pill: "border-violet-500/30 bg-violet-500/15 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    headerRow: "bg-violet-100/70 dark:bg-violet-900/30",
    icon: "text-violet-600 dark:text-violet-300",
  },
  indigo: {
    card: "border-indigo-300/70 bg-indigo-50/40 dark:border-indigo-800/50 dark:bg-indigo-950/15",
    pill: "border-indigo-500/30 bg-indigo-500/15 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
    headerRow: "bg-indigo-100/70 dark:bg-indigo-900/30",
    icon: "text-indigo-600 dark:text-indigo-300",
  },
  amber: {
    card: "border-amber-300/80 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/15",
    pill: "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    headerRow: "bg-amber-100/70 dark:bg-amber-900/30",
    icon: "text-amber-600 dark:text-amber-300",
  },
};

function ReportTableSection({
  title,
  icon: Icon,
  tone,
  count,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone: ReportTone;
  count?: number;
  children: React.ReactNode;
}) {
  const t = REPORT_TONE[tone];
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border-2 shadow-sm",
        t.card,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
            t.pill,
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", t.icon)} aria-hidden />
          {title}
        </span>
        {typeof count === "number" ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {count} {count === 1 ? "row" : "rows"}
          </span>
        ) : null}
      </header>
      <div className="border-t bg-card">{children}</div>
    </section>
  );
}

export default function SalesReportPage() {
  const { toast } = useToast();
  const [range, setRange] = useState<ReportRange>("today");
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
    <AppPageShell
      leading={
        <Link href="/app/reportings">
          <Button variant="ghost" size="icon" aria-label="Back to reportings">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Filter by period to see sales totals, paid vs outstanding, and product or customer breakdown—then export a PDF."
      actions={
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
      }
    >
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
              {(["today", "monthly", "yearly", "custom"] as const).map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={range === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRange(r)}
                >
                  {r === "today"
                    ? "Today"
                    : r === "monthly"
                      ? "Monthly"
                      : r === "yearly"
                        ? "Yearly"
                        : "Custom range"}
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
                    <p className="text-base font-bold break-words">
                      {formatCurrency(data.totalSalesGross, data.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Discounts</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-base font-bold break-words">
                      {formatCurrency(data.totalDiscounts, data.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Tax Collected</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-base font-bold break-words">
                      {formatCurrency(data.totalTaxCollected, data.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Net Sales</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-base font-bold break-words">
                      {formatCurrency(data.netSales, data.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Money In (Paid)</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-base font-bold text-green-600 dark:text-green-400 break-words">
                      {formatCurrency(data.totalPaid, data.currency)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Money Pending</CardTitle>
                  </CardHeader>
                  <CardContent className="min-w-0 overflow-hidden">
                    <p className="text-base font-bold text-amber-600 dark:text-amber-400 break-words">
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
                  <ReportTableSection
                    title="Sales by Product"
                    icon={Package}
                    tone="sky"
                    count={data.byProduct.length}
                  >
                    {data.byProduct.length === 0 ? (
                      <p className="px-4 py-6 text-xs text-muted-foreground">
                        No product data
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className={REPORT_TONE.sky.headerRow}>
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
                                <TableCell className="text-right">
                                  <span
                                    className={cn(
                                      PILL_BASE,
                                      row.qtySold > 0
                                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                        : "border-border bg-muted/60 text-muted-foreground",
                                    )}
                                  >
                                    {row.qtySold.toLocaleString()}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground tabular-nums">
                                  {formatCurrency(row.unitPrice, data.currency)}
                                </TableCell>
                                <TableCell className="text-right font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                                  {formatCurrency(row.total, data.currency)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </ReportTableSection>

                  {/* Sales by Customer */}
                  <ReportTableSection
                    title="Sales by Customer"
                    icon={Users}
                    tone="violet"
                    count={data.byCustomer.length}
                  >
                    {data.byCustomer.length === 0 ? (
                      <p className="px-4 py-6 text-xs text-muted-foreground">
                        No customer data
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className={REPORT_TONE.violet.headerRow}>
                              <TableHead>Customer</TableHead>
                              <TableHead className="text-right">Total Sales</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead className="text-right">Outstanding</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.byCustomer.map((row) => {
                              const hasOutstanding = row.outstanding > 0;
                              return (
                                <TableRow
                                  key={row.customer}
                                  className={
                                    hasOutstanding
                                      ? "bg-amber-50/40 dark:bg-amber-950/15"
                                      : ""
                                  }
                                >
                                  <TableCell className="font-medium">
                                    {row.customer}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold tabular-nums">
                                    {formatCurrency(row.totalSales, data.currency)}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right tabular-nums",
                                      row.paid > 0
                                        ? "text-emerald-700 font-medium dark:text-emerald-400"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {formatCurrency(row.paid, data.currency)}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right tabular-nums",
                                      hasOutstanding
                                        ? "font-semibold text-amber-700 dark:text-amber-300"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {formatCurrency(row.outstanding, data.currency)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </ReportTableSection>

                  {/* Invoice Details */}
                  <ReportTableSection
                    title="Invoice Details"
                    icon={FileText}
                    tone="indigo"
                    count={data.invoices.length}
                  >
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-10">
                          <TableRow className={REPORT_TONE.indigo.headerRow}>
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
                          {data.invoices.map((inv) => {
                            const status = getInvoiceStatus(
                              inv.amountPaid,
                              inv.amountDue,
                            );
                            const sb = STATUS_BADGE[status];
                            const paymentLabel = inv.paymentMethod
                              ? PAYMENT_LABELS[inv.paymentMethod] ??
                                inv.paymentMethod
                              : null;
                            const paymentCls = inv.paymentMethod
                              ? PAYMENT_BADGE[inv.paymentMethod] ??
                                "border-border bg-muted/60 text-muted-foreground"
                              : null;
                            return (
                              <TableRow key={inv.id} className={sb.row}>
                                <TableCell className="font-medium">
                                  {inv.number}
                                </TableCell>
                                <TableCell className="text-muted-foreground tabular-nums">
                                  {formatDate(inv.issueDate)}
                                </TableCell>
                                <TableCell>{inv.clientName}</TableCell>
                                <TableCell>
                                  {paymentLabel ? (
                                    <span
                                      className={cn(PILL_BASE, paymentCls)}
                                    >
                                      {paymentLabel}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-semibold tabular-nums">
                                  {formatCurrency(inv.total, data.currency)}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-right tabular-nums",
                                    inv.amountPaid > 0
                                      ? "text-emerald-700 font-medium dark:text-emerald-400"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {formatCurrency(inv.amountPaid, data.currency)}
                                </TableCell>
                                <TableCell>
                                  <span className={cn(PILL_BASE, sb.pill)}>
                                    {sb.label}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </ReportTableSection>

                  {/* Outstanding Invoices */}
                  {data.outstandingInvoices.length > 0 && (
                    <ReportTableSection
                      title="Outstanding Invoices"
                      icon={AlertTriangle}
                      tone="amber"
                      count={data.outstandingInvoices.length}
                    >
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className={REPORT_TONE.amber.headerRow}>
                              <TableHead>Invoice #</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead className="text-right">Amount Due</TableHead>
                              <TableHead>Due Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.outstandingInvoices.map((inv) => {
                              const today = toLocalDateStr(new Date());
                              const isOverdue =
                                !!inv.dueDate && inv.dueDate < today;
                              return (
                                <TableRow
                                  key={inv.id}
                                  className={
                                    isOverdue
                                      ? "bg-rose-50/50 dark:bg-rose-950/15"
                                      : "bg-amber-50/40 dark:bg-amber-950/15"
                                  }
                                >
                                  <TableCell className="font-medium">
                                    {inv.number}
                                  </TableCell>
                                  <TableCell>{inv.clientName}</TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right font-semibold tabular-nums",
                                      isOverdue
                                        ? "text-rose-700 dark:text-rose-300"
                                        : "text-amber-700 dark:text-amber-300",
                                    )}
                                  >
                                    {formatCurrency(inv.amountDue, data.currency)}
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={cn(
                                        PILL_BASE,
                                        isOverdue
                                          ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                                          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
                                      )}
                                    >
                                      {formatDate(inv.dueDate)}
                                      {isOverdue ? " · Overdue" : ""}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </ReportTableSection>
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
    </AppPageShell>
  );
}
