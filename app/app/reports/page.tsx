"use client";

import { useState, useEffect, useRef } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getReportData, type ReportData } from "@/lib/report-service";
import { getCustomersByMonthForRange } from "@/lib/customers-service";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

type ReportRange = "monthly" | "yearly" | "custom";

export type ChartDataPoint = {
  month: string;
  label: string;
  income: number;
  expense: number;
};

const chartConfig = {
  income: { label: "Income", color: "hsl(217, 91%, 60%)" },
  expense: { label: "Expense", color: "hsl(0, 84%, 60%)" },
} satisfies ChartConfig;

const customersChartConfig = {
  count: { label: "Customers", color: "hsl(217, 91%, 60%)" },
} satisfies ChartConfig;

function aggregateByMonth(data: ReportData): ChartDataPoint[] {
  const byMonth = new Map<string, { income: number; expense: number }>();
  const [startY, startM] = data.startDate.split("-").map(Number);
  const [endY, endM] = data.endDate.split("-").map(Number);
  for (let y = startY; y <= endY; y++) {
    const mStart = y === startY ? startM : 1;
    const mEnd = y === endY ? endM : 12;
    for (let m = mStart; m <= mEnd; m++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      byMonth.set(key, { income: 0, expense: 0 });
    }
  }
  data.invoices.forEach((inv) => {
    const d = inv.issueDate;
    if (!d) return;
    const [y, m] = d.split("-");
    const key = `${y}-${m}`;
    const cur = byMonth.get(key);
    if (cur) cur.income += Number(inv.total || 0);
  });
  data.expenses.forEach((e) => {
    const d = e.expense_date;
    if (!d) return;
    const [y, m] = d.split("-");
    const key = `${y}-${m}`;
    const cur = byMonth.get(key);
    if (cur) cur.expense += Number(e.amount || 0);
  });
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => {
      const [y, m] = month.split("-");
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = d.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      return { month, label, income: vals.income, expense: vals.expense };
    });
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDateRange(range: ReportRange, customStart?: string, customEnd?: string): { start: string; end: string } {
  const today = new Date();
  const y = today.getFullYear();
  if (range === "monthly") {
    const start = new Date(y, today.getMonth(), 1);
    return {
      start: toLocalDateStr(start),
      end: toLocalDateStr(today),
    };
  }
  if (range === "yearly") {
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31); // Dec 31
    return {
      start: toLocalDateStr(start),
      end: toLocalDateStr(end),
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

function generateReportPDF(
  data: ReportData,
  rangeLabel: string,
  chartImageDataUrl?: string,
  customersChartImageDataUrl?: string
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;

  // Theme colors (RGB for jsPDF compatibility)
  const headerBg = [15, 23, 42] as [number, number, number]; // slate-900
  const white = [255, 255, 255] as [number, number, number];
  const black = [0, 0, 0] as [number, number, number];

  // Header
  doc.setFillColor(...headerBg);
  doc.rect(0, 0, pageW, 72, "F");
  doc.setTextColor(...white);
  doc.setFont("helvetica", "bold").setFontSize(22).text("Financial Report", M, 32);
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(rangeLabel, M, 52);
  doc.text(`Generated: ${formatDate(new Date().toISOString().slice(0, 10))}`, pageW - M, 52, {
    align: "right",
  });
  doc.setTextColor(...black);

  let y = 100;

  // Summary section
  doc.setFont("helvetica", "bold").setFontSize(14).text("Summary", M, y);
  y += 8;

  const summaryRows = [
    ["Total Paid", formatCurrency(data.totalPaid, data.currency)],
    ["Total Expense", formatCurrency(data.totalExpense, data.currency)],
    ["Profitable Income", formatCurrency(data.profitableIncome, data.currency)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Amount"]],
    body: summaryRows,
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: "auto", halign: "right" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 24;

  // Chart
  if (chartImageDataUrl && y < 500) {
    const chartW = pageW - 2 * M;
    const chartH = 140;
    doc.setFont("helvetica", "bold").setFontSize(12).text("Income vs Expense", M, y);
    y += 8;
    doc.addImage(chartImageDataUrl, "PNG", M, y, chartW, chartH);
    y += chartH + 24;
  } else if (chartImageDataUrl) {
    doc.addPage();
    y = 40;
    doc.setFont("helvetica", "bold").setFontSize(12).text("Income vs Expense", M, y);
    y += 8;
    const chartW = pageW - 2 * M;
    const chartH = 140;
    doc.addImage(chartImageDataUrl, "PNG", M, y, chartW, chartH);
    y += chartH + 24;
  }

  // Customers per month chart
  if (customersChartImageDataUrl) {
    if (y > 550) {
      doc.addPage();
      y = 40;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Customers per Month", M, y);
    y += 8;
    const chartW = pageW - 2 * M;
    const chartH = 120;
    doc.addImage(customersChartImageDataUrl, "PNG", M, y, chartW, chartH);
    y += chartH + 24;
  }

  // Paid Invoices table
  if (data.invoices.length > 0) {
    if (y > 650) {
      doc.addPage();
      y = 40;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Paid Invoices", M, y);
    y += 6;

    const invRows = data.invoices.map((inv) => [
      inv.number,
      inv.clientName,
      formatDate(inv.issueDate),
      formatCurrency(inv.total, inv.currency),
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Invoice #", "Client", "Issue Date", "Amount"]],
      body: invRows,
      margin: { left: M, right: M },
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 55 },
        3: { cellWidth: 55, halign: "right" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 20;
  }

  // Expenses table
  if (data.expenses.length > 0) {
    if (y > 620) {
      doc.addPage();
      y = 40;
    }
    doc.setFont("helvetica", "bold").setFontSize(12).text("Expenses", M, y);
    y += 6;

    const expRows = data.expenses.map((e) => [
      e.description || "—",
      e.expense_date ? formatDate(e.expense_date) : "—",
      formatCurrency(e.amount, e.currency || data.currency),
      e.notes?.trim() || "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Description", "Date", "Amount", "Notes"]],
      body: expRows,
      margin: { left: M, right: M },
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 55 },
        2: { cellWidth: 50, halign: "right" },
        3: { cellWidth: "auto" },
      },
    });
  }

  const filename = `PocketLedger-Report-${data.startDate}_to_${data.endDate}.pdf`;
  doc.save(filename);
}

export default function ReportsPage() {
  const { toast } = useToast();
  const chartRef = useRef<HTMLDivElement>(null);
  const customersChartRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<ReportRange>("yearly");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [customersChartData, setCustomersChartData] = useState<{ month: string; label: string; count: number }[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  const { start, end } = getDateRange(range, customStart, customEnd);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (range === "custom" && customStart > customEnd) {
        setChartData([]);
        setCustomersChartData([]);
        setReportData(null);
        setChartLoading(false);
        return;
      }
      setChartLoading(true);
      try {
        const [data, custData] = await Promise.all([
          getReportData(start, end),
          getCustomersByMonthForRange(start, end),
        ]);
        if (!cancelled) {
          setReportData(data);
          setChartData(aggregateByMonth(data));
          setCustomersChartData(custData);
        }
      } catch {
        if (!cancelled) {
          setReportData(null);
          setChartData([]);
          setCustomersChartData([]);
        }
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [start, end, range, customStart, customEnd]);

  async function handleDownload() {
    if (range === "custom" && customStart > customEnd) {
      toast({
        title: "Invalid date range",
        description: "Start date must be before or equal to end date.",
        variant: "destructive",
      });
      return;
    }

    const rangeLabel =
      range === "monthly"
        ? `Monthly: ${formatDate(start)} – ${formatDate(end)}`
        : range === "yearly"
          ? `Yearly: ${formatDate(start)} – ${formatDate(end)}`
          : `Custom: ${formatDate(start)} – ${formatDate(end)}`;

    setLoading(true);
    try {
      const data = await getReportData(start, end);
      const freshChartData = aggregateByMonth(data);
      const freshCustData = await getCustomersByMonthForRange(start, end);
      setChartData(freshChartData);
      setCustomersChartData(freshCustData);
      await new Promise((r) => setTimeout(r, 600));
      let chartImageDataUrl: string | undefined;
      let customersChartImageDataUrl: string | undefined;
      if (chartRef.current && freshChartData.length > 0) {
        const canvas = await html2canvas(chartRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
        chartImageDataUrl = canvas.toDataURL("image/png");
      }
      if (customersChartRef.current && freshCustData.length > 0) {
        const canvas = await html2canvas(customersChartRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
        customersChartImageDataUrl = canvas.toDataURL("image/png");
      }
      generateReportPDF(data, rangeLabel, chartImageDataUrl, customersChartImageDataUrl);
      toast({
        title: "Report downloaded",
        description: "Your financial report has been downloaded successfully.",
      });
    } catch (e: unknown) {
      toast({
        title: "Failed to generate report",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Download financial reports (Total Paid, Total Expense, Profitable Income)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download Report</CardTitle>
          <CardDescription>
            Export as PDF. Paid invoices only — no overdue data.
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

          <div
            ref={chartRef}
            className="rounded-lg border p-4"
            style={
              {
                backgroundColor: "#ffffff",
                color: "#0a0a0a",
                "--background": "#ffffff",
                "--foreground": "#0a0a0a",
                "--chart-1": "#3b82f6",
                "--chart-2": "#ef4444",
                "--card": "#ffffff",
                "--card-foreground": "#0a0a0a",
                "--muted": "#f1f5f9",
                "--muted-foreground": "#64748b",
                "--border": "#e2e8f0",
              } as React.CSSProperties
            }
          >
            <p className="text-sm font-medium mb-3">Income vs Expense</p>
            {chartLoading ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                Loading chart…
              </div>
            ) : chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <AreaChart data={chartData} margin={{ left: 0, right: 16 }}>
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
                      (reportData?.currency ?? "MUR") + " " + (v >= 1000 ? v / 1000 + "k" : v)
                    }
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          (reportData?.currency ?? "MUR") + " " +
                          Number(value).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="hsl(217, 91%, 60%)"
                    fill="hsl(217, 91%, 60%)"
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke="hsl(0, 84%, 60%)"
                    fill="hsl(0, 84%, 60%)"
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                No data for selected period
              </div>
            )}
          </div>

          <div
            ref={customersChartRef}
            className="rounded-lg border p-4"
            style={
              {
                backgroundColor: "#ffffff",
                color: "#0a0a0a",
                "--background": "#ffffff",
                "--foreground": "#0a0a0a",
                "--chart-1": "#3b82f6",
                "--card": "#ffffff",
                "--card-foreground": "#0a0a0a",
                "--muted": "#f1f5f9",
                "--muted-foreground": "#64748b",
                "--border": "#e2e8f0",
              } as React.CSSProperties
            }
          >
            <p className="text-sm font-medium mb-3">Customers per Month</p>
            {chartLoading ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Loading chart…
              </div>
            ) : customersChartData.length > 0 ? (
              <ChartContainer config={customersChartConfig} className="h-[220px] w-full">
                <AreaChart data={customersChartData} margin={{ left: 0, right: 16 }}>
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
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [String(value), "Customers"]}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(217, 91%, 60%)"
                    fill="hsl(217, 91%, 60%)"
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No customer data for selected period
              </div>
            )}
          </div>

          <Button
            className="gap-2"
            onClick={handleDownload}
            disabled={loading}
          >
            {loading ? (
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
