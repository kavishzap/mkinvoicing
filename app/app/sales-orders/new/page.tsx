"use client";
export const dynamic = "force-dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  UserPlus,
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
  DialogDescription,
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
  createSalesOrder,
  getSalesOrder,
  buildFromSnapshotForSalesOrder,
  buildBillToSnapshot,
  clientInfoFromBillSnapshot,
  type SalesOrderLinePayload,
  type SalesOrderStatus,
  type SalesOrderFulfillmentStatus,
  type SalesOrderItemRow,
  SALES_ORDER_FULFILLMENT_STATUSES,
  SALES_ORDER_FULFILLMENT_LABELS,
} from "@/lib/sales-orders-service";
import { getQuotation } from "@/lib/quotations-service";
import { AppPageShell, APP_PAGE_SHELL_CLASS } from "@/components/app-page-shell";
import { SalesOrderLineProductSelect } from "@/components/sales-order-line-product-select";
import { DiscountTypeToggle } from "@/components/discount-type-toggle";
import { applyProductPickToLines } from "@/lib/sales-order-line-items-merge";

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

function CompactBillToCustomer({ c }: { c: CustomerRow }) {
  const name =
    c.type === "company" ? (c.companyName ?? "").trim() : (c.fullName ?? "").trim();
  const sub =
    c.type === "company" && c.contactName?.trim() ? c.contactName : null;
  const contactLine = [c.email, c.phone].filter((x) => String(x ?? "").trim()).join(" · ");
  const addr = [c.address_line_1, c.address_line_2]
    .filter((x) => String(x ?? "").trim())
    .join(", ");
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm space-y-1">
      <p className="font-medium text-foreground">{name || "—"}</p>
      {sub ? <p className="text-muted-foreground">{sub}</p> : null}
      {contactLine ? (
        <p className="text-muted-foreground">{contactLine}</p>
      ) : null}
      {addr ? <p className="text-muted-foreground">{addr}</p> : null}
    </div>
  );
}

function CompactBillToClientInfo({ ci }: { ci: ClientInfo }) {
  const name =
    ci.type === "company"
      ? ci.companyName.trim() || "—"
      : ci.fullName.trim() || "—";
  const sub =
    ci.type === "company" && ci.contactName.trim() ? ci.contactName : null;
  const contactLine = [ci.email, ci.phone].filter(Boolean).join(" · ");
  const addr = [ci.address_line_1, ci.address_line_2].filter(Boolean).join(", ");
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm space-y-1">
      <p className="font-medium text-foreground">{name}</p>
      {sub ? <p className="text-muted-foreground">{sub}</p> : null}
      {contactLine ? (
        <p className="text-muted-foreground">{contactLine}</p>
      ) : null}
      {addr ? <p className="text-muted-foreground">{addr}</p> : null}
    </div>
  );
}

function NewSalesOrderPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [duplicateSourceId] = useState(() => searchParams.get("duplicate"));
  const [convertFromQuotationId] = useState(() =>
    searchParams.get("convertFromQuotation")
  );
  const { toast } = useToast();

  const returnToNewCustomer = useMemo(() => {
    const qs = searchParams.toString();
    const p = pathname ?? "/app/sales-orders/new";
    return encodeURIComponent(qs ? `${p}?${qs}` : p);
  }, [pathname, searchParams]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
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
    new Date().toISOString().split("T")[0]
  );
  const [validUntil, setValidUntil] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validForDays, setValidForDays] = useState("14");
  const [lifecycleStatus, setLifecycleStatus] =
    useState<SalesOrderStatus>("active");
  const [fulfillmentStatus, setFulfillmentStatus] =
    useState<SalesOrderFulfillmentStatus>("new");

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
  const [discount, setDiscount] = useState({
    type: "value" as "value" | "percent",
    amount: 0,
  });
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [duplicatedFromNumber, setDuplicatedFromNumber] = useState<
    string | null
  >(null);
  const [convertedFromQuotationNumber, setConvertedFromQuotationNumber] =
    useState<string | null>(null);
  const duplicateHandledRef = useRef(false);
  const convertHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, prefs] = await Promise.all([
          fetchProfile(),
          fetchPreferences(),
        ]);
        if (cancelled) return;
        setProfile(p);
        setPreferences(prefs);

        const sop = prefs.salesOrderPrefix ?? "SO";
        const sopad = prefs.salesOrderNumberPadding ?? 4;
        const son = prefs.salesOrderNextNumber ?? 1;
        setSalesOrderNumber(`${sop}-${String(son).padStart(sopad, "0")}`);

        const today = new Date();
        setIssueDate(today.toISOString().split("T")[0]);

        const v = new Date(today);
        v.setDate(v.getDate() + (prefs.paymentTerms || 14));
        setValidUntil(v.toISOString().split("T")[0]);
        setValidForDays(String(prefs.paymentTerms || 14));

        setNotes(prefs.defaultNotes || "");
        setTerms(prefs.defaultTerms || "");

        const { rows } = await listCustomers({
          search: "",
          includeInactive: false,
          page: 1,
          pageSize: 100,
        });
        if (cancelled) return;
        setCustomers(rows);

        const { rows: productRows } = await listProducts({
          search: "",
          includeInactive: false,
          page: 1,
          pageSize: 400,
          onlyWithPositiveStock: true,
        });
        if (!cancelled) setProducts(productRows);

        if (convertFromQuotationId && !convertHandledRef.current) {
          convertHandledRef.current = true;
          const q = await getQuotation(convertFromQuotationId);
          if (cancelled) return;
          if (q) {
            const ci = clientInfoFromBillSnapshot(q.bill_to_snapshot);
            setClientInfo({
              type: ci.type,
              companyName: ci.companyName,
              contactName: ci.contactName,
              fullName: ci.fullName,
              email: ci.email,
              phone: ci.phone,
              street: ci.street,
              city: ci.city,
              postal: ci.postal,
              country: ci.country,
              address_line_1: ci.address_line_1,
              address_line_2: ci.address_line_2,
            });
            setDiscount({
              type: q.discount_type,
              amount: q.discount_amount,
            });
            setNotes(q.notes ?? "");
            setTerms(q.terms ?? "");
            setLifecycleStatus("active");
            setFulfillmentStatus("new");
            setLineItems(
              [...q.items]
                .sort(
                  (a, b) =>
                    Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
                )
                .map((it, i) => ({
                  id: `ln-${Date.now()}-${i}`,
                  productId:
                    (it as { product_id?: string | null }).product_id ?? null,
                  item: it.item,
                  description: it.description ?? "",
                  quantity: Number(it.quantity),
                  unitPrice: Number(it.unit_price),
                  tax: Number(it.tax_percent),
                }))
            );
            if (q.customer_id) {
              const match = rows.find((c) => c.id === q.customer_id);
              if (match) setSelectedCustomer(match);
            }
            setConvertedFromQuotationNumber(q.number);
            toast({
              title: "Convert from quotation",
              description: `Form filled from quotation ${q.number}. Save to create sales order with link.`,
            });
          } else {
            toast({
              title: "Could not load quotation",
              description: "Starting with a blank form.",
              variant: "destructive",
            });
          }
          router.replace("/app/sales-orders/new", { scroll: false });
        } else if (duplicateSourceId && !duplicateHandledRef.current) {
          duplicateHandledRef.current = true;
          const q = await getSalesOrder(duplicateSourceId);
          if (cancelled) return;
          if (q) {
            const ci = clientInfoFromBillSnapshot(q.bill_to_snapshot);
            setClientInfo({
              type: ci.type,
              companyName: ci.companyName,
              contactName: ci.contactName,
              fullName: ci.fullName,
              email: ci.email,
              phone: ci.phone,
              street: ci.street,
              city: ci.city,
              postal: ci.postal,
              country: ci.country,
              address_line_1: ci.address_line_1,
              address_line_2: ci.address_line_2,
            });
            setDiscount({
              type: q.discount_type,
              amount: q.discount_amount,
            });
            setNotes(q.notes ?? "");
            setTerms(q.terms ?? "");
            setLifecycleStatus(q.status);
            setFulfillmentStatus(q.fulfillment_status);
            setLineItems(
              [...q.items]
                .sort(
                  (a, b) =>
                    Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
                )
                .map((it, i) => ({
                  id: `ln-${Date.now()}-${i}`,
                  productId: (it as SalesOrderItemRow).product_id ?? null,
                  item: it.item,
                  description: it.description ?? "",
                  quantity: Number(it.quantity),
                  unitPrice: Number(it.unit_price),
                  tax: Number(it.tax_percent),
                }))
            );
            if (q.customer_id) {
              const match = rows.find((c) => c.id === q.customer_id);
              if (match) setSelectedCustomer(match);
            }
            setDuplicatedFromNumber(q.number);
            toast({
              title: "Form filled from sales order",
              description: `Edit as needed, then save to create ${sop}-${String(son).padStart(sopad, "0")}.`,
            });
          } else {
            toast({
              title: "Could not load sales order",
              description: "Starting with a blank form.",
              variant: "destructive",
            });
          }
          router.replace("/app/sales-orders/new", { scroll: false });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Please try again.";
          toast({
            title: "Failed to load data",
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
  }, [toast, duplicateSourceId, convertFromQuotationId, router]);

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
  const taxTotal = useMemo(
    () =>
      lineItems.reduce(
        (sum, item) => sum + (item.quantity * item.unitPrice * item.tax) / 100,
        0
      ),
    [lineItems]
  );
  const discountAmount = useMemo(
    () =>
      discount.type === "percent"
        ? (subtotal * discount.amount) / 100
        : discount.amount,
    [discount, subtotal]
  );
  const total = useMemo(
    () => subtotal + taxTotal - discountAmount,
    [subtotal, taxTotal, discountAmount]
  );

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
      city: c.city ?? "",
      postal: c.postal ?? "",
      country: c.country ?? "",
      address_line_1: c.address_line_1 ?? "",
      address_line_2: c.address_line_2 ?? "",
    });
    setIsCustomerDialogOpen(false);
  };

  function validate(): boolean {
    const next: FieldErrors = {};

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
    return Object.keys(next).length === 0;
  }

  async function doCreateSalesOrder() {
    if (!validate()) {
      toast({
        title: "Please fix the highlighted fields.",
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
        tax_percent: li.tax,
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
            address_line_2: clientInfo.address_line_2 || null,
          };

      const id = await createSalesOrder({
        issue_date: issueDate,
        valid_until: validUntil,
        status: lifecycleStatus,
        fulfillment_status: fulfillmentStatus,
        currency: preferences.currency,
        discount_type: discount.type,
        discount_amount: discount.amount,
        shipping_amount: 0,
        notes,
        terms,
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        client_snapshot: clientSnapshot,
        from_snapshot: fromSnap,
        bill_to_snapshot: billSnap,
        created_from_quotation_id:
          convertFromQuotationId || undefined,
        items: itemsPayload,
      });

      toast({
        title: "Sales order created",
        description: "Your sales order was saved.",
      });
      router.push(`/app/sales-orders/${id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Failed to create sales order",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const headerSubtitle = convertedFromQuotationNumber
    ? `Converting from quotation ${convertedFromQuotationNumber}. Draft number ${salesOrderNumber} — review lines, then save to create the order.`
    : duplicatedFromNumber
      ? `Copied from ${duplicatedFromNumber}. Next number ${salesOrderNumber} — save when you are ready to create a new order.`
      : `Next number ${salesOrderNumber}. Choose a customer, add line items, then save.`;

  if (loading) {
    return (
      <div className={`${APP_PAGE_SHELL_CLASS} max-w-7xl`}>
        <div className="flex items-center justify-between">
          <div className="h-8 w-56 rounded bg-muted animate-pulse" />
          <div className="flex gap-2">
            <div className="h-9 w-28 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="max-w-7xl">
          <div className="h-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-64 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <AppPageShell
      className="max-w-7xl"
      subtitle={headerSubtitle}
      leading={
        <Link href="/app/sales-orders">
          <Button variant="ghost" size="icon" aria-label="Back to sales orders">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      actions={
        <Button onClick={doCreateSalesOrder} disabled={saving} size="sm">
          {saving ? "Saving..." : "Save & View"}
        </Button>
      }
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Bill to & dates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-nowrap items-end gap-3 md:gap-4 overflow-x-auto pb-1">
            <div className="min-w-[min(100%,12rem)] shrink-0 basis-[min(100%,20rem)] max-w-md space-y-3">
              {selectedCustomer ? (
                <CompactBillToCustomer c={selectedCustomer} />
              ) : hasBillToDetails(clientInfo) ? (
                <CompactBillToClientInfo ci={clientInfo} />
              ) : (
                <p className="text-sm text-muted-foreground py-0.5">
                  Pick someone from your customer list.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  onClick={() => setIsCustomerDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4 shrink-0" />
                  {selectedCustomer ? "Change customer" : "Choose customer"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  asChild
                  aria-label="Add new customer (full page)"
                >
                  <Link
                    href={`/app/customers/new?returnTo=${returnToNewCustomer}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              {!selectedCustomer &&
              !hasBillToDetails(clientInfo) &&
              (errors.companyName ||
                errors.fullName ||
                errors.email ||
                errors.phone ||
                errors.address_line_1) ? (
                <p className="text-sm text-destructive">
                  Select a customer from the list to continue.
                </p>
              ) : null}
            </div>
            <div
              className="hidden sm:block w-px shrink-0 self-stretch min-h-[5.5rem] bg-border"
              aria-hidden
            />
            <div className="shrink-0 space-y-2 w-[min(100%,11rem)]">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                className="w-full min-w-0 h-9"
                value={issueDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setIssueDate(v);
                  const base = new Date(v);
                  const days = Number(validForDays) || 14;
                  base.setDate(base.getDate() + days);
                  setValidUntil(base.toISOString().split("T")[0]);
                }}
              />
            </div>
            <div className="shrink-0 space-y-2 w-[min(100%,11rem)]">
              <Label htmlFor="validUntil">Valid Until</Label>
              <Input
                id="validUntil"
                type="date"
                className="w-full min-w-0 h-9"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <div className="shrink-0 space-y-2 w-[min(100%,9.5rem)]">
              <Label htmlFor="validForDays">Valid for (days)</Label>
              <Select
                value={validForDays}
                onValueChange={(v) => {
                  setValidForDays(v);
                  const days = Number(v) || 14;
                  const base = new Date(
                    issueDate || new Date().toISOString().split("T")[0]
                  );
                  base.setDate(base.getDate() + days);
                  setValidUntil(base.toISOString().split("T")[0]);
                }}
              >
                <SelectTrigger id="validForDays" className="w-full min-w-0 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="shrink-0 space-y-2 w-[min(100%,10.5rem)]">
              <Label htmlFor="soFulfillment">Fulfillment status</Label>
              <Select
                value={fulfillmentStatus}
                onValueChange={(v) =>
                  setFulfillmentStatus(v as SalesOrderFulfillmentStatus)
                }
              >
                <SelectTrigger id="soFulfillment" className="w-full min-w-0 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALES_ORDER_FULFILLMENT_STATUSES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {SALES_ORDER_FULFILLMENT_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.lineItems && (
            <p className="mb-2 text-xs text-destructive">{errors.lineItems}</p>
          )}
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px] text-center align-middle">
                    Order
                  </TableHead>
                  <TableHead className="w-[min(14rem,22vw)] align-middle">
                    Product *
                  </TableHead>
                  <TableHead className="w-[200px] align-middle">Item</TableHead>
                  <TableHead className="w-[250px] align-middle">
                    Description
                  </TableHead>
                  <TableHead className="w-[100px] align-middle">Qty *</TableHead>
                  <TableHead className="w-[120px] align-middle">
                    Unit Price *
                  </TableHead>
                  <TableHead className="w-[100px] align-middle">Tax %</TableHead>
                  <TableHead className="w-[120px] text-right align-middle">
                    Total
                  </TableHead>
                  <TableHead className="w-[50px] align-middle"></TableHead>
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
                  const lineTotal =
                    item.quantity * item.unitPrice * (1 + item.tax / 100);

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
                      <TableCell className="align-middle py-2">
                        <Input
                          readOnly
                          tabIndex={-1}
                          value={item.item}
                          placeholder="—"
                          title={item.item || undefined}
                          className="h-9 bg-muted/40 pointer-events-none"
                        />
                      </TableCell>
                      <TableCell className="align-middle py-2">
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
                      <TableCell className="align-middle py-2">
                        <Select
                          value={item.tax.toString()}
                          onValueChange={(v) =>
                            updateLineItem(item.id, "tax", Number(v))
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="10">10%</SelectItem>
                            <SelectItem value="15">15%</SelectItem>
                            <SelectItem value="20">20%</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-medium align-middle py-2">
                        {preferences?.currency} {lineTotal.toFixed(2)}
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
            Add Row
          </Button>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Notes & Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="terms">Terms & Conditions</Label>
              <Textarea
                id="terms"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Sales order terms..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>
                  {preferences?.currency} {subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>
                  {preferences?.currency} {taxTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Discount</span>
                <div className="flex items-center gap-2">
                  <DiscountTypeToggle
                    value={discount.type}
                    onChange={(t) => setDiscount({ ...discount, type: t })}
                    currencyLabel={preferences?.currency ?? ""}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount.amount}
                    onChange={(e) =>
                      setDiscount({
                        ...discount,
                        amount: Number(e.target.value),
                      })
                    }
                    className="w-[100px] h-8"
                  />
                  <span className="text-sm min-w-[80px] text-right">
                    -{preferences?.currency} {discountAmount.toFixed(2)}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>
                  {preferences?.currency} {total.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isCustomerDialogOpen}
        onOpenChange={(open) => {
          setIsCustomerDialogOpen(open);
          if (open) {
            void (async () => {
              try {
                const { rows } = await listCustomers({
                  search: "",
                  includeInactive: false,
                  page: 1,
                  pageSize: 100,
                });
                setCustomers(rows);
              } catch {
                /* ignore */
              }
            })();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Customer</DialogTitle>
            <DialogDescription>
              Choose a customer from your database
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <Input
              placeholder="Search customers..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {customers.map((c) => {
                const label =
                  c.type === "company" ? c.companyName : c.fullName;
                const line2 = [c.email, c.phone]
                  .filter((x) => String(x ?? "").trim())
                  .join(" · ");
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full text-left rounded-lg border px-3 py-2.5 hover:bg-accent transition-colors"
                  >
                    <div className="font-medium text-sm">{label || "—"}</div>
                    {line2 ? (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {line2}
                      </div>
                    ) : null}
                  </button>
                );
              })}

              {customers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No customers found</p>
                  <Link
                    href={`/app/customers/new?returnTo=${returnToNewCustomer}`}
                  >
                    <Button variant="link" className="mt-2">
                      Add a new customer
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}

export default function NewSalesOrderPage() {
  return (
    <Suspense
      fallback={
        <div className={`${APP_PAGE_SHELL_CLASS} max-w-7xl`}>
          <div className="h-8 w-56 rounded bg-muted animate-pulse" />
          <div className="max-w-7xl">
            <div className="h-28 rounded bg-muted animate-pulse" />
          </div>
        </div>
      }
    >
      <NewSalesOrderPageContent />
    </Suspense>
  );
}
