"use client";

import { useCallback, useEffect, useState } from "react";
import { BookMarked, FileText, Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ReportTabSkeleton } from "@/components/page-skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReportPeriodTabs } from "@/components/report-period-tabs";
import {
  REPORT_TONE,
  ReportTableSection,
} from "@/components/report-table-section";
import type { ReportTabExportProps } from "@/components/report-tab-export";
import {
  getBasicLedgerData,
  CHART_OF_ACCOUNTS,
  type BasicLedgerFilters,
  type BasicLedgerData,
} from "@/lib/basic-ledger-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { generateBasicLedgerPDF } from "@/lib/basic-ledger-pdf";

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

const SOURCE_LABELS: Record<string, string> = {
  invoice: "Sales",
  purchase_invoice: "Purchase",
  expense: "Expense",
};

export function BasicLedgerTab({ onExportReady }: ReportTabExportProps) {
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
  const [data, setData] = useState<BasicLedgerData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const { start, end } = getDateRange(range, customStart, customEnd);

  const loadReport = useCallback(async () => {
    if (range === "custom" && customStart > customEnd) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const filters: BasicLedgerFilters = { startDate: start, endDate: end };
      const result = await getBasicLedgerData(filters);
      setData(result);
    } catch (e: unknown) {
      toast({
        title: "Failed to load ledger",
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
      await generateBasicLedgerPDF(data, profile);
      toast({
        title: "Report downloaded",
        description: "Basic ledger PDF has been downloaded.",
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
              <Label htmlFor="basic-start">Start date</Label>
              <Input
                id="basic-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="basic-end">End date</Label>
              <Input
                id="basic-end"
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
            <div className="space-y-4 text-sm">
              <ReportTableSection
                title="Chart of Accounts"
                icon={BookMarked}
                tone="sky"
                count={CHART_OF_ACCOUNTS.length}
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className={REPORT_TONE.sky.headerRow}>
                        <TableHead>Code</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {CHART_OF_ACCOUNTS.map((acc) => (
                        <TableRow key={acc.code}>
                          <TableCell className="font-mono">{acc.code}</TableCell>
                          <TableCell>{acc.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {acc.type}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ReportTableSection>

              <ReportTableSection
                title="Trial Balance"
                icon={Scale}
                tone="violet"
                count={data.trialBalance.length}
              >
                {data.trialBalance.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-muted-foreground">
                    No activity in period
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className={REPORT_TONE.violet.headerRow}>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.trialBalance.map((r) => (
                          <TableRow key={r.accountCode}>
                            <TableCell className="font-medium">
                              {r.accountCode} {r.accountName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.debit > 0
                                ? formatCurrency(r.debit, data.currency)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.credit > 0
                                ? formatCurrency(r.credit, data.currency)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                              {formatCurrency(r.balance, data.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </ReportTableSection>

              <ReportTableSection
                title="Journal Entries"
                icon={FileText}
                tone="indigo"
                count={data.entries.length}
                defaultOpen={data.entries.length > 0}
              >
                {data.entries.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-muted-foreground">
                    No entries in period
                  </p>
                ) : (
                  <div className="space-y-1 px-2 py-2">
                    {data.entries.map((entry) => (
                      <Collapsible key={entry.id}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="group h-auto w-full justify-between px-3 py-2.5 hover:bg-accent/50"
                          >
                            <span className="flex items-center gap-2 text-left">
                              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                              {formatDate(entry.date)} · {entry.ref} ·{" "}
                              {SOURCE_LABELS[entry.source] ?? entry.source}
                            </span>
                            <span className="shrink-0 font-normal tabular-nums text-muted-foreground">
                              {formatCurrency(entry.totalDebit, data.currency)}
                            </span>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mb-2 ml-6 overflow-x-auto rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow className={REPORT_TONE.indigo.headerRow}>
                                  <TableHead>Account</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead className="text-right">Debit</TableHead>
                                  <TableHead className="text-right">Credit</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {entry.lines.map((line, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-mono text-sm">
                                      {line.accountCode} {line.accountName}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {line.description}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {line.debit > 0
                                        ? formatCurrency(line.debit, data.currency)
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {line.credit > 0
                                        ? formatCurrency(line.credit, data.currency)
                                        : "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-muted/30 font-medium">
                                  <TableCell colSpan={2}>Total</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatCurrency(entry.totalDebit, data.currency)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatCurrency(entry.totalCredit, data.currency)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </ReportTableSection>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {range === "custom" && customStart > customEnd
                ? "Select a valid date range."
                : "No data for the selected period."}
            </p>
          )}
      </CardContent>
    </Card>
  );
}
