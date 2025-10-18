"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { createInvoice, type LineItemPayload } from "@/lib/invoices-service";

type LineItem = {
  id: string;
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
    | "lineItems"
    | `item_${string}`
    | `qty_${string}`
    | `price_${string}`,
    string
  >
>;

export default function NewInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();

  // ===== Load profile & preferences from Supabase
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  // ===== Customers from Supabase
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
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
    { id: "1", item: "", description: "", quantity: 1, unitPrice: 0, tax: 0 },
  ]);
  const [discount, setDiscount] = useState({
    type: "value" as "value" | "percent",
    amount: 0,
  });
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  // Errors
  const [errors, setErrors] = useState<FieldErrors>({});

  // ========= INITIAL LOAD
  useEffect(() => {
    (async () => {
      try {
        const [p, prefs] = await Promise.all([
          fetchProfile(),
          fetchPreferences(),
        ]);
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
        setCustomers(rows);
      } catch (e: any) {
        toast({
          title: "Failed to load data",
          description: e?.message ?? "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

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
    () => subtotal + taxTotal - discountAmount,
    [subtotal, taxTotal, discountAmount]
  );

  // ===== Line handlers
  const addLineItem = () =>
    setLineItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
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
    });
    setIsCustomerDialogOpen(false);
    toast({
      title: "Customer selected",
      description: `${
        c.type === "company" ? c.companyName : c.fullName
      } added to the invoice.`,
    });
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
    if (!clientInfo.street.trim()) next.street = "Street is required";
    if (!clientInfo.city.trim()) next.city = "City is required";
    if (!clientInfo.postal.trim()) next.postal = "Postal code is required";
    if (!clientInfo.country.trim()) next.country = "Country is required";

    // Line items validation
    if (lineItems.length === 0) {
      next.lineItems = "At least one line item is required";
    } else {
      lineItems.forEach((li) => {
        if (!li.item.trim()) next[`item_${li.id}`] = "Item name is required";
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
        tax_percent: li.tax,
      }));

      // IMPORTANT:
      // - status is "unpaid" only (you're restricting statuses to unpaid/paid)
      // - invoiceNumber is read-only UI; still passed along if your RPC expects it.
      const invoiceId = await createInvoice({
        issue_date: issueDate,
        due_date: dueDate,
        status: "unpaid" as "unpaid", // <- only unpaid|paid allowed now
        currency: preferences.currency,
        discount_type: discount.type,
        discount_amount: discount.amount,
        notes,
        terms,
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
            },
        items: itemsPayload,
      });

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

  const err = (k: keyof FieldErrors) => (errors[k] ? "border-destructive" : "");
  const showLogo = (profile as any)?.logoUrl || (profile as any)?.logo_url;

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-56 rounded bg-muted animate-pulse" />
          <div className="flex gap-2">
            <div className="h-9 w-28 rounded bg-muted animate-pulse" />
            <div className="h-9 w-28 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-56 rounded bg-muted animate-pulse" />
          <div className="h-56 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-64 rounded bg-muted animate-pulse" />
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-56 rounded bg-muted animate-pulse" />
          <div className="h-56 rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Create Invoice
            </h1>
            <p className="text-muted-foreground mt-1">
              Fill in the details to create a new invoice
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={doCreateUnpaid} disabled={saving}>
            {saving ? "Saving..." : "Save & View"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* From (your profile) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                {/* Logo / Initials */}
                From
              </CardTitle>
              <Link href="/app/settings">
                <Button variant="link" size="sm" className="h-auto p-0">
                  Edit in Settings
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="space-y-2 text-sm">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(showLogo)}
                alt="Logo"
                className="h-50 w-50 rounded-md object-cover border"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary  font-bold">
                {(profile?.companyName || profile?.fullName || "I")
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
            )}
            {profile?.accountType === "company" ? (
              <>
                <p className="font-semibold">{profile?.companyName}</p>
                {profile?.registrationId && (
                  <p className="text-muted-foreground">
                    Reg: {profile.registrationId}
                  </p>
                )}
              </>
            ) : (
              <p className="font-semibold">{profile?.fullName}</p>
            )}
            <p className="text-muted-foreground">{profile?.email}</p>
            <p className="text-muted-foreground">{profile?.phone}</p>
            <p className="text-muted-foreground">
              {profile?.street}, {profile?.city}
            </p>
            <p className="text-muted-foreground">
              {profile?.postal}, {profile?.country}
            </p>
          </CardContent>
        </Card>

        {/* Bill To */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Bill To</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCustomerDialogOpen(true)}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Select Customer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  <Label htmlFor="contactName">Contact Name (Optional)</Label>
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
                  <p className="text-xs text-destructive">{errors.fullName}</p>
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
              <Label htmlFor="clientStreet">Street Address *</Label>
              <Input
                id="clientStreet"
                className={err("street")}
                value={clientInfo.street}
                onChange={(e) =>
                  setClientInfo({ ...clientInfo, street: e.target.value })
                }
                placeholder="123 Main St"
              />
              {errors.street && (
                <p className="text-xs text-destructive">{errors.street}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientCity">City *</Label>
                <Input
                  id="clientCity"
                  className={err("city")}
                  value={clientInfo.city}
                  onChange={(e) =>
                    setClientInfo({ ...clientInfo, city: e.target.value })
                  }
                  placeholder="Port Louis"
                />
                {errors.city && (
                  <p className="text-xs text-destructive">{errors.city}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPostal">Postal *</Label>
                <Input
                  id="clientPostal"
                  className={err("postal")}
                  value={clientInfo.postal}
                  onChange={(e) =>
                    setClientInfo({ ...clientInfo, postal: e.target.value })
                  }
                  placeholder="742CU001"
                />
                {errors.postal && (
                  <p className="text-xs text-destructive">{errors.postal}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientCountry">Country *</Label>
                <Input
                  id="clientCountry"
                  className={err("country")}
                  value={clientInfo.country}
                  onChange={(e) =>
                    setClientInfo({ ...clientInfo, country: e.target.value })
                  }
                  placeholder="Mauritius"
                />
                {errors.country && (
                  <p className="text-xs text-destructive">{errors.country}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Meta */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice #</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                readOnly
                className="bg-muted/60 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from your settings (uneditable).
              </p>
            </div>
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
                  <TableHead className="w-[200px]">Item *</TableHead>
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
                  const lineErrItem =
                    errors[`item_${item.id}` as keyof FieldErrors];
                  const lineErrQty =
                    errors[`qty_${item.id}` as keyof FieldErrors];
                  const lineErrPrice =
                    errors[`price_${item.id}` as keyof FieldErrors];
                  const lineTotal =
                    item.quantity * item.unitPrice * (1 + item.tax / 100);

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.item}
                          onChange={(e) =>
                            updateLineItem(item.id, "item", e.target.value)
                          }
                          placeholder="Service/Product"
                          className={`h-9 ${
                            lineErrItem ? "border-destructive" : ""
                          }`}
                        />
                        {lineErrItem && (
                          <p className="text-xs text-destructive mt-1">
                            {String(lineErrItem)}
                          </p>
                        )}
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
                  <Select
                    value={discount.type}
                    onValueChange={(v: "value" | "percent") =>
                      setDiscount({ ...discount, type: v })
                    }
                  >
                    <SelectTrigger className="w-[80px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="value">
                        {preferences?.currency}
                      </SelectItem>
                      <SelectItem value="percent">%</SelectItem>
                    </SelectContent>
                  </Select>
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
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>
                  {preferences?.currency} {total.toFixed(2)}
                </span>
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
                    {c.city}, {c.country}
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
    </div>
  );
}
