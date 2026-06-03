"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Download, Printer, Sparkles, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeliveryBalanceCollapsibleSection } from "@/components/delivery-balance-collapsible-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import {
  DeliveryDriverCollectionBadge,
  DeliveryDriverSettlementBadge,
} from "@/components/delivery-driver-balance-status-badge";
import {
  deleteDeliveryDriverSettlement,
  deliveryUpsellingSalesOrders,
  ensureDeliveryNoteCompleted,
  getDriverStockReturnContext,
  insertDeliveryDriverSettlement,
  returnDriverStockToWarehouse,
  setDeliveryDriverStatus,
  type DeliveryDetail,
  type DeliveryDetailSalesOrder,
  type DriverStockReturnContext,
  type DriverStockReturnLine,
} from "@/lib/deliveries-service";
import { generateDriverBalanceSheetPdf } from "@/lib/driver-balance-sheet-pdf";
import { generateDriverStockReturnPdf } from "@/lib/driver-stock-return-pdf";
import type { TeamMemberRow } from "@/lib/company-team-service";
import {
  addExpense,
  deleteExpense,
  type ExpenseLineItem,
} from "@/lib/expenses-service";

const DRIVER_STOCK_RETURN_P_DAYS_ALL = 0;

function fmtMoneyMur(n: number) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `MUR ${n.toFixed(2)}`;
  }
}

