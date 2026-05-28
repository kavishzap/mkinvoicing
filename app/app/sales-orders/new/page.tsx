"use client";
import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  Plus,
  Receipt,
  Save,
  ScrollText,
  Store,
  Trash2,
  UserPlus,
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  resolveDiscountAmount,
  computeSalesOrderValidUntil,
  buildFromSnapshotForSalesOrder,
  buildBillToSnapshot,
  clientInfoFromBillSnapshot,
  cityIdFromDeliveryCityName,
  type SalesOrderLinePayload,
  type SalesOrderStatus,
  type SalesOrderItemRow,
} from "@/lib/sales-orders-service";
import { SalesOrderFulfillmentStatusBadge } from "@/components/sales-order-fulfillment-status-badge";
import { getQuotation } from "@/lib/quotations-service";
import { AppPageShell } from "@/components/app-page-shell";
import { cn } from "@/lib/utils";
import { SalesOrderLineProductSelect } from "@/components/sales-order-line-product-select";
import { applyProductPickToLines } from "@/lib/sales-order-line-items-merge";
import { listDeliveryCities, type DeliveryCityRow } from "@/lib/delivery-zones-service";

const DEFAULT_TAX_PERCENT = 0;

function formatNumericFieldValue(n: number) {
  return n === 0 ? "" : String(n);
}

function parseNumericFieldValue(raw: string) {
  if (raw.trim() === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

/** Location `/locations/new` uses `flex-1` on a single grid; sales-order forms stack sections — no `flex-1` or rows steal viewport height. */
const salesOrderTwoColGridClass =
  "grid min-h-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8 xl:gap-10 [&>*]:min-w-0";

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
  headerRight,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "flex min-h-0 w-full max-w-full flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm self-start",
        className,
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={sectionIconBoxClass}>
            <Icon className={sectionIconClass} aria-hidden />
          </div>
          <CardTitle className={sectionTitleClass}>{title}</CardTitle>
        </div>
        {headerRight ? (
          <div className="flex shrink-0 items-center">{headerRight}</div>
        ) : null}
      </CardHeader>
      <CardContent className="field-controls flex min-h-0 flex-col space-y-4 px-4 py-5 [&_input]:h-8 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs">
        {children}
      </CardContent>
    </Card>
  );
}

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

