"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  FileText,
  LayoutList,
  Loader2,
  Package,
  PieChart,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  getSalesReportData,
  type SalesReportData,
  type SalesReportFilters,
} from "@/lib/sales-report-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { generateSalesReportPDF } from "@/lib/sales-report-pdf";
import { ReportPeriodTabs } from "@/components/report-period-tabs";
import {
  REPORT_TONE,
  ReportLineGrid,
  ReportTableSection,
} from "@/components/report-table-section";
import type { ReportTabExportProps } from "@/components/report-tab-export";

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

function salesFmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SalesReportTab({ onExportReady }: ReportTabExportProps) {
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
  }, [data, range, customStart, customEnd, profile, toast]);

  useEffect(() => {
    onExportReady?.({
      exportPdf: handleDownload,
      exporting: downloading,
      canExport: !!data && !downloading,
    });
  }, [onExportReady, handleDownload, downloading, data]);

  const periodOptions = [
    { value: "today" as const, label: "Today" },
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
              <Label htmlFor="sales-start">Start date</Label>
              <Input
                id="sales-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-end">End date</Label>
              <Input
                id="sales-end"
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

              <div className="space-y-4 text-sm">
                <ReportTableSection title="Summary" icon={LayoutList} tone="sky">
                  <ReportLineGrid
                    lines={[
                      {
                        label: "Total Sales (Gross)",
                        value: salesFmt(data.totalSalesGross, data.currency),
                      },
                      {
                        label: "Total Discounts",
                        value: salesFmt(data.totalDiscounts, data.currency),
                      },
                      {
                        label: "Total Tax Collected",
                        value: salesFmt(data.totalTaxCollected, data.currency),
                      },
                      {
                        label: "Net Sales",
                        value: salesFmt(data.netSales, data.currency),
                      },
                      {
                        label: "Total Paid (Money In)",
                        value: salesFmt(data.totalPaid, data.currency),
                      },
                      {
                        label: "Outstanding (Money Pending)",
                        value: salesFmt(data.outstanding, data.currency),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>

                <ReportTableSection
                  title="Sales Breakdown"
                  icon={PieChart}
                  tone="violet"
                >
                  <div className="space-y-4 px-4 py-4 text-sm">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Money collected
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
                        {(
                          [
                            ["Cash", data.salesBreakdown.cash],
                            ["Credit", data.salesBreakdown.credit],
                            ["Bank / Juice", data.salesBreakdown.bankJuice],
                          ] as const
                        ).map(([label, amount]) => (
                          <Fragment key={label}>
                            <span>{label}</span>
                            <span className="text-right tabular-nums text-foreground">
                              {salesFmt(amount, data.currency)}
                            </span>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                      <div className="grid grid-cols-2 gap-x-4 text-sm">
                        <span className="font-semibold text-amber-800 dark:text-amber-300">
                          Due (outstanding)
                        </span>
                        <span className="text-right font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                          {salesFmt(data.salesBreakdown.due, data.currency)}
                        </span>
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <div className="grid grid-cols-2 gap-x-4 font-semibold">
                        <span>Total sales</span>
                        <span className="text-right tabular-nums">
                          {salesFmt(data.totalSalesGross, data.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </ReportTableSection>

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

                  {/* Sales Details */}
                  <ReportTableSection
                    title="Sales Details"
                    icon={FileText}
                    tone="indigo"
                    count={data.invoices.length}
                  >
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-10">
                          <TableRow className={REPORT_TONE.indigo.headerRow}>
                            <TableHead>Ref #</TableHead>
                            <TableHead>Type</TableHead>
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
                                <TableCell>
                                  <span
                                    className={cn(
                                      PILL_BASE,
                                      inv.source === "sales_order"
                                        ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                                        : "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
                                    )}
                                  >
                                    {inv.source === "sales_order"
                                      ? "Sales order"
                                      : "Invoice"}
                                  </span>
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
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {range === "custom" && customStart > customEnd
                ? "Select a valid date range."
                : "No sales data for the selected period yet."}
            </p>
          )}

      </CardContent>
    </Card>
  );
}
