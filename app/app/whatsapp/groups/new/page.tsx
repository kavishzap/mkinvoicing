"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { getActiveCompanyId } from "@/lib/active-company";
import { listCustomersForCompany, type CustomerRow } from "@/lib/customers-service";
import { listProducts, type ProductRow } from "@/lib/products-service";
import {
  addWhatsAppGroup,
  fetchCustomerIdsWhoBoughtProductOnInvoice,
} from "@/lib/whatsapp-groups-service";
import { cn } from "@/lib/utils";

const PRODUCT_NONE = "__none__";

function customerLabel(c: CustomerRow): string {
  return c.type === "company"
    ? c.companyName || "Company"
    : c.fullName || "Individual";
}

export default function NewWhatsAppGroupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [suggestProductId, setSuggestProductId] = useState<string>(PRODUCT_NONE);
  const [suggestingByProduct, setSuggestingByProduct] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedProductSearch(productSearch.trim()),
      220,
    );
    return () => window.clearTimeout(t);
  }, [productSearch]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedCustomerSearch(customerSearch.trim()),
      220,
    );
    return () => window.clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    (async () => {
      const id = await getActiveCompanyId();
      setCompanyReady(!!id);
    })();
  }, []);

  const loadCustomers = useCallback(async () => {
    if (companyReady !== true) return;
    setCustomersLoading(true);
    try {
      const rows = await listCustomersForCompany({
        search: debouncedCustomerSearch || undefined,
        columns: "picker",
      });
      setCustomers(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Could not load customers",
        description: msg,
        variant: "destructive",
      });
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, [companyReady, debouncedCustomerSearch, toast]);

  useEffect(() => {
    if (companyReady !== true) return;
    void loadCustomers();
  }, [companyReady, loadCustomers]);

  const loadProducts = useCallback(async () => {
    if (companyReady !== true) return;
    setProductsLoading(true);
    try {
      const { rows } = await listProducts({
        page: 1,
        pageSize: 500,
        status: "active",
        search: debouncedProductSearch || undefined,
      });
      setProducts(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Could not load products",
        description: msg,
        variant: "destructive",
      });
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [companyReady, debouncedProductSearch, toast]);

  useEffect(() => {
    if (companyReady !== true) return;
    void loadProducts();
  }, [companyReady, loadProducts]);

  const applyProductPurchaseSelection = useCallback(
    async (productId: string) => {
      if (!productId || productId === PRODUCT_NONE) return;
      setSuggestingByProduct(true);
      try {
        const ids = await fetchCustomerIdsWhoBoughtProductOnInvoice(productId);
        const pname = products.find((p) => p.id === productId)?.name ?? "this product";
        setSelectedCustomerIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.add(id);
          return next;
        });
        if (ids.length === 0) {
          toast({
            title: "No matching customers",
            description: `No customer on a non-cancelled invoice was found with this product on a line. Link the product on invoice items (not only free-typed line text) for “${pname}”.`,
          });
        } else {
          toast({
            title: "Customers selected",
            description: `Added ${ids.length} customer(s) who bought “${pname}” on an invoice. Selection is merged with any customers you already ticked.`,
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Could not resolve customers for product",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setSuggestingByProduct(false);
      }
    },
    [products, toast],
  );

  function toggleCustomer(id: string) {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleIds = useMemo(() => customers.map((c) => c.id), [customers]);

  const allVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    return visibleIds.every((id) => selectedCustomerIds.has(id));
  }, [visibleIds, selectedCustomerIds]);

  function selectAllVisible() {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }

  function clearVisibleSelection() {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.delete(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError("");
    try {
      setSaving(true);
      await addWhatsAppGroup({
        name: name.trim(),
        description: description.trim() || null,
        customerIds: [...selectedCustomerIds],
      });
      toast({ title: "Group created" });
      router.push("/app/whatsapp/groups");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPageShell
      fillHeight
      className={cn(
        "max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background",
        "flex min-h-0 min-w-0 flex-1 flex-col",
      )}
      leading={
        <Link href="/app/whatsapp/groups">
          <Button variant="ghost" size="icon" aria-label="Back to groups">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Choose a unique name and tick customers to include. You can also pick a product to auto-select customers who bought it on an invoice."
    >
      {companyReady === false && (
        <Card className="mb-4 shrink-0 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company linked. Groups require a company context.
          </CardContent>
        </Card>
      )}

      <div className="grid min-h-0 min-w-0 flex-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex min-h-0 flex-col lg:max-w-none">
          <CardHeader>
            <CardTitle>New group</CardTitle>
            <CardDescription>
              Customers must belong to your active company.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex min-h-0 flex-1 flex-col space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="g-name">Name *</Label>
                <Input
                  id="g-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={companyReady !== true}
                  className={nameError ? "border-destructive" : ""}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-desc">Description</Label>
                <Textarea
                  id="g-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={companyReady !== true}
                />
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
                <Button type="button" variant="outline" asChild>
                  <Link href="/app/whatsapp/groups">Cancel</Link>
                </Button>
                <Button type="submit" disabled={saving || companyReady !== true}>
                  {saving ? "Saving…" : "Create group"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 min-w-0 flex-col lg:max-w-none">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-base">Customers</CardTitle>
            <CardDescription>
              Pick a product to merge in everyone on a non-cancelled invoice with that line item.
              Filter runs on the server (name, email, phone). Use Select all for everyone in the
              current results.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                Select by purchased product
              </Label>
              <Input
                placeholder="Search products…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                disabled={companyReady !== true}
                aria-label="Search products"
                autoComplete="off"
              />
              <Select
                value={suggestProductId}
                onValueChange={(v) => {
                  setSuggestProductId(v);
                  if (v !== PRODUCT_NONE) void applyProductPurchaseSelection(v);
                }}
                disabled={
                  companyReady !== true || productsLoading || suggestingByProduct
                }
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Choose a product…" />
                </SelectTrigger>
                <SelectContent className="max-h-[min(280px,50vh)]">
                  <SelectItem value={PRODUCT_NONE}>None (manual selection only)</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="truncate">{p.name}</span>
                      {p.sku ? (
                        <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                          {p.sku}
                        </span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {productsLoading
                  ? "Loading products…"
                  : suggestingByProduct
                    ? "Finding customers on invoices…"
                    : "Uses invoice line items linked to the product. Merges with your existing ticks."}
              </p>
            </div>
            <Input
              placeholder="Filter by name, email, or mobile phone…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              disabled={companyReady !== true}
              aria-label="Filter customers"
              autoComplete="off"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  companyReady !== true ||
                  customersLoading ||
                  visibleIds.length === 0 ||
                  allVisibleSelected
                }
                onClick={selectAllVisible}
              >
                Select all ({customers.length})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  companyReady !== true ||
                  customersLoading ||
                  visibleIds.length === 0 ||
                  !visibleIds.some((id) => selectedCustomerIds.has(id))
                }
                onClick={clearVisibleSelection}
              >
                Clear list selection
              </Button>
            </div>
            <div
              className={cn(
                "min-h-0 flex-1 space-y-0 overflow-y-auto rounded-md border",
                customersLoading && "pointer-events-none opacity-60",
              )}
              aria-busy={customersLoading}
            >
              {customers.length === 0 && !customersLoading ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No customers match this filter. Try another phone or name, or clear the filter.
                </p>
              ) : (
                <ul className="divide-y">
                  {customers.map((c) => (
                    <li key={c.id}>
                      <label
                        className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedCustomerIds.has(c.id)}
                          onCheckedChange={() => toggleCustomer(c.id)}
                          disabled={companyReady !== true}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-medium">{customerLabel(c)}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            <span className="tabular-nums">{c.phone || "No phone"}</span>
                            {" · "}
                            {c.email || "—"}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">
              {selectedCustomerIds.size} selected in total (includes rows hidden by the current
              filter).
            </p>
          </CardContent>
        </Card>
      </div>
    </AppPageShell>
  );
}
