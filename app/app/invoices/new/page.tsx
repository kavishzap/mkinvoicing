"use client";
export const dynamic = "force-dynamic";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, UserPlus } from "lucide-react";
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
  createInvoice,
  getInvoice,
  type LineItemPayload,
} from "@/lib/invoices-service";
import { getQuotation } from "@/lib/quotations-service";
import {
  getSalesOrder,
  clientInfoFromBillSnapshot,
  computeSalesOrderTotals,
  updateSalesOrderPaymentStatus,
  type SalesOrderDetail,
  type SalesOrderPaymentStatus,
} from "@/lib/sales-orders-service";
import { AppPageShell, APP_PAGE_SHELL_CLASS } from "@/components/app-page-shell";
import { CustomerQuickCreateDialog } from "@/components/customer-quick-create-dialog";
import { DiscountTypeToggle } from "@/components/discount-type-toggle";
import { SalesOrderLineProductSelect } from "@/components/sales-order-line-product-select";
import { applyProductPickToLines } from "@/lib/sales-order-line-items-merge";

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
    | "amountPaid"
    | `item_${string}`
    | `product_${string}`
    | `qty_${string}`
    | `price_${string}`,
    string
  >
>;

function NewInvoicePageContent() {
  const router = useRouter();
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
  const convertHandledRef = useRef(false);

  // ===== Load profile & preferences from Supabase
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  // ===== Customers from Supabase
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] =
    useState(false);
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
  const [paymentTerms, setPaymentTerms] = useState("14");

  // ===== Lines
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: "1",
      productId: null,
      item: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      tax: 0,
    },
  ]);
  const [discount, setDiscount] = useState({
    type: "value" as "value" | "percent",
    amount: 0,
  });
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
      setDiscount({
        type: so.discount_type,
        amount: so.discount_amount,
      });
      setNotes(so.notes ?? "");
      setTerms(so.terms ?? "");
      setIssueDate(so.issue_date);
      setDueDate(so.valid_until);
      setLineItems(
        [...(so.items ?? [])]
          .sort(
            (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
          )
          .map((it, i) => ({
            id: `ln-${Date.now()}-${i}`,
            productId: (it as { product_id?: string | null }).product_id ?? null,
            item: it.item,
            description: it.description ?? "",
            quantity: Number(it.quantity),
            unitPrice: Number(it.unit_price),
            tax: Number(it.tax_percent),
          }))
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
        const [p, prefs] = await Promise.all([
          fetchProfile(),
          fetchPreferences(),
        ]);
        if (cancelled) return;
        setProfile(p);
        setPreferences(prefs);

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

        setPaymentTerms(String(prefs.paymentTerms));
        setNotes(prefs.defaultNotes || "");
        setTerms(prefs.defaultTerms || "");

        // Load customers (first page quick list)
        const { rows } = await listCustomers({
          search: "",
          includeInactive: false,
          page: 1,
          pageSize: 50,
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

        // Convert from quotation
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
            setIssueDate(q.issue_date);
            setDueDate(q.valid_until);
            setLineItems(
              [...q.items]
                .sort(
                  (a, b) =>
                    Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
                )
                .map((it, i) => ({
                  id: `ln-${Date.now()}-${i}`,
                  productId: null,
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
            setConvertedFromSource({ type: "quotation", number: q.number });
            setInvoiceShippingAmount(0);
            toast({
              title: "Convert from quotation",
              description: `Form filled from quotation ${q.number}. Save to create invoice with link.`,
            });
          } else {
            toast({
              title: "Could not load quotation",
              description: "Starting with a blank form.",
              variant: "destructive",
            });
          }
          router.replace("/app/invoices/new", { scroll: false });
        } else if (createdFromSalesOrderId && !convertHandledRef.current) {
          convertHandledRef.current = true;
          const so = await getSalesOrder(createdFromSalesOrderId);
          if (cancelled) return;
          if (so) {
            applySalesOrderToForm(so, rows, {
              markPaid: markSalesOrderPaidFromSo,
            });
            toast({
              title: "Convert from sales order",
              description: markSalesOrderPaidFromSo
                ? `Form filled from sales order ${so.number}. Payment is set to the full amount; save to create a paid invoice and update the order.`
                : `Form filled from sales order ${so.number}. Save to create invoice with link.`,
            });
          } else {
            toast({
              title: "Could not load sales order",
              description: "Starting with a blank form.",
              variant: "destructive",
            });
          }
          router.replace("/app/invoices/new", { scroll: false });
        } else if (duplicateFromInvoiceId && !convertHandledRef.current) {
          convertHandledRef.current = true;
          const inv = await getInvoice(duplicateFromInvoiceId);
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
            setDiscount({
              type: inv.discount_type,
              amount: inv.discount_amount,
            });
            setNotes(inv.notes ?? "");
            setTerms(inv.terms ?? "");
            setIssueDate(inv.issue_date);
            setDueDate(inv.due_date);
            setLineItems(
              (inv.items ?? []).map((it, i) => ({
                id: `ln-${Date.now()}-${i}`,
                productId: it.product_id ?? null,
                item: it.item,
                description: it.description ?? "",
                quantity: Number(it.quantity),
                unitPrice: Number(it.unit_price),
                tax: Number(it.tax_percent),
              }))
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
            toast({
              title: "Duplicate invoice",
              description: `Prefilled from ${inv.number}. Save to create a new invoice.`,
            });
          } else {
            toast({
              title: "Could not load invoice",
              description: "Starting with a blank form.",
              variant: "destructive",
            });
          }
          router.replace("/app/invoices/new", { scroll: false });
        }
      } catch (e: any) {
        if (!cancelled) {
          toast({
            title: "Failed to load data",
            description: e?.message ?? "Please try again.",
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
    toast,
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
    () => subtotal + taxTotal - discountAmount + invoiceShippingAmount,
    [subtotal, taxTotal, discountAmount, invoiceShippingAmount]
  );

  // ===== Line handlers
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
        tax: 0,
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

    // Amount paid validation
    if (amountPaid < 0) {
      next.amountPaid = "Amount paid cannot be negative";
    } else if (amountPaid > total) {
      next.amountPaid = `Amount paid cannot exceed invoice total of ${preferences?.currency ?? ""} ${total.toFixed(2)}`;
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
        tax_percent: li.tax,
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
        discount_type: discount.type,
        discount_amount: discount.amount,
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
      <div className={`${APP_PAGE_SHELL_CLASS} max-w-7xl`}>
        <div className="h-8 w-56 rounded bg-muted animate-pulse" />
        <div className="mt-4 h-24 rounded bg-muted animate-pulse" />
        <div className="mt-4 h-64 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  const headerSubtitle =
    convertedFromSource != null
      ? convertedFromSource.type === "invoice"
        ? `Duplicating from invoice ${convertedFromSource.number} — review and save to create a new invoice.`
        : `Converting from ${
            convertedFromSource.type === "quotation" ? "quotation" : "sales order"
          } ${convertedFromSource.number} — review lines below, then save to create the invoice.`
      : "Select a customer, then add lines and save.";

  return (
    <AppPageShell
      className="max-w-7xl"
      subtitle={headerSubtitle}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/invoices">
            <Button variant="ghost" size="icon" aria-label="Back to invoices">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Button onClick={doCreateUnpaid} disabled={saving} size="sm">
            {saving ? "Saving..." : "Save & View"}
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Customer</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Your business details on the invoice come from{" "}
                <Link href="/app/settings" className="text-primary underline">
                  Settings
                </Link>
                .
              </p>
            </div>
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
                aria-label="Add new customer"
                onClick={() => setIsCreateCustomerDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedCustomer ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">
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
              <p className="text-muted-foreground">{selectedCustomer.email}</p>
              <p className="text-muted-foreground">{selectedCustomer.phone}</p>
              <p className="text-muted-foreground">
                {selectedCustomer.address_line_1}
              </p>
            </div>
          ) : clientInfo.email ||
            clientInfo.companyName ||
            clientInfo.fullName ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-sm">
              <p className="font-medium text-foreground">
                Billing preview (from import)
              </p>
              <p className="text-muted-foreground">
                {clientInfo.type === "company"
                  ? clientInfo.companyName
                  : clientInfo.fullName}
              </p>
              <p className="text-muted-foreground">{clientInfo.email}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Link a customer above if this order matches someone in your
                directory.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick someone from your customer list.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Invoice Meta */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Select
                value={paymentTerms}
                onValueChange={(v) => {
                  setPaymentTerms(v);
                  const termsDays = Number(v || "0");
                  const d = new Date(
                    issueDate || new Date().toISOString().split("T")[0]
                  );
                  d.setDate(d.getDate() + termsDays);
                  setDueDate(d.toISOString().split("T")[0]);
                }}
              >
                <SelectTrigger id="paymentTerms">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Net 7</SelectItem>
                  <SelectItem value="14">Net 14</SelectItem>
                  <SelectItem value="30">Net 30</SelectItem>
                  <SelectItem value="60">Net 60</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
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
                  <TableHead className="w-[min(14rem,22vw)]">Product *</TableHead>
                  <TableHead className="w-[200px]">Item</TableHead>
                  <TableHead className="w-[250px]">Description</TableHead>
                  <TableHead className="w-[100px]">Qty *</TableHead>
                  <TableHead className="w-[120px]">Unit Price *</TableHead>
                  <TableHead className="w-[100px]">Tax %</TableHead>
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
                  const lineTotal =
                    item.quantity * item.unitPrice * (1 + item.tax / 100);

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
                                delete next[`item_${item.id}`];
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
                      <TableCell>
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
                      <TableCell>
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

      {/* Summary */}
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
              <p className="text-xs text-muted-foreground">
                {notes.length} characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms">Terms & Conditions</Label>
              <Textarea
                id="terms"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Payment terms..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {terms.length} characters
              </p>
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
              <Separator />
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="amountPaid">Amount Paid</Label>
                  <Input
                    id="amountPaid"
                    type="number"
                    min="0"
                    step="0.01"
                    max={total}
                    value={amountPaid}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const newValue = val >= 0 ? Math.min(val, total) : 0;
                      setAmountPaid(newValue);
                    }}
                    placeholder="0.00"
                    className={errors.amountPaid ? "border-destructive" : ""}
                  />
                  {errors.amountPaid ? (
                    <p className="text-xs text-destructive">{errors.amountPaid}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Maximum: {preferences?.currency} {total.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Due</span>
                  <span className="font-semibold">
                    {preferences?.currency} {Math.max(0, total - amountPaid).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Selection Dialog (Supabase-powered) */}
      <Dialog
        open={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
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
              {customers.map((c) => (
                <button
                  key={c.id}
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
                    {c.address_line_1}
                    {c.address_line_2 ? `, ${c.address_line_2}` : ""}
                  </div>
                </button>
              ))}

              {customers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No customers found</p>
                  <Link href="/app/customers">
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

      <CustomerQuickCreateDialog
        open={isCreateCustomerDialogOpen}
        onOpenChange={setIsCreateCustomerDialogOpen}
        onCreated={async (row) => {
          handleSelectCustomer(row);
          setCustomerSearch("");
          try {
            const { rows } = await listCustomers({
              search: "",
              includeInactive: false,
              page: 1,
              pageSize: 50,
            });
            setCustomers(rows);
          } catch {
            /* ignore */
          }
        }}
      />
    </AppPageShell>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className={`${APP_PAGE_SHELL_CLASS} max-w-7xl`}>
          <div className="h-8 w-56 rounded bg-muted animate-pulse" />
          <div className="mt-4 h-24 rounded bg-muted animate-pulse" />
        </div>
      }
    >
      <NewInvoicePageContent />
    </Suspense>
  );
}
