"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ClipboardList, FileText, Receipt, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { QuotationStatusBadge } from "@/components/quotation-status-badge";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { SalesOrderPaymentStatusBadge } from "@/components/sales-order-payment-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { listInvoices, type InvoiceListRow } from "@/lib/invoices-service";
import { listQuotations, type QuotationListRow } from "@/lib/quotations-service";
import {
  expireStaleSalesOrders,
  listSalesOrders,
  type SalesOrderListRow,
} from "@/lib/sales-orders-service";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || ""} ${amount.toFixed(2)}`.trim();
  }
}

function DocSectionCard({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <Card className="flex min-h-0 flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={cn(sectionTitleClass, "flex flex-wrap items-center gap-2")}>
          {title}
          <span className="rounded-full bg-muted/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground dark:bg-muted/70">
            {count}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 px-0 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}

function TruncationNote({
  shown,
  total,
  href,
  label,
}: {
  shown: number;
  total: number;
  href: string;
  label: string;
}) {
  if (total <= shown) return null;
  return (
    <p className="border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
      Showing {shown} of {total}.{" "}
      <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
        Open {label}
      </Link>{" "}
      for the full list.
    </p>
  );
}

export function CustomerRelatedDocuments({
  customerId,
  reloadToken = 0,
}: {
  customerId: string;
  /** Increment after mutations so lists refresh. */
  reloadToken?: number;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [salesOrders, setSalesOrders] = useState<SalesOrderListRow[]>([]);
  const [salesOrderTotal, setSalesOrderTotal] = useState(0);
  const [invoices, setInvoices] = useState<InvoiceListRow[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [quotations, setQuotations] = useState<QuotationListRow[]>([]);
  const [quotationTotal, setQuotationTotal] = useState(0);

  useEffect(() => {
    if (!customerId.trim()) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        await expireStaleSalesOrders();
        const [soRes, invRes, qRes] = await Promise.all([
          listSalesOrders({
            customerId,
            page: 1,
            pageSize: PAGE_SIZE,
            skipExpireStale: true,
            status: "all",
          }),
          listInvoices({
            customerId,
            page: 1,
            pageSize: PAGE_SIZE,
            status: "all",
            period: "all",
          }),
          listQuotations({
            customerId,
            page: 1,
            pageSize: PAGE_SIZE,
            status: "all",
          }),
        ]);
        if (cancelled) return;
        setSalesOrders(soRes.rows);
        setSalesOrderTotal(soRes.total);
        setInvoices(invRes.rows);
        setInvoiceTotal(invRes.total);
        setQuotations(qRes.rows);
        setQuotationTotal(qRes.total);
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Could not load linked documents",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, reloadToken, toast]);

  if (!customerId.trim()) return null;

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-1">
        <div className="h-36 animate-pulse rounded-lg border border-border/60 bg-muted/40" />
        <div className="h-36 animate-pulse rounded-lg border border-border/60 bg-muted/40" />
        <div className="h-36 animate-pulse rounded-lg border border-border/60 bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 border-t border-border/60 pt-6">
      <DocSectionCard
        icon={ClipboardList}
        title="Sales orders"
        count={salesOrderTotal}
      >
        <div className="max-h-[min(22rem,50vh)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-4">Number</TableHead>
                <TableHead className="hidden sm:table-cell">Issued</TableHead>
                <TableHead className="hidden md:table-cell">Delivery</TableHead>
                <TableHead className="hidden lg:table-cell">Fulfillment</TableHead>
                <TableHead className="hidden md:table-cell">Payment</TableHead>
                <TableHead className="text-right pe-4">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesOrders.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No sales orders for this customer yet.
                  </TableCell>
                </TableRow>
              ) : (
                salesOrders.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="ps-4 font-medium">
                      <Link
                        href={`/app/sales-orders/${r.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {r.number}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      <Link
                        href={`/app/sales-orders/${r.id}`}
                        className="hover:text-foreground hover:underline"
                      >
                        {fmtDate(r.issueDate)}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      <Link
                        href={`/app/sales-orders/${r.id}`}
                        className="hover:text-foreground hover:underline"
                      >
                        {r.deliveryDate ? fmtDate(r.deliveryDate) : "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <SalesOrderFulfillmentStatusBadge status={r.fulfillmentStatus} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <SalesOrderPaymentStatusBadge status={r.paymentStatus} />
                    </TableCell>
                    <TableCell className="pe-4 text-right tabular-nums">
                      <Link
                        href={`/app/sales-orders/${r.id}`}
                        className="text-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        {fmtMoney(r.total, r.currency)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <TruncationNote
          shown={salesOrders.length}
          total={salesOrderTotal}
          href="/app/sales-orders"
          label="sales orders"
        />
      </DocSectionCard>

      <DocSectionCard icon={Receipt} title="Invoices" count={invoiceTotal}>
        <div className="max-h-[min(22rem,50vh)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-4">Number</TableHead>
                <TableHead className="hidden sm:table-cell">Issued</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="text-right pe-4">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No invoices for this customer yet.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="ps-4 font-medium">
                      <Link
                        href={`/app/invoices/${r.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {r.number}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      <Link
                        href={`/app/invoices/${r.id}`}
                        className="hover:text-foreground hover:underline"
                      >
                        {fmtDate(r.issueDate)}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <InvoiceStatusBadge status={r.status} dueDate={r.dueDate} />
                    </TableCell>
                    <TableCell className="pe-4 text-right tabular-nums">
                      <Link
                        href={`/app/invoices/${r.id}`}
                        className="text-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        {fmtMoney(r.total, r.currency)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <TruncationNote
          shown={invoices.length}
          total={invoiceTotal}
          href="/app/invoices"
          label="invoices"
        />
      </DocSectionCard>

      <DocSectionCard icon={FileText} title="Quotations" count={quotationTotal}>
        <div className="max-h-[min(22rem,50vh)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-4">Number</TableHead>
                <TableHead className="hidden sm:table-cell">Issued</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="text-right pe-4">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No quotations for this customer yet.
                  </TableCell>
                </TableRow>
              ) : (
                quotations.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="ps-4 font-medium">
                      <Link
                        href={`/app/quotations/${r.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {r.number}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      <Link
                        href={`/app/quotations/${r.id}`}
                        className="hover:text-foreground hover:underline"
                      >
                        {fmtDate(r.issueDate)}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <QuotationStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="pe-4 text-right tabular-nums">
                      <Link
                        href={`/app/quotations/${r.id}`}
                        className="text-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        {fmtMoney(r.total, r.currency)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <TruncationNote
          shown={quotations.length}
          total={quotationTotal}
          href="/app/quotations"
          label="quotations"
        />
      </DocSectionCard>
    </div>
  );
}
