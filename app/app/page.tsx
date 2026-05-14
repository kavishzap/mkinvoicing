"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useToast } from "@/hooks/use-toast";
import {
  Banknote,
  BarChart3,
  FileStack,
  Landmark,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard-service";
import { AppPageShell } from "@/components/app-page-shell";
import { Button } from "@/components/ui/button";

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(142, 76%, 36%)",
  },
} satisfies ChartConfig;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<{
    netSales: number;
    totalPaid: number;
    totalExpense: number;
    totalPurchases: number;
    profitableIncome: number;
    customerCount: number;
    salesInvoiceCount: number;
    driverSettlementCount: number;
    driverSettlementsCashTotal: number;
    driverSettlementsBankTotal: number;
    currency: string;
  } | null>(null);
  const [incomeData, setIncomeData] = useState<
    { month: string; label: string; income: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { stats: s, incomeByMonth } = await getDashboardData();
        setStats(s);
        setIncomeData(incomeByMonth);
      } catch (e: unknown) {
        const err = e as { message?: string };
        toast({
          title: "Failed to load dashboard",
          description: err?.message ?? "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  if (loading || !stats) {
    return (
      <AppPageShell subtitle="See how sales, cash in, and costs look at a glance—then open any module from the sidebar.">
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-32 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={`b-${i}`}>
                <CardHeader className="pb-2">
                  <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-32 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-40 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell subtitle="See how sales, cash in, and costs look at a glance—then open any module from the sidebar.">
      <div className="space-y-4" data-tour-id="dashboard">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Sales
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {formatCurrency(stats.netSales, stats.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total invoice value (paid + pending)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Money In (Paid)
              </CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600">
                {formatCurrency(stats.totalPaid, stats.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Invoices marked as paid
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Expense
              </CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {formatCurrency(stats.totalExpense, stats.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All expenses
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profitable Income
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-xl font-bold ${
                  stats.profitableIncome >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {formatCurrency(stats.profitableIncome, stats.currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Paid sales − purchases − expenses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Customers
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stats.customerCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active & inactive
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sales Invoices
              </CardTitle>
              <FileStack className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stats.salesInvoiceCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Non-cancelled invoices (same basis as net sales)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Driver settlements
              </CardTitle>
              <Landmark className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm font-semibold tabular-nums">
                {stats.driverSettlementCount} recorded
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-2 tabular-nums">
                  <span>Cash to owner</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(stats.driverSettlementsCashTotal, stats.currency)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 tabular-nums">
                  <span>Bank to owner</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(stats.driverSettlementsBankTotal, stats.currency)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t pt-1 tabular-nums font-medium text-foreground">
                  <span>Combined</span>
                  <span>
                    {formatCurrency(
                      stats.driverSettlementsCashTotal + stats.driverSettlementsBankTotal,
                      stats.currency,
                    )}
                  </span>
                </div>
              </div>
              <Link
                href="/app/delivery-notes"
                className="inline-block text-xs text-primary underline-offset-4 hover:underline"
              >
                Open delivery notes
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Shortcuts</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Quick links to reports and tools you use often.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/app/sales-report">
              <BarChart3 className="h-4 w-4 shrink-0" />
              Sales report
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Income Over Time</CardTitle>
          <p className="text-sm text-muted-foreground">
            Monthly income from paid invoices (Jan–Dec, current year)
          </p>
        </CardHeader>
        <CardContent>
          {incomeData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={incomeData} margin={{ left: 0, right: 16 }}>
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
                    stats.currency + " " + (v >= 1000 ? v / 1000 + "k" : v)
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) =>
                        formatCurrency(Number(value), stats.currency)
                      }
                    />
                  }
                />
                <Bar
                  dataKey="income"
                  fill="var(--color-income)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No income data yet
            </div>
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
