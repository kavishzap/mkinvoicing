"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ListOrdered,
  Pencil,
  Receipt,
  ScrollText,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { SalesOrderPaymentStatusBadge } from "@/components/sales-order-payment-status-badge";
import { SalesOrderStatusBadge } from "@/components/sales-order-status-badge";
import { SalesOrderViewActions } from "@/components/sales-order-view-actions";
import {
  getSalesOrder,
  computeSalesOrderTotals,
  normalizeSalesOrderFulfillmentStatus,
  type SalesOrderDetail,
} from "@/lib/sales-orders-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { AppPageShell } from "@/components/app-page-shell";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { cn } from "@/lib/utils";

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-0 rounded-lg py-0 shadow-sm",
        className
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-5 text-sm">
        {children}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className={fieldLabelClass}>{label}</p>
      <div className="break-words text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function fmtMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export default function SalesOrderViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [salesOrder, setSalesOrder] = useState<SalesOrderDetail | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (searchParams.get("edit") === "1") {
      router.replace(`/app/sales-orders/${id}/edit`);
    }
  }, [id, router, searchParams]);

  useEffect(() => {
    if (!id) return;
    setProfile(null);
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const q = await getSalesOrder(id, { mode: "view" });
        if (cancelled) return;
        if (!q) {
          setSalesOrder(null);
          setError("Sales order not found.");
        } else {
          setSalesOrder(q);
        }
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

  useEffect(() => {
    if (!id || !salesOrder || salesOrder.id !== id) return;
    let cancelled = false;
    (async () => {
      try {
        const prof = await fetchProfile();
        if (!cancelled) setProfile(prof);
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, salesOrder?.id]);

  const orderedItems = useMemo(
    () =>
      salesOrder
        ? [...(salesOrder.items ?? [])].sort(
            (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
          )
        : [],
    [salesOrder]
  );

  const canEditSalesOrder = useMemo(
    () =>
      salesOrder != null &&
      normalizeSalesOrderFulfillmentStatus(salesOrder.fulfillment_status) === "new",
    [salesOrder]
  );

  if (!loading && !salesOrder) {
    return (
      <AppPageShell fillHeight className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <FeatureEmptyState
            title="Sales order not found"
            description={
              error ?? "The sales order you're looking for doesn't exist."
            }
            action={
              <Button asChild>
                <Link href="/app/sales-orders">Back to sales orders</Link>
              </Button>
            }
            className="border-0 bg-transparent py-12"
          />
        </div>
      </AppPageShell>
    );
  }

  if (loading || !salesOrder) {
    return (
      <AppPageShell fillHeight className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="h-10 w-48 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-56 animate-pulse rounded-lg bg-muted" />
            <div className="h-56 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
      </AppPageShell>
    );
  }

  const { subtotal, taxTotal, discount, shipping, total } =
    computeSalesOrderTotals(salesOrder);
  const ccy = salesOrder.currency;

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

  const billToIcon = bill.type === "company" ? Building2 : UserRound;

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to sales orders">
          <Link href="/app/sales-orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      subtitle={`${salesOrder.number}${billName ? ` · ${billName}` : ""}`}
      subtitleClassName="w-full min-w-0 max-w-none"
      actions={
        canEditSalesOrder ? (
          <Button asChild className="gap-2 rounded-md font-semibold shadow-sm">
            <Link href={`/app/sales-orders/${salesOrder.id}/edit`}>
              <Pencil className="size-3.5 shrink-0" aria-hidden />
              Edit
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SalesOrderViewActions
            salesOrderId={salesOrder.id}
            salesOrder={salesOrder}
            profile={profile}
            logoSrc={logoSrc}
            showEditButton={false}
            toolbarClassName="justify-end"
            onRecordUpdated={(order) => {
              if (order) setSalesOrder(order);
            }}
          />
        </div>

        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-6 overflow-y-auto overscroll-y-contain rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="flex min-w-0 flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                Sales order {salesOrder.number}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{ccy}</span>
                <span aria-hidden>·</span>
                <span>Issue {fmtDate(salesOrder.issue_date)}</span>
                {billName ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="font-medium text-foreground">{billName}</span>
                  </>
                ) : null}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SalesOrderStatusBadge status={salesOrder.status} />
                <SalesOrderFulfillmentStatusBadge
                  status={salesOrder.fulfillment_status}
                />
                <SalesOrderPaymentStatusBadge status={salesOrder.payment_status} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground lg:max-w-sm lg:text-right">
              {canEditSalesOrder ? (
                <>
                  Use{" "}
                  <span className="font-medium text-foreground">Edit</span> in the
                  top bar to change lines and amounts while fulfillment is{" "}
                  <span className="font-medium text-foreground">New</span>.
                </>
              ) : (
                <>View-only summary.</>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8 xl:gap-10">
            <SectionCard icon={Store} title="Seller">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {logoSrc ? (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    <Image
                      src={logoSrc}
                      alt=""
                      width={56}
                      height={56}
                      className="object-contain"
                      priority
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                    S
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-3">
                  <InfoRow label="Name">{fromName || "—"}</InfoRow>
                  {fromEmail ? <InfoRow label="Email">{fromEmail}</InfoRow> : null}
                  {from?.type === "company" && from?.registration_id ? (
                    <InfoRow label="Registration">
                      {String(from.registration_id)}
                    </InfoRow>
                  ) : null}
                  {from?.type === "company" && from?.vat_number ? (
                    <InfoRow label="VAT">{String(from.vat_number)}</InfoRow>
                  ) : null}
                </div>
              </div>
            </SectionCard>

          <SectionCard icon={billToIcon} title="Bill to">
            <div className="space-y-3">
              <InfoRow label="Customer">{billName || "—"}</InfoRow>
              {bill?.email ? <InfoRow label="Email">{bill.email}</InfoRow> : null}
              {bill?.phone ? <InfoRow label="Phone">{bill.phone}</InfoRow> : null}
              {(bill?.street ||
                bill?.city ||
                bill?.postal ||
                bill?.country) && (
                <InfoRow label="Address">
                  <span className="block font-normal leading-relaxed">
                    {bill?.street ? <>{bill.street}</> : null}
                    {bill?.street && (bill?.city || bill?.postal) ? <br /> : null}
                    {[bill?.city, bill?.postal].filter(Boolean).join(", ")}
                    {bill?.country ? (
                      <>
                        {(bill?.city || bill?.postal) ? <br /> : null}
                        {bill.country}
                      </>
                    ) : null}
                  </span>
                </InfoRow>
              )}
            </div>

            <Separator className="my-4" />

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Issue date">{fmtDate(salesOrder.issue_date)}</InfoRow>
              <InfoRow label="Valid until">{fmtDate(salesOrder.valid_until)}</InfoRow>
              <InfoRow label="Delivery date">
                {salesOrder.delivery_date
                  ? fmtDate(salesOrder.delivery_date)
                  : "—"}
              </InfoRow>
            </div>
            {salesOrder.created_from_quotation_id ? (
              <InfoRow label="Created from quotation">
                <Link
                  href={`/app/quotations/${salesOrder.created_from_quotation_id}`}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  Open quotation
                </Link>
              </InfoRow>
            ) : null}
            {salesOrder.customer_id ? (
              <InfoRow label="Linked customer">
                <Link
                  href={`/app/customers/${salesOrder.customer_id}/edit`}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  View customer record
                </Link>
              </InfoRow>
            ) : null}
          </SectionCard>
        </div>

        <div className="flex justify-stretch lg:justify-end">
          <SectionCard
            icon={Receipt}
            title="Totals"
            className="w-full lg:max-w-md"
          >
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums font-medium">
                  {fmtMoney(subtotal, ccy)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums font-medium">
                  {fmtMoney(taxTotal, ccy)}
                </span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                    −{fmtMoney(discount, ccy)}
                  </span>
                </div>
              ) : null}
              {shipping > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="tabular-nums font-medium">
                    {fmtMoney(shipping, ccy)}
                  </span>
                </div>
              ) : null}
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{fmtMoney(total, ccy)}</span>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard icon={ListOrdered} title="Line items">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-semibold">Catalog</TableHead>
                  <TableHead className="text-xs font-semibold">SKU</TableHead>
                  <TableHead className="text-xs font-semibold">Item</TableHead>
                  <TableHead className="text-xs font-semibold">Description</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Qty</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Price</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Tax</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No line items.
                    </TableCell>
                  </TableRow>
                ) : (
                  orderedItems.map((it, idx) => {
                    const line = Number(it.quantity) * Number(it.unit_price);
                    const taxAmt = line * (Number(it.tax_percent) / 100);
                    const lineTotal = line + taxAmt;
                    const pid = it.product_id?.trim();
                    return (
                      <TableRow key={`${it.item}-${idx}`}>
                        <TableCell className="max-w-[160px]">
                          {pid ? (
                            <Link
                              href={`/app/products/${pid}`}
                              className="font-medium text-primary underline-offset-2 hover:underline line-clamp-2"
                            >
                              {it.product_name?.trim() || it.item}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {it.product_sku?.trim() || "—"}
                        </TableCell>
                        <TableCell className="font-medium">{it.item}</TableCell>
                        <TableCell className="max-w-[220px] text-muted-foreground">
                          {it.description || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtMoney(Number(it.unit_price), ccy)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.tax_percent}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {fmtMoney(lineTotal, ccy)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        {(salesOrder.notes || salesOrder.terms) && (
          <SectionCard icon={ScrollText} title="Notes & terms">
            <div className="space-y-4">
              {salesOrder.notes ? (
                <div>
                  <p className={fieldLabelClass}>Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {salesOrder.notes}
                  </p>
                </div>
              ) : null}
              {salesOrder.terms ? (
                <div>
                  <p className={fieldLabelClass}>Terms &amp; conditions</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {salesOrder.terms}
                  </p>
                </div>
              ) : null}
            </div>
          </SectionCard>
        )}
        </div>
      </div>
    </AppPageShell>
  );
}
