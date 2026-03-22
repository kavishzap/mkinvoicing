"use client";
export const dynamic = "force-dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { listSuppliers, type SupplierRow } from "@/lib/suppliers-service";
import {
  buildFromSnapshotForSalesOrder,
  buildBillToSnapshot,
  clientInfoFromBillSnapshot,
} from "@/lib/sales-orders-service";
import {
  createPurchaseOrder,
  getPurchaseOrder,
  supplierToClientInfo,
  type PurchaseOrderLinePayload,
  type PurchaseOrderStatus,
} from "@/lib/purchase-orders-service";

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
    | `item_${string}`
    | `qty_${string}`
    | `price_${string}`,
    string
  >
>;

function NewPurchaseOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [duplicateSourceId] = useState(() => searchParams.get("duplicate"));
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRow | null>(
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

  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validUntil, setValidUntil] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [validForDays, setValidForDays] = useState("14");
  const [purchaseOrderStatus, setPurchaseOrderStatus] =
    useState<PurchaseOrderStatus>("active");

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", item: "", description: "", quantity: 1, unitPrice: 0, tax: 0 },
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
  const duplicateHandledRef = useRef(false);

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

        const pop = prefs.purchaseOrderPrefix ?? "PO";
        const popad = prefs.purchaseOrderNumberPadding ?? 4;
        const pon = prefs.purchaseOrderNextNumber ?? 1;
        setPurchaseOrderNumber(`${pop}-${String(pon).padStart(popad, "0")}`);

        const today = new Date();
        setIssueDate(today.toISOString().split("T")[0]);

        const v = new Date(today);
        v.setDate(v.getDate() + (prefs.paymentTerms || 14));
        setValidUntil(v.toISOString().split("T")[0]);
        setValidForDays(String(prefs.paymentTerms || 14));

        setNotes(prefs.defaultNotes || "");
        setTerms(prefs.defaultTerms || "");

        const { rows } = await listSuppliers({
          search: "",
          includeInactive: false,
          page: 1,
          pageSize: 100,
        });
        if (cancelled) return;
        setSuppliers(rows);

        if (duplicateSourceId && !duplicateHandledRef.current) {
          duplicateHandledRef.current = true;
          const q = await getPurchaseOrder(duplicateSourceId);
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
            setPurchaseOrderStatus(q.status);
            setLineItems(
              [...q.items]
                .sort(
                  (a, b) =>
                    Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
                )
                .map((it, i) => ({
                  id: `ln-${Date.now()}-${i}`,
                  item: it.item,
                  description: it.description ?? "",
                  quantity: Number(it.quantity),
                  unitPrice: Number(it.unit_price),
                  tax: Number(it.tax_percent),
                }))
            );
            if (q.supplier_id) {
              const match = rows.find((s) => s.id === q.supplier_id);
              if (match) setSelectedSupplier(match);
            }
            setDuplicatedFromNumber(q.number);
            toast({
              title: "Form filled from purchase order",
              description: `Edit as needed, then save to create ${pop}-${String(pon).padStart(popad, "0")}.`,
            });
          } else {
            toast({
              title: "Could not load purchase order",
              description: "Starting with a blank form.",
              variant: "destructive",
            });
          }
          router.replace("/app/purchase-orders/new", { scroll: false });
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
  }, [toast, duplicateSourceId, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { rows } = await listSuppliers({
          search: supplierSearch,
          includeInactive: false,
          page: 1,
          pageSize: 50,
        });
        if (!cancelled) setSuppliers(rows);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supplierSearch]);

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

  const handleSelectSupplier = (s: SupplierRow) => {
    setSelectedSupplier(s);
    setClientInfo(supplierToClientInfo(s));
    setIsSupplierDialogOpen(false);
    toast({
      title: "Supplier selected",
      description: `${
        s.type === "company" ? s.companyName : s.fullName
      } added to the purchase order.`,
    });
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

  async function doCreatePurchaseOrder() {
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

      const itemsPayload: PurchaseOrderLinePayload[] = lineItems.map((li, i) => ({
        item: li.item,
        description: li.description || undefined,
        quantity: li.quantity,
        unit_price: li.unitPrice,
        tax_percent: li.tax,
        sort_order: i,
      }));

      const fromSnap = buildFromSnapshotForSalesOrder(profile);
      const billSnap = buildBillToSnapshot(clientInfo);

      const clientSnapshot = selectedSupplier
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

      const id = await createPurchaseOrder({
        issue_date: issueDate,
        valid_until: validUntil,
        status: purchaseOrderStatus,
        currency: preferences.currency,
        discount_type: discount.type,
        discount_amount: discount.amount,
        shipping_amount: 0,
        notes,
        terms,
        supplier_id: selectedSupplier ? selectedSupplier.id : null,
        client_snapshot: clientSnapshot,
        from_snapshot: fromSnap,
        bill_to_snapshot: billSnap,
        items: itemsPayload,
      });

      toast({
        title: "Purchase order created",
        description: "Your purchase order was saved.",
      });
      router.push(`/app/purchase-orders/${id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Failed to create purchase order",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const err = (k: keyof FieldErrors) => (errors[k] ? "border-destructive" : "");
  const showLogo = (profile as { logoUrl?: string })?.logoUrl;

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-56 rounded bg-muted animate-pulse" />
          <div className="flex gap-2">
            <div className="h-9 w-28 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-56 rounded bg-muted animate-pulse" />
          <div className="h-56 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-64 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/purchase-orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Create Purchase Order
          </h1>
          <p className="text-muted-foreground mt-1">
            Next number: <span className="font-medium">{purchaseOrderNumber}</span>
          </p>
          {duplicatedFromNumber && (
            <p className="text-sm text-muted-foreground mt-1">
              Filled from{" "}
              <span className="font-medium text-foreground">
                {duplicatedFromNumber}
              </span>{" "}
              — save when ready to create a new purchase order.
            </p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">From</CardTitle>
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
                {(profile?.companyName || profile?.fullName || "S")
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
                {profile?.vatNumber && (
                  <p className="text-muted-foreground">
                    VAT: {profile.vatNumber}
                  </p>
                )}
              </>
            ) : (
              <p className="font-semibold">{profile?.fullName}</p>
            )}
            <p className="text-muted-foreground">{profile?.email}</p>
            <p className="text-muted-foreground">{profile?.phone}</p>
            {profile?.address_line_1 && (
              <p className="text-muted-foreground">{profile.address_line_1}</p>
            )}
            {profile?.address_line_2 && (
              <p className="text-muted-foreground">{profile.address_line_2}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Bill To</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSupplierDialogOpen(true)}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Select Supplier
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
            <div className="space-y-2">
              <Label htmlFor="clientAddress2">Address Line 2</Label>
              <Input
                id="clientAddress2"
                value={clientInfo.address_line_2}
                onChange={(e) =>
                  setClientInfo({
                    ...clientInfo,
                    address_line_2: e.target.value,
                  })
                }
                placeholder="Apartment, suite, building, etc."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
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
            <div className="space-y-2">
              <Label htmlFor="validUntil">Valid Until</Label>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <div className="space-y-2">
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
                <SelectTrigger id="validForDays">
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
            <div className="space-y-2">
              <Label htmlFor="poStatus">Status</Label>
              <Select
                value={purchaseOrderStatus}
                onValueChange={(v) =>
                  setPurchaseOrderStatus(v as PurchaseOrderStatus)
                }
              >
                <SelectTrigger id="poStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
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
                  <TableHead className="w-[72px] text-center">Order</TableHead>
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
                {lineItems.map((item, index) => {
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
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-0.5 items-center pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
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
                            className="h-7 w-7 shrink-0"
                            onClick={() => moveLineDown(index)}
                            disabled={index === lineItems.length - 1}
                            aria-label="Move line down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
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
                placeholder="Purchase order terms..."
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

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={doCreatePurchaseOrder} disabled={saving} size="lg">
          {saving ? "Saving..." : "Save & View"}
        </Button>
      </div>

      <Dialog
        open={isSupplierDialogOpen}
        onOpenChange={setIsSupplierDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Supplier</DialogTitle>
            <DialogDescription>
              Choose a supplier from your database
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <Input
              placeholder="Search suppliers..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {suppliers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSupplier(s)}
                  className="w-full text-left p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="font-semibold">
                    {s.type === "company" ? s.companyName : s.fullName}
                  </div>
                  {s.type === "company" && s.contactName && (
                    <div className="text-sm text-muted-foreground">
                      {s.contactName}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground mt-1">
                    {s.email}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {s.address_line_1}
                    {s.address_line_2 ? `, ${s.address_line_2}` : ""}
                  </div>
                </button>
              ))}

              {suppliers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No suppliers found</p>
                  <Link href="/app/suppliers">
                    <Button variant="link" className="mt-2">
                      Add a new supplier
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

export default function NewPurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-56 rounded bg-muted animate-pulse" />
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="h-56 rounded bg-muted animate-pulse" />
            <div className="h-56 rounded bg-muted animate-pulse" />
          </div>
        </div>
      }
    >
      <NewPurchaseOrderPageContent />
    </Suspense>
  );
}
