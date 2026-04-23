"use client";
export const dynamic = "force-dynamic";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { InvoiceViewActions } from "@/components/invoice-view-actions";
import { CompactBillToSummary } from "@/components/compact-bill-to-summary";
import { useToast } from "@/hooks/use-toast";

import {
  getInvoice,
  computeTotals,
  type InvoiceDetail,
} from "@/lib/invoices-service";
import { AppPageShell } from "@/components/app-page-shell";
import { fetchProfile, type Profile } from "@/lib/settings-service";

export default function InvoiceViewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadInvoiceData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const [inv, prof] = await Promise.allSettled([
        getInvoice(id),
        fetchProfile(),
      ]);

      if (inv.status === "fulfilled") {
        setInvoice(inv.value);
      } else {
        setInvoice(null);
        setError(inv.reason?.message ?? "Failed to load invoice.");
      }

      if (prof.status === "fulfilled") {
        setProfile(prof.value);
      } else {
        setProfile(null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!id) return;

    loadInvoiceData();

    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const fmtMoney = (amt: number, ccy: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: ccy }).format(
      amt
    );

  if (!loading && !invoice) {
    return (
      <AppPageShell>
        <Card>
          <CardContent className="py-16 text-center">
            <h2 className="text-xl font-semibold mb-2">Invoice not found</h2>
            <p className="text-muted-foreground mb-6">
              {error ?? "The invoice you're looking for doesn't exist."}
            </p>
            <Link href="/app/invoices">
              <Button>Back to Invoices</Button>
            </Link>
          </CardContent>
        </Card>
      </AppPageShell>
    );
  }

  // Skeleton depends only on invoice, not profile (prevents deadlock)
  if (loading || !invoice) {
    return (
      <AppPageShell className="max-w-7xl">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="mt-4 h-96 rounded bg-muted animate-pulse" />
      </AppPageShell>
    );
  }

  const { subtotal, taxTotal, discount, total } = computeTotals(invoice);
  const bill = (invoice.bill_to_snapshot || {}) as Record<string, unknown>;
  const from = invoice.from_snapshot || {};
  
  // Calculate amount due: always calculate from total - amount_paid to ensure accuracy
  const amountPaid = invoice.amount_paid || 0;
  const amountDue = Math.max(0, total - amountPaid);

  const billName =
    bill.type === "company"
      ? String(bill.company_name ?? "")
      : String(bill.full_name ?? "");

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
      className="max-w-7xl"
      leading={
        <Link href="/app/invoices">
          <Button variant="ghost" size="icon" aria-label="Back to invoices">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle={`${invoice.number}${billName ? ` · ${billName}` : ""} — Review lines and totals below.`}
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
      <div>
        {/* Invoice Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardContent className="space-y-6 p-6 sm:p-7 sm:space-y-8">
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
                    <p className="font-medium">{fmtDate(invoice.issue_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Due Date
                    </p>
                    <p className="font-medium">{fmtDate(invoice.due_date)}</p>
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
                          Open sales order
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
                          Tax
                        </th>
                        <th className="text-right py-3 text-sm font-semibold text-muted-foreground">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((it, idx) => {
                        const line =
                          Number(it.quantity) * Number(it.unit_price);
                        const taxAmt = line * (Number(it.tax_percent) / 100);
                        const lineTotal = line + taxAmt;
                        return (
                          <tr key={idx} className="border-b">
                            <td className="py-4 font-medium">{it.item}</td>
                            <td className="py-4 text-sm text-muted-foreground">
                              {it.description || ""}
                            </td>
                            <td className="py-4 text-right">{it.quantity}</td>
                            <td className="py-4 text-right">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: invoice.currency,
                              }).format(Number(it.unit_price))}
                            </td>
                            <td className="py-4 text-right">
                              {it.tax_percent}%
                            </td>
                            <td className="py-4 text-right font-medium">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: invoice.currency,
                              }).format(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="flex justify-end mt-6">
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: invoice.currency,
                        }).format(subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: invoice.currency,
                        }).format(taxTotal)}
                      </span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span>
                          -
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: invoice.currency,
                          }).format(discount)}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-base font-bold">
                      <span>Total</span>
                      <span>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: invoice.currency,
                        }).format(total)}
                      </span>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Amount Paid</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: invoice.currency,
                          }).format(amountPaid)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span className={amountDue > 0 ? "text-destructive" : "text-green-600"}>
                          Amount Due
                        </span>
                        <span className={amountDue > 0 ? "text-destructive" : "text-green-600"}>
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: invoice.currency,
                          }).format(amountDue)}
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
