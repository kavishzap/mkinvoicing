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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

export default function BasicLedgerPage() {
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
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/app/accounting">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Basic Accounting Ledger</h1>
            <p className="text-muted-foreground mt-1">
              Double-entry journal derived from sales, purchases, and expenses
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
          <CardTitle>Ledger</CardTitle>
          <CardDescription>
            Chart of accounts and journal entries. Debits = Credits for each entry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Period</Label>
            <div className="flex flex-wrap gap-2">
              {(["monthly", "yearly", "custom"] as const).map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={range === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRange(r)}
                >
                  {r === "monthly" ? "Monthly" : r === "yearly" ? "Yearly" : "Custom"}
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
            <div className="space-y-6">
              <div>
                <p className="font-semibold mb-2">Chart of Accounts</p>
                <div className="rounded-md border text-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                          <TableCell className="text-muted-foreground">{acc.type}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">Trial Balance</p>
                {data.trialBalance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity in period</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
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
                            <TableCell className="text-right">
                              {r.debit > 0 ? formatCurrency(r.debit, data.currency) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.credit > 0 ? formatCurrency(r.credit, data.currency) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(r.balance, data.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div>
                <p className="font-semibold mb-2">Journal Entries</p>
                {data.entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries in period</p>
                ) : (
                  <div className="space-y-2">
                    {data.entries.map((entry) => (
                      <Collapsible key={entry.id}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between hover:bg-accent/50"
                          >
                            <span className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 collapsible-open:rotate-90" />
                              {formatDate(entry.date)} · {entry.ref} · {SOURCE_LABELS[entry.source] ?? entry.source}
                            </span>
                            <span className="text-muted-foreground font-normal">
                              {formatCurrency(entry.totalDebit, data.currency)}
                            </span>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="rounded-md border ml-6 mt-1 overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
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
                                    <TableCell className="text-muted-foreground text-sm">
                                      {line.description}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {line.debit > 0 ? formatCurrency(line.debit, data.currency) : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {line.credit > 0 ? formatCurrency(line.credit, data.currency) : "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-muted/30 font-medium">
                                  <TableCell colSpan={2}>Total</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(entry.totalDebit, data.currency)}
                                  </TableCell>
                                  <TableCell className="text-right">
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
              </div>
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
    </div>
  );
}
