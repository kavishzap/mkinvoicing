"use client";
export const dynamic = "force-dynamic";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { SalesOrderPaymentStatusBadge } from "@/components/sales-order-payment-status-badge";
import { SalesOrderViewActions } from "@/components/sales-order-view-actions";
import {
  getSalesOrder,
  computeSalesOrderTotals,
  type SalesOrderDetail,
} from "@/lib/sales-orders-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { AppPageShell } from "@/components/app-page-shell";

export default function SalesOrderViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [loading, setLoading] = useState(true);
  const [salesOrder, setSalesOrder] = useState<SalesOrderDetail | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [q, prof] = await Promise.all([getSalesOrder(id), fetchProfile()]);
        if (cancelled) return;
        if (!q) {
          setSalesOrder(null);
          setError("Sales order not found.");
        } else {
          setSalesOrder(q);
        }
        setProfile(prof);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load.");
          setSalesOrder(null);
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
      salesOrder
        ? [...(salesOrder.items ?? [])].sort(
            (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
          )
        : [],
    [salesOrder]
  );

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  if (!loading && !salesOrder) {
    return (
      <AppPageShell>
        <Card>
          <CardContent className="py-16 text-center">
            <h2 className="text-xl font-semibold mb-2">Sales order not found</h2>
            <p className="text-muted-foreground mb-6">
              {error ?? "The sales order you're looking for doesn't exist."}
            </p>
            <Link href="/app/sales-orders">
              <Button>Back to Sales Orders</Button>
            </Link>
          </CardContent>
        </Card>
      </AppPageShell>
    );
  }

  if (loading || !salesOrder) {
    return (
      <AppPageShell className="max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-96 animate-pulse rounded bg-muted" />
      </AppPageShell>
    );
  }

  const { subtotal, taxTotal, discount, shipping, total } =
    computeSalesOrderTotals(salesOrder);

  const from = salesOrder.from_snapshot as {
    type?: string;
    company_name?: string;
    full_name?: string;
    email?: string;
    registration_id?: string;
    vat_number?: string;
    logoUrl?: string;
  };
  const bill = salesOrder.bill_to_snapshot as {
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
    <AppPageShell
      className="max-w-7xl"
      leading={
        <Link href="/app/sales-orders">
          <Button variant="ghost" size="icon" aria-label="Back to sales orders">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle={`${salesOrder.number}${billName ? ` · ${billName}` : ""} — Review lines and totals, export a PDF, or convert to an invoice when ready.`}
      actions={
        <div className="print:hidden">
          <SalesOrderViewActions
            salesOrderId={salesOrder.id}
            salesOrder={salesOrder}
            profile={profile}
            logoSrc={logoSrc}
          />
        </div>
      }
    >
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg mb-3">
                    S
                  </div>
                )}

                <h2 className="text-xl font-bold">{fromName}</h2>
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
                <h3 className="text-2xl font-bold text-muted-foreground">
                  SALES ORDER
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {salesOrder.number}
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
                  <p className="font-medium">{fmtDate(salesOrder.issue_date)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Valid Until
                  </p>
                  <p className="font-medium">{fmtDate(salesOrder.valid_until)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Fulfillment
                  </p>
                  <div className="mt-1">
                    <SalesOrderFulfillmentStatusBadge
                      status={salesOrder.fulfillment_status}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Payment
                  </p>
                  <div className="mt-1">
                    <SalesOrderPaymentStatusBadge
                      status={salesOrder.payment_status}
                    />
                  </div>
                </div>
                {salesOrder.created_from_quotation_id && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Created from quotation
                    </p>
                    <Link
                      href={`/app/quotations/${salesOrder.created_from_quotation_id}`}
                      className="text-sm text-primary underline font-medium"
                    >
                      Open quotation
                    </Link>
                  </div>
                )}
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
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: salesOrder.currency,
                            }).format(Number(it.unit_price))}
                          </td>
                          <td className="py-4 text-right">{it.tax_percent}%</td>
                          <td className="py-4 text-right font-medium">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: salesOrder.currency,
                            }).format(lineTotal)}
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
                    <span>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: salesOrder.currency,
                      }).format(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: salesOrder.currency,
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
                          currency: salesOrder.currency,
                        }).format(discount)}
                      </span>
                    </div>
                  )}
                  {shipping > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: salesOrder.currency,
                        }).format(shipping)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: salesOrder.currency,
                      }).format(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {(salesOrder.notes || salesOrder.terms) && (
              <div className="space-y-4">
                {salesOrder.notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                      NOTES
                    </h4>
                    <p className="text-sm">{salesOrder.notes}</p>
                  </div>
                )}
                {salesOrder.terms && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                      TERMS & CONDITIONS
                    </h4>
                    <p className="text-sm text-muted-foreground">{salesOrder.terms}</p>
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
    </AppPageShell>
  );
}
