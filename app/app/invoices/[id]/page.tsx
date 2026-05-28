"use client";
import { DetailDocumentPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import nextDynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { CompactBillToSummary } from "@/components/compact-bill-to-summary";
import { useToast } from "@/hooks/use-toast";

import {
  getInvoice,
  getCachedInvoice,
  computeTotals,
  invalidateInvoiceCaches,
  type InvoiceDetail,
  type InvoiceItemRow,
} from "@/lib/invoices-service";
import { AppPageShell } from "@/components/app-page-shell";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { fetchProfile, type Profile } from "@/lib/settings-service";

const InvoiceViewActions = nextDynamic(
  () =>
    import("@/components/invoice-view-actions").then((m) => m.InvoiceViewActions),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-9 w-48 animate-pulse rounded-md bg-muted/70" />
    ),
  },
);

function formatInvoiceDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatInvoiceMoney(amt: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amt);
}

export default function InvoiceViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const bump = () => {
      invalidateInvoiceCaches();
      setRefreshKey((n) => n + 1);
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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    setError(null);

    (async () => {
      const companyId = await getActiveCompanyId();
      const cached = companyId ? getCachedInvoice(companyId, id) : null;
      if (cancelled) return;

      if (cached) {
        setInvoice(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      /*
       * Kick off both requests in parallel but render the page as soon as the
       * invoice resolves — the profile is only used for fallback fields (logo,
       * sender name/email) and doesn't need to block the main view. Profile
       * fills in moments later if it lags behind. `fetchProfile` is also cached
       * for the session, so subsequent navigations resolve it instantly.
       */
      const invoicePromise = getInvoice(id);
      const profilePromise = fetchProfile();

      invoicePromise
        .then((inv) => {
          if (cancelled) return;
          setInvoice(inv);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setInvoice(null);
          setError(
            e instanceof Error ? e.message : "Failed to load invoice.",
          );
          toastRef.current({
            title: "Failed to load invoice",
            description:
              e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      profilePromise
        .then((prof) => {
          if (!cancelled) setProfile(prof);
        })
        .catch(() => {
          if (!cancelled) setProfile(null);
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  const totals = useMemo(
    () => (invoice ? computeTotals(invoice) : null),
    [invoice],
  );

  const display = useMemo(() => {
    if (!invoice || !totals) return null;
    const bill = (invoice.bill_to_snapshot || {}) as Record<string, unknown>;
    const from = invoice.from_snapshot || {};
    const amountPaid = invoice.amount_paid || 0;
    const amountDue = Math.max(0, totals.total - amountPaid);
    const billName =
      bill.type === "company"
        ? String(bill.company_name ?? "")
        : String(bill.full_name ?? "");
    return { bill, from, amountPaid, amountDue, billName };
  }, [invoice, totals]);

  const moneyFmt = useMemo(
    () =>
      invoice
        ? (amt: number) => formatInvoiceMoney(amt, invoice.currency)
        : null,
    [invoice],
  );

  if (!loading && !invoice) {
    return (
      <AppPageShell
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={
          <Button variant="ghost" size="icon" asChild aria-label="Back to invoices">
            <Link href="/app/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
        subtitle="We couldn’t find that invoice."
      >
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h2 className="text-xl font-semibold">Invoice not found</h2>
            {error ? (
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {error}
              </p>
            ) : null}
            <Button asChild className="mt-6">
              <Link href="/app/invoices">Back to invoices</Link>
            </Button>
          </div>
        </div>
      </AppPageShell>
    );
  }

  // Skeleton depends only on invoice, not profile (prevents deadlock)
  if (loading || !invoice) {
    return (
      <AppPageShell
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={
          <Button variant="ghost" size="icon" asChild aria-label="Back to invoices">
            <Link href="/app/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
        subtitle="Loading invoice…"
      >
        <DetailDocumentPageSkeleton />
      </AppPageShell>
    );
  }

  const { subtotal, taxTotal, discount, total } = totals!;
  const { bill, from, amountPaid, amountDue, billName } = display!;

  const safeProfile = {
    accountType: profile?.accountType ?? "individual",
    companyName: profile?.companyName ?? "",
    fullName: profile?.fullName ?? "",
    email: profile?.email ?? "",
    logoUrl: (profile as any)?.logoUrl as string | undefined,
  };

  const fromName =
    from?.type === "company"
      ? from?.company_name
      : from?.full_name ||
        (safeProfile.accountType === "company"
          ? safeProfile.companyName
          : safeProfile.fullName);

  const fromEmail = from?.email || safeProfile.email;

  // Resolve a logo URL in order: from_snapshot -> profile -> /kredence.png
  const logoSrc = (from as any)?.logoUrl || safeProfile.logoUrl || "/kredence.png";

  return (
    <AppPageShell
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to invoices">
          <Link href="/app/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      belowSubtitle={
        <InvoiceViewActions
          invoiceId={invoice.id}
          invoice={invoice}
          profile={profile}
          logoSrc={logoSrc}
          onPaid={() => {
            setInvoice((prev) =>
              prev ? ({ ...prev, status: "paid" } as InvoiceDetail) : prev
            );
          }}
          onCancelled={() => {
            setInvoice((prev) =>
              prev
                ? ({ ...prev, status: "cancelled" } as InvoiceDetail)
                : prev
            );
          }}
          onRefresh={() => {
            setRefreshKey((prev) => prev + 1);
          }}
        />
      }
    >
      <div className="h-auto w-full rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="space-y-6 sm:space-y-8">
          <Card className="border-0 shadow-none">
            <CardContent className="space-y-6 p-0 sm:space-y-8">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  {/* Logo (or fallback initial) */}
                  {logoSrc ? (
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted flex items-center justify-center mb-3">
                      <Image
                        src={logoSrc}
                        alt="Sender logo"
                        width={48}
                        height={48}
                        className="object-contain"
                        priority
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg mb-3">
                      I
                    </div>
                  )}

                  <h2 className="text-xl font-bold">{fromName}</h2>
                  {fromEmail && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {fromEmail}
                    </p>
                  )}
                  {from?.type === "company" && from?.registration_id && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Reg: {from.registration_id}
                    </p>
                  )}
                  {from?.type === "company" && from?.vat_number && (
                    <p className="text-sm text-muted-foreground">
                      VAT: {from.vat_number}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-2xl font-bold text-muted-foreground">
                    INVOICE
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {invoice.number}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <CompactBillToSummary billName={billName} bill={bill} />

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Issue Date
                    </p>
                    <p className="font-medium">
                      {formatInvoiceDate(invoice.issue_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Due Date
                    </p>
                    <p className="font-medium">
                      {formatInvoiceDate(invoice.due_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Status
                    </p>
                    <div className="mt-1">
                      <InvoiceStatusBadge
                        status={invoice.status}
                        dueDate={invoice.due_date}
                        amountDue={amountDue}
                      />
                    </div>
                  </div>
                </div>

                {(invoice.created_from_quotation_id ||
                  invoice.created_from_sales_order_id) && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Created from
                    </p>
                    <div className="mt-1 space-y-1">
                      {invoice.created_from_quotation_id && (
                        <Link
                          href={`/app/quotations/${invoice.created_from_quotation_id}`}
                          className="block text-sm font-medium text-primary underline"
                        >
                          Open quotation
                        </Link>
                      )}
                      {invoice.created_from_sales_order_id && (
                        <Link
                          href={`/app/sales-orders/${invoice.created_from_sales_order_id}`}
                          className="block text-sm font-medium text-primary underline"
                        >
                          {invoice.createdFromSalesOrderNumber ||
                            "View sales order"}
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-border bg-muted/35 px-3 py-3 sm:px-4">
                  <p className="mb-2 text-sm font-semibold text-muted-foreground">
                    Payment Information
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Amount Paid</p>
                      <p className="text-sm font-medium">
                        {invoice.currency} {amountPaid.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount Due</p>
                      <p
                        className={`text-sm font-semibold ${amountDue > 0 ? "text-destructive" : "text-green-600"}`}
                      >
                        {invoice.currency} {amountDue.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Line Items */}
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 text-sm font-semibold text-muted-foreground">
                          Item
                        </th>
                        <th className="text-left py-3 text-sm font-semibold text-muted-foreground">
                          Description
                        </th>
                        <th className="text-right py-3 text-sm font-semibold text-muted-foreground">
                          Qty
                        </th>
                        <th className="text-right py-3 text-sm font-semibold text-muted-foreground">
                          Price
                        </th>
                        <th className="text-right py-3 text-sm font-semibold text-muted-foreground">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((it, idx) => (
                        <InvoiceLineRow
                          key={idx}
                          item={it}
                          formatMoney={moneyFmt!}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="flex justify-end mt-6">
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{moneyFmt!(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{moneyFmt!(taxTotal)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span>-{moneyFmt!(discount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-base font-bold">
                      <span>Total</span>
                      <span>{moneyFmt!(total)}</span>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Amount Paid</span>
                        <span className="font-medium">{moneyFmt!(amountPaid)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span className={amountDue > 0 ? "text-destructive" : "text-green-600"}>
                          Amount Due
                        </span>
                        <span
                          className={
                            amountDue > 0 ? "text-destructive" : "text-green-600"
                          }
                        >
                          {moneyFmt!(amountDue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Notes & Terms */}
              {(invoice.notes || invoice.terms) && (
                <div className="space-y-4">
                  {invoice.notes && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                        NOTES
                      </h4>
                      <p className="text-sm">{invoice.notes}</p>
                    </div>
                  )}
                  {invoice.terms && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                        TERMS & CONDITIONS
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {invoice.terms}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Footer */}
              <div className="text-center pt-6">
                <p className="text-sm text-muted-foreground">
                  Thank you for your business!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppPageShell>
  );
}

function InvoiceLineRow({
  item,
  formatMoney,
}: {
  item: InvoiceItemRow;
  formatMoney: (amt: number) => string;
}) {
  const line = Number(item.quantity) * Number(item.unit_price);
  const taxAmt = line * (Number(item.tax_percent) / 100);
  const lineTotal = line + taxAmt;
  return (
    <tr className="border-b">
      <td className="py-4 font-medium">{item.item}</td>
      <td className="py-4 text-sm text-muted-foreground">
        {item.description || ""}
      </td>
      <td className="py-4 text-right">{item.quantity}</td>
      <td className="py-4 text-right">
        {formatMoney(Number(item.unit_price))}
      </td>
      <td className="py-4 text-right font-medium">{formatMoney(lineTotal)}</td>
    </tr>
  );
}
