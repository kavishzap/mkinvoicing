"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReportPeriodTabs } from "@/components/report-period-tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  getInvoicePivotData,
  type InvoicePivotData,
} from "@/lib/invoice-pivot-service";
import {
  defaultPivotCustomEnd,
  defaultPivotCustomStart,
  formatPivotPeriodLabel,
  getPivotDateRange,
  isPivotCustomRangeInvalid,
  PIVOT_PERIOD_OPTIONS,
  type PivotPeriod,
} from "@/lib/pivot-date-range";

function formatQty(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatAmount(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function PivotTable({ data }: { data: InvoicePivotData }) {
  return (
    <div className="max-h-[min(70vh,560px)] overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
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
                No invoices in this period.
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
                  {formatAmount(row.totalAmount, data.currency)}
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
                {formatAmount(data.grandTotalAmount, data.currency)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

export function InvoicePivotDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [period, setPeriod] = useState<PivotPeriod>("today");
  const [customStart, setCustomStart] = useState(defaultPivotCustomStart);
  const [customEnd, setCustomEnd] = useState(defaultPivotCustomEnd);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InvoicePivotData | null>(null);

  const { start, end } = useMemo(
    () => getPivotDateRange(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  const customRangeInvalid =
    period === "custom" && isPivotCustomRangeInvalid(customStart, customEnd);

  const dataMatchesSelection =
    data != null && data.startDate === start && data.endDate === end;

  const load = useCallback(async () => {
    if (customRangeInvalid) {
      setData(null);
      return;
    }
    setLoading(true);
    setData(null);
    try {
      const result = await getInvoicePivotData({
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
  }, [start, end, customRangeInvalid, toast]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setPeriod("today");
      setCustomStart(defaultPivotCustomStart());
      setCustomEnd(defaultPivotCustomEnd());
      setData(null);
    }
  }, [open]);

  const descriptionSuffix = loading
    ? "Loading…"
    : dataMatchesSelection
      ? `${data.invoiceCount.toLocaleString()} invoice${data.invoiceCount === 1 ? "" : "s"} · ${data.currency} (qty × unit price)`
      : "Select a period to load product totals.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-4">
        <DialogHeader>
          <DialogTitle>Invoice Pivot Table</DialogTitle>
          <DialogDescription>
            {`${formatPivotPeriodLabel(start, end)} · ${descriptionSuffix}`}
          </DialogDescription>
        </DialogHeader>

        <ReportPeriodTabs
          value={period}
          onChange={setPeriod}
          options={PIVOT_PERIOD_OPTIONS}
        />

        {period === "custom" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice-pivot-custom-start">Start date</Label>
              <Input
                id="invoice-pivot-custom-start"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-pivot-custom-end">End date</Label>
              <Input
                id="invoice-pivot-custom-end"
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {customRangeInvalid ? (
          <p className="text-sm text-destructive">
            Start date must be on or before the end date.
          </p>
        ) : null}

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : dataMatchesSelection && data ? (
          <PivotTable data={data} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function InvoicePivotButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 shrink-0"
        onClick={() => setOpen(true)}
      >
        <FileSpreadsheet className="h-4 w-4 shrink-0" />
        Invoice Pivot table
      </Button>
      <InvoicePivotDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
