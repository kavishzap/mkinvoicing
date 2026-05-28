"use client";
import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  Package,
  Plus,
  Receipt,
  Save,
  ScrollText,
  Store,
  Trash2,
  UserPlus,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";

import {
  fetchProfile,
  fetchPreferences,
  type Profile,
  type Preferences,
} from "@/lib/settings-service";
import { listCustomers, type CustomerRow } from "@/lib/customers-service";
import {
  listProducts,
  type ProductRow,
} from "@/lib/products-service";
import {
  getSalesOrder,
  resolveDiscountAmount,
  computeSalesOrderValidUntil,
  updateSalesOrder,
  buildFromSnapshotForSalesOrder,
  buildBillToSnapshot,
  clientInfoFromBillSnapshot,
  cityIdFromDeliveryCityName,
  normalizeSalesOrderFulfillmentStatus,
  salesOrderFulfillmentAllowsEditing,
  type SalesOrderLinePayload,
  type SalesOrderStatus,
  type SalesOrderFulfillmentStatus,
  type SalesOrderItemRow,
  type SalesOrderPaymentStatus,
} from "@/lib/sales-orders-service";
import { AppPageShell } from "@/components/app-page-shell";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { SalesOrderPaymentStatusBadge } from "@/components/sales-order-payment-status-badge";
import { SalesOrderStatusBadge } from "@/components/sales-order-status-badge";
import { cn } from "@/lib/utils";
import { SalesOrderLineProductSelect } from "@/components/sales-order-line-product-select";
import { applyProductPickToLines } from "@/lib/sales-order-line-items-merge";
import { listDeliveryCities, type DeliveryCityRow } from "@/lib/delivery-zones-service";

const DEFAULT_TAX_PERCENT = 15;

type LineItem = {
  id: string;
  /** `products.id`; required before save. */
  productId: string | null;
  item: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
};

type ClientInfo = {
  type: "company" | "individual";
  companyName: string;
  contactName: string;
  fullName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  postal: string;
  country: string;
  address_line_1: string;
  address_line_2: string;
};

type FieldErrors = Partial<
  Record<
    | "billTo"
    | "companyName"
    | "fullName"
    | "email"
    | "phone"
    | "address_line_1"
    | "lineItems"
    | `product_${string}`
    | `qty_${string}`
    | `price_${string}`,
    string
  >
>;

function hasBillToDetails(ci: ClientInfo): boolean {
  return (
    (ci.type === "company" && ci.companyName.trim().length > 0) ||
    (ci.type === "individual" && ci.fullName.trim().length > 0) ||
    ci.email.trim().length > 0 ||
    ci.phone.trim().length > 0 ||
    ci.address_line_1.trim().length > 0
  );
}

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

const twoColSectionGridClass =
  "grid min-h-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8 xl:gap-10 [&>*]:min-w-0";

