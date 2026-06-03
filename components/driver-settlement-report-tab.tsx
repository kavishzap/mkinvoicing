"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Building2,
  FileText,
  LayoutList,
  Search,
  Truck,
  Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DELIVERY_NOTE_STATUSES,
  DELIVERY_NOTE_STATUS_LABELS,
  listDriverTeamMembers,
  type DeliveryNoteStatus,
} from "@/lib/deliveries-service";
import type { TeamMemberRow } from "@/lib/company-team-service";
import {
  getDriverSettlementReportData,
  type DriverSettlementReportData,
  type DriverSettlementReportFilters,
} from "@/lib/driver-settlement-report-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { generateDriverSettlementReportPDF } from "@/lib/driver-settlement-report-pdf";
import { ReportPeriodTabs } from "@/components/report-period-tabs";
import {
  REPORT_TONE,
  ReportLineGrid,
  ReportTableSection,
} from "@/components/report-table-section";
import { DeliveryNoteStatusBadge } from "@/components/delivery-note-status-badge";
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
  customEnd?: string,
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

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id: string) {
  const t = id.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 8)}…`;
}

function driverLabel(member: TeamMemberRow): string {
  const name = member.profile?.full_name?.trim();
  if (name) return name;
  const email = member.profile?.email?.trim();
  if (email) return email;
  return member.userId.slice(0, 8);
}

function reportFmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function DriverSettlementReportTab({ onExportReady }: ReportTabExportProps) {
  const { toast } = useToast();
  const [range, setRange] = useState<ReportRange>("monthly");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [deliveryIdQuery, setDeliveryIdQuery] = useState("");
  const [driverUserId, setDriverUserId] = useState<string>("all");
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryNoteStatus | "all">("all");
  const [drivers, setDrivers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [data, setData] = useState<DriverSettlementReportData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const { start, end } = getDateRange(range, customStart, customEnd);

  useEffect(() => {
    listDriverTeamMembers()
      .then(setDrivers)
      .catch(() => setDrivers([]));
  }, []);

  useEffect(() => {
    fetchProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  const loadReport = useCallback(async () => {
    if (range === "custom" && customStart > customEnd) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const filters: DriverSettlementReportFilters = {
        startDate: start,
        endDate: end,
        deliveryIdQuery: deliveryIdQuery.trim() || null,
        driverUserId: driverUserId === "all" ? null : driverUserId,
        deliveryStatus,
      };
      const result = await getDriverSettlementReportData(filters);
      setData(result);
    } catch (e: unknown) {
      toast({
        title: "Failed to load driver settlement report",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    start,
    end,
    range,
    customStart,
    customEnd,
    deliveryIdQuery,
    driverUserId,
    deliveryStatus,
    toast,
  ]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

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
      await generateDriverSettlementReportPDF({ ...data, companyName }, profile);
      toast({
        title: "Report downloaded",
        description: "Your driver settlement report has been downloaded successfully.",
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
      canExport: !!data && !downloading && data.rows.length > 0,
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
          <Label>Report period (settlement date)</Label>
          <ReportPeriodTabs
            value={range}
            onChange={setRange}
            options={periodOptions}
          />
        </div>

        {range === "custom" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="settlement-start">Start date</Label>
              <Input
                id="settlement-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settlement-end">End date</Label>
              <Input
                id="settlement-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="delivery-id-filter">Delivery note</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="delivery-id-filter"
                placeholder="Search by delivery note ID…"
                value={deliveryIdQuery}
                onChange={(e) => setDeliveryIdQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Driver</Label>
            <Select value={driverUserId} onValueChange={setDriverUserId}>
              <SelectTrigger>
                <SelectValue placeholder="All drivers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All drivers</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.userId} value={d.userId}>
                    {driverLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Delivery status</Label>
            <Select
              value={deliveryStatus}
              onValueChange={(v) => setDeliveryStatus(v as DeliveryNoteStatus | "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {DELIVERY_NOTE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {DELIVERY_NOTE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <ReportTabSkeleton />
        ) : data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    Settlements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base font-bold tabular-nums">
                    {data.summary.settlementCount}
                  </p>
                </CardContent>
              </Card>
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    Total to owner
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden">
                  <p className="text-base font-bold break-words text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(data.summary.totalAmountToOwner, data.currency)}
                  </p>
                </CardContent>
              </Card>
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    Cash received
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden">
                  <p className="text-base font-bold break-words">
                    {formatCurrency(data.summary.totalCash, data.currency)}
                  </p>
                </CardContent>
              </Card>
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Bank received
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden">
                  <p className="text-base font-bold break-words">
                    {formatCurrency(data.summary.totalBank, data.currency)}
                  </p>
                </CardContent>
              </Card>
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Linked orders total</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden">
                  <p className="text-base font-bold break-words">
                    {formatCurrency(data.summary.totalLinkedOrders, data.currency)}
                  </p>
                </CardContent>
              </Card>
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Driver cash collected</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden">
                  <p className="text-base font-bold break-words">
                    {formatCurrency(data.summary.totalSettlementCashTotal, data.currency)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <ReportTableSection title="Summary" icon={LayoutList} tone="sky">
              <ReportLineGrid
                lines={[
                  {
                    label: "Settlements recorded",
                    value: String(data.summary.settlementCount),
                  },
                  {
                    label: "Total returned to owner",
                    value: reportFmt(data.summary.totalAmountToOwner, data.currency),
                    emphasis: true,
                  },
                  {
                    label: "Cash portion",
                    value: reportFmt(data.summary.totalCash, data.currency),
                  },
                  {
                    label: "Bank transfer portion",
                    value: reportFmt(data.summary.totalBank, data.currency),
                  },
                  {
                    label: "Linked sales orders total (snapshot)",
                    value: reportFmt(data.summary.totalLinkedOrders, data.currency),
                  },
                  {
                    label: "Driver cash collected (snapshot)",
                    value: reportFmt(data.summary.totalSettlementCashTotal, data.currency),
                  },
                  {
                    label: "Driver daily rates (snapshot)",
                    value: reportFmt(data.summary.totalDriverDailyRate, data.currency),
                  },
                ]}
              />
            </ReportTableSection>

            <ReportTableSection
              title="Settlement details"
              icon={FileText}
              tone="indigo"
              count={data.rows.length}
            >
              {data.rows.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground">
                  No driver settlements match your filters for this period.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className={REPORT_TONE.indigo.headerRow}>
                        <TableHead>Settled at</TableHead>
                        <TableHead>Delivery note</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Del. date</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Linked total</TableHead>
                        <TableHead className="text-right">Cash coll.</TableHead>
                        <TableHead className="text-right">Daily rate</TableHead>
                        <TableHead className="text-right">To owner</TableHead>
                        <TableHead className="text-right">Cash</TableHead>
                        <TableHead className="text-right">Bank</TableHead>
                        <TableHead>Bank ref</TableHead>
                        <TableHead>Recorded by</TableHead>
                        <TableHead>Linked SOs</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row) => (
                        <TableRow key={row.settlementId}>
                          <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                            {formatDateTime(row.settlementCreatedAt)}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/app/delivery-notes/${row.deliveryId}`}
                              className="font-mono text-xs font-medium text-primary underline-offset-4 hover:underline"
                              title={row.deliveryId}
                            >
                              {shortId(row.deliveryId)}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {row.driverMembershipId ? (
                              <Link
                                href={`/app/company-team/${row.driverMembershipId}`}
                                className="font-medium text-primary underline-offset-4 hover:underline"
                              >
                                {row.driverDisplay}
                              </Link>
                            ) : (
                              <span className="font-medium">{row.driverDisplay}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DeliveryNoteStatusBadge status={row.deliveryStatus} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                            {formatDate(row.deliveryDate)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.orderCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.linkedOrdersTotal != null
                              ? formatCurrency(row.linkedOrdersTotal, row.currency)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.settlementCashTotal != null
                              ? formatCurrency(row.settlementCashTotal, row.currency)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.driverDailyRate != null
                              ? formatCurrency(row.driverDailyRate, row.currency)
                              : "—"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums",
                              row.amountToOwner > 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatCurrency(row.amountToOwner, row.currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(row.cashAmount, row.currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(row.bankTransferAmount, row.currency)}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate text-xs">
                            {row.bankReference ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.recordedByDisplay}
                          </TableCell>
                          <TableCell className="max-w-[160px]">
                            {row.linkedOrders.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {row.linkedOrders.map((so) => (
                                  <Link
                                    key={so.id}
                                    href={`/app/sales-orders/${so.id}`}
                                    className="inline-flex rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-primary underline-offset-2 hover:underline"
                                    title={formatCurrency(so.total, row.currency)}
                                  >
                                    {so.number}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">
                            {row.deliveryNotes ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ReportTableSection>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {range === "custom" && customStart > customEnd
              ? "Select a valid date range."
              : "No settlement data for the selected filters yet."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
