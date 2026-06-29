"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  FileText,
  ListOrdered,
  Receipt,
  ScrollText,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCustomers, type CustomerRow } from "@/lib/customers-service";
import {
  getInvoice,
  type InvoiceDetail,
} from "@/lib/invoices-service";
import {
  CREDIT_NOTE_REASONS,
  listCreditableInvoices,
  type CreditableInvoiceRow,
  type CreditNoteCreditType,
  type CreditNoteLinePayload,
  type CreditNoteReason,
} from "@/lib/credit-notes-service";
import { cn } from "@/lib/utils";
import { QtyNumberInput } from "@/components/qty-input";
import type { Preferences } from "@/lib/settings-service";

const fieldLabelClass =
  "text-sm font-medium text-neutral-700 dark:text-neutral-300";
const sectionTitleClass =
  "text-base font-semibold leading-snug text-neutral-800 dark:text-neutral-200";
const sectionIconBoxClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-4 w-4 text-neutral-600 dark:text-neutral-300";

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
  step,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
  step?: number;
}) {
  return (
    <Card className={cn("gap-0 rounded-lg py-0 shadow-sm", className)}>
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 border-b bg-muted/40 px-4 py-3.5">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>
          {step != null ? `${step}. ` : ""}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-5">{children}</CardContent>
    </Card>
  );
}

export type CreditNoteFormLine = {
  id: string;
  invoiceItemId: string | null;
  productId: string | null;
  item: string;
  description: string;
  quantity: number;
  maxQuantity: number;
  unitPrice: number;
  tax: number;
};

export type CreditNoteFormValue = {
  customerId: string;
  invoiceId: string;
  issueDate: string;
  creditType: CreditNoteCreditType;
  reason: CreditNoteReason | "";
  notes: string;
  lineItems: CreditNoteFormLine[];
  discountAmount: number;
};

export type CreditNoteFormErrors = Partial<
  Record<
    | "customerId"
    | "invoiceId"
    | "reason"
    | "lineItems"
    | "creditTotal"
    | `qty_${string}`,
    string
  >
>;

function linesFromInvoice(inv: InvoiceDetail): CreditNoteFormLine[] {
  return (inv.items ?? []).map((it, i) => ({
    id: `ln-${i}`,
    invoiceItemId: it.id ?? null,
    productId: it.product_id ?? null,
    item: it.item,
    description: it.description ?? "",
    quantity: Number(it.quantity),
    maxQuantity: Number(it.quantity),
    unitPrice: Number(it.unit_price),
    tax: Number(it.tax_percent),
  }));
}

function linesToPayload(lines: CreditNoteFormLine[]): CreditNoteLinePayload[] {
  return lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      item: l.item,
      description: l.description || undefined,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      tax_percent: l.tax,
      product_id: l.productId,
      invoice_item_id: l.invoiceItemId,
    }));
}

function computeLineTotals(lines: CreditNoteFormLine[], discountAmount: number) {
  const subtotal = lines.reduce(
    (s, l) => s + l.quantity * l.unitPrice,
    0,
  );
  const taxTotal = lines.reduce((s, l) => {
    const line = l.quantity * l.unitPrice;
    return s + line * (l.tax / 100);
  }, 0);
  const total = Math.max(0, subtotal + taxTotal - discountAmount);
  return { subtotal, taxTotal, total };
}

export function useCreditNoteFormState(initial?: Partial<CreditNoteFormValue>) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [invoiceId, setInvoiceId] = useState(initial?.invoiceId ?? "");
  const [issueDate, setIssueDate] = useState(
    initial?.issueDate ?? new Date().toISOString().split("T")[0],
  );
  const [creditType, setCreditType] = useState<CreditNoteCreditType>(
    initial?.creditType ?? "partial",
  );
  const [reason, setReason] = useState<CreditNoteReason | "">(
    initial?.reason ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lineItems, setLineItems] = useState<CreditNoteFormLine[]>(
    initial?.lineItems ?? [],
  );
  const [discountAmount, setDiscountAmount] = useState(
    initial?.discountAmount ?? 0,
  );
  const [errors, setErrors] = useState<CreditNoteFormErrors>({});

  return {
    customerId,
    setCustomerId,
    invoiceId,
    setInvoiceId,
    issueDate,
    setIssueDate,
    creditType,
    setCreditType,
    reason,
    setReason,
    notes,
    setNotes,
    lineItems,
    setLineItems,
    discountAmount,
    setDiscountAmount,
    errors,
    setErrors,
  };
}