function EditSectionCard({
  icon: Icon,
  title,
  headerRight,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex min-h-0 w-full max-w-full flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm self-start",
        className,
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
          <CardTitle className={sectionTitleClass}>{title}</CardTitle>
          {headerRight ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {headerRight}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="field-controls flex min-h-0 flex-col space-y-4 px-4 py-5 [&_input]:h-8 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs">
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

export default function EditSalesOrderPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const salesOrderId = params.id;
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [cities, setCities] = useState<DeliveryCityRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(
    null
  );

  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    type: "company",
    companyName: "",
    contactName: "",
    fullName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    postal: "",
    country: "",
    address_line_1: "",
    address_line_2: "",
  });

  const [salesOrderNumber, setSalesOrderNumber] = useState("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [deliveryDate, setDeliveryDate] = useState("");
  const [lifecycleStatus, setLifecycleStatus] =
    useState<SalesOrderStatus>("active");
  const [fulfillmentStatus, setFulfillmentStatus] =
    useState<SalesOrderFulfillmentStatus>("new");
  const [paymentStatus, setPaymentStatus] =
    useState<SalesOrderPaymentStatus>("unpaid");
  const [createdFromQuotationId, setCreatedFromQuotationId] = useState<
    string | null
  >(null);

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: "1",
      productId: null,
      item: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      tax: DEFAULT_TAX_PERCENT,
    },
  ]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!salesOrderId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [
          p,
          prefs,
          q,
          prodRes,
          cityRows,
          customerList,
        ] = await Promise.all([
          fetchProfile(),
          fetchPreferences(),
          getSalesOrder(salesOrderId),
          listProducts({
            search: "",
            includeInactive: false,
            page: 1,
            pageSize: 400,
            onlyWithPositiveStock: true,
          }),
          listDeliveryCities(),
          listCustomers({
            search: "",
            includeInactive: false,
            page: 1,
            pageSize: 100,
          }),
        ]);
        if (cancelled) return;
        if (!q) {
          toastRef.current({
            title: "Sales order not found",
            variant: "destructive",
          });
          router.replace("/app/sales-orders");
          return;
        }

        if (
          !salesOrderFulfillmentAllowsEditing(
            normalizeSalesOrderFulfillmentStatus(q.fulfillment_status)
          )
        ) {
          toastRef.current({
            title: "Editing not available",
            description:
              "Sales orders can only be edited when fulfillment status is New or Pending.",
            variant: "destructive",
          });
          router.replace(`/app/sales-orders/${salesOrderId}`);
          return;
        }

        setProfile(p);
        setPreferences(prefs);
        setProducts(prodRes.rows);
        setCities(cityRows);
        setSalesOrderNumber(q.number);
        setIssueDate(q.issue_date);
        setDeliveryDate(
          q.delivery_date ? String(q.delivery_date).slice(0, 10) : "",
        );
        setLifecycleStatus(q.status);
        setFulfillmentStatus(q.fulfillment_status);
        setPaymentStatus(q.payment_status);
        setCreatedFromQuotationId(q.created_from_quotation_id);
        setNotes(q.notes ?? "");
        setTerms(q.terms ?? "");

        const ci = clientInfoFromBillSnapshot(q.bill_to_snapshot);
        const cityFromCatalog =
          q.city_id && cityRows.length > 0
            ? cityRows.find((c) => c.id === q.city_id)?.name
            : undefined;
        setClientInfo({
          type: ci.type,
          companyName: ci.companyName,
          contactName: ci.contactName,
          fullName: ci.fullName,
          email: ci.email,
          phone: ci.phone,
          street: ci.street,
          city: cityFromCatalog ?? ci.city,
          postal: ci.postal,
          country: ci.country,
          address_line_1: ci.address_line_1,
          address_line_2: ci.address_line_2,
        });

        const loadedLines = [...q.items]
          .sort(
            (a, b) =>
              Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
          )
          .map((it, i) => ({
            id: `ln-${i}-${it.item?.slice(0, 8) || "row"}`,
            productId: (it as SalesOrderItemRow).product_id ?? null,
            item: it.item,
            description: it.description ?? "",
            quantity: Number(it.quantity),
            unitPrice: Number(it.unit_price),
            tax: Number(it.tax_percent),
          }));
        const loadedSubtotal = loadedLines.reduce(
          (sum, it) => sum + it.quantity * it.unitPrice,
          0,
        );
        setDiscountAmount(
          resolveDiscountAmount(
            q.discount_type,
            q.discount_amount,
            loadedSubtotal,
          ),
        );
        setLineItems(loadedLines);

        setCustomers(customerList.rows);
        if (q.customer_id) {
          const match = customerList.rows.find((c) => c.id === q.customer_id);
          if (match) setSelectedCustomer(match);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Please try again.";
          toastRef.current({
            title: "Failed to load sales order",
            description: msg,
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
  }, [salesOrderId, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { rows } = await listCustomers({
          search: customerSearch,
          includeInactive: false,
          page: 1,
          pageSize: 50,
        });
        if (!cancelled) setCustomers(rows);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerSearch]);

  const subtotal = useMemo(
    () =>
      lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [lineItems]
  );
  const total = useMemo(
    () => subtotal - discountAmount,
    [subtotal, discountAmount]
  );

  const currency = preferences?.currency ?? "USD";

  const billDisplayName = useMemo(() => {
    return clientInfo.type === "company"
      ? clientInfo.companyName.trim()
      : clientInfo.fullName.trim();
  }, [clientInfo]);

  const productSummary = useMemo(() => {
    type SummaryRow = {
      key: string;
      productId: string | null;
      label: string;
      sku: string | null;
      totalQty: number;
      lineCount: number;
    };
    const map = new Map<string, SummaryRow>();
    for (const it of lineItems) {
      const pid = it.productId?.trim() || null;
      const itemLabel = String(it.item ?? "").trim() || "Line item";
      const key =
        pid ??
        `manual:${itemLabel}:${Number(it.unitPrice ?? 0)}:${Number(it.tax ?? 0)}`;
      const prod = pid ? products.find((p) => p.id === pid) : undefined;
      const catalogName = prod?.name?.trim() || null;
      const label = pid ? catalogName || itemLabel : itemLabel;
      const sku = pid ? prod?.sku?.trim() || null : null;
      const qty = Number(it.quantity) || 0;
      const prev = map.get(key);
      if (prev) {
        prev.totalQty += qty;
        prev.lineCount += 1;
      } else {
        map.set(key, {
          key,
          productId: pid,
          label,
          sku,
          totalQty: qty,
          lineCount: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
  }, [lineItems, products]);

  const logoSrc =
    (profile as { logoUrl?: string })?.logoUrl || "/kredence.png";

  const billToIcon =
    clientInfo.type === "company" ? Building2 : UserRound;

  const addLineItem = () =>
    setLineItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        productId: null,
        item: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        tax: DEFAULT_TAX_PERCENT,
      },
    ]);

  const removeLineItem = (id: string) => {
    setLineItems((prev) =>
      prev.length > 1 ? prev.filter((it) => it.id !== id) : prev
    );
  };

  const updateLineItem = (
    id: string,
    field: keyof LineItem,
    value: string | number | null
  ) => {
    setLineItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        return { ...it, [field]: value } as LineItem;
      })
    );
  };

  const moveLineUp = (index: number) => {
    if (index <= 0) return;
    setLineItems((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveLineDown = (index: number) => {
    setLineItems((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleSelectCustomer = (c: CustomerRow) => {
    setSelectedCustomer(c);
    setClientInfo({
      type: c.type,
      companyName: c.companyName ?? "",
      contactName: c.contactName ?? "",
      fullName: c.fullName ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      street: c.street ?? "",
      city: c.cityName ?? c.city ?? "",
      postal: c.postal ?? "",
      country: c.country ?? "",
      address_line_1: c.address_line_1 ?? "",
      address_line_2: "",
    });
    setIsCustomerDialogOpen(false);
    setErrors((e) => {
      const next = { ...e };
      delete next.billTo;
      delete next.companyName;
      delete next.fullName;
      delete next.email;
      delete next.phone;
      delete next.address_line_1;
      return next;
    });
    toastRef.current({
      title: "Customer selected",
      description: `${
        c.type === "company" ? c.companyName : c.fullName
      } added to the sales order.`,
    });
  };

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (selectedCustomer) {
      // Linked customer: same rule as new sales order — do not block save on sparse legacy rows.
    } else if (!hasBillToDetails(clientInfo)) {
      next.billTo =
        "Choose a customer or enter bill-to details (name, email, phone, or address) before saving.";
    } else {
      const needCompany = clientInfo.type === "company";
      if (needCompany && !clientInfo.companyName.trim())
        next.companyName = "Company name is required";
      if (!needCompany && !clientInfo.fullName.trim())
        next.fullName = "Full name is required";

      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!clientInfo.email.trim()) next.email = "Email is required";
      else if (!emailRx.test(clientInfo.email)) next.email = "Invalid email";

      if (!clientInfo.phone.trim()) next.phone = "Phone is required";
      if (!clientInfo.address_line_1.trim())
        next.address_line_1 = "Address line 1 is required";
    }

    if (lineItems.length === 0) {
      next.lineItems = "At least one line item is required";
    } else {
      lineItems.forEach((li) => {
        if (!li.productId?.trim())
          next[`product_${li.id}`] = "Select a product";
        if (!(li.quantity > 0))
          next[`qty_${li.id}`] = "Quantity must be greater than 0";
        if (!(li.unitPrice >= 0))
          next[`price_${li.id}`] = "Unit price must be 0 or more";
      });
    }

    setErrors(next);
    return next;
  }

  async function saveSalesOrder() {
    if (!salesOrderId) return;
    const validation = validate();
    if (Object.keys(validation).length > 0) {
      const firstMsg = Object.values(validation).find(
        (v): v is string => typeof v === "string" && v.length > 0
      );
      toastRef.current({
        title: "Please fix the highlighted fields.",
        description: firstMsg,
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      if (!preferences) throw new Error("Preferences not loaded");
      if (!profile) throw new Error("Profile not loaded");

      const itemsPayload: SalesOrderLinePayload[] = lineItems.map((li, i) => ({
        item: li.item,
        description: li.description || undefined,
        quantity: li.quantity,
        unit_price: li.unitPrice,
        tax_percent: 0,
        sort_order: i,
        product_id: li.productId,
      }));

      const fromSnap = buildFromSnapshotForSalesOrder(profile);
      const billSnap = buildBillToSnapshot(clientInfo);

      const clientSnapshot = selectedCustomer
        ? null
        : {
            type: clientInfo.type,
            company_name: clientInfo.companyName || null,
            contact_name: clientInfo.contactName || null,
            full_name: clientInfo.fullName || null,
            email: clientInfo.email || null,
            phone: clientInfo.phone || null,
            street: clientInfo.street || null,
            city: clientInfo.city || null,
            postal: clientInfo.postal || null,
            country: clientInfo.country || null,
            address_line_1: clientInfo.address_line_1 || null,
            address_line_2: null,
          };

      await updateSalesOrder(salesOrderId, {
        issue_date: issueDate,
        valid_until: computeSalesOrderValidUntil(
          issueDate,
          preferences?.paymentTerms ?? 14,
        ),
        status: lifecycleStatus,
        fulfillment_status: fulfillmentStatus,
        currency: preferences.currency,
        discount_type: "value",
        discount_amount: discountAmount,
        shipping_amount: 0,
        notes,
        terms,
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        city_id: cityIdFromDeliveryCityName(clientInfo.city, cities),
        client_snapshot: clientSnapshot,
        from_snapshot: fromSnap,
        bill_to_snapshot: billSnap,
        items: itemsPayload,
        delivery_date: deliveryDate.trim() || null,
      });

      toastRef.current({
        title: "Sales order updated",
        description: "Your changes were saved.",
      });
      router.push(`/app/sales-orders/${salesOrderId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toastRef.current({
        title: "Failed to save sales order",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const err = (k: keyof FieldErrors) => (errors[k] ? "border-destructive" : "");

  if (loading) {
    return (
      <AppPageShell
        fillHeight
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      >
        <FormTwoColumnPageSkeleton withLineItems />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label="Back to sales order"
        >
          <Link
            href={
              salesOrderId
                ? `/app/sales-orders/${salesOrderId}`
                : "/app/sales-orders"
            }
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      subtitle={`${salesOrderNumber}${billDisplayName ? ` · ${billDisplayName}` : ""}`}
      subtitleClassName="w-full min-w-0 max-w-none"
      actions={
        <Button
          onClick={saveSalesOrder}
          disabled={saving}
          className="gap-2 rounded font-semibold shadow-sm"
        >
          <Save className="size-3.5 shrink-0" aria-hidden />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      }
    >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/app/sales-orders/${salesOrderId}`}>
                View sales order
              </Link>
            </Button>
          </div>

          <div className="flex min-w-0 flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
            <div className="flex min-w-0 flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                  Sales order {salesOrderNumber}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{currency}</span>
                  <span aria-hidden>·</span>
                  <span>Issue {fmtDate(issueDate)}</span>
                  {billDisplayName ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-medium text-foreground">
                        {billDisplayName}
                      </span>
                    </>
                  ) : null}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SalesOrderStatusBadge status={lifecycleStatus} />
                  <SalesOrderFulfillmentStatusBadge
                    status={fulfillmentStatus}
                  />
                  <SalesOrderPaymentStatusBadge status={paymentStatus} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground lg:max-w-sm lg:text-right">
                Update customer, lines, and totals, then use{" "}
                <span className="font-medium text-foreground">
                  Save changes
                </span>{" "}
                in the top bar.
              </p>
            </div>

            <div className={twoColSectionGridClass}>
              <EditSectionCard
                icon={Store}
                title="Seller"
                headerRight={
                  <Link href="/app/settings">
                    <Button variant="link" size="sm" className="h-auto px-0">
                      Edit in Settings
                    </Button>
                  </Link>
                }
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {logoSrc ? (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                      <Image
                        src={logoSrc}
                        alt=""
                        width={56}
                        height={56}
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                      {(profile?.companyName || profile?.fullName || "S")
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-3">
                    <InfoRow label="Name">
                      {profile?.accountType === "company"
                        ? profile?.companyName || "—"
                        : profile?.fullName || "—"}
                    </InfoRow>
                    {profile?.email ? (
                      <InfoRow label="Email">{profile.email}</InfoRow>
                    ) : null}
                    {profile?.accountType === "company" &&
                    profile?.registrationId ? (
                      <InfoRow label="Registration">
                        {profile.registrationId}
                      </InfoRow>
                    ) : null}
                    {profile?.accountType === "company" && profile?.vatNumber ? (
                      <InfoRow label="VAT">{profile.vatNumber}</InfoRow>
                    ) : null}
                  </div>
                </div>
              </EditSectionCard>

              <EditSectionCard
                icon={billToIcon}
                title="Bill to"
                headerRight={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCustomerDialogOpen(true)}
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Select customer
                  </Button>
                }
              >
                {errors.billTo ? (
                  <p className="text-xs text-destructive">{errors.billTo}</p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    variant={clientInfo.type === "company" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setClientInfo({ ...clientInfo, type: "company" })
                    }
                    className="flex-1"
                  >
                    Company
                  </Button>
                  <Button
                    variant={
                      clientInfo.type === "individual" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      setClientInfo({ ...clientInfo, type: "individual" })
                    }
                    className="flex-1"
                  >
                    Individual
                  </Button>
                </div>

                {clientInfo.type === "company" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input
                        id="companyName"
                        className={err("companyName")}
                        value={clientInfo.companyName}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            companyName: e.target.value,
                          })
                        }
                        placeholder="Acme Corp"
                      />
                      {errors.companyName && (
                        <p className="text-xs text-destructive">
                          {errors.companyName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactName">
                        Contact Name (Optional)
                      </Label>
                      <Input
                        id="contactName"
                        value={clientInfo.contactName}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            contactName: e.target.value,
                          })
                        }
                        placeholder="John Doe"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      className={err("fullName")}
                      value={clientInfo.fullName}
                      onChange={(e) =>
                        setClientInfo({ ...clientInfo, fullName: e.target.value })
                      }
                      placeholder="John Doe"
                    />
                    {errors.fullName && (
                      <p className="text-xs text-destructive">
                        {errors.fullName}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientEmail">Email *</Label>
                    <Input
                      id="clientEmail"
                      className={err("email")}
                      type="email"
                      value={clientInfo.email}
                      onChange={(e) =>
                        setClientInfo({ ...clientInfo, email: e.target.value })
                      }
                      placeholder="client@example.com"
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">Phone *</Label>
                    <Input
                      id="clientPhone"
                      className={err("phone")}
                      value={clientInfo.phone}
                      onChange={(e) =>
                        setClientInfo({ ...clientInfo, phone: e.target.value })
                      }
                      placeholder="+230 5xx xx xx"
                    />
                    {errors.phone && (
                      <p className="text-xs text-destructive">{errors.phone}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientCity">City</Label>
                  <Select
                    value={clientInfo.city || "__none__"}
                    onValueChange={(v) => {
                      const nextCity = v === "__none__" ? "" : v;
                      setClientInfo({
                        ...clientInfo,
                        city: nextCity,
                      });
                      if (selectedCustomer) {
                        setSelectedCustomer((prev) =>
                          prev
                            ? {
                                ...prev,
                                city: nextCity,
                                cityName:
                                  cities.find((c) => c.name === nextCity)?.name ??
                                  prev.cityName,
                                cityId:
                                  cities.find((c) => c.name === nextCity)?.id ??
                                  null,
                              }
                            : prev
                        );
                      }
                    }}
                  >
                    <SelectTrigger id="clientCity">
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No city</SelectItem>
                      {cities
                        .filter((c) => c.isActive)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientAddress1">Address Line 1 *</Label>
                  <Input
                    id="clientAddress1"
                    className={err("address_line_1")}
                    value={clientInfo.address_line_1}
                    onChange={(e) =>
                      setClientInfo({
                        ...clientInfo,
                        address_line_1: e.target.value,
                      })
                    }
                    placeholder="e.g. 123 Main St, Port Louis"
                  />
                  {errors.address_line_1 && (
                    <p className="text-xs text-destructive">
                      {errors.address_line_1}
                    </p>
                  )}
                </div>
                {createdFromQuotationId ? (
                  <InfoRow label="Created from quotation">
                    <Link
                      href={`/app/quotations/${createdFromQuotationId}`}
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      Open quotation
                    </Link>
                  </InfoRow>
                ) : null}
                {selectedCustomer?.id ? (
                  <InfoRow label="Linked customer">
                    <Link
                      href={`/app/customers/${selectedCustomer.id}/edit`}
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      View customer record
                    </Link>
                  </InfoRow>
                ) : null}
              </EditSectionCard>
            </div>

            <div className={twoColSectionGridClass}>
              <EditSectionCard
                icon={CalendarDays}
                title="Dates & fulfillment"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="issueDate" className={fieldLabelClass}>
                      Issue date
                    </Label>
                    <Input
                      id="issueDate"
                      type="date"
                      value={issueDate}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="soDeliveryDate" className={fieldLabelClass}>
                      Delivery date
                    </Label>
                    <Input
                      id="soDeliveryDate"
                      type="date"
                      value={deliveryDate}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="min-w-0 space-y-2 sm:col-span-2">
                    <Label className={fieldLabelClass}>Fulfillment status</Label>
                    <div className="flex h-8 items-center">
                      <SalesOrderFulfillmentStatusBadge
                        status={fulfillmentStatus}
                      />
                    </div>
                  </div>
                </div>
              </EditSectionCard>

              <EditSectionCard
                icon={Receipt}
                title="Totals"
              >
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums font-medium">
                      {fmtMoney(subtotal, currency)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">
                      Discount
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountAmount}
                        onChange={(e) =>
                          setDiscountAmount(Number(e.target.value))
                        }
                        className="h-8 w-[100px]"
                      />
                      <span className="min-w-[80px] text-right text-sm tabular-nums">
                        −{fmtMoney(discountAmount, currency)}
                      </span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">
                      {fmtMoney(total, currency)}
                    </span>
                  </div>
                </div>
              </EditSectionCard>
            </div>

            <EditSectionCard icon={Package} title="Products" className="min-w-0 max-w-full">
              <p className="text-xs text-muted-foreground">
                Aggregated from line items; links open the product record.
              </p>
              <div className="max-w-full min-w-0 overflow-x-auto rounded-md border">
                <Table className="w-max min-w-full">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="min-w-[10rem] text-xs font-semibold">
                        Product
                      </TableHead>
                      <TableHead className="min-w-[6rem] text-xs font-semibold">
                        SKU
                      </TableHead>
                      <TableHead className="min-w-[6rem] text-right text-xs font-semibold">
                        Total qty
                      </TableHead>
                      <TableHead className="min-w-[5rem] text-right text-xs font-semibold">
                        Lines
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productSummary.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No products on this order yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      productSummary.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium">
                            {row.productId ? (
                              <Link
                                href={`/app/products/${row.productId}`}
                                className="text-primary underline-offset-2 hover:underline"
                              >
                                {row.label}
                              </Link>
                            ) : (
                              <span>{row.label}</span>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {row.sku ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.totalQty}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {row.lineCount}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </EditSectionCard>

            <EditSectionCard
              icon={ListOrdered}
              title="Line items"
              className="min-w-0 max-w-full"
            >
              {errors.lineItems ? (
                <p className="text-xs text-destructive">{errors.lineItems}</p>
              ) : null}
              <div className="max-w-full min-w-0 overflow-x-auto rounded-md border">
                <Table className="w-max min-w-full">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[72px] min-w-[72px] text-center text-xs font-semibold">
                        Order
                      </TableHead>
                      <TableHead className="min-w-[9rem] text-xs font-semibold">
                        Item *
                      </TableHead>
                      <TableHead className="min-w-[10rem] text-xs font-semibold">
                        Description
                      </TableHead>
                      <TableHead className="min-w-[4.5rem] text-xs font-semibold">
                        Qty *
                      </TableHead>
                      <TableHead className="min-w-[5.5rem] text-xs font-semibold">
                        Unit price *
                      </TableHead>
                      <TableHead className="min-w-[5.5rem] text-right text-xs font-semibold">
                        Total
                      </TableHead>
                      <TableHead className="w-10 min-w-10 text-xs font-semibold" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                {lineItems.map((item, index) => {
                  const lineErrProduct =
                    errors[`product_${item.id}` as keyof FieldErrors];
                  const lineErrQty =
                    errors[`qty_${item.id}` as keyof FieldErrors];
                  const lineErrPrice =
                    errors[`price_${item.id}` as keyof FieldErrors];
                  const lineTotal = item.quantity * item.unitPrice;

                  return (
                    <TableRow key={item.id} className="align-middle">
                      <TableCell className="align-middle py-2">
                        <div className="flex flex-row items-center justify-center gap-0.5 h-9">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => moveLineUp(index)}
                            disabled={index === 0}
                            aria-label="Move line up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => moveLineDown(index)}
                            disabled={index === lineItems.length - 1}
                            aria-label="Move line down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <div className="space-y-1">
                          <SalesOrderLineProductSelect
                            products={products}
                            value={item.productId}
                            invalid={Boolean(lineErrProduct)}
                            onValueChange={(pid) => {
                              const p = products.find((x) => x.id === pid);
                              if (!p) return;
                              setLineItems((prev) =>
                                applyProductPickToLines(prev, item.id, {
                                  id: p.id,
                                  name: p.name,
                                  description: p.description || "",
                                  salePrice: p.salePrice,
                                })
                              );
                              setErrors((e) => {
                                const next = { ...e };
                                delete next[`product_${item.id}`];
                                delete next[`qty_${item.id}`];
                                delete next[`price_${item.id}`];
                                return next;
                              });
                            }}
                          />
                          {lineErrProduct ? (
                            <p className="text-xs text-destructive">
                              {String(lineErrProduct)}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[18rem] whitespace-normal align-middle py-2">
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "description",
                              e.target.value
                            )
                          }
                          placeholder="Description"
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "quantity",
                              Number(e.target.value)
                            )
                          }
                          className={`h-9 ${
                            lineErrQty ? "border-destructive" : ""
                          }`}
                        />
                        {lineErrQty && (
                          <p className="text-xs text-destructive mt-1">
                            {String(lineErrQty)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "unitPrice",
                              Number(e.target.value)
                            )
                          }
                          className={`h-9 ${
                            lineErrPrice ? "border-destructive" : ""
                          }`}
                        />
                        {lineErrPrice && (
                          <p className="text-xs text-destructive mt-1">
                            {String(lineErrPrice)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right align-middle font-medium tabular-nums">
                        {fmtMoney(lineTotal, currency)}
                      </TableCell>
                      <TableCell className="align-middle py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                          className="h-9 w-9"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                  </TableBody>
                </Table>
              </div>
              <Button
                variant="outline"
                onClick={addLineItem}
                className="mt-4 gap-2 bg-transparent"
              >
                <Plus className="h-4 w-4" />
                Add row
              </Button>
            </EditSectionCard>

            <EditSectionCard icon={ScrollText} title="Notes & terms" className="min-w-0 max-w-full">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="terms">Terms & conditions</Label>
                  <Textarea
                    id="terms"
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Sales order terms..."
                    rows={3}
                  />
                </div>
              </div>
            </EditSectionCard>
          </div>
        </div>

        <Dialog
          open={isCustomerDialogOpen}
          onOpenChange={setIsCustomerDialogOpen}
        >
          <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>Select Customer</DialogTitle>
            </DialogHeader>

            <div className="flex flex-1 flex-col space-y-4 overflow-hidden">
              <Input
                placeholder="Search customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />

              <div className="flex-1 space-y-2 overflow-y-auto pr-2">
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCustomer(c)}
                  className="w-full text-left p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="font-semibold">
                    {c.type === "company" ? c.companyName : c.fullName}
                  </div>
                  {c.type === "company" && c.contactName && (
                    <div className="text-sm text-muted-foreground">
                      {c.contactName}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground mt-1">
                    {c.email}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {[c.phone, c.cityName || c.city].filter(Boolean).join(" · ") || "—"}
                  </div>
                </button>
              ))}

              {customers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No customers found</p>
                  <Link href="/app/customers">
                    <Button variant="link" className="mt-2">
                      Add a new customer
                    </Button>
                  </Link>
                </div>
              ) : null}
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </AppPageShell>
  );
}
