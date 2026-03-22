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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

export default function CustomerSupplierLedgerPage() {
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
            <h1 className="text-3xl font-bold tracking-tight">Customer / Supplier Ledger</h1>
            <p className="text-muted-foreground mt-1">
              Accounts receivable by customer, accounts payable by supplier
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
            Customer ledger: amounts owed to you. Supplier ledger: amounts you owe.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Receivable</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(data.totalReceivable, data.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">What customers owe you</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Payable</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(data.totalPayable, data.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">What you owe suppliers</p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="customers">
                <TabsList>
                  <TabsTrigger value="customers">Customer Ledger (Receivables)</TabsTrigger>
                  <TabsTrigger value="suppliers">Supplier Ledger (Payables)</TabsTrigger>
                </TabsList>
                <TabsContent value="customers" className="mt-4">
                  {data.customers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No customer activity in period</p>
                  ) : (
                    <div className="space-y-4">
                      {data.customers.map((acc) => (
                        <CustomerAccountCard
                          key={acc.customerName}
                          account={acc}
                          currency={data.currency}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="suppliers" className="mt-4">
                  {data.suppliers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No supplier activity in period</p>
                  ) : (
                    <div className="space-y-4">
                      {data.suppliers.map((acc) => (
                        <SupplierAccountCard
                          key={acc.supplierName}
                          account={acc}
                          currency={data.currency}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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

function CustomerAccountCard({
  account,
  currency,
}: {
  account: CustomerLedgerAccount;
  currency: string;
}) {
  return (
    <Collapsible>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 collapsible-open:rotate-90" />
                <CardTitle className="text-base">{account.customerName}</CardTitle>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  Balance: {formatCurrency(account.balance, currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sales {formatCurrency(account.totalSales, currency)} · Paid {formatCurrency(account.totalPayments, currency)}
                </p>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell>{t.ref}</TableCell>
                      <TableCell className="capitalize">{t.type}</TableCell>
                      <TableCell className="text-right">
                        {t.debit > 0 ? formatCurrency(t.debit, currency) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.credit > 0 ? formatCurrency(t.credit, currency) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(t.balance, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function SupplierAccountCard({
  account,
  currency,
}: {
  account: SupplierLedgerAccount;
  currency: string;
}) {
  return (
    <Collapsible>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 collapsible-open:rotate-90" />
                <CardTitle className="text-base">{account.supplierName}</CardTitle>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  Balance: {formatCurrency(account.balance, currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Purchases {formatCurrency(account.totalPurchases, currency)} · Paid {formatCurrency(account.totalPayments, currency)}
                </p>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell>{t.ref}</TableCell>
                      <TableCell className="capitalize">{t.type}</TableCell>
                      <TableCell className="text-right">
                        {t.debit > 0 ? formatCurrency(t.debit, currency) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.credit > 0 ? formatCurrency(t.credit, currency) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(t.balance, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