function CompactBillToCustomer({ c }: { c: CustomerRow }) {
  const name =
    c.type === "company" ? (c.companyName ?? "").trim() : (c.fullName ?? "").trim();
  const sub =
    c.type === "company" && c.contactName?.trim() ? c.contactName : null;
  const contactLine = [c.email, c.phone].filter((x) => String(x ?? "").trim()).join(" · ");
  const city = (c.cityName || c.city || "").trim();
  return (
    <div className="min-w-0 w-full max-w-full rounded-md border bg-muted/30 px-3 py-2.5 text-sm space-y-1">
      <p className="break-words font-medium text-foreground">{name || "—"}</p>
      {sub ? (
        <p className="break-words text-muted-foreground">{sub}</p>
      ) : null}
      {contactLine ? (
        <p className="break-words text-muted-foreground">{contactLine}</p>
      ) : null}
      {city ? (
        <p className="break-words text-muted-foreground">{city}</p>
      ) : null}
      {c.address_line_1?.trim() ? (
        <p className="break-words text-muted-foreground">{c.address_line_1}</p>
      ) : null}
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
  const addr = ci.address_line_1.trim();
  return (
    <div className="min-w-0 w-full max-w-full rounded-md border bg-muted/30 px-3 py-2.5 text-sm space-y-1">
      <p className="break-words font-medium text-foreground">{name}</p>
      {sub ? (
        <p className="break-words text-muted-foreground">{sub}</p>
      ) : null}
      {contactLine ? (
        <p className="break-words text-muted-foreground">{contactLine}</p>
      ) : null}
      {addr ? (
        <p className="break-words text-muted-foreground">{addr}</p>
      ) : null}
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
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [cities, setCities] = useState<DeliveryCityRow[]>([]);
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
  const [issueDate] = useState(() =>
    new Date().toISOString().split("T")[0],
  );
  /** Optional `sales_orders.delivery_date` (YYYY-MM-DD); set elsewhere. */
  const [deliveryDate] = useState("");
  const [lifecycleStatus, setLifecycleStatus] =
    useState<SalesOrderStatus>("active");
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
  const [duplicatedFromNumber, setDuplicatedFromNumber] = useState<
    string | null
  >(null);
  const [convertedFromQuotationNumber, setConvertedFromQuotationNumber] =
    useState<string | null>(null);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const duplicateHandledRef = useRef(false);
  const convertHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        type ConversionResult =
          | { kind: "quotation"; data: Awaited<ReturnType<typeof getQuotation>> }
          | { kind: "duplicate"; data: Awaited<ReturnType<typeof getSalesOrder>> }
          | null;

        const conversionPromise: Promise<ConversionResult> = (async () => {
          if (convertFromQuotationId) {
            return {
              kind: "quotation",
              data: await getQuotation(convertFromQuotationId),
            };
          }
          if (duplicateSourceId) {
            return {
              kind: "duplicate",
              data: await getSalesOrder(duplicateSourceId),
            };
          }
          return null;
        })();

        const [p, prefs, customerRes, prodRes, cityRows, conversion] =
          await Promise.all([
            fetchProfile(),
            fetchPreferences(),
            listCustomers({
              search: "",
              includeInactive: false,
              page: 1,
              pageSize: 100,
            }),
            listProducts({
              search: "",
              includeInactive: false,
              page: 1,
              pageSize: 400,
              onlyWithPositiveStock: true,
            }),
            listDeliveryCities(),
            conversionPromise,
          ]);

        if (cancelled) return;
        setProfile(p);
        setPreferences(prefs);

        const sop = prefs.salesOrderPrefix ?? "SO";
        const sopad = prefs.salesOrderNumberPadding ?? 4;
        const son = prefs.salesOrderNextNumber ?? 1;
        setSalesOrderNumber(`${sop}-${String(son).padStart(sopad, "0")}`);

        setNotes(prefs.defaultNotes || "");
        setTerms(prefs.defaultTerms || "");

        const rows = customerRes.rows;
        setCustomers(rows);
        setProducts(prodRes.rows);
        setCities(cityRows);

        if (
          conversion?.kind === "quotation" &&
          convertFromQuotationId &&
          !convertHandledRef.current
        ) {
          convertHandledRef.current = true;
          const q = conversion.data;
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
            const convertedLines = [...q.items]
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
              }));
            const convertedSubtotal = convertedLines.reduce(
              (sum, it) => sum + it.quantity * it.unitPrice,
              0,
            );
            setDiscountAmount(
              resolveDiscountAmount(
                q.discount_type,
                q.discount_amount,
                convertedSubtotal,
              ),
            );
            setNotes(q.notes ?? "");
            setTerms(q.terms ?? "");
            setLifecycleStatus("active");
            setLineItems(convertedLines);
            if (q.customer_id) {
              const match = rows.find((c) => c.id === q.customer_id);
              if (match) setSelectedCustomer(match);
            }
            setConvertedFromQuotationNumber(q.number);
            toastRef.current({
              title: "Convert from quotation",
              description: `Form filled from quotation ${q.number}. Save to create sales order with link.`,
            });
          } else {
            toastRef.current({
              title: "Could not load quotation",
              description: "Starting with a blank form.",
              variant: "destructive",
            });
          }
          router.replace("/app/sales-orders/new", { scroll: false });
        } else if (
          conversion?.kind === "duplicate" &&
          duplicateSourceId &&
          !duplicateHandledRef.current
        ) {
          duplicateHandledRef.current = true;
          const q = conversion.data;
          if (cancelled) return;
          if (q) {
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
            const duplicatedLines = [...q.items]
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
              }));
            const duplicatedSubtotal = duplicatedLines.reduce(
              (sum, it) => sum + it.quantity * it.unitPrice,
              0,
            );
            setDiscountAmount(
              resolveDiscountAmount(
                q.discount_type,
                q.discount_amount,
                duplicatedSubtotal,
              ),
            );
            setNotes(q.notes ?? "");
            setTerms(q.terms ?? "");
            setLifecycleStatus(q.status);
            setLineItems(duplicatedLines);
            if (q.customer_id) {
              const match = rows.find((c) => c.id === q.customer_id);
              if (match) setSelectedCustomer(match);
            }
            setDuplicatedFromNumber(q.number);
            toastRef.current({
              title: "Form filled from sales order",
              description: `Edit as needed, then save to create ${sop}-${String(son).padStart(sopad, "0")}.`,
            });
          } else {
            toastRef.current({
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
          toastRef.current({
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
  }, [duplicateSourceId, convertFromQuotationId, router]);

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

  const pickProductForLine = useCallback(
    (lineId: string, p: ProductRow) => {
      setLineItems((prev) =>
        applyProductPickToLines(prev, lineId, {
          id: p.id,
          name: p.name,
          description: p.description || "",
          salePrice: p.salePrice,
        }),
      );
      setErrors((e) => {
        const next = { ...e };
        delete next[`product_${lineId}`];
        delete next[`qty_${lineId}`];
        delete next[`price_${lineId}`];
        return next;
      });
    },
    [],
  );

  const handleAddItemFromCatalog = (p: ProductRow) => {
    const lineId = String(Date.now());
    setLineItems((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return applyProductPickToLines(prev, existing.id, {
          id: p.id,
          name: p.name,
          description: p.description || "",
          salePrice: p.salePrice,
        });
      }
      const withBlank = [
        ...prev,
        {
          id: lineId,
          productId: null,
          item: "",
          description: "",
          quantity: 1,
          unitPrice: 0,
          tax: DEFAULT_TAX_PERCENT,
        },
      ];
      return applyProductPickToLines(withBlank, lineId, {
        id: p.id,
        name: p.name,
        description: p.description || "",
        salePrice: p.salePrice,
      });
    });
    setAddItemDialogOpen(false);
    setErrors((e) => {
      const next = { ...e };
      delete next.lineItems;
      return next;
    });
  };

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
  };

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (selectedCustomer) {
      // Linked customer: bill-to panel does not expose email/phone/address inputs.
      // Snapshot uses clientInfo copied from the customer row; do not block save on legacy sparse rows.
    } else if (!hasBillToDetails(clientInfo)) {
      next.billTo =
        "Choose a customer from your list before saving (or load bill-to from convert / duplicate).";
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
          next[`product_${li.id}`] = "Select an item";
        if (!(li.quantity > 0))
          next[`qty_${li.id}`] = "Quantity must be greater than 0";
        if (!(li.unitPrice >= 0))
          next[`price_${li.id}`] = "Unit price must be 0 or more";
      });
    }

    setErrors(next);
    return next;
  }

  async function doCreateSalesOrder() {
    const validation = validate();
    if (Object.keys(validation).length > 0) {
      const firstMsg = Object.values(validation).find(
        (v): v is string => typeof v === "string" && v.length > 0
      );
      toast({
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

      const id = await createSalesOrder({
        issue_date: issueDate,
        valid_until: computeSalesOrderValidUntil(
          issueDate,
          preferences?.paymentTerms ?? 14,
        ),
        status: lifecycleStatus,
        fulfillment_status: "new",
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
        created_from_quotation_id:
          convertFromQuotationId || undefined,
        delivery_date: deliveryDate.trim() || null,
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
      subtitle={headerSubtitle}
      subtitleClassName="w-full min-w-0 max-w-none"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to sales orders">
          <Link href="/app/sales-orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <Button
          onClick={doCreateSalesOrder}
          disabled={saving}
          className="gap-2 rounded font-semibold shadow-sm"
        >
          <Save className="size-3.5 shrink-0" aria-hidden />
          {saving ? "Saving…" : "Save & view"}
        </Button>
      }
    >
      <div className="flex min-w-0 flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <div className={salesOrderTwoColGridClass}>
          <SectionCard icon={Store} title="Bill to">
            <div className="min-w-0 space-y-3">
              {selectedCustomer ? (
                <CompactBillToCustomer c={selectedCustomer} />
              ) : hasBillToDetails(clientInfo) ? (
                <CompactBillToClientInfo ci={clientInfo} />
              ) : null}
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
                  className="h-8 w-8 shrink-0"
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
              <div className="space-y-2">
                <Label htmlFor="soCity" className={fieldLabelClass}>
                  City
                </Label>
                <Select
                  value={clientInfo.city || "__none__"}
                  onValueChange={(v) => {
                    const nextCity = v === "__none__" ? "" : v;
                    setClientInfo((prev) => ({ ...prev, city: nextCity }));
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
                  <SelectTrigger
                    id="soCity"
                    className="h-8 w-full rounded-sm text-xs"
                  >
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
                <Label htmlFor="soAddress1" className={fieldLabelClass}>
                  Address
                </Label>
                <Input
                  id="soAddress1"
                  className="h-8 rounded-sm text-xs"
                  value={clientInfo.address_line_1}
                  onChange={(e) => {
                    const value = e.target.value;
                    setClientInfo((prev) => ({
                      ...prev,
                      address_line_1: value,
                    }));
                    if (selectedCustomer) {
                      setSelectedCustomer((prev) =>
                        prev ? { ...prev, address_line_1: value } : prev,
                      );
                    }
                    setErrors((err) => {
                      if (!err.address_line_1) return err;
                      const next = { ...err };
                      delete next.address_line_1;
                      return next;
                    });
                  }}
                  placeholder="e.g. 123 Main St, Port Louis"
                  autoComplete="address-line1"
                />
                {errors.address_line_1 ? (
                  <p className="text-xs text-destructive">
                    {errors.address_line_1}
                  </p>
                ) : null}
              </div>
              {errors.billTo ? (
                <p className="text-xs text-destructive">{errors.billTo}</p>
              ) : null}
              {!selectedCustomer &&
              !hasBillToDetails(clientInfo) &&
              (errors.companyName ||
                errors.fullName ||
                errors.email ||
                errors.phone ||
                errors.address_line_1) ? (
                <p className="text-xs text-destructive">
                  Select a customer from the list to continue.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard icon={CalendarDays} title="Dates & fulfillment">
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
                  <SalesOrderFulfillmentStatusBadge status="new" />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

      <SectionCard
          icon={ListOrdered}
          title="Line items"
          className="min-w-0 max-w-full"
          headerRight={
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setAddItemDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add item
            </Button>
          }
        >
          {errors.lineItems && (
            <p className="mb-2 text-xs text-destructive">{errors.lineItems}</p>
          )}
          <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border">
            <Table className="w-max min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px] min-w-[72px] text-center align-middle">
                    Order
                  </TableHead>
                  <TableHead className="min-w-[9rem] align-middle">
                    Item *
                  </TableHead>
                  <TableHead className="min-w-[10rem] align-middle">
                    Description
                  </TableHead>
                  <TableHead className="min-w-[4.5rem] align-middle">Qty *</TableHead>
                  <TableHead className="min-w-[5.5rem] align-middle">
                    Unit Price *
                  </TableHead>
                  <TableHead className="min-w-[5.5rem] text-right align-middle">
                    Total
                  </TableHead>
                  <TableHead className="w-10 min-w-10 align-middle"></TableHead>
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
                              pickProductForLine(item.id, p);
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
                          inputMode="decimal"
                          value={formatNumericFieldValue(item.quantity)}
                          placeholder="1"
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "quantity",
                              parseNumericFieldValue(e.target.value),
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
                          inputMode="decimal"
                          value={formatNumericFieldValue(item.unitPrice)}
                          placeholder="0.00"
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "unitPrice",
                              parseNumericFieldValue(e.target.value),
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
      </SectionCard>

      <div className={salesOrderTwoColGridClass}>
        <SectionCard icon={ScrollText} title="Notes & terms">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes" className={fieldLabelClass}>
                Notes
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={5}
                className="min-h-[120px] resize-y rounded-sm py-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms" className={fieldLabelClass}>
                Terms & conditions
              </Label>
              <Textarea
                id="terms"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Sales order terms..."
                rows={5}
                className="min-h-[120px] resize-y rounded-sm py-2"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Receipt} title="Summary">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums font-medium">
                {preferences?.currency} {subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Discount</span>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={formatNumericFieldValue(discountAmount)}
                  placeholder="0"
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    setDiscountAmount(parseNumericFieldValue(e.target.value))
                  }
                  className="h-8 w-[100px]"
                />
                <span className="min-w-[80px] text-right text-sm tabular-nums">
                  −{preferences?.currency} {discountAmount.toFixed(2)}
                </span>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {preferences?.currency} {total.toFixed(2)}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>
      </div>

      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="flex max-h-[80vh] max-w-lg flex-col overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 text-left">
            <DialogTitle>Add item</DialogTitle>
            <DialogDescription>
              Search your product catalog and add a line to this sales order.
            </DialogDescription>
          </DialogHeader>
          <Command shouldFilter className="flex min-h-0 flex-1 flex-col">
            <CommandInput
              placeholder="Search by name or SKU…"
              className="border-b px-3 text-sm"
            />
            <CommandList className="max-h-[min(60vh,24rem)] flex-1 overflow-y-auto p-2">
              <CommandEmpty>No items found.</CommandEmpty>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.sku ?? ""} ${p.id}`}
                  className="flex cursor-pointer flex-col items-start gap-0.5 rounded-lg px-3 py-2.5"
                  onSelect={() => handleAddItemFromCatalog(p)}
                >
                  <span className="font-medium text-sm text-foreground">
                    {p.name}
                  </span>
                  {p.sku ? (
                    <span className="text-xs text-muted-foreground">{p.sku}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

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
                const line2 = [c.email, c.phone, c.cityName || c.city]
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
        <AppPageShell
          fillHeight
          className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        >
          <FormTwoColumnPageSkeleton withLineItems />
        </AppPageShell>
      }
    >
      <NewSalesOrderPageContent />
    </Suspense>
  );
}
