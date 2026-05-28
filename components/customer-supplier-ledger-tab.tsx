"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Truck, Users } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ReportPeriodTabs } from "@/components/report-period-tabs";
import {
  REPORT_TONE,
  ReportTableSection,
} from "@/components/report-table-section";
import type { ReportTabExportProps } from "@/components/report-tab-export";
import {
  getCustomerSupplierLedgerData,
  type CustomerSupplierLedgerFilters,
  type CustomerLedgerAccount,
  type SupplierLedgerAccount,
} from "@/lib/customer-supplier-ledger-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { generateCustomerSupplierLedgerPDF } from "@/lib/customer-supplier-ledger-pdf";

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

type DataState = {
  currency: string;
  customers: CustomerLedgerAccount[];
  suppliers: SupplierLedgerAccount[];
  totalReceivable: number;
  totalPayable: number;
} | null;

export function CustomerSupplierLedgerTab({ onExportReady }: ReportTabExportProps) {
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
  const [data, setData] = useState<DataState>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const { start, end } = getDateRange(range, customStart, customEnd);

  const loadReport = useCallback(async () => {
    if (range === "custom" && customStart > customEnd) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const filters: CustomerSupplierLedgerFilters = { startDate: start, endDate: end };
      const result = await getCustomerSupplierLedgerData(filters);
      setData({
        currency: result.currency,
        customers: result.customers,
        suppliers: result.suppliers,
        totalReceivable: result.totalReceivable,
        totalPayable: result.totalPayable,
      });
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
      await generateCustomerSupplierLedgerPDF(
        {
          ...data,
          startDate: start,
          endDate: end,
        },
        profile
      );
      toast({
        title: "Report downloaded",
        description: "Customer/Supplier ledger PDF has been downloaded.",
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
  }, [data, range, customStart, customEnd, start, end, profile, toast]);

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
              <Label htmlFor="cs-start">Start date</Label>
              <Input
                id="cs-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-end">End date</Label>
              <Input
                id="cs-end"
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Receivable</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(data.totalReceivable, data.currency)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      What customers owe you
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Payable</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(data.totalPayable, data.currency)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      What you owe suppliers
                    </p>
                  </CardContent>
                </Card>
              </div>

              <ReportTableSection
                title="Customer Ledger (Receivables)"
                icon={Users}
                tone="sky"
                count={data.customers.length}
              >
                {data.customers.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-muted-foreground">
                    No customer activity in period
                  </p>
                ) : (
                  <div className="space-y-2 px-2 py-2">
                    {data.customers.map((acc) => (
                      <CustomerAccountCard
                        key={acc.customerName}
                        account={acc}
                        currency={data.currency}
                        tone="sky"
                      />
                    ))}
                  </div>
                )}
              </ReportTableSection>

              <ReportTableSection
                title="Supplier Ledger (Payables)"
                icon={Truck}
                tone="violet"
                count={data.suppliers.length}
                defaultOpen={false}
              >
                {data.suppliers.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-muted-foreground">
                    No supplier activity in period
                  </p>
                ) : (
                  <div className="space-y-2 px-2 py-2">
                    {data.suppliers.map((acc) => (
                      <SupplierAccountCard
                        key={acc.supplierName}
                        account={acc}
                        currency={data.currency}
                        tone="violet"
                      />
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

function LedgerAccountCard({
  name,
  balance,
  subtitle,
  transactions,
  currency,
  tone,
}: {
  name: string;
  balance: number;
  subtitle: string;
  transactions: CustomerLedgerAccount["transactions"];
  currency: string;
  tone: keyof typeof REPORT_TONE;
}) {
  const toneStyles = REPORT_TONE[tone];
  return (
    <Collapsible>
      <div className={cn("overflow-hidden rounded-lg border bg-card", toneStyles.card)}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
              <span className="truncate text-sm font-semibold">{name}</span>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium tabular-nums">
                Balance: {formatCurrency(balance, currency)}
              </p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-2 pb-2">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className={toneStyles.headerRow}>
                    <TableHead>Date</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="tabular-nums">
                        {formatDate(txn.date)}
                      </TableCell>
                      <TableCell>{txn.ref}</TableCell>
                      <TableCell className="capitalize">{txn.type}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {txn.debit > 0 ? formatCurrency(txn.debit, currency) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {txn.credit > 0 ? formatCurrency(txn.credit, currency) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(txn.balance, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function CustomerAccountCard({
  account,
  currency,
  tone,
}: {
  account: CustomerLedgerAccount;
  currency: string;
  tone: keyof typeof REPORT_TONE;
}) {
  return (
    <LedgerAccountCard
      name={account.customerName}
      balance={account.balance}
      subtitle={`Sales ${formatCurrency(account.totalSales, currency)} · Paid ${formatCurrency(account.totalPayments, currency)}`}
      transactions={account.transactions}
      currency={currency}
      tone={tone}
    />
  );
}

function SupplierAccountCard({
  account,
  currency,
  tone,
}: {
  account: SupplierLedgerAccount;
  currency: string;
  tone: keyof typeof REPORT_TONE;
}) {
  return (
    <LedgerAccountCard
      name={account.supplierName}
      balance={account.balance}
      subtitle={`Purchases ${formatCurrency(account.totalPurchases, currency)} · Paid ${formatCurrency(account.totalPayments, currency)}`}
      transactions={account.transactions}
      currency={currency}
      tone={tone}
    />
  );
}
