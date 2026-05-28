"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CircleDollarSign,
  Landmark,
  Package,
  Receipt,
  Scale,
  TrendingUp,
  Wallet,
  ArrowLeftRight,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportTabSkeleton } from "@/components/page-skeletons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getReportData, type ReportData } from "@/lib/report-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { ReportPeriodTabs } from "@/components/report-period-tabs";
import { ReportLineGrid, ReportTableSection } from "@/components/report-table-section";
import type { ReportTabExportProps } from "@/components/report-tab-export";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

function pnlFmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function imageUrlToDataURL(
  url: string
): Promise<{ dataUrl: string; fmt: "PNG" | "JPEG" } | undefined> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const fmt: "PNG" | "JPEG" = blob.type.includes("png") ? "PNG" : "JPEG";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { dataUrl, fmt };
  } catch {
    return undefined;
  }
}

async function generateReportPDF(data: ReportData, rangeLabel: string, profile: Profile | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;

  const brandColor: [number, number, number] = [15, 23, 42]; // slate-900

  const senderName =
    (profile as any)?.companyName ||
    (profile as any)?.fullName ||
    "Your Company";
  const senderEmail = (profile as any)?.email || "";
  const registrationId = (profile as any)?.registration_id || (profile as any)?.registrationId;
  const vatNumber = (profile as any)?.vat_number || (profile as any)?.vatNumber;
  const resolvedLogo =
    (profile as any)?.logoUrl ||
    (profile as any)?.logo_url ||
    "/kredence.png";

  const revenue = data.totalPaid;
  const totalPurchases = data.totalPurchases;
  const totalExpenses = data.totalExpense;
  const grossProfit = revenue - totalPurchases;
  const netProfit = data.profitableIncome;
  const isVatRegistered =
    (profile as any)?.vat_registered ?? (profile as any)?.vatRegistered ?? false;
  const taxRate = isVatRegistered ? 0.15 : 0;
  const taxAmount = netProfit > 0 ? netProfit * taxRate : 0;
  const netAfterTax = netProfit - taxAmount;

  // Header bar
  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageW, 70, "F");

  // Logo on the left
  const logoImg = resolvedLogo ? await imageUrlToDataURL(resolvedLogo) : undefined;
  if (logoImg?.dataUrl) {
    doc.addImage(logoImg.dataUrl, logoImg.fmt, M, 14, 48, 48, undefined, "FAST");
  }

  const headerTextX = M + 60;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text("PROFIT & LOSS", headerTextX, 28);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(senderName, headerTextX, 44);
  if (senderEmail) {
    doc.text(senderEmail, headerTextX, 58);
  }

  // Right-side meta (range + generated date + BRN / VAT)
  const metaLines = [
    rangeLabel,
    `Generated: ${formatDate(new Date().toISOString().slice(0, 10))}`,
  ];
  if (registrationId) {
    metaLines.push(`BRN: ${registrationId}`);
  }
  if (vatNumber) {
    metaLines.push(`VAT: ${vatNumber}`);
  }
  const rightX = pageW - M;
  let metaY = 26;
  doc.setFontSize(9);
  for (const line of metaLines) {
    doc.text(line, rightX, metaY, { align: "right" });
    metaY += 12;
  }

  doc.setTextColor(0, 0, 0);

  let y = 110;

  // 1. Revenue
  doc.setFont("helvetica", "bold").setFontSize(14).text("1. Revenue", M, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [["Description", `Amount (${data.currency})`]],
    body: [
      ["Sales / Invoices Revenue", formatCurrency(revenue, data.currency)],
      ["Other Income", formatCurrency(0, data.currency)],
      ["Total Revenue", formatCurrency(revenue, data.currency)],
    ],
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 120, halign: "right" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // 2. Cost of Sales (purchase invoices)
  doc.setFont("helvetica", "bold").setFontSize(14).text("2. Cost of Sales / Direct Costs", M, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [["Description", `Amount (${data.currency})`]],
    body: [
      ["Cost of Goods Sold (COGS)", formatCurrency(0, data.currency)],
      ["Purchases (purchase invoices)", formatCurrency(totalPurchases, data.currency)],
      ["Direct Labour", formatCurrency(0, data.currency)],
      ["Other Direct Costs", formatCurrency(0, data.currency)],
      ["Total Cost of Sales", formatCurrency(totalPurchases, data.currency)],
    ],
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 120, halign: "right" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // Gross Profit = Revenue - Cost of Sales
  doc.setFont("helvetica", "bold").setFontSize(14).text("Gross Profit", M, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [["", `Amount (${data.currency})`]],
    body: [["Gross Profit", formatCurrency(grossProfit, data.currency)]],
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 120, halign: "right" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // 3. Operating Expenses (all expenses including salary)
  doc.setFont("helvetica", "bold").setFontSize(14).text("3. Operating Expenses", M, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [["Expense Category", `Amount (${data.currency})`]],
    body: [
      ["Total Expenses (incl. salary / payroll)", formatCurrency(totalExpenses, data.currency)],
      ["Total Operating Expenses", formatCurrency(totalExpenses, data.currency)],
    ],
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 140, halign: "right" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // Net Operating Profit = Gross Profit - Operating Expenses
  doc.setFont("helvetica", "bold").setFontSize(14).text("Net Operating Profit", M, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [["", `Amount (${data.currency})`]],
    body: [["Net Operating Profit", formatCurrency(netProfit, data.currency)]],
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 140, halign: "right" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // 4. Other Income / Expenses (not tracked separately yet)
  doc.setFont("helvetica", "bold").setFontSize(14).text("4. Other Income / Expenses", M, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [["Description", `Amount (${data.currency})`]],
    body: [
      ["Interest Income", formatCurrency(0, data.currency)],
      ["Interest Expense", formatCurrency(0, data.currency)],
      ["Other Non-Operating Income", formatCurrency(0, data.currency)],
      ["Total Other Income / Expense", formatCurrency(0, data.currency)],
    ],
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 140, halign: "right" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // Net Profit Before Tax (same as Net Operating Profit)
  doc.setFont("helvetica", "bold").setFontSize(14).text("Net Profit Before Tax", M, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [["", `Amount (${data.currency})`]],
    body: [["Net Profit Before Tax", formatCurrency(netProfit, data.currency)]],
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 160, halign: "right" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // 5. Tax
  doc.setFont("helvetica", "bold").setFontSize(14).text("5. Tax", M, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [["Description", `Amount (${data.currency})`]],
    body: [
      [
        "Corporate Tax (15% Mauritius)",
        formatCurrency(taxAmount, data.currency),
      ],
      ["CSR Levy (if applicable)", formatCurrency(0, data.currency)],
      ["Total Tax", formatCurrency(taxAmount, data.currency)],
    ],
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 160, halign: "right" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // Net Profit After Tax
  doc.setFont("helvetica", "bold").setFontSize(14).text("Net Profit After Tax", M, y);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [["", `Amount (${data.currency})`]],
    body: [["Net Profit After Tax", formatCurrency(netAfterTax, data.currency)]],
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 180, halign: "right" },
    },
  });

  // Footer: powered by + page number
  doc.setDrawColor(230);
  doc.line(M, pageH - 50, pageW - M, pageH - 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("Powered by MoLedger", pageW / 2, pageH - 35, {
    align: "center",
  });
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Page ${doc.getNumberOfPages()}`, pageW - M, pageH - 24, {
    align: "right",
  });
  doc.setTextColor(0, 0, 0);

  const filename = `MoLedger-Report-${data.startDate}_to_${data.endDate}.pdf`;
  doc.save(filename);
}

export function PnlReportTab({ onExportReady }: ReportTabExportProps) {
  const { toast } = useToast();
  const [range, setRange] = useState<ReportRange>("yearly");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const { start, end } = getDateRange(range, customStart, customEnd);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (range === "custom" && customStart > customEnd) {
        setReportData(null);
        setDataLoading(false);
        return;
      }
      setDataLoading(true);
      try {
        const data = await getReportData(start, end);
        if (!cancelled) {
          setReportData(data);
        }
      } catch {
        if (!cancelled) {
          setReportData(null);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [start, end, range, customStart, customEnd]);

  const handleDownload = useCallback(async () => {
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
      const prof = await fetchProfile().catch(() => null);
      await generateReportPDF(data, rangeLabel, prof);
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
  }, [range, customStart, customEnd, start, end, toast]);

  useEffect(() => {
    onExportReady?.({
      exportPdf: handleDownload,
      exporting: loading,
      canExport: !loading,
    });
  }, [onExportReady, handleDownload, loading]);

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
              <Label htmlFor="pnl-start">Start date</Label>
              <Input
                id="pnl-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pnl-end">End date</Label>
              <Input
                id="pnl-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}

          {dataLoading && !reportData ? (
            <ReportTabSkeleton />
          ) : reportData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Sales revenue (paid)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {reportData.currency}{" "}
                      {reportData.totalPaid.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Purchases (PINV)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {reportData.currency}{" "}
                      {reportData.totalPurchases.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {reportData.currency}{" "}
                      {reportData.totalExpense.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Net profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">
                      {reportData.currency}{" "}
                      {reportData.profitableIncome.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4 text-sm">
                <ReportTableSection
                  title="1. Revenue"
                  icon={TrendingUp}
                  tone="sky"
                >
                  <ReportLineGrid
                    lines={[
                      {
                        label: "Sales / Invoices Revenue",
                        value: pnlFmt(reportData.totalPaid, reportData.currency),
                      },
                      {
                        label: "Other Income",
                        value: pnlFmt(0, reportData.currency),
                      },
                      {
                        label: "Total Revenue",
                        value: pnlFmt(reportData.totalPaid, reportData.currency),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>

                <ReportTableSection
                  title="2. Cost of Sales / Direct Costs"
                  icon={Package}
                  tone="violet"
                >
                  <ReportLineGrid
                    muted
                    lines={[
                      {
                        label: "Cost of Goods Sold (COGS)",
                        value: pnlFmt(0, reportData.currency),
                      },
                      {
                        label: "Purchases (purchase invoices)",
                        value: pnlFmt(
                          reportData.totalPurchases,
                          reportData.currency,
                        ),
                      },
                      {
                        label: "Direct Labour",
                        value: pnlFmt(0, reportData.currency),
                      },
                      {
                        label: "Other Direct Costs",
                        value: pnlFmt(0, reportData.currency),
                      },
                      {
                        label: "Total Cost of Sales",
                        value: pnlFmt(
                          reportData.totalPurchases,
                          reportData.currency,
                        ),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>

                <ReportTableSection
                  title="Gross Profit"
                  icon={Scale}
                  tone="emerald"
                >
                  <ReportLineGrid
                    lines={[
                      {
                        label: "Gross Profit",
                        value: pnlFmt(
                          reportData.totalPaid - reportData.totalPurchases,
                          reportData.currency,
                        ),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>

                <ReportTableSection
                  title="3. Operating Expenses"
                  icon={Receipt}
                  tone="amber"
                >
                  <ReportLineGrid
                    lines={[
                      {
                        label: "Total Expenses (incl. salary / payroll)",
                        value: pnlFmt(reportData.totalExpense, reportData.currency),
                      },
                      {
                        label: "Total Operating Expenses",
                        value: pnlFmt(reportData.totalExpense, reportData.currency),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>

                <ReportTableSection
                  title="Net Operating Profit"
                  icon={CircleDollarSign}
                  tone="indigo"
                >
                  <ReportLineGrid
                    lines={[
                      {
                        label: "Net Operating Profit",
                        value: pnlFmt(
                          reportData.profitableIncome,
                          reportData.currency,
                        ),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>

                <ReportTableSection
                  title="4. Other Income / Expenses"
                  icon={ArrowLeftRight}
                  tone="sky"
                  defaultOpen={false}
                >
                  <ReportLineGrid
                    muted
                    lines={[
                      {
                        label: "Interest Income",
                        value: pnlFmt(0, reportData.currency),
                      },
                      {
                        label: "Interest Expense",
                        value: pnlFmt(0, reportData.currency),
                      },
                      {
                        label: "Other Non-Operating Income",
                        value: pnlFmt(0, reportData.currency),
                      },
                      {
                        label: "Total Other Income / Expense",
                        value: pnlFmt(0, reportData.currency),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>

                <ReportTableSection
                  title="Net Profit Before Tax"
                  icon={FileText}
                  tone="violet"
                >
                  <ReportLineGrid
                    lines={[
                      {
                        label: "Net Profit Before Tax",
                        value: pnlFmt(
                          reportData.profitableIncome,
                          reportData.currency,
                        ),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>

                <ReportTableSection title="5. Tax" icon={Landmark} tone="rose" defaultOpen={false}>
                  <ReportLineGrid
                    muted
                    lines={[
                      {
                        label: "Corporate Tax (15% Mauritius)",
                        value: pnlFmt(0, reportData.currency),
                      },
                      {
                        label: "CSR Levy (if applicable)",
                        value: pnlFmt(0, reportData.currency),
                      },
                      {
                        label: "Total Tax",
                        value: pnlFmt(0, reportData.currency),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>

                <ReportTableSection
                  title="Net Profit After Tax"
                  icon={Wallet}
                  tone="emerald"
                >
                  <ReportLineGrid
                    lines={[
                      {
                        label: "Net Profit After Tax",
                        value: pnlFmt(
                          reportData.profitableIncome,
                          reportData.currency,
                        ),
                        emphasis: true,
                      },
                    ]}
                  />
                </ReportTableSection>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No data available for the selected period yet.
            </p>
          )}

      </CardContent>
    </Card>
  );
}
