"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, TableProperties } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportPeriodTabs } from "@/components/report-period-tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  getSalesOrderPivotData,
  type SalesOrderPivotData,
} from "@/lib/sales-order-pivot-service";

type PivotPeriod = "today" | "week" | "month" | "year";

const PERIOD_OPTIONS = [
  { value: "today" as const, label: "Today" },
  { value: "week" as const, label: "This week" },
  { value: "month" as const, label: "This month" },
  { value: "year" as const, label: "This year" },
];

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPivotDateRange(period: PivotPeriod): { start: string; end: string } {
  const today = new Date();
  const end = toLocalDateStr(today);

  if (period === "today") {
    return { start: end, end };
  }
  if (period === "week") {
    const startDate = new Date(today);
    const weekday = startDate.getDay();
    const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
    startDate.setDate(startDate.getDate() - daysFromMonday);
    return { start: toLocalDateStr(startDate), end };
  }
  if (period === "month") {
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: toLocalDateStr(startDate), end };
  }
  const startDate = new Date(today.getFullYear(), 0, 1);
  return { start: toLocalDateStr(startDate), end };
}

function formatPeriodLabel(start: string, end: string) {
  if (start === end) {
    return new Date(`${start}T12:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatQty(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatAmount(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function PivotTable({ data }: { data: SalesOrderPivotData }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-600 text-white dark:bg-slate-700">
            <th className="px-4 py-2.5 text-left font-semibold italic">
              Product
            </th>
            <th className="px-4 py-2.5 text-right font-semibold">Total Qty</th>
            <th className="px-4 py-2.5 text-right font-semibold">
              Total Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No sales orders in this period.
              </td>
            </tr>
          ) : (
            data.rows.map((row, index) => (
              <tr
                key={row.product}
                className={cn(
                  "border-t border-border",
                  index % 2 === 0 ? "bg-background" : "bg-muted/40",
                )}
              >
                <td className="px-4 py-2 text-left">{row.product}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatQty(row.totalQty)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatAmount(row.totalAmount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {data.rows.length > 0 ? (
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/70 font-bold">
              <td className="px-4 py-2.5">Grand Total</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatQty(data.grandTotalQty)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatAmount(data.grandTotalAmount)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

export function SalesOrderPivotDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [period, setPeriod] = useState<PivotPeriod>("today");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SalesOrderPivotData | null>(null);

  const { start, end } = useMemo(() => getPivotDateRange(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSalesOrderPivotData({
        startDate: start,
        endDate: end,
      });
      setData(result);
    } catch (e: unknown) {
      setData(null);
      toast({
        title: "Failed to load pivot table",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [start, end, toast]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setPeriod("today");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-4">
        <DialogHeader>
          <DialogTitle>Sales Order Pivot Table</DialogTitle>
          <DialogDescription>
            {data
              ? `${formatPeriodLabel(data.startDate, data.endDate)} · ${data.orderCount.toLocaleString()} sales order${data.orderCount === 1 ? "" : "s"} · ${data.currency} (qty × unit price)`
              : "Product totals from sales orders by issue date."}
          </DialogDescription>
        </DialogHeader>

        <ReportPeriodTabs
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
        />

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <PivotTable data={data} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function SalesOrderPivotButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 shrink-0"
        onClick={() => setOpen(true)}
      >
        <TableProperties className="h-4 w-4 shrink-0" />
        Sales Order Pivot table
      </Button>
      <SalesOrderPivotDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
