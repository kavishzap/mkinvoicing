"use client";

import { memo, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { IncomeByMonth } from "@/lib/dashboard-service";

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(142, 76%, 36%)",
  },
} satisfies ChartConfig;

type Props = {
  data: IncomeByMonth[];
  currency: string;
};

function DashboardIncomeChartInner({ data, currency }: Props) {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [currency],
  );

  const hasData = data.some((d) => d.income > 0);

  if (!hasData) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No income data yet
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data} margin={{ left: 0, right: 16 }}>
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
            `${currency} ${v >= 1000 ? `${v / 1000}k` : v}`
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatter.format(Number(value))}
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
  );
}

export const DashboardIncomeChart = memo(DashboardIncomeChartInner);
