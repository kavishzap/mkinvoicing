"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import nextDynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ListOrdered,
  Pencil,
  Receipt,
  ScrollText,
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
import { CustomerInfoDialog } from "@/components/customer-info-dialog";
import {
  getSalesOrder,
  getCachedSalesOrder,
  computeSalesOrderTotals,
  invalidateSalesOrderCaches,
  clientInfoFromBillSnapshot,
  normalizeSalesOrderFulfillmentStatus,
  salesOrderFulfillmentAllowsEditing,
  type SalesOrderDetail,
} from "@/lib/sales-orders-service";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { useToast } from "@/hooks/use-toast";
import { getCustomer } from "@/lib/customers-service";
import { listDeliveryCities, type DeliveryCityRow } from "@/lib/delivery-zones-service";
import {
  getInvoiceForSalesOrder,
  type InvoiceLinkForSalesOrder,
} from "@/lib/invoices-service";
import { fetchProfile, type Profile } from "@/lib/settings-service";
import { AppPageShell } from "@/components/app-page-shell";
import { DetailDocumentPageSkeleton } from "@/components/page-skeletons";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { cn } from "@/lib/utils";

const SalesOrderViewActions = nextDynamic(
  () =>
    import("@/components/sales-order-view-actions").then(
      (m) => m.SalesOrderViewActions,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-9 w-48 animate-pulse rounded-md bg-muted/70" />
    ),
  },
);

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
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [salesOrder, setSalesOrder] = useState<SalesOrderDetail | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deliveryCities, setDeliveryCities] = useState<DeliveryCityRow[]>([]);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [linkedInvoice, setLinkedInvoice] =
    useState<InvoiceLinkForSalesOrder | null>(null);
  const [customerRecordName, setCustomerRecordName] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!id) return;
    if (searchParams.get("edit") === "1") {
      router.replace(`/app/sales-orders/${id}/edit`);
    }
  }, [id, router, searchParams]);

  useEffect(() => {
    const bump = () => {
      invalidateSalesOrderCaches();
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

    (async () => {
      setError(null);
      setLinkedInvoice(null);
      setCustomerRecordName(null);

      const companyId = await getActiveCompanyId();
      const cached = companyId
        ? getCachedSalesOrder(companyId, id, "view")
        : null;
      if (cancelled) return;

      if (cached) {
        setSalesOrder(cached);
        setLoading(false);
      } else {
        setLoading(true);
        setSalesOrder(null);
      }

      const citiesPromise = listDeliveryCities().catch(
        () => [] as DeliveryCityRow[],
      );
      const profilePromise = fetchProfile().catch(() => null);

      try {
        const q = await getSalesOrder(id, { mode: "view" });
        if (cancelled) return;

        if (!q) {
          setSalesOrder(null);
          setError("Sales order not found.");
          setLoading(false);
          return;
        }

        setSalesOrder(q);
        setLoading(false);

        const [cityRows, prof] = await Promise.all([
          citiesPromise,
          profilePromise,
        ]);
        if (cancelled) return;
        setDeliveryCities(cityRows);
        if (prof) setProfile(prof);

        const billSnap = q.bill_to_snapshot as {
          type?: string;
          company_name?: string;
          full_name?: string;
        };
        const snapshotName =
          billSnap?.type === "company"
            ? billSnap.company_name
            : billSnap?.full_name;
        const needsCustomerFetch =
          Boolean(q.customer_id) && !String(snapshotName ?? "").trim();

        const [invoiceLink, customerRow] = await Promise.all([
          getInvoiceForSalesOrder(id).catch(() => null),
          needsCustomerFetch && q.customer_id
            ? getCustomer(q.customer_id).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setLinkedInvoice(invoiceLink);
        if (customerRow) {
          const name =
            customerRow.type === "company"
              ? customerRow.companyName?.trim() ||
                customerRow.contactName?.trim() ||
                ""
              : customerRow.fullName?.trim() || "";
          setCustomerRecordName(name || null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load.");
          setSalesOrder(null);
          setLoading(false);
          toastRef.current({
            title: "Failed to load sales order",
            description:
              e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, refreshKey]);

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
      salesOrderFulfillmentAllowsEditing(
        normalizeSalesOrderFulfillmentStatus(salesOrder.fulfillment_status)
      ),
    [salesOrder]
  );

  /** Must run before any early return — same hook order every render. */
  const billCityDisplay = useMemo(() => {
    if (!salesOrder) return "";
    const cid = salesOrder.city_id;
    if (cid && deliveryCities.length > 0) {
      const n = deliveryCities.find((c) => c.id === cid)?.name;
      if (n) return n;
    }
    const ci = clientInfoFromBillSnapshot(salesOrder.bill_to_snapshot);
    return ci.city.trim();
  }, [salesOrder, deliveryCities]);

  const billAddressDisplay = useMemo(() => {
    if (!salesOrder) return "";
    const ci = clientInfoFromBillSnapshot(salesOrder.bill_to_snapshot);
    return ci.address_line_1.trim() || ci.street.trim();
  }, [salesOrder]);

  const customerShortcutLabel = useMemo(() => {
    if (!salesOrder) return "View customer";
    const snap = salesOrder.bill_to_snapshot as {
      type?: string;
      company_name?: string;
      full_name?: string;
    };
    const snapshotName =
      snap?.type === "company" ? snap.company_name : snap.full_name;
    const name = String(snapshotName ?? "").trim() || customerRecordName?.trim();
    return name || "View customer";
  }, [salesOrder, customerRecordName]);

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
        <DetailDocumentPageSkeleton />
      </AppPageShell>
    );
  }

  const { subtotal, discount, shipping, total } =
    computeSalesOrderTotals(salesOrder);
  const ccy = salesOrder.currency;

  const from = salesOrder.from_snapshot as {
    logoUrl?: string;
  };
  const bill = salesOrder.bill_to_snapshot as {
    type?: string;
    company_name?: string;
    full_name?: string;
    email?: string;
    phone?: string;
  };

  const billName =
    bill.type === "company" ? bill.company_name : bill.full_name;

  const profileLogoUrl = (profile as { logoUrl?: string } | null)?.logoUrl;
  const logoSrc = from.logoUrl || profileLogoUrl || "/kredence.png";

  const billToIcon = bill.type === "company" ? Building2 : UserRound;
  const notesText = (salesOrder.notes ?? "").trim();
  const termsText = (salesOrder.terms ?? "").trim();

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
                  <span className="font-medium text-foreground">New</span> or{" "}
                  <span className="font-medium text-foreground">Pending</span>.
                </>
              ) : (
                <>View-only summary.</>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start lg:gap-6 xl:gap-7">
          <SectionCard icon={billToIcon} title="Bill to">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div className="space-y-3">
                <InfoRow label="Customer">
                  {salesOrder.customer_id ? (
                    <button
                      type="button"
                      onClick={() => setCustomerDialogOpen(true)}
                      className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
                    >
                      {customerShortcutLabel}
                    </button>
                  ) : (
                    billName || "—"
                  )}
                </InfoRow>
                {bill?.email ? <InfoRow label="Email">{bill.email}</InfoRow> : null}
                {bill?.phone ? <InfoRow label="Phone">{bill.phone}</InfoRow> : null}
                {billCityDisplay ? (
                  <InfoRow label="City">{billCityDisplay}</InfoRow>
                ) : null}
                {billAddressDisplay ? (
                  <InfoRow label="Address">
                    <span className="font-normal leading-relaxed">
                      {billAddressDisplay}
                    </span>
                  </InfoRow>
                ) : null}
              </div>

              <div className="space-y-3 sm:border-l sm:border-border/60 sm:pl-6">
                <InfoRow label="Delivery date">
                  {salesOrder.delivery_date ? (
                    fmtDate(salesOrder.delivery_date)
                  ) : (
                    <span className="font-normal italic text-muted-foreground">
                      Date not set yet
                    </span>
                  )}
                </InfoRow>
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
                {linkedInvoice ? (
                  <InfoRow label="Invoice">
                    <Link
                      href={`/app/invoices/${linkedInvoice.id}`}
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      {linkedInvoice.number}
                    </Link>
                  </InfoRow>
                ) : null}
              </div>
            </div>
            <div className="border-t border-border/60 pt-4">
              <InfoRow label="Notes">
                {notesText ? (
                  <span className="font-normal whitespace-pre-wrap leading-relaxed">
                    {notesText}
                  </span>
                ) : (
                  <span className="font-normal italic text-muted-foreground">
                    No notes
                  </span>
                )}
              </InfoRow>
            </div>
          </SectionCard>

          <SectionCard icon={Receipt} title="Totals">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums font-medium">
                  {fmtMoney(subtotal, ccy)}
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
                  <TableHead className="text-xs font-semibold">Item</TableHead>
                  <TableHead className="text-xs font-semibold">SKU</TableHead>
                  <TableHead className="text-xs font-semibold">Description</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Qty</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Price</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No line items.
                    </TableCell>
                  </TableRow>
                ) : (
                  orderedItems.map((it, idx) => {
                    const lineTotal =
                      Number(it.quantity) * Number(it.unit_price);
                    const pid = it.product_id?.trim();
                    const itemLabel =
                      it.product_name?.trim() || it.item?.trim() || "—";
                    return (
                      <TableRow key={`${it.item}-${idx}`}>
                        <TableCell className="max-w-[200px]">
                          {pid ? (
                            <Link
                              href={`/app/products/${pid}`}
                              className="font-medium text-primary underline-offset-2 hover:underline line-clamp-2"
                            >
                              {itemLabel}
                            </Link>
                          ) : (
                            <span className="font-medium">{itemLabel}</span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {it.product_sku?.trim() || "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px] text-muted-foreground">
                          {it.description || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtMoney(Number(it.unit_price), ccy)}
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

        {termsText ? (
          <SectionCard icon={ScrollText} title="Terms & conditions">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{termsText}</p>
          </SectionCard>
        ) : null}
        </div>
      </div>

      {salesOrder.customer_id ? (
        <CustomerInfoDialog
          customerId={salesOrder.customer_id}
          open={customerDialogOpen}
          onOpenChange={setCustomerDialogOpen}
        />
      ) : null}
    </AppPageShell>
  );
}
