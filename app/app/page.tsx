"use client";
export const dynamic = "force-dynamic";

import nextDynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  BarChart3,
  FileStack,
  Landmark,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { DashboardPageSkeleton } from "@/components/page-skeletons";
import { DashboardStatCard } from "@/components/dashboard-stat-card";
import { SalesOrderPivotButton } from "@/components/sales-order-pivot-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAppFeatures } from "@/contexts/app-features-context";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
} from "@/lib/active-company";
import {
  getDashboardData,
  invalidateDashboardCache,
  type DashboardData,
} from "@/lib/dashboard-service";
import { FEATURE_CODES } from "@/lib/app-nav";

const DashboardIncomeChart = nextDynamic(
  () =>
    import("@/components/dashboard-income-chart").then(
      (m) => m.DashboardIncomeChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-md bg-muted/60" />
    ),
  },
);

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; data: DashboardData }
  | { phase: "error" };

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const { has, status: featureStatus } = useAppFeatures();
  const [loadState, setLoadState] = useState<LoadState>({ phase: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoadState({ phase: "loading" });
    try {
      const data = await getDashboardData();
      if (signal.aborted) return;
      setLoadState({ phase: "ready", data });
    } catch (e: unknown) {
      if (signal.aborted) return;
      const message = e instanceof Error ? e.message : "Please try again.";
      setLoadState({ phase: "error" });
      toastRef.current({
        title: "Failed to load dashboard",
        description: message,
        variant: "destructive",
      });
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load, reloadToken]);

  useEffect(() => {
    const bump = () => {
      invalidateDashboardCache();
      setReloadToken((n) => n + 1);
    };
    window.addEventListener(ACTIVE_COMPANY_CHANGED_EVENT, bump);
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_COMPANY_ID_STORAGE_KEY) bump();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ACTIVE_COMPANY_CHANGED_EVENT, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const showSalesReportShortcut =
    featureStatus === "ready" && has(FEATURE_CODES.reporting);
  const showSalesOrderPivot =
    featureStatus === "ready" && has(FEATURE_CODES.salesOrders);

  const shortcutActions =
    showSalesReportShortcut || showSalesOrderPivot ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {showSalesOrderPivot ? <SalesOrderPivotButton /> : null}
        {showSalesReportShortcut ? (
          <Button variant="outline" size="sm" className="gap-2 shrink-0" asChild>
            <Link href="/app/reportings?tab=sales">
              <BarChart3 className="h-4 w-4 shrink-0" />
              Sales report
            </Link>
          </Button>
        ) : null}
      </div>
    ) : undefined;

  const ready = loadState.phase === "ready" ? loadState.data : null;
  const stats = ready?.stats;
  const incomeData = ready?.incomeByMonth ?? [];

  const fmt = useMemo(
    () => (amount: number) => formatMoney(amount, stats?.currency ?? "MUR"),
    [stats?.currency],
  );

  if (loadState.phase === "loading") {
    return (
      <AppPageShell actions={shortcutActions}>
        <DashboardPageSkeleton />
      </AppPageShell>
    );
  }

  if (!stats) {
    return (
      <AppPageShell actions={shortcutActions}>
        <p className="text-sm text-muted-foreground">
          Dashboard data is unavailable. Refresh the page to try again.
        </p>
      </AppPageShell>
    );
  }

  const settlementCombined =
    stats.driverSettlementsCashTotal + stats.driverSettlementsBankTotal;

  return (
    <AppPageShell actions={shortcutActions}>
      <div className="space-y-4" data-tour-id="dashboard">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardStatCard
            title="Net Sales"
            icon={TrendingUp}
            value={<div className="text-xl font-bold">{fmt(stats.netSales)}</div>}
            hint="Total invoice value (paid + pending)"
          />
          <DashboardStatCard
            title="Money In (Paid)"
            icon={Banknote}
            value={
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {fmt(stats.totalPaid)}
              </div>
            }
            hint="Invoices marked as paid"
          />
          <DashboardStatCard
            title="Total Expense"
            icon={Receipt}
            value={
              <div className="text-xl font-bold">{fmt(stats.totalExpense)}</div>
            }
            hint="All expenses"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStatCard
            title="Profitable Income"
            icon={TrendingUp}
            value={
              <div
                className={`text-xl font-bold ${
                  stats.profitableIncome >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {fmt(stats.profitableIncome)}
              </div>
            }
            hint="Paid sales − purchases − expenses"
          />
          <DashboardStatCard
            title="Customers"
            icon={Users}
            value={<div className="text-xl font-bold">{stats.customerCount}</div>}
            hint="Active & inactive"
          />
          <DashboardStatCard
            title="Sales Invoices"
            icon={FileStack}
            value={
              <div className="text-xl font-bold">{stats.salesInvoiceCount}</div>
            }
            hint="Non-cancelled invoices"
          />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Driver settlements
              </CardTitle>
              <Landmark className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm font-semibold tabular-nums">
                {stats.driverSettlementCount} recorded
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-2 tabular-nums">
                  <span>Cash to owner</span>
                  <span className="font-medium text-foreground">
                    {fmt(stats.driverSettlementsCashTotal)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 tabular-nums">
                  <span>Bank to owner</span>
                  <span className="font-medium text-foreground">
                    {fmt(stats.driverSettlementsBankTotal)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 tabular-nums">
                  <span>Due paid (driver balance)</span>
                  <span className="font-medium text-foreground">
                    {fmt(stats.driverSettlementsDuePaidTotal)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 tabular-nums">
                  <span>Due outstanding</span>
                  <span className="font-medium text-red-700 dark:text-red-400">
                    {fmt(stats.driverSettlementsDueOpenTotal)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t pt-1 font-medium tabular-nums text-foreground">
                  <span>Combined received</span>
                  <span>{fmt(settlementCombined)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Cash includes amounts paid later via Driver Balance. Due
                  outstanding is still owed by drivers.
                </p>
              </div>
              <Link
                href="/app/delivery-notes"
                className="inline-block text-xs text-primary underline-offset-4 hover:underline"
              >
                Open delivery notes
                {stats.driverSettlementsOpenDueCount > 0
                  ? ` (${stats.driverSettlementsOpenDueCount} with due)`
                  : ""}
              </Link>
              <Link
                href="/app/delivery-notes/driver-credit"
                className="ml-3 inline-block text-xs text-primary underline-offset-4 hover:underline"
              >
                Driver balance
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income Over Time</CardTitle>
          <p className="text-sm text-muted-foreground">
            Monthly income from paid invoices (Jan–Dec, current year)
          </p>
        </CardHeader>
        <CardContent>
          <DashboardIncomeChart data={incomeData} currency={stats.currency} />
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
