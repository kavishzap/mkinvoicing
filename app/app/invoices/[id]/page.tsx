"use client";

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
import { useToast } from "@/hooks/use-toast";

import {
  getInvoice,
  computeTotals,
  type InvoiceDetail,
} from "@/lib/invoices-service";
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

  useEffect(() => {
    let cancelled = false;
    if (!id) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [inv, prof] = await Promise.allSettled([
          getInvoice(id),
          fetchProfile(),
        ]);

        if (cancelled) return;

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
        if (!cancelled) {
          setError(e?.message ?? "Something went wrong.");
          setInvoice(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

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
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <h2 className="text-2xl font-semibold mb-2">Invoice not found</h2>
            <p className="text-muted-foreground mb-6">
              {error ?? "The invoice you're looking for doesn't exist."}
            </p>
            <Link href="/app/invoices">
              <Button>Back to Invoices</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Skeleton depends only on invoice, not profile (prevents deadlock)
  if (loading || !invoice) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
          <div className="h-9 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-muted rounded animate-pulse" />
          <div className="h-60 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const { subtotal, taxTotal, discount, total } = computeTotals(invoice);
  const bill = invoice.bill_to_snapshot || {};
  const from = invoice.from_snapshot || {};

  const billName =
    bill?.type === "company" ? bill?.company_name : bill?.full_name;

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

  // Resolve a logo URL in order: from_snapshot -> profile -> /logo.png
  const logoSrc = (from as any)?.logoUrl || safeProfile.logoUrl || "/logo.png";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/app/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Invoice {invoice.number}
            </h1>
            <p className="text-muted-foreground mt-1">
              View and manage invoice details
            </p>
          </div>
        </div>

        {/* UPDATED: pass invoice/profile/logoSrc so PDF uses data, not HTML */}
        <InvoiceViewActions
          invoiceId={invoice.id}
          invoice={invoice}
          profile={profile}
          logoSrc={logoSrc}
          onPaid={() => {
            // flip local state so badge updates right away
            setInvoice((prev) =>
              prev ? ({ ...prev, status: "paid" } as InvoiceDetail) : prev
            );
          }}
        />
      </div>

      <div>
        {/* Invoice Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardContent className="p-8 space-y-8">
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl mb-3">
                      I
                    </div>
                  )}

                  <h2 className="text-2xl font-bold">{fromName}</h2>
                  {fromEmail && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {fromEmail}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-3xl font-bold text-muted-foreground">
                    INVOICE
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {invoice.number}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Details */}
              <div className="grid sm:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                    BILL TO
                  </h4>
                  <p className="font-semibold">{billName}</p>
                  {bill?.email && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {bill.email}
                    </p>
                  )}
                  {bill?.phone && (
                    <p className="text-sm text-muted-foreground">
                      {bill.phone}
                    </p>
                  )}
                  {(bill?.street || bill?.city || bill?.postal) && (
                    <>
                      {bill?.street && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {bill.street}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {[bill?.city, bill?.postal].filter(Boolean).join(", ")}
                      </p>
                      {bill?.country && (
                        <p className="text-sm text-muted-foreground">
                          {bill.country}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-3">
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
                      <InvoiceStatusBadge status={invoice.status} />
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
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: invoice.currency,
                        }).format(total)}
                      </span>
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
    </div>
  );
}
