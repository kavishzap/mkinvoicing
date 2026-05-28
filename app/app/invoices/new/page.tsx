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
  FileText,
  ListOrdered,
  Plus,
  Receipt,
  Save,
  ScrollText,
  Trash2,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  createInvoice,
  getInvoice,
  type LineItemPayload,
} from "@/lib/invoices-service";
import { getQuotation } from "@/lib/quotations-service";
import {
  getSalesOrder,
  clientInfoFromBillSnapshot,
  computeSalesOrderTotals,
  resolveDiscountAmount,
  updateSalesOrderPaymentStatus,
  type SalesOrderDetail,
  type SalesOrderPaymentStatus,
} from "@/lib/sales-orders-service";
import { AppPageShell } from "@/components/app-page-shell";
import { cn } from "@/lib/utils";
import { SalesOrderLineProductSelect } from "@/components/sales-order-line-product-select";
import { applyProductPickToLines } from "@/lib/sales-order-line-items-merge";

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
  "text-sm font-medium text-neutral-700 dark:text-neutral-300";
const sectionTitleClass =
  "text-base font-semibold leading-snug text-neutral-800 dark:text-neutral-200";
const sectionIconBoxClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-4 w-4 text-neutral-600 dark:text-neutral-300";

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
        "flex h-full min-h-0 flex-col gap-0 rounded-lg py-0 shadow-sm",
        className
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3.5">
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
      <CardContent className="field-controls flex min-h-0 flex-1 flex-col space-y-5 px-4 py-5 [&_input]:h-9 [&_input]:text-sm [&_select]:text-sm [&_textarea]:text-sm">
        {children}
      </CardContent>
    </Card>
  );
}

type LineItem = {
  id: string;
  /** `products.id`; required before save (same pattern as sales orders). */
  productId: string | null;
  item: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
};

function lineItemsSubtotal(items: LineItem[]) {
  return items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
}

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
    | "street"
    | "city"
    | "postal"
    | "country"
    | "address_line_1"
    | "lineItems"
    | `item_${string}`
    | `product_${string}`
    | `qty_${string}`
    | `price_${string}`,
    string
  >
>;

function NewInvoicePageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [convertFromQuotationId] = useState(() =>
    searchParams.get("convertFromQuotation")
  );
  const [createdFromSalesOrderId, setCreatedFromSalesOrderId] = useState<
    string | null
  >(() => searchParams.get("convertFromSalesOrder"));
  const [markSalesOrderPaidFromSo] = useState(
    () => searchParams.get("markSalesOrderPaid") === "1"
  );
  const [duplicateFromInvoiceId] = useState(() =>
    searchParams.get("duplicateFrom")
  );
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const convertHandledRef = useRef(false);

  const returnToNewCustomer = useMemo(() => {
    const qs = searchParams.toString();
    const p = pathname ?? "/app/invoices/new";
    return encodeURIComponent(qs ? `${p}?${qs}` : p);
  }, [pathname, searchParams]);

  // ===== Load profile & preferences from Supabase
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  // ===== Customers from Supabase
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(
    null
  );

  // ===== Client (bill-to) snapshot (editable)
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

  // ===== Invoice meta
  const [invoiceNumber, setInvoiceNumber] = useState(""); // read-only UI, still displayed
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  // ===== Lines
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
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  /** Carried from sales order conversion so totals match `computeSalesOrderTotals`. */
  const [invoiceShippingAmount, setInvoiceShippingAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);

  // Errors
  const [errors, setErrors] = useState<FieldErrors>({});
  const [convertedFromSource, setConvertedFromSource] = useState<{
    type: "quotation" | "sales_order" | "invoice";
    number: string;
  } | null>(null);

  const applySalesOrderToForm = useCallback(
    (
      so: SalesOrderDetail,
      customerRows: CustomerRow[],
      opts?: { markPaid?: boolean }
    ) => {
      const ci = clientInfoFromBillSnapshot(so.bill_to_snapshot);
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
      setNotes(so.notes ?? "");
      setTerms(so.terms ?? "");
      setIssueDate(so.issue_date);
      setDueDate(so.valid_until);
      const soLines = [...(so.items ?? [])]
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
        .map((it, i) => ({
          id: `ln-${Date.now()}-${i}`,
          productId: (it as { product_id?: string | null }).product_id ?? null,
          item: it.item,
          description: it.description ?? "",
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          tax: DEFAULT_TAX_PERCENT,
        }));
      setLineItems(soLines);
      setDiscountAmount(
        resolveDiscountAmount(
          so.discount_type,
          so.discount_amount,
          lineItemsSubtotal(soLines),
        ),
      );
      if (so.customer_id) {
        const match = customerRows.find((c) => c.id === so.customer_id);
        setSelectedCustomer(match ?? null);
      } else {
        setSelectedCustomer(null);
      }
      setConvertedFromSource({ type: "sales_order", number: so.number });
      setInvoiceShippingAmount(Number(so.shipping_amount ?? 0));
      setCreatedFromSalesOrderId(so.id);
      if (opts?.markPaid) {
        const { total: soTotal } = computeSalesOrderTotals(so);
        setAmountPaid(soTotal);
      }
    },
    []
  );

  // ========= INITIAL LOAD
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        type ConversionResult =
          | { kind: "quotation"; data: Awaited<ReturnType<typeof getQuotation>> }
          | { kind: "sales_order"; data: SalesOrderDetail | null }
          | { kind: "duplicate"; data: Awaited<ReturnType<typeof getInvoice>> }
          | null;

        const conversionPromise: Promise<ConversionResult> = (async () => {
          if (convertFromQuotationId) {
            return {
              kind: "quotation",
              data: await getQuotation(convertFromQuotationId),
            };
          }
          if (createdFromSalesOrderId) {
            return {
              kind: "sales_order",
              data: await getSalesOrder(createdFromSalesOrderId),
            };
          }
          if (duplicateFromInvoiceId) {
            return {
              kind: "duplicate",
              data: await getInvoice(duplicateFromInvoiceId),
            };
          }
          return null;
        })();

        const [p, prefs, customerRes, productRes, conversion] = await Promise.all([
          fetchProfile(),
          fetchPreferences(),
          listCustomers({
            search: "",
            includeInactive: false,
            page: 1,
            pageSize: 50,
          }),
          listProducts({
            search: "",
            includeInactive: false,
            page: 1,
            pageSize: 400,
            onlyWithPositiveStock: true,
          }),
          conversionPromise,
        ]);

        if (cancelled) return;
        setProfile(p);
        setPreferences(prefs);

        const rows = customerRes.rows;
        setCustomers(rows);
        setProducts(productRes.rows);

        // Invoice number (read-only visual) & dates using preferences
        const n = `${prefs.numberPrefix}-${String(prefs.nextNumber).padStart(
          prefs.numberPadding,
          "0"
        )}`;
        setInvoiceNumber(n);

        const today = new Date();
        setIssueDate(today.toISOString().split("T")[0]);

        const due = new Date(today);
        due.setDate(today.getDate() + prefs.paymentTerms);
        setDueDate(due.toISOString().split("T")[0]);

        setNotes(prefs.defaultNotes || "");
        setTerms(prefs.defaultTerms || "");

        // Convert from quotation
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
            setNotes(q.notes ?? "");
            setTerms(q.terms ?? "");
            setIssueDate(q.issue_date);
            setDueDate(q.valid_until);
            const qLines = [...q.items]
              .sort(
                (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
              )
              .map((it, i) => ({
                id: `ln-${Date.now()}-${i}`,
                productId: null,
                item: it.item,
                description: it.description ?? "",
                quantity: Number(it.quantity),
                unitPrice: Number(it.unit_price),
                tax: DEFAULT_TAX_PERCENT,
              }));
            setLineItems(qLines);
            setDiscountAmount(
              resolveDiscountAmount(
                q.discount_type,
                q.discount_amount,
                lineItemsSubtotal(qLines),
              ),
            );
            if (q.customer_id) {
              const match = rows.find((c) => c.id === q.customer_id);
              if (match) setSelectedCustomer(match);
            }
            setConvertedFromSource({ type: "quotation", number: q.number });
            setInvoiceShippingAmount(0);
            toastRef.current({
              title: "Convert from quotation",
              description: `Form filled from quotation ${q.number}. Save to create invoice with link.`,
            });
          } else {
            toastRef.current({
              title: "Could not load quotation",
              description: "Starting with a blank form.",
              variant: "destructive",
            });
          }
          router.replace("/app/invoices/new", { scroll: false });
        } else if (
          conversion?.kind === "sales_order" &&
          createdFromSalesOrderId &&
          !convertHandledRef.current
        ) {
          convertHandledRef.current = true;
          const so = conversion.data;
          if (cancelled) return;
          if (so) {
            applySalesOrderToForm(so, rows, {
              markPaid: markSalesOrderPaidFromSo,
            });
            toastRef.current({
              title: "Convert from sales order",
              description: markSalesOrderPaidFromSo
                ? `Form filled from sales order ${so.number}. Payment is set to the full amount; save to create a paid invoice and update the order.`
                : `Form filled from sales order ${so.number}. Save to create invoice with link.`,
            });
          } else {
            toastRef.current({
              title: "Could not load sales order",
              description: "Starting with a blank form.",
              variant: "destructive",
            });
          }
          router.replace("/app/invoices/new", { scroll: false });
        } else if (
          conversion?.kind === "duplicate" &&
          duplicateFromInvoiceId &&
          !convertHandledRef.current
        ) {
          convertHandledRef.current = true;
          const inv = conversion.data;
          if (cancelled) return;
          if (inv) {
            const ci = clientInfoFromBillSnapshot(
              (inv.bill_to_snapshot || {}) as Record<string, unknown>
            );
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
            setNotes(inv.notes ?? "");
            setTerms(inv.terms ?? "");
            setIssueDate(inv.issue_date);
            setDueDate(inv.due_date);
            const invLines = (inv.items ?? []).map((it, i) => ({
              id: `ln-${Date.now()}-${i}`,
              productId: it.product_id ?? null,
              item: it.item,
              description: it.description ?? "",
              quantity: Number(it.quantity),
              unitPrice: Number(it.unit_price),
              tax: DEFAULT_TAX_PERCENT,
            }));
            setLineItems(invLines);
            setDiscountAmount(
              resolveDiscountAmount(
                inv.discount_type,
                inv.discount_amount,
                lineItemsSubtotal(invLines),
              ),
            );
            if (inv.customer_id) {
              const match = rows.find((c) => c.id === inv.customer_id);
              setSelectedCustomer(match ?? null);
            } else {
              setSelectedCustomer(null);
            }
            setConvertedFromSource({
              type: "invoice",
              number: inv.number,
            });
            setInvoiceShippingAmount(Number(inv.shipping_amount ?? 0));
            setCreatedFromSalesOrderId(null);
            setAmountPaid(0);
            toastRef.current({
              title: "Duplicate invoice",
              description: `Prefilled from ${inv.number}. Save to create a new invoice.`,
            });
          } else {
            toastRef.current({
              title: "Could not load invoice",
              description: "Starting with a blank form.",
              variant: "destructive",
            });
          }
          router.replace("/app/invoices/new", { scroll: false });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          toastRef.current({
            title: "Failed to load data",
            description:
              e instanceof Error ? e.message : "Please try again.",
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
  }, [
    convertFromQuotationId,
    createdFromSalesOrderId,
    markSalesOrderPaidFromSo,
    duplicateFromInvoiceId,
    router,
    applySalesOrderToForm,
  ]);

  // React to search within dialog
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

  // ===== Derived totals
  const subtotal = useMemo(
    () =>
      lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [lineItems]
  );
  const total = useMemo(
    () => subtotal - discountAmount + invoiceShippingAmount,
    [subtotal, discountAmount, invoiceShippingAmount],
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
        delete next[`item_${lineId}`];
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
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  // ===== Select customer → hydrate clientInfo
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
    setErrors({});
  };

  // ===== Validation
  function validate(): boolean {
    const next: FieldErrors = {};

    // Bill-to required fields
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
    // Line items validation
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

  // ===== Save helpers (status restricted to "unpaid" | "paid")
  async function doCreateUnpaid() {
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

      const itemsPayload: LineItemPayload[] = lineItems.map((li) => ({
        item: li.item,
        description: li.description || undefined,
        quantity: li.quantity,
        unit_price: li.unitPrice,
        tax_percent: 0,
        product_id: li.productId,
      }));

      // IMPORTANT:
      // - status is "unpaid" only (you're restricting statuses to unpaid/paid)
      // - invoiceNumber is read-only UI; still passed along if your RPC expects it.
      // Calculate amount due: total - amount_paid (minimum 0)
      const calculatedAmountDue = Math.max(0, total - amountPaid);
      
      const invoiceId = await createInvoice({
        issue_date: issueDate,
        due_date: dueDate,
        status: amountPaid >= total ? "paid" : "unpaid",
        currency: preferences.currency,
        discount_type: "value",
        discount_amount: discountAmount,
        shipping_amount: invoiceShippingAmount,
        notes,
        terms,
        payment_method: null,
        amount_paid: amountPaid,
        amount_due: calculatedAmountDue,
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        client_snapshot: selectedCustomer
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
            },
        created_from_quotation_id: convertFromQuotationId || undefined,
        created_from_sales_order_id: createdFromSalesOrderId || undefined,
        items: itemsPayload,
      });

      if (createdFromSalesOrderId && markSalesOrderPaidFromSo) {
        let nextPay: SalesOrderPaymentStatus = "unpaid";
        if (amountPaid >= total) nextPay = "paid";
        else if (amountPaid > 0) nextPay = "partial";
        try {
          await updateSalesOrderPaymentStatus(
            createdFromSalesOrderId,
            nextPay
          );
        } catch (syncErr: unknown) {
          const msg =
            syncErr instanceof Error ? syncErr.message : "Unknown error";
          toast({
            title: "Sales order payment not updated",
            description: `Invoice was created, but updating the linked sales order failed: ${msg}`,
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Invoice created",
        description: "Your invoice was created.",
      });
      router.push(`/app/invoices/${invoiceId}`);
    } catch (e: any) {
      toast({
        title: "Failed to create invoice",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppPageShell className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
        <FormTwoColumnPageSkeleton withLineItems />
      </AppPageShell>
    );
  }

  const headerSubtitle =
    convertedFromSource != null
      ? convertedFromSource.type === "invoice"
        ? `Duplicating from invoice ${convertedFromSource.number} — review and save to create a new invoice.`
        : `Converting from ${
            convertedFromSource.type === "quotation" ? "quotation" : "sales order"
          } ${convertedFromSource.number} — review lines below, then save to create the invoice.`
      : undefined;

  return (
    <AppPageShell
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      subtitle={headerSubtitle}
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to invoices">
          <Link href="/app/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <Button
          onClick={doCreateUnpaid}
          disabled={saving}
          className="gap-2 rounded font-semibold shadow-sm"
        >
          <Save className="size-3.5 shrink-0" aria-hidden />
          {saving ? "Saving…" : "Save & view"}
        </Button>
      }
    >
      <div className="h-auto w-full rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10">
          <SectionCard icon={Users} title="Customer" className="w-full min-h-0">
            <div className="flex min-h-0 flex-1 flex-col space-y-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Your business details on the invoice come from{" "}
                <Link href="/app/settings" className="text-primary underline">
                  Settings
                </Link>
                .
              </p>
              <div className="min-h-0 flex-1">
              {selectedCustomer ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
                  <p className="font-semibold leading-snug">
                    {selectedCustomer.type === "company"
                      ? selectedCustomer.companyName
                      : selectedCustomer.fullName}
                  </p>
                  {selectedCustomer.type === "company" &&
                    selectedCustomer.contactName && (
                      <p className="text-muted-foreground">
                        {selectedCustomer.contactName}
                      </p>
                    )}
                  {(selectedCustomer.email || selectedCustomer.phone) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[selectedCustomer.email, selectedCustomer.phone]
                        .filter((x) => String(x ?? "").trim())
                        .join(" · ")}
                    </p>
                  )}
                  {selectedCustomer.address_line_1 ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedCustomer.address_line_1}
                    </p>
                  ) : null}
                </div>
              ) : clientInfo.email ||
                clientInfo.companyName ||
                clientInfo.fullName ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm">
                  <p className="font-medium text-foreground">
                    Billing preview (from import)
                  </p>
                  <p className="text-muted-foreground">
                    {clientInfo.type === "company"
                      ? clientInfo.companyName
                      : clientInfo.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[clientInfo.email, clientInfo.phone]
                      .filter((x) => String(x ?? "").trim())
                      .join(" · ")}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Link a customer below if this matches someone in your
                    directory.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Pick someone from your customer list.
                </p>
              )}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
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
            </div>
          </SectionCard>

          <SectionCard icon={CalendarDays} title="Dates" className="w-full min-h-0">
            <div className="grid h-full flex-1 gap-4 sm:grid-cols-2 sm:content-start">
              <div className="space-y-2">
                <Label htmlFor="issueDate" className={fieldLabelClass}>
                  Issue date
                </Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate" className={fieldLabelClass}>
                  Due date
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="mt-6 space-y-6 lg:mt-8">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[min(14rem,22vw)]">Product *</TableHead>
                  <TableHead className="w-[200px]">Item</TableHead>
                  <TableHead className="w-[250px]">Description</TableHead>
                  <TableHead className="w-[100px]">Qty *</TableHead>
                  <TableHead className="w-[120px]">Unit Price *</TableHead>
                  <TableHead className="w-[120px] text-right">Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => {
                  const lineErrProduct =
                    errors[`product_${item.id}` as keyof FieldErrors];
                  const lineErrQty =
                    errors[`qty_${item.id}` as keyof FieldErrors];
                  const lineErrPrice =
                    errors[`price_${item.id}` as keyof FieldErrors];
                  const lineTotal = item.quantity * item.unitPrice;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
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
                      <TableCell>
                        <Input
                          readOnly
                          tabIndex={-1}
                          value={item.item}
                          placeholder="—"
                          title={item.item || undefined}
                          className="h-9 bg-muted/40 pointer-events-none"
                        />
                      </TableCell>
                      <TableCell>
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
                      <TableCell>
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
                      <TableCell>
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
                      <TableCell className="text-right font-medium">
                        {preferences?.currency} {lineTotal.toFixed(2)}
                      </TableCell>
                      <TableCell>
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10">
            <SectionCard icon={ScrollText} title="Notes & terms" className="min-h-0">
              <div className="flex min-h-0 flex-1 flex-col gap-5">
                <div className="flex min-h-0 flex-1 flex-col space-y-2">
                  <Label htmlFor="notes" className={fieldLabelClass}>
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes..."
                    rows={4}
                    className="min-h-[7rem] flex-1 resize-y"
                  />
                  <p className="text-xs text-muted-foreground">
                    {notes.length} characters
                  </p>
                </div>
                <div className="flex min-h-0 flex-1 flex-col space-y-2">
                  <Label htmlFor="terms" className={fieldLabelClass}>
                    Terms & conditions
                  </Label>
                  <Textarea
                    id="terms"
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Payment terms..."
                    rows={4}
                    className="min-h-[7rem] flex-1 resize-y"
                  />
                  <p className="text-xs text-muted-foreground">
                    {terms.length} characters
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard icon={Receipt} title="Summary" className="min-h-0">
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
      </div>

      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="flex max-h-[80vh] max-w-lg flex-col overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 text-left">
            <DialogTitle>Add item</DialogTitle>
            <DialogDescription>
              Search your product catalog and add a line to this invoice.
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

      {/* Customer Selection Dialog (Supabase-powered) */}
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
              placeholder="Search by name, email, or phone…"
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
                    className="w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <div className="text-sm font-medium">{label || "—"}</div>
                    {c.type === "company" && c.contactName ? (
                      <div className="text-xs text-muted-foreground">
                        {c.contactName}
                      </div>
                    ) : null}
                    {line2 ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
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

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <AppPageShell className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
          <FormTwoColumnPageSkeleton withLineItems />
        </AppPageShell>
      }
    >
      <NewInvoicePageContent />
    </Suspense>
  );
}
