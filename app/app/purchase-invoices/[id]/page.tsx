"use client";
export const dynamic = "force-dynamic";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PurchaseInvoiceStatusBadge } from "@/components/purchase-invoice-status-badge";
import { PurchaseInvoiceViewActions } from "@/components/purchase-invoice-view-actions";
import {
  getPurchaseInvoice,
  computePurchaseInvoiceTotals,
  type PurchaseInvoiceDetail,
} from "@/lib/purchase-invoices-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";

export default function PurchaseInvoiceViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [loading, setLoading] = useState(true);
  const [purchaseInvoice, setPurchaseInvoice] =
    useState<PurchaseInvoiceDetail | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    const inv = await getPurchaseInvoice(id);
    setPurchaseInvoice(inv);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [inv, prof] = await Promise.all([
          getPurchaseInvoice(id),
          fetchProfile(),
        ]);
        if (cancelled) return;
        if (!inv) {
          setPurchaseInvoice(null);
          setError("Purchase invoice not found.");
        } else {
          setPurchaseInvoice(inv);
        }
        setProfile(prof);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load.");
          setPurchaseInvoice(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const orderedItems = useMemo(
    () =>
      purchaseInvoice
        ? [...(purchaseInvoice.items ?? [])].sort(
            (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
          )
        : [],
    [purchaseInvoice]
  );

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const fmtMoney = (n: number, ccy: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy,
    }).format(n);

  if (!loading && !purchaseInvoice) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <h2 className="text-2xl font-semibold mb-2">
              Purchase invoice not found
            </h2>
            <p className="text-muted-foreground mb-6">
              {error ?? "The purchase invoice you're looking for doesn't exist."}
            </p>
            <Link href="/app/purchase-invoices">
              <Button>Back to Purchase Invoices</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !purchaseInvoice) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
          <div className="h-9 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const { subtotal, taxTotal, discount, shipping, total } =
    computePurchaseInvoiceTotals(purchaseInvoice);

  const from = purchaseInvoice.from_snapshot as {
    type?: string;
    company_name?: string;
    full_name?: string;
    email?: string;
    registration_id?: string;
    vat_number?: string;
    logoUrl?: string;
  };
  const bill = purchaseInvoice.bill_to_snapshot as {
    type?: string;
    company_name?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    street?: string;
    city?: string;
    postal?: string;
    country?: string;
  };

  const billName =
    bill.type === "company" ? bill.company_name : bill.full_name;

  const safeProfile = {
    accountType: profile?.accountType ?? "individual",
    companyName: profile?.companyName ?? "",
    fullName: profile?.fullName ?? "",
    email: profile?.email ?? "",
    logoUrl: (profile as { logoUrl?: string })?.logoUrl,
  };

  const fromName =
    from.type === "company"
      ? from.company_name
      : from.full_name ||
        (safeProfile.accountType === "company"
          ? safeProfile.companyName
          : safeProfile.fullName);

  const fromEmail = from.email || safeProfile.email;
  const logoSrc =
    from.logoUrl || safeProfile.logoUrl || "/kredence.png";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/app/purchase-invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Purchase Invoice {purchaseInvoice.number}
            </h1>
            <p className="text-muted-foreground mt-1">
              View details and export PDF
            </p>
          </div>
        </div>

        <PurchaseInvoiceViewActions
          purchaseInvoiceId={purchaseInvoice.id}
          purchaseInvoice={purchaseInvoice}
          profile={profile}
          logoSrc={logoSrc}
          onRefresh={reload}
        />
      </div>

      <div className="lg:col-span-2 space-y-6">
        <Card className="shadow-lg">
          <CardContent className="p-8 space-y-8">
            <div className="flex items-start justify-between">
              <div>
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
                    P
                  </div>
                )}

                <h2 className="text-2xl font-bold">{fromName}</h2>
                {fromEmail && (
                  <p className="text-sm text-muted-foreground mt-1">{fromEmail}</p>
                )}
                {from?.type === "company" && from?.registration_id && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Reg: {String(from.registration_id)}
                  </p>
                )}
                {from?.type === "company" && from?.vat_number && (
                  <p className="text-sm text-muted-foreground">
                    VAT: {String(from.vat_number)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <h3 className="text-3xl font-bold text-muted-foreground">
                  PURCHASE INVOICE
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {purchaseInvoice.number}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid sm:grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  BILL TO
                </h4>
                <p className="font-semibold">{billName}</p>
                {bill?.email && (
                  <p className="text-sm text-muted-foreground mt-1">{bill.email}</p>
                )}
                {bill?.phone && (
                  <p className="text-sm text-muted-foreground">{bill.phone}</p>
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
                      <p className="text-sm text-muted-foreground">{bill.country}</p>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Issue Date
                  </p>
                  <p className="font-medium">{fmtDate(purchaseInvoice.issue_date)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Due Date
                  </p>
                  <p className="font-medium">{fmtDate(purchaseInvoice.due_date)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Status
                  </p>
                  <div className="mt-1">
                    <PurchaseInvoiceStatusBadge status={purchaseInvoice.status} />
                  </div>
                </div>
                {purchaseInvoice.created_from_purchase_order_id && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Created from
                    </p>
                    <div className="mt-1">
                      <Link
                        href={`/app/purchase-orders/${purchaseInvoice.created_from_purchase_order_id}`}
                        className="text-sm text-primary underline font-medium"
                      >
                        Open purchase order
                      </Link>
                    </div>
                  </div>
                )}
                <Separator />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-2">
                    Payment
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Amount paid</span>
                      <span className="font-medium">
                        {fmtMoney(
                          purchaseInvoice.amount_paid,
                          purchaseInvoice.currency
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Amount due</span>
                      <span className="font-medium">
                        {fmtMoney(
                          purchaseInvoice.amount_due,
                          purchaseInvoice.currency
                        )}
                      </span>
                    </div>
                    {purchaseInvoice.payment_method && (
                      <p className="text-muted-foreground pt-1">
                        Method: {purchaseInvoice.payment_method}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

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
                    {orderedItems.map((it, idx) => {
                      const line = Number(it.quantity) * Number(it.unit_price);
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
                            {fmtMoney(Number(it.unit_price), purchaseInvoice.currency)}
                          </td>
                          <td className="py-4 text-right">{it.tax_percent}%</td>
                          <td className="py-4 text-right font-medium">
                            {fmtMoney(lineTotal, purchaseInvoice.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-6">
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{fmtMoney(subtotal, purchaseInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{fmtMoney(taxTotal, purchaseInvoice.currency)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span>
                        -{fmtMoney(discount, purchaseInvoice.currency)}
                      </span>
                    </div>
                  )}
                  {shipping > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>{fmtMoney(shipping, purchaseInvoice.currency)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{fmtMoney(total, purchaseInvoice.currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {(purchaseInvoice.notes || purchaseInvoice.terms) && (
              <div className="space-y-4">
                {purchaseInvoice.notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                      NOTES
                    </h4>
                    <p className="text-sm">{purchaseInvoice.notes}</p>
                  </div>
                )}
                {purchaseInvoice.terms && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                      TERMS & CONDITIONS
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {purchaseInvoice.terms}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="text-center pt-6">
              <p className="text-sm text-muted-foreground">
                Thank you for your business.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