type CreditNoteFormProps = {
  preferences: Preferences | null;
  value: ReturnType<typeof useCreditNoteFormState>;
  readOnly?: boolean;
  initialCustomer?: CustomerRow | null;
};

export function CreditNoteForm({
  preferences,
  value,
  readOnly = false,
  initialCustomer = null,
}: CreditNoteFormProps) {
  const {
    customerId,
    setCustomerId,
    invoiceId,
    setInvoiceId,
    issueDate,
    setIssueDate,
    creditType,
    setCreditType,
    reason,
    setReason,
    notes,
    setNotes,
    lineItems,
    setLineItems,
    discountAmount,
    setDiscountAmount,
    errors,
    setErrors,
  } = value;

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(
    initialCustomer,
  );
  const [creditableInvoices, setCreditableInvoices] = useState<
    CreditableInvoiceRow[]
  >([]);
  const [selectedInvoiceMeta, setSelectedInvoiceMeta] =
    useState<CreditableInvoiceRow | null>(null);
  const [loadedInvoice, setLoadedInvoice] = useState<InvoiceDetail | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceListError, setInvoiceListError] = useState<string | null>(null);
  const [loadingInvoiceDetail, setLoadingInvoiceDetail] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => {
    void listCustomers({
      search: customerSearch,
      includeInactive: false,
      page: 1,
      pageSize: 100,
    }).then(({ rows }) => setCustomers(rows));
  }, [customerSearch]);

  useEffect(() => {
    if (!customerId) {
      setCreditableInvoices([]);
      setSelectedInvoiceMeta(null);
      setLoadedInvoice(null);
      setInvoiceId("");
      return;
    }
    let cancelled = false;
    setLoadingInvoices(true);
    setInvoiceListError(null);
    void listCreditableInvoices(customerId)
      .then((rows) => {
        if (!cancelled) setCreditableInvoices(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCreditableInvoices([]);
          setInvoiceListError(
            err instanceof Error ? err.message : "Could not load invoices",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingInvoices(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, setInvoiceId]);

  const loadInvoiceDetail = useCallback(
    async (invId: string) => {
      setLoadingInvoiceDetail(true);
      try {
        const inv = await getInvoice(invId);
        if (!inv) throw new Error("Invoice not found");
        setLoadedInvoice(inv);
        setLineItems(linesFromInvoice(inv));
        setDiscountAmount(0);
      } finally {
        setLoadingInvoiceDetail(false);
      }
    },
    [setLineItems, setDiscountAmount],
  );

  useEffect(() => {
    if (!invoiceId) {
      setSelectedInvoiceMeta(null);
      setLoadedInvoice(null);
      return;
    }
    const meta = creditableInvoices.find((i) => i.id === invoiceId) ?? null;
    setSelectedInvoiceMeta(meta);
    void loadInvoiceDetail(invoiceId);
  }, [invoiceId, creditableInvoices, loadInvoiceDetail]);

  useEffect(() => {
    if (creditType !== "full" || !loadedInvoice) return;
    setLineItems(linesFromInvoice(loadedInvoice));
  }, [creditType, loadedInvoice, setLineItems]);

  const totals = useMemo(
    () => computeLineTotals(lineItems, discountAmount),
    [lineItems, discountAmount],
  );

  const outstandingAfterCredit = useMemo(() => {
    if (!selectedInvoiceMeta) return null;
    return Math.max(
      0,
      selectedInvoiceMeta.outstandingBalance - totals.total,
    );
  }, [selectedInvoiceMeta, totals.total]);

  const handleSelectCustomer = (c: CustomerRow) => {
    setSelectedCustomer(c);
    setCustomerId(c.id);
    setInvoiceId("");
    setLineItems([]);
    setCustomerDialogOpen(false);
    setErrors({});
  };

  const updateLineQty = (lineId: string, qty: number) => {
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const capped = Math.min(Math.max(0, qty), l.maxQuantity);
        return { ...l, quantity: capped };
      }),
    );
  };

  const removeLine = (lineId: string) => {
    setLineItems((prev) =>
      prev.length > 1 ? prev.filter((l) => l.id !== lineId) : prev,
    );
  };

  const currency = preferences?.currency ?? loadedInvoice?.currency ?? "MUR";

  return (
    <div className="space-y-6">
      <SectionCard icon={Users} title="Select customer" step={1}>
        {selectedCustomer ? (
          <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
            <p className="font-semibold">
              {selectedCustomer.type === "company"
                ? selectedCustomer.companyName
                : selectedCustomer.fullName}
            </p>
            <p className="text-xs text-muted-foreground">
              {[selectedCustomer.email, selectedCustomer.phone]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose the customer this credit note applies to.
          </p>
        )}
        {errors.customerId ? (
          <p className="text-xs text-destructive">{errors.customerId}</p>
        ) : null}
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setCustomerDialogOpen(true)}
          >
            {selectedCustomer ? "Change customer" : "Select customer *"}
          </Button>
        ) : null}
      </SectionCard>

      <SectionCard icon={FileText} title="Select invoice" step={2}>
        {!customerId ? (
          <p className="text-sm text-muted-foreground">
            Select a customer first to see eligible invoices.
          </p>
        ) : loadingInvoices ? (
          <p className="text-sm text-muted-foreground">Loading invoices…</p>
        ) : invoiceListError ? (
          <p className="text-sm text-destructive">{invoiceListError}</p>
        ) : creditableInvoices.length === 0 ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>No invoices available to credit for this customer.</p>
            <p className="text-xs">
              Shows non-cancelled invoices linked to this customer that still
              have credit remaining (invoice total minus credits already
              posted). Paid invoices appear here too — for example returns
              after payment.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className={fieldLabelClass}>Invoice *</Label>
            <Select
              value={invoiceId || undefined}
              onValueChange={(v) => {
                setInvoiceId(v);
                setErrors((e) => ({ ...e, invoiceId: undefined }));
              }}
              disabled={readOnly}
            >
              <SelectTrigger className={errors.invoiceId ? "border-destructive" : ""}>
                <SelectValue placeholder="Choose an invoice…" />
              </SelectTrigger>
              <SelectContent>
                {creditableInvoices.map((inv) => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.number} — {currency}{" "}
                    {inv.creditableBalance.toFixed(2)} creditable
                    {inv.status === "paid" ? " (paid)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.invoiceId ? (
              <p className="text-xs text-destructive">{errors.invoiceId}</p>
            ) : null}
          </div>
        )}

        {selectedInvoiceMeta && loadedInvoice ? (
          <div className="mt-4 grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Invoice number
              </p>
              <p className="font-medium">{selectedInvoiceMeta.number}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Invoice date
              </p>
              <p className="font-medium">{selectedInvoiceMeta.issueDate}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Original amount
              </p>
              <p className="font-medium">
                {currency} {selectedInvoiceMeta.originalAmount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Outstanding balance
              </p>
              <p className="font-medium">
                {currency} {selectedInvoiceMeta.outstandingBalance.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Already credited
              </p>
              <p className="font-medium">
                {currency} {selectedInvoiceMeta.alreadyCredited.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Creditable balance
              </p>
              <p className="font-semibold text-primary">
                {currency} {selectedInvoiceMeta.creditableBalance.toFixed(2)}
              </p>
            </div>
          </div>
        ) : loadingInvoiceDetail ? (
          <p className="text-sm text-muted-foreground">Loading invoice lines…</p>
        ) : null}
      </SectionCard>

      {invoiceId ? (
        <>
          <SectionCard icon={Receipt} title="Credit type" step={3}>
            <RadioGroup
              value={creditType}
              onValueChange={(v) =>
                setCreditType(v as CreditNoteCreditType)
              }
              className="flex flex-col gap-3 sm:flex-row sm:gap-6"
              disabled={readOnly}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="full" id="credit-full" />
                <Label htmlFor="credit-full" className="font-normal cursor-pointer">
                  Full credit — all invoice lines
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="partial" id="credit-partial" />
                <Label htmlFor="credit-partial" className="font-normal cursor-pointer">
                  Partial credit — adjust quantities
                </Label>
              </div>
            </RadioGroup>
          </SectionCard>

          <SectionCard icon={ScrollText} title="Reason" step={4}>
            <div className="space-y-2">
              <Label className={fieldLabelClass}>Reason *</Label>
              <Select
                value={reason || undefined}
                onValueChange={(v) => {
                  setReason(v as CreditNoteReason);
                  setErrors((e) => ({ ...e, reason: undefined }));
                }}
                disabled={readOnly}
              >
                <SelectTrigger className={errors.reason ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {CREDIT_NOTE_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reason ? (
                <p className="text-xs text-destructive">{errors.reason}</p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard icon={ListOrdered} title="Items" step={5}>
            {errors.lineItems ? (
              <p className="text-xs text-destructive">{errors.lineItems}</p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product / Item</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px]">Qty</TableHead>
                    <TableHead className="w-[100px]">Max</TableHead>
                    <TableHead className="w-[120px]">Unit price</TableHead>
                    <TableHead className="w-[80px]">Tax %</TableHead>
                    <TableHead className="text-right w-[120px]">Total</TableHead>
                    {!readOnly && creditType === "partial" ? (
                      <TableHead className="w-[50px]" />
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((line) => {
                    const lineTotal =
                      line.quantity * line.unitPrice * (1 + line.tax / 100);
                    const qtyLocked = readOnly || creditType === "full";
                    return (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">{line.item}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {line.description || "—"}
                        </TableCell>
                        <TableCell>
                          <QtyNumberInput
                            value={line.quantity}
                            onValueChange={(v) => updateLineQty(line.id, v)}
                            className={cn(
                              "h-9",
                              errors[`qty_${line.id}`] && "border-destructive",
                            )}
                            disabled={qtyLocked}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {line.maxQuantity}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {currency} {line.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="tabular-nums">{line.tax}%</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {currency} {lineTotal.toFixed(2)}
                        </TableCell>
                        {!readOnly && creditType === "partial" ? (
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeLine(line.id)}
                              disabled={lineItems.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard icon={CalendarDays} title="Notes" step={6}>
              <div className="space-y-2">
                <Label htmlFor="cn-issue-date">Issue date</Label>
                <Input
                  id="cn-issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cn-notes">Notes</Label>
                <Textarea
                  id="cn-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  disabled={readOnly}
                />
              </div>
            </SectionCard>

            <SectionCard icon={Receipt} title="Summary & accounting effect" step={7}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">
                    {currency} {totals.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">
                    {currency} {totals.taxTotal.toFixed(2)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Credit total</span>
                  <span className="tabular-nums">
                    {currency} {totals.total.toFixed(2)}
                  </span>
                </div>
              </div>
              {errors.creditTotal ? (
                <p className="text-xs text-destructive">{errors.creditTotal}</p>
              ) : null}
              {selectedInvoiceMeta ? (
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <p className="mb-2 font-semibold">Accounting effect (on post)</p>
                  <div className="space-y-1 text-muted-foreground">
                    <p>
                      Invoice {selectedInvoiceMeta.number}:{" "}
                      <span className="font-medium text-foreground">
                        {currency}{" "}
                        {selectedInvoiceMeta.outstandingBalance.toFixed(2)}
                      </span>{" "}
                      outstanding
                    </p>
                    <p>
                      Credit note:{" "}
                      <span className="font-medium text-destructive">
                        −{currency} {totals.total.toFixed(2)}
                      </span>
                    </p>
                    <p>
                      Customer balance after post:{" "}
                      <span className="font-semibold text-foreground">
                        {currency} {(outstandingAfterCredit ?? 0).toFixed(2)}
                      </span>{" "}
                      outstanding
                    </p>
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </div>
        </>
      ) : null}

      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select customer</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search customers…"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
          />
          <div className="flex-1 overflow-y-auto space-y-2 mt-2">
            {customers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectCustomer(c)}
                className="w-full rounded-lg border px-3 py-2 text-left hover:bg-accent text-sm"
              >
                {c.type === "company" ? c.companyName : c.fullName}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function validateCreditNoteForm(
  state: ReturnType<typeof useCreditNoteFormState>,
  creditableBalance: number | null,
): CreditNoteFormErrors {
  const errors: CreditNoteFormErrors = {};
  if (!state.customerId.trim()) errors.customerId = "Customer is required";
  if (!state.invoiceId.trim()) errors.invoiceId = "Invoice is required";
  if (!state.reason) errors.reason = "Reason is required";

  const activeLines = state.lineItems.filter((l) => l.quantity > 0);
  if (activeLines.length === 0) {
    errors.lineItems = "At least one line with quantity greater than zero";
  }

  state.lineItems.forEach((l) => {
    if (l.quantity > l.maxQuantity) {
      errors[`qty_${l.id}`] = `Max ${l.maxQuantity}`;
    }
  });

  const { total } = computeLineTotals(state.lineItems, state.discountAmount);
  if (creditableBalance != null && total > creditableBalance + 0.005) {
    errors.creditTotal = `Credit total exceeds remaining invoice balance (${creditableBalance.toFixed(2)})`;
  }

  return errors;
}

export { linesToPayload, computeLineTotals };