function fmtMoneyCurrency(n: number, currency: string) {
  const ccy = currency?.trim() || "MUR";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${ccy} ${n.toFixed(2)}`;
  }
}

function parseMoneyInput(s: string): number {
  const t = String(s).trim().replace(/,/g, "");
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtDeliveryDay(yyyyMmDd: string | null) {
  if (!yyyyMmDd?.trim()) return null;
  try {
    return new Date(`${yyyyMmDd.trim()}T12:00:00`).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return yyyyMmDd;
  }
}

function deliverySettlementRef(delivery: DeliveryDetail) {
  const day = fmtDeliveryDay(delivery.deliveryDate);
  return day
    ? `Delivery note (scheduled ${day})`
    : `Delivery note ${delivery.id.slice(0, 8)}`;
}

function buildSettlementSummaryNotes(opts: {
  delivery: DeliveryDetail;
  settlementCashTotal: number;
  deliveryTotalAll: number;
  driverRate: number;
  upsellingCommissionTotal: number;
  amountToReturnOwner: number;
  paymentSummary: string;
  bankReference?: string;
  commissionExpenseSummaries: string[];
}): string {
  const lines = [
    "Driver balance settlement recorded in the app.",
    `Driver: ${opts.delivery.driverDisplay}.`,
    deliverySettlementRef(opts.delivery) + ".",
    `Cash for settlement — sum of sales orders with fulfillment “Delivered to customer”, “Completed”, or “Upselling”: ${fmtMoneyMur(opts.settlementCashTotal)}.`,
    `All linked sales order totals on this delivery: ${fmtMoneyMur(opts.deliveryTotalAll)}.`,
    `Driver daily rate: ${fmtMoneyMur(opts.driverRate)}.`,
  ];
  if (opts.upsellingCommissionTotal > 0) {
    lines.push(
      `Upselling commission total: ${fmtMoneyMur(opts.upsellingCommissionTotal)}.`
    );
    if (opts.commissionExpenseSummaries.length > 0) {
      lines.push(`Commission expenses created: ${opts.commissionExpenseSummaries.join("; ")}.`);
    }
  }
  lines.push(`Return to Owner Amount: ${fmtMoneyMur(opts.amountToReturnOwner)}.`);
  lines.push(`Amount returned by driver: ${opts.paymentSummary}.`);
  if (opts.bankReference?.trim()) {
    lines.push(`Bank reference: ${opts.bankReference.trim()}.`);
  }
  return lines.join("\n");
}

function buildUpsellingCommissionLineItems(
  so: DeliveryDetailSalesOrder,
  commissionTotal: number
): ExpenseLineItem[] {
  const catalogItems = (so.items ?? []).filter(
    (it) => String(it.item ?? "").trim() && Number(it.quantity) > 0
  );

  if (catalogItems.length === 0 || commissionTotal <= 0) {
    return [
      {
        item: "Upselling commission",
        description: [
          `Sales order ${so.number}`,
          so.clientName || null,
          "No line items on order",
        ]
          .filter(Boolean)
          .join(" · "),
        quantity: 1,
        unit_price: commissionTotal,
        tax_percent: 0,
        line_total: commissionTotal,
      },
    ];
  }

  const weights = catalogItems.map((it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return Number.isFinite(line) && line > 0 ? line : 0;
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);

  if (weightSum <= 0) {
    return [
      {
        item: "Upselling commission",
        description: `Sales order ${so.number}${so.clientName ? ` · ${so.clientName}` : ""}`,
        quantity: 1,
        unit_price: commissionTotal,
        tax_percent: 0,
        line_total: commissionTotal,
      },
    ];
  }

  const lines: ExpenseLineItem[] = [];
  let allocated = 0;
  for (let i = 0; i < catalogItems.length; i++) {
    const it = catalogItems[i];
    const isLast = i === catalogItems.length - 1;
    const share = isLast
      ? roundMoney2(commissionTotal - allocated)
      : roundMoney2((commissionTotal * weights[i]) / weightSum);
    if (!isLast) allocated += share;

    const productLabel = String(it.item).trim();
    lines.push({
      item: `Commission · ${productLabel}`,
      description: [
        `Sales order ${so.number}`,
        so.clientName || null,
        `Qty ${it.quantity}`,
        `Line ${fmtMoneyCurrency(Number(it.quantity) * Number(it.unit_price), so.currency)}`,
      ]
        .filter(Boolean)
        .join(" · "),
      quantity: 1,
      unit_price: share,
      tax_percent: 0,
      line_total: share,
    });
  }
  return lines;
}

function sumUpsellingCommissionInputs(
  orders: DeliveryDetailSalesOrder[],
  inputs: Record<string, string>
): number {
  let sum = 0;
  for (const so of orders) {
    const amt = parseMoneyInput(inputs[so.salesOrderId] ?? "");
    if (Number.isFinite(amt) && amt > 0) {
      sum += amt;
    }
  }
  return roundMoney2(sum);
}

function DriverBalanceTotalsSummary({
  settlementCashTotal,
  deliveryTotalAll,
  driverRate,
  upsellingCommissionTotal,
  showCommissionLine,
  children,
}: {
  settlementCashTotal: number;
  deliveryTotalAll: number;
  driverRate: number;
  upsellingCommissionTotal: number;
  showCommissionLine: boolean;
  children?: ReactNode;
}) {
  const amountToReturn = roundMoney2(
    settlementCashTotal - driverRate - upsellingCommissionTotal
  );

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
      {children}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Cash for settlement (orders)</span>
        <span className="font-medium tabular-nums">
          {fmtMoneyMur(settlementCashTotal)}
        </span>
      </div>
      {deliveryTotalAll !== settlementCashTotal ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>All linked orders (reference)</span>
          <span className="tabular-nums">{fmtMoneyMur(deliveryTotalAll)}</span>
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Driver daily rate</span>
        <span className="font-medium tabular-nums text-muted-foreground">
          − {fmtMoneyMur(driverRate)}
        </span>
      </div>
      {showCommissionLine ? (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Commission</span>
          <span className="font-medium tabular-nums text-purple-800 dark:text-purple-300">
            − {fmtMoneyMur(upsellingCommissionTotal)}
          </span>
        </div>
      ) : null}
      <div className="border-t pt-2 flex items-center justify-between text-base">
        <span className="font-semibold">Return to Owner Amount</span>
        <span className="font-bold tabular-nums">{fmtMoneyMur(amountToReturn)}</span>
      </div>
    </div>
  );
}

function validateReturnQtyInput(
  raw: string,
  opts: { onDriver: number; deliveryQty: number }
): string | null {
  const t = String(raw).trim().replace(/,/g, "");
  if (t === "") return null;
  const qty = Number(t);
  if (!Number.isFinite(qty)) return "Enter a valid number.";
  if (qty < 0) return "Cannot be negative.";
  if (qty === 0) return "Must be greater than zero.";
  if (!Number.isInteger(qty)) return "Use a whole number.";
  if (opts.onDriver <= 0) return "Nothing on driver to return.";
  if (qty > opts.onDriver) {
    return `Max ${opts.onDriver} on driver.`;
  }
  if (qty > opts.deliveryQty) {
    return `Max ${opts.deliveryQty} on this delivery.`;
  }
  return null;
}

function validateUpsellingCommissionInput(raw: string): string | null {
  const t = String(raw).trim();
  if (t === "") return "Enter commission before settling.";
  const amt = parseMoneyInput(t);
  if (!Number.isFinite(amt) || amt < 0) {
    return "Enter a valid amount (zero or more).";
  }
  return null;
}

type DriverSettlementValidationInput = {
  delivery: DeliveryDetail;
  upsellingOrders: DeliveryDetailSalesOrder[];
  commissionInputs: Record<string, string>;
  stockReturnLines: DriverStockReturnLine[];
  driverStockAvailable: Record<string, number>;
  returnQtys: Record<string, string>;
  driverRate: number;
};

type DriverSettlementValidationResult = {
  message: string | null;
  commissionErrors: Record<string, string>;
  returnQtyErrors: Record<string, string>;
};

function validateDriverSettlementPrerequisites(
  input: DriverSettlementValidationInput
): DriverSettlementValidationResult {
  const commissionErrors: Record<string, string> = {};
  const returnQtyErrors: Record<string, string> = {};
  let message: string | null = null;

  const note = (text: string) => {
    if (!message) message = text;
  };

  if (!Number.isFinite(input.driverRate) || input.driverRate < 0) {
    note("Driver daily rate is missing or invalid. Set it in Company Team first.");
  }

  for (const so of input.upsellingOrders) {
    const err = validateUpsellingCommissionInput(
      input.commissionInputs[so.salesOrderId] ?? ""
    );
    if (err) {
      commissionErrors[so.salesOrderId] = err;
      note(`Upselling order ${so.number}: ${err}`);
    }
  }

  for (const l of input.stockReturnLines) {
    const onDriver = input.driverStockAvailable[l.productId] ?? 0;
    const raw = input.returnQtys[l.productId] ?? "";
    const fieldErr = validateReturnQtyInput(raw, {
      onDriver,
      deliveryQty: l.deliveryQty,
    });
    if (fieldErr) {
      returnQtyErrors[l.productId] = fieldErr;
      note(`${l.productName}: ${fieldErr}`);
      continue;
    }
    if (onDriver > 0) {
      returnQtyErrors[l.productId] =
        `Return all ${onDriver} unit(s) still on driver (use Return stock).`;
      note(
        `Return driver stock first — ${l.productName} still has ${onDriver} unit(s) on the driver.`
      );
    }
  }

  return { message, commissionErrors, returnQtyErrors };
}

function UpsellingOrderCollapsible({
  so,
  readOnly,
  commissionValue,
  commissionError,
  onCommissionChange,
  disabled,
}: {
  so: DeliveryDetailSalesOrder;
  readOnly: boolean;
  commissionValue: string;
  commissionError?: string | null;
  onCommissionChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const items = so.items?.length ? so.items : [];
  const lineRows =
    items.length > 0
      ? items
      : [
          {
            product_id: null,
            item: "—",
            description: null,
            quantity: 0,
            unit_price: 0,
            tax_percent: 0,
          },
        ];
  return (
    <DeliveryBalanceCollapsibleSection
      icon={Sparkles}
      title="Upselling"
      count={items.length}
      defaultOpen
    >
      <div className="space-y-4">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px] whitespace-nowrap">
                  Sales order
                </TableHead>
                <TableHead className="min-w-[120px]">Customer</TableHead>
                <TableHead className="min-w-[160px]">Item</TableHead>
                <TableHead className="text-right whitespace-nowrap w-20">Qty</TableHead>
                <TableHead className="text-right whitespace-nowrap">Unit price</TableHead>
                <TableHead className="text-right whitespace-nowrap">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineRows.map((it, idx) => {
                const lineTotal =
                  Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
                const hasItems = items.length > 0;
                return (
                  <TableRow key={`${so.linkId}-${idx}`}>
                    {idx === 0 ? (
                      <>
                        <TableCell
                          className="align-top whitespace-nowrap"
                          rowSpan={lineRows.length}
                        >
                          {so.salesOrderId ? (
                            <Link
                              href={`/app/sales-orders/${so.salesOrderId}`}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {so.number}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{so.number || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top" rowSpan={lineRows.length}>
                          {so.clientName ? (
                            so.customerId ? (
                              <Link
                                href={`/app/customers/${so.customerId}/edit`}
                                className="line-clamp-3 font-medium text-primary underline-offset-4 hover:underline"
                              >
                                {so.clientName}
                              </Link>
                            ) : (
                              <span className="line-clamp-3 font-medium">{so.clientName}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell className="font-medium align-top">
                      {hasItems && it.product_id ? (
                        <Link
                          href={`/app/products/${it.product_id}/edit`}
                          className="line-clamp-3 text-primary underline-offset-4 hover:underline"
                        >
                          {it.item}
                        </Link>
                      ) : (
                        <span className="line-clamp-3">{it.item}</span>
                      )}
                      {it.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {it.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums align-top">
                      {hasItems ? it.quantity : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums align-top text-muted-foreground">
                      {hasItems ? fmtMoneyCurrency(it.unit_price, so.currency) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums align-top font-medium">
                      {hasItems ? fmtMoneyCurrency(lineTotal, so.currency) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length > 0 ? (
                <TableRow className="bg-muted/30 font-medium">
                  <TableCell colSpan={5} className="text-right">
                    Sales order total
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoneyCurrency(so.total, so.currency)}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No line items on this order.</p>
        ) : null}

        <div className="flex flex-wrap items-end justify-end gap-2 pt-1">
          <Label
            htmlFor={`upsell-commission-${so.salesOrderId}`}
            className="text-sm text-muted-foreground shrink-0 pb-2"
          >
            Commission (MUR)
          </Label>
          {readOnly ? (
            <p className="min-w-[8rem] pb-2 text-right text-sm font-semibold tabular-nums">
              {commissionValue.trim() !== ""
                ? fmtMoneyMur(parseMoneyInput(commissionValue))
                : "—"}
            </p>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <Input
                id={`upsell-commission-${so.salesOrderId}`}
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                aria-invalid={commissionError != null}
                className="h-9 w-36 text-right tabular-nums"
                placeholder="0"
                value={commissionValue}
                onChange={(e) => onCommissionChange?.(e.target.value)}
                disabled={disabled}
              />
              {commissionError ? (
                <p className="text-[11px] leading-snug text-destructive" role="alert">
                  {commissionError}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </DeliveryBalanceCollapsibleSection>
  );
}

function returnQtysFromStockContext(ctx: DriverStockReturnContext): Record<string, string> {
  const init: Record<string, string> = {};
  for (const l of ctx.lines) {
    const avail = ctx.availableByProduct[l.productId] ?? 0;
    init[l.productId] =
      avail > 0 ? String(Math.min(l.deliveryQty, avail)) : "";
  }
  return init;
}

function applyStockReturnContext(
  ctx: DriverStockReturnContext,
  setters: {
    setStockReturnLines: (lines: DriverStockReturnLine[]) => void;
    setDriverStockAvailable: (m: Record<string, number>) => void;
    setReturnQtys: (q: Record<string, string>) => void;
    setReturnQtyErrors: (e: Record<string, string>) => void;
  }
) {
  setters.setStockReturnLines(ctx.lines);
  setters.setDriverStockAvailable(ctx.availableByProduct);
  setters.setReturnQtys(returnQtysFromStockContext(ctx));
  setters.setReturnQtyErrors({});
}

type Props = {
  delivery: DeliveryDetail;
  drivers: TeamMemberRow[];
  stockReturn: DriverStockReturnContext | null;
  onDeliveryUpdated: () => void | Promise<void>;
};

export function DeliveryDriverBalancePanel({
  delivery,
  drivers,
  stockReturn,
  onDeliveryUpdated,
}: Props) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [stockReturnLines, setStockReturnLines] = useState<DriverStockReturnLine[]>([]);
  const [driverStockAvailable, setDriverStockAvailable] = useState<Record<string, number>>(
    {}
  );
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [returnQtyErrors, setReturnQtyErrors] = useState<Record<string, string>>({});
  const [stockReturnBusy, setStockReturnBusy] = useState(false);
  const [stockReturnConfirmOpen, setStockReturnConfirmOpen] = useState(false);
  const [stockReturnPendingCount, setStockReturnPendingCount] = useState(0);
  const [settleProceedConfirmOpen, setSettleProceedConfirmOpen] = useState(false);
  const [completeSettlementConfirmOpen, setCompleteSettlementConfirmOpen] =
    useState(false);
  const [stockSheetBusy, setStockSheetBusy] = useState(false);
  const [step, setStep] = useState<"preview" | "payment">("preview");
  const [settlementCashInput, setSettlementCashInput] = useState("");
  const [settlementBankInput, setSettlementBankInput] = useState("");
  const [settlementBankReference, setSettlementBankReference] = useState("");
  const [balanceSheetBusy, setBalanceSheetBusy] = useState(false);
  const [commissionInputs, setCommissionInputs] = useState<Record<string, string>>(
    {}
  );
  const [upsellingCommissionErrors, setUpsellingCommissionErrors] = useState<
    Record<string, string>
  >({});
  const upsellingOrders = useMemo(
    () => deliveryUpsellingSalesOrders(delivery.salesOrders),
    [delivery.salesOrders]
  );

  const selectedDriverMember = useMemo(
    () => drivers.find((d) => d.userId === delivery.driverUserId) ?? null,
    [drivers, delivery.driverUserId]
  );
  const selectedDriverRate = Number(selectedDriverMember?.driverRate ?? 0);
  const selectedDeliveryTotalAll = Number(delivery.totalAmount ?? 0);
  const selectedSettlementCashTotal = Number(
    delivery.totalAmountCashForSettlement ?? 0
  );
  const totalUpsellingCommission = useMemo(
    () => sumUpsellingCommissionInputs(upsellingOrders, commissionInputs),
    [upsellingOrders, commissionInputs]
  );
  const showCommissionLine = upsellingOrders.length > 0;
  const amountToReturnOwner = roundMoney2(
    selectedSettlementCashTotal - selectedDriverRate - totalUpsellingCommission
  );
  const dueRounded = amountToReturnOwner;

  const settlementCashParsed = useMemo(
    () => parseMoneyInput(settlementCashInput),
    [settlementCashInput]
  );
  const settlementBankParsed = useMemo(
    () => parseMoneyInput(settlementBankInput),
    [settlementBankInput]
  );
  const settlementSplitSum = useMemo(() => {
    if (!Number.isFinite(settlementCashParsed) || !Number.isFinite(settlementBankParsed)) {
      return NaN;
    }
    return roundMoney2(settlementCashParsed + settlementBankParsed);
  }, [settlementCashParsed, settlementBankParsed]);

  const settlementPaymentReady = useMemo(() => {
    if (!Number.isFinite(settlementCashParsed) || !Number.isFinite(settlementBankParsed)) {
      return false;
    }
    if (dueRounded <= 0) {
      return settlementCashParsed === 0 && settlementBankParsed === 0;
    }
    return (
      settlementSplitSum === dueRounded &&
      (settlementCashParsed > 0 || settlementBankParsed > 0)
    );
  }, [dueRounded, settlementBankParsed, settlementCashParsed, settlementSplitSum]);

  const settlementPrerequisites = useMemo(
    () =>
      validateDriverSettlementPrerequisites({
        delivery,
        upsellingOrders,
        commissionInputs,
        stockReturnLines,
        driverStockAvailable,
        returnQtys,
        driverRate: selectedDriverRate,
      }),
    [
      commissionInputs,
      delivery,
      driverStockAvailable,
      returnQtys,
      selectedDriverRate,
      stockReturnLines,
      upsellingOrders,
    ]
  );

  const applyDriverSettlementValidation = useCallback(() => {
    const result = validateDriverSettlementPrerequisites({
      delivery,
      upsellingOrders,
      commissionInputs,
      stockReturnLines,
      driverStockAvailable,
      returnQtys,
      driverRate: selectedDriverRate,
    });
    setUpsellingCommissionErrors(result.commissionErrors);
    setReturnQtyErrors((prev) => ({ ...prev, ...result.returnQtyErrors }));
    return result.message;
  }, [
    commissionInputs,
    delivery,
    driverStockAvailable,
    returnQtys,
    selectedDriverRate,
    stockReturnLines,
    upsellingOrders,
  ]);

  useEffect(() => {
    setStep("preview");
    setSettlementCashInput("");
    setSettlementBankInput("");
    setSettlementBankReference("");
  }, [delivery.id, delivery.driverStatus]);

  useEffect(() => {
    if (delivery.driverStatus || !stockReturn) {
      setStockReturnLines([]);
      setDriverStockAvailable({});
      setReturnQtys({});
      setReturnQtyErrors({});
      return;
    }
    applyStockReturnContext(stockReturn, {
      setStockReturnLines,
      setDriverStockAvailable,
      setReturnQtys,
      setReturnQtyErrors,
    });
  }, [delivery.id, delivery.driverStatus, stockReturn]);

  useEffect(() => {
    setCommissionInputs((prev) => {
      const next: Record<string, string> = {};
      for (const so of upsellingOrders) {
        next[so.salesOrderId] = prev[so.salesOrderId] ?? "";
      }
      return next;
    });
    setUpsellingCommissionErrors({});
  }, [delivery.id, upsellingOrders]);

  const runBalanceSheet = useCallback(
    async (mode: "download" | "print") => {
      if (balanceSheetBusy) return;
      setBalanceSheetBusy(true);
      try {
        const result = await generateDriverBalanceSheetPdf(delivery, mode);
        if (result.mode === "print-fallback") {
          toast({
            title: "Print blocked",
            description: "Allow popups to print. PDF downloaded instead.",
          });
        } else {
          toast({
            title: mode === "print" ? "Opening print dialog" : "Downloaded",
            description: result.filename,
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Could not generate sheet",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setBalanceSheetBusy(false);
      }
    },
    [balanceSheetBusy, delivery, toast]
  );

  const runStockReturnSheet = useCallback(
    async (mode: "download" | "print") => {
      if (stockSheetBusy || stockReturnLines.length === 0) return;
      setStockSheetBusy(true);
      try {
        const result = generateDriverStockReturnPdf(
          {
            delivery: {
              id: delivery.id,
              driverDisplay: delivery.driverDisplay,
              status: delivery.status,
              createdAt: delivery.createdAt,
              createdByDisplay: delivery.createdByDisplay,
              deliveryDate: delivery.deliveryDate,
            },
            lines: stockReturnLines,
            availableByProduct: driverStockAvailable,
            returnQtys,
          },
          mode
        );
        if (result.mode === "print-fallback") {
          toast({
            title: "Print blocked",
            description: "Allow popups to print. PDF downloaded instead.",
          });
        } else {
          toast({
            title: mode === "print" ? "Opening print dialog" : "Downloaded",
            description: result.filename,
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Could not generate stock sheet",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setStockSheetBusy(false);
      }
    },
    [
      delivery.createdAt,
      delivery.createdByDisplay,
      delivery.deliveryDate,
      delivery.driverDisplay,
      delivery.id,
      delivery.status,
      driverStockAvailable,
      returnQtys,
      stockReturnLines,
      stockSheetBusy,
      toast,
    ]
  );

  function collectStockReturnEntries(): {
    entries: { productId: string; productName: string; qty: number }[];
    nextErrors: Record<string, string>;
  } {
    const entries: { productId: string; productName: string; qty: number }[] = [];
    const nextErrors: Record<string, string> = {};

    for (const l of stockReturnLines) {
      const raw = returnQtys[l.productId] ?? "";
      const onDriver = driverStockAvailable[l.productId] ?? 0;
      const fieldErr = validateReturnQtyInput(raw, {
        onDriver,
        deliveryQty: l.deliveryQty,
      });
      if (fieldErr) {
        nextErrors[l.productId] = fieldErr;
        continue;
      }
      const t = String(raw).trim();
      if (t === "") continue;
      const qty = Number(t);
      entries.push({ productId: l.productId, productName: l.productName, qty });
    }

    return { entries, nextErrors };
  }

  function requestStockReturn() {
    const { entries, nextErrors } = collectStockReturnEntries();
    setReturnQtyErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast({
        title: "Check return quantities",
        description: "Fix the highlighted return qty fields before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (entries.length === 0) {
      toast({
        title: "Nothing to return",
        description: "Enter a return quantity greater than zero for at least one product.",
        variant: "destructive",
      });
      return;
    }

    setStockReturnPendingCount(entries.length);
    setStockReturnConfirmOpen(true);
  }

  async function performStockReturn() {
    const driverId = delivery.driverUserId;
    const { entries } = collectStockReturnEntries();
    if (entries.length === 0) return;

    try {
      setStockReturnBusy(true);
      for (const { productId, qty } of entries) {
        await returnDriverStockToWarehouse({
          driverUserId: driverId,
          productId,
          quantity: qty,
        });
      }
      toast({
        title: "Stock returned to warehouse",
        description: `${entries.length} product line(s) moved from driver to primary warehouse.`,
      });
      const ctx = await getDriverStockReturnContext(delivery.id, {
        p_days: DRIVER_STOCK_RETURN_P_DAYS_ALL,
        delivery,
      });
      applyStockReturnContext(ctx, {
        setStockReturnLines,
        setDriverStockAvailable,
        setReturnQtys,
        setReturnQtyErrors,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Stock return failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setStockReturnBusy(false);
    }
  }

  function requestSettleProceed() {
    const block = applyDriverSettlementValidation();
    if (block) {
      toast({
        title: "Cannot settle yet",
        description: block,
        variant: "destructive",
      });
      return;
    }
    setSettleProceedConfirmOpen(true);
  }

  function performSettleProceed() {
    if (dueRounded > 0) {
      setSettlementCashInput(String(dueRounded));
      setSettlementBankInput("");
    } else {
      setSettlementCashInput("");
      setSettlementBankInput("");
    }
    setSettlementBankReference("");
    setStep("payment");
  }

  function requestCompleteSettlement() {
    const block = applyDriverSettlementValidation();
    if (block) {
      toast({
        title: "Cannot settle yet",
        description: block,
        variant: "destructive",
      });
      return;
    }

    if (!settlementPaymentReady) {
      toast({
        title: "Check payment split",
        description:
          dueRounded > 0
            ? "Enter cash and/or bank amounts that add up to the amount due."
            : "For this net amount, leave both cash and bank at zero.",
        variant: "destructive",
      });
      return;
    }

    setCompleteSettlementConfirmOpen(true);
  }

  async function performCompleteSettlement() {
    const cashAmt = settlementCashParsed;
    const bankAmt = settlementBankParsed;
    const refTrim = settlementBankReference.trim();

    const createdExpenseIds: string[] = [];
    let settlementId: string | null = null;
    try {
      setConfirming(true);
      const rate = Number(selectedDriverRate);

      const parts: string[] = [];
      if (cashAmt > 0) parts.push(`Cash ${fmtMoneyMur(cashAmt)}`);
      if (bankAmt > 0) parts.push(`Bank transfer ${fmtMoneyMur(bankAmt)}`);
      const paymentSummary =
        parts.length > 0 ? parts.join(" · ") : "No cash movement (net ≤ 0)";

      const settlementDate = new Date().toISOString().slice(0, 10);
      const commissionExpenseSummaries: string[] = [];

      for (const so of upsellingOrders) {
        const commissionAmt = parseMoneyInput(commissionInputs[so.salesOrderId] ?? "");
        if (!Number.isFinite(commissionAmt) || commissionAmt <= 0) continue;

        const lineItems = buildUpsellingCommissionLineItems(so, commissionAmt);
        const productNames = (so.items ?? [])
          .map((it) => String(it.item ?? "").trim())
          .filter(Boolean);
        const primaryProduct = productNames[0] ?? "Upselling";

        const commissionExpense = await addExpense({
          description: `Upselling commission — ${so.number} · ${primaryProduct}`,
          amount: commissionAmt,
          currency: so.currency || "MUR",
          expense_date: settlementDate,
          notes: [
            "Upselling commission expense from driver balance settlement.",
            `Driver: ${delivery.driverDisplay}.`,
            deliverySettlementRef(delivery) + ".",
            `Sales order: ${so.number}.`,
            so.clientName ? `Customer: ${so.clientName}.` : null,
            `Commission amount: ${fmtMoneyMur(commissionAmt)}.`,
            productNames.length > 0
              ? `Products: ${productNames.join(", ")}.`
              : null,
            "Line items below split the commission by product line on this order.",
          ]
            .filter(Boolean)
            .join("\n"),
          line_items: lineItems,
        });
        createdExpenseIds.push(commissionExpense.id);
        commissionExpenseSummaries.push(
          `${so.number} ${fmtMoneyMur(commissionAmt)} (${primaryProduct})`
        );
      }

      const settlementNotes = buildSettlementSummaryNotes({
        delivery,
        settlementCashTotal: selectedSettlementCashTotal,
        deliveryTotalAll: selectedDeliveryTotalAll,
        driverRate: rate,
        upsellingCommissionTotal: totalUpsellingCommission,
        amountToReturnOwner,
        paymentSummary,
        bankReference: refTrim || undefined,
        commissionExpenseSummaries,
      });

      const salaryExpense = await addExpense({
        description: `Driver daily rate — ${delivery.driverDisplay}`,
        amount: rate,
        currency: "MUR",
        expense_date: settlementDate,
        notes: [
          "Driver daily rate expense from delivery balance settlement.",
          `Driver: ${delivery.driverDisplay}.`,
          deliverySettlementRef(delivery) + ".",
          `Daily rate charged on settlement: ${fmtMoneyMur(rate)}.`,
          "",
          settlementNotes,
        ].join("\n"),
        line_items: [
          {
            item: "Driver daily rate",
            description: [
              deliverySettlementRef(delivery),
              `Settlement date ${settlementDate}`,
              "Pay for driver’s day on this route",
            ].join(" · "),
            quantity: 1,
            unit_price: rate,
            tax_percent: 0,
            line_total: rate,
          },
        ],
      });
      createdExpenseIds.unshift(salaryExpense.id);

      const { id: sid } = await insertDeliveryDriverSettlement({
        deliveryId: delivery.id,
        driverUserId: delivery.driverUserId,
        amountToOwner: dueRounded,
        currency: "MUR",
        settlementCashTotal: selectedSettlementCashTotal,
        driverDailyRate: selectedDriverRate,
        linkedOrdersTotal: selectedDeliveryTotalAll,
        cashAmount: cashAmt,
        bankTransferAmount: bankAmt,
        bankReference: bankAmt > 0 && refTrim ? refTrim : null,
        expenseId: salaryExpense.id,
      });
      settlementId = sid;

      await setDeliveryDriverStatus(delivery.id, true);
      await ensureDeliveryNoteCompleted(delivery.id);
      await onDeliveryUpdated();

      const expenseMsg =
        commissionExpenseSummaries.length > 0
          ? `Driver daily rate and ${commissionExpenseSummaries.length} upselling commission expense(s) saved.`
          : "Driver daily rate expense saved.";
      toast({
        title: "Driver balance recorded",
        description: `${expenseMsg} Payment logged, delivery note marked completed, and driver settlement saved.`,
      });
      setStep("preview");
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (settlementId) {
        try {
          await deleteDeliveryDriverSettlement(settlementId);
        } catch {
          /* ignore */
        }
      }
      for (const eid of [...createdExpenseIds].reverse()) {
        try {
          await deleteExpense(eid);
        } catch {
          /* ignore */
        }
      }
      toast({
        title: "Could not settle driver balance",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  }

  const sheetActions = (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={balanceSheetBusy}
        onClick={() => void runBalanceSheet("download")}
      >
        <Download className="h-4 w-4" aria-hidden />
        {balanceSheetBusy ? "Preparing…" : "Download balance sheet"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={balanceSheetBusy}
        onClick={() => void runBalanceSheet("print")}
      >
        <Printer className="h-4 w-4" aria-hidden />
        {balanceSheetBusy ? "Preparing…" : "Print balance sheet"}
      </Button>
    </div>
  );

  if (delivery.driverStatus) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Driver balance</h2>
            <p className="text-sm text-muted-foreground">
              Collection recorded for {delivery.driverDisplay}.
            </p>
          </div>
          {sheetActions}
        </div>
        <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Money collected (cash + bank)</span>
            <span className="font-semibold tabular-nums">
              {delivery.driverCollectedAmount != null
                ? fmtMoneyMur(delivery.driverCollectedAmount)
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Collection</span>
            <DeliveryDriverCollectionBadge collected />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Settlement</span>
            <DeliveryDriverSettlementBadge settled />
          </div>
        </div>
        <DriverBalanceTotalsSummary
          settlementCashTotal={selectedSettlementCashTotal}
          deliveryTotalAll={selectedDeliveryTotalAll}
          driverRate={selectedDriverRate}
          upsellingCommissionTotal={totalUpsellingCommission}
          showCommissionLine={showCommissionLine}
        />

        {upsellingOrders.length > 0 ? (
          <div className="space-y-3">
            {upsellingOrders.map((so) => (
              <UpsellingOrderCollapsible
                key={so.salesOrderId}
                so={so}
                readOnly
                commissionValue={commissionInputs[so.salesOrderId] ?? ""}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Driver balance</h2>
          <p className="text-sm text-muted-foreground">
            {step === "payment"
              ? "Enter how the driver returned the net amount to you, then complete settlement."
              : "Return all stock still on the driver, enter upselling commission per order, then settle."}
          </p>
        </div>
        {sheetActions}
      </div>

      {step === "preview" ? (
        <div className="space-y-4">
          <DriverBalanceTotalsSummary
            settlementCashTotal={selectedSettlementCashTotal}
            deliveryTotalAll={selectedDeliveryTotalAll}
            driverRate={selectedDriverRate}
            upsellingCommissionTotal={totalUpsellingCommission}
            showCommissionLine={showCommissionLine}
          >
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Driver</span>
              <span className="font-medium">{delivery.driverDisplay}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Collection</span>
              <DeliveryDriverCollectionBadge collected={false} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Settlement</span>
              <DeliveryDriverSettlementBadge settled={false} />
            </div>
          </DriverBalanceTotalsSummary>

          <Separator />

          <div className="space-y-3">
            <DeliveryBalanceCollapsibleSection
              icon={Warehouse}
              title="Return driver stock"
              count={stockReturnLines.length}
              defaultOpen={stockReturnLines.length > 0}
            >
              {stockReturnLines.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                  {delivery.salesOrders.length > 0
                    ? "No matching lines: need fulfillment Delivered to driver, Rescheduled, or Pending, with catalog-linked line items on this delivery."
                    : "No products on this delivery."}
                </p>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Product</TableHead>
                          <TableHead className="min-w-[100px]">Sales order</TableHead>
                          <TableHead className="min-w-[120px]">Status</TableHead>
                          <TableHead className="text-right whitespace-nowrap">
                            Total
                          </TableHead>
                          <TableHead className="text-right whitespace-nowrap">
                            Line qty
                          </TableHead>
                          <TableHead className="text-right whitespace-nowrap">
                            On driver
                          </TableHead>
                          <TableHead className="w-[120px] text-right">Return qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockReturnLines.map((l) => {
                          const onDriver = driverStockAvailable[l.productId] ?? 0;
                          const soRows =
                            l.salesOrders.length > 0
                              ? l.salesOrders
                              : [
                                  {
                                    salesOrderId: "",
                                    salesOrderNumber: "—",
                                    salesOrderTotal: 0,
                                    currency: "MUR",
                                    qty: 0,
                                    fulfillmentStatus: "pending" as const,
                                  },
                                ];
                          return soRows.map((so, idx) => (
                            <TableRow
                              key={
                                so.salesOrderId
                                  ? `${l.productId}-${so.salesOrderId}`
                                  : `${l.productId}-empty`
                              }
                            >
                              {idx === 0 ? (
                                <>
                                  <TableCell
                                    className="font-medium max-w-[200px] align-top"
                                    rowSpan={soRows.length}
                                  >
                                    <Link
                                      href={`/app/products/${l.productId}/edit`}
                                      className="line-clamp-3 text-primary underline-offset-4 hover:underline"
                                    >
                                      {l.productName}
                                    </Link>
                                  </TableCell>
                                </>
                              ) : null}
                              <TableCell className="align-top whitespace-nowrap">
                                {so.salesOrderId ? (
                                  <Link
                                    href={`/app/sales-orders/${so.salesOrderId}`}
                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                  >
                                    {so.salesOrderNumber}
                                  </Link>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="align-top">
                                {so.salesOrderId ? (
                                  <SalesOrderFulfillmentStatusBadge
                                    status={so.fulfillmentStatus}
                                    className="h-5 shrink-0 px-1.5 text-[10px]"
                                  />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums align-top whitespace-nowrap">
                                {so.salesOrderId
                                  ? fmtMoneyCurrency(so.salesOrderTotal, so.currency)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums align-top">
                                {so.salesOrderId ? so.qty : "—"}
                              </TableCell>
                              {idx === 0 ? (
                                <>
                                  <TableCell
                                    className="text-right tabular-nums align-top"
                                    rowSpan={soRows.length}
                                  >
                                    {onDriver}
                                  </TableCell>
                                  <TableCell
                                    className="text-right align-top min-w-[7.5rem]"
                                    rowSpan={soRows.length}
                                  >
                                    <Label
                                      htmlFor={`ret-qty-${l.productId}`}
                                      className="sr-only"
                                    >
                                      Return quantity for {l.productName}
                                    </Label>
                                    <Input
                                      id={`ret-qty-${l.productId}`}
                                      type="number"
                                      min={0}
                                      step={1}
                                      inputMode="numeric"
                                      aria-invalid={
                                        returnQtyErrors[l.productId] != null
                                      }
                                      className="h-8 w-full rounded text-right tabular-nums"
                                      value={returnQtys[l.productId] ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setReturnQtys((prev) => ({
                                          ...prev,
                                          [l.productId]: v,
                                        }));
                                        const err = validateReturnQtyInput(v, {
                                          onDriver,
                                          deliveryQty: l.deliveryQty,
                                        });
                                        setReturnQtyErrors((prev) => {
                                          const next = { ...prev };
                                          if (err) next[l.productId] = err;
                                          else delete next[l.productId];
                                          return next;
                                        });
                                      }}
                                      onBlur={(e) => {
                                        const err = validateReturnQtyInput(
                                          e.target.value,
                                          { onDriver, deliveryQty: l.deliveryQty }
                                        );
                                        setReturnQtyErrors((prev) => {
                                          const next = { ...prev };
                                          if (err) next[l.productId] = err;
                                          else delete next[l.productId];
                                          return next;
                                        });
                                      }}
                                      disabled={stockReturnBusy || confirming}
                                    />
                                    {returnQtyErrors[l.productId] ? (
                                      <p
                                        className="mt-1 text-left text-[11px] leading-snug text-destructive"
                                        role="alert"
                                      >
                                        {returnQtyErrors[l.productId]}
                                      </p>
                                    ) : null}
                                  </TableCell>
                                </>
                              ) : null}
                            </TableRow>
                          ));
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2 print:hidden">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={
                        stockSheetBusy ||
                        stockReturnBusy ||
                        confirming ||
                        stockReturnLines.length === 0
                      }
                      onClick={() => void runStockReturnSheet("download")}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      {stockSheetBusy ? "Preparing…" : "Download stock PDF"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={
                        stockSheetBusy ||
                        stockReturnBusy ||
                        confirming ||
                        stockReturnLines.length === 0
                      }
                      onClick={() => void runStockReturnSheet("print")}
                    >
                      <Printer className="h-4 w-4" aria-hidden />
                      {stockSheetBusy ? "Preparing…" : "Print stock"}
                    </Button>
                    <Button
                      type="button"
                      className="gap-2 rounded font-semibold shadow-sm"
                      disabled={
                        stockReturnBusy ||
                        confirming ||
                        stockReturnLines.length === 0 ||
                        Object.keys(returnQtyErrors).length > 0
                      }
                      onClick={requestStockReturn}
                    >
                      {stockReturnBusy ? "Returning…" : "Return stock"}
                    </Button>
                  </div>
                </>
              )}
            </DeliveryBalanceCollapsibleSection>

            {upsellingOrders.length > 0 ? (
              <>
                {upsellingOrders.map((so) => (
                  <UpsellingOrderCollapsible
                    key={so.salesOrderId}
                    so={so}
                    readOnly={false}
                    commissionValue={commissionInputs[so.salesOrderId] ?? ""}
                    commissionError={upsellingCommissionErrors[so.salesOrderId]}
                    onCommissionChange={(v) => {
                      setCommissionInputs((prev) => ({
                        ...prev,
                        [so.salesOrderId]: v,
                      }));
                      setUpsellingCommissionErrors((prev) => {
                        const next = { ...prev };
                        delete next[so.salesOrderId];
                        return next;
                      });
                    }}
                    disabled={confirming || stockReturnBusy}
                  />
                ))}
              </>
            ) : null}
          </div>

          {settlementPrerequisites.message ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {settlementPrerequisites.message}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              className="rounded font-semibold shadow-sm"
              disabled={
                confirming ||
                stockReturnBusy ||
                settlementPrerequisites.message != null
              }
              onClick={requestSettleProceed}
            >
              Settle
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <DriverBalanceTotalsSummary
            settlementCashTotal={selectedSettlementCashTotal}
            deliveryTotalAll={selectedDeliveryTotalAll}
            driverRate={selectedDriverRate}
            upsellingCommissionTotal={totalUpsellingCommission}
            showCommissionLine={showCommissionLine}
          />
          <p className="text-xs text-muted-foreground">
            Split between cash and bank transfer; both can be used. The two amounts must
            add up to the Return to Owner Amount (when it is greater than zero).
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settlement-cash-amt">Cash (MUR)</Label>
              <Input
                id="settlement-cash-amt"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                className="tabular-nums"
                value={settlementCashInput}
                onChange={(e) => setSettlementCashInput(e.target.value)}
                disabled={confirming}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settlement-bank-amt">Bank transfer (MUR)</Label>
              <Input
                id="settlement-bank-amt"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                className="tabular-nums"
                value={settlementBankInput}
                onChange={(e) => setSettlementBankInput(e.target.value)}
                disabled={confirming}
                placeholder="0"
              />
            </div>
          </div>

          {settlementBankParsed > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="settlement-bank-reference">Reference (optional)</Label>
              <Input
                id="settlement-bank-reference"
                placeholder="e.g. transfer ref, transaction ID"
                value={settlementBankReference}
                onChange={(e) => setSettlementBankReference(e.target.value)}
                disabled={confirming}
                autoComplete="off"
              />
            </div>
          ) : null}

          {dueRounded > 0 ? (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                Number.isFinite(settlementSplitSum) && settlementSplitSum === dueRounded
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  : "border-border bg-muted/40"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Total allocated</span>
                <span className="font-medium tabular-nums">
                  {Number.isFinite(settlementSplitSum)
                    ? fmtMoneyMur(settlementSplitSum)
                    : "—"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Must equal</span>
                <span className="font-medium tabular-nums">{fmtMoneyMur(dueRounded)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2">
              Net to owner is zero or negative — leave cash and bank at zero and complete
              settlement.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("preview")}
              disabled={confirming}
            >
              Back
            </Button>
            <Button
              type="button"
              className="rounded font-semibold shadow-sm"
              onClick={requestCompleteSettlement}
              disabled={
                confirming ||
                stockReturnBusy ||
                !settlementPaymentReady ||
                settlementPrerequisites.message != null
              }
            >
              {confirming ? "Settling…" : "Complete settlement"}
            </Button>
          </div>
        </div>
      )}
    </div>

    <AlertDialog open={stockReturnConfirmOpen} onOpenChange={setStockReturnConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Return stock to warehouse?</AlertDialogTitle>
          <AlertDialogDescription>
            Move {stockReturnPendingCount} product line
            {stockReturnPendingCount === 1 ? "" : "s"} from {delivery.driverDisplay} back
            to the primary warehouse. This updates inventory balances.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={stockReturnBusy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={stockReturnBusy}
            onClick={(e) => {
              e.preventDefault();
              setStockReturnConfirmOpen(false);
              void performStockReturn();
            }}
          >
            {stockReturnBusy ? "Returning…" : "Return stock"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={settleProceedConfirmOpen} onOpenChange={setSettleProceedConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Proceed with settlement?</AlertDialogTitle>
          <AlertDialogDescription>
            Continue to record how {delivery.driverDisplay} returned{" "}
            {fmtMoneyMur(Math.max(0, dueRounded))} to you? Expenses may be created
            for driver daily rate and upselling commission before payment is recorded.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              setSettleProceedConfirmOpen(false);
              performSettleProceed();
            }}
          >
            Continue to payment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={completeSettlementConfirmOpen}
      onOpenChange={setCompleteSettlementConfirmOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Complete driver settlement?</AlertDialogTitle>
          <AlertDialogDescription>
            Record settlement for {delivery.driverDisplay} with{" "}
            {settlementCashParsed > 0
              ? `cash ${fmtMoneyMur(settlementCashParsed)}`
              : "no cash"}
            {settlementBankParsed > 0
              ? ` and bank ${fmtMoneyMur(settlementBankParsed)}`
              : settlementCashParsed > 0
                ? ""
                : " and no bank transfer"}
            . The delivery note will be marked completed and driver settlement saved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={confirming}
            onClick={(e) => {
              e.preventDefault();
              setCompleteSettlementConfirmOpen(false);
              void performCompleteSettlement();
            }}
          >
            {confirming ? "Settling…" : "Complete settlement"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
