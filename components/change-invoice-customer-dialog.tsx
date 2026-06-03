"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  CustomerDirectoryFormFields,
  customerDirectoryFormToPayload,
  emptyCustomerDirectoryForm,
  validateCustomerDirectoryForm,
  type CustomerDirectoryFormData,
} from "@/components/customer-directory-form-fields";
import {
  addCustomer,
  listCustomers,
  type CustomerRow,
} from "@/lib/customers-service";
import { updateInvoiceCustomer } from "@/lib/invoices-service";
import {
  billToFromCustomer,
  buildBillToSnapshot,
} from "@/lib/sales-orders-service";
import {
  listDeliveryCities,
  type DeliveryCityRow,
} from "@/lib/delivery-zones-service";
import { cn } from "@/lib/utils";

type ChangeInvoiceCustomerDialogProps = {
  invoiceId: string;
  currentCustomerId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

function customerDisplayName(c: CustomerRow): string {
  if (c.type === "company") {
    return (
      c.companyName?.trim() ||
      c.contactName?.trim() ||
      "Company"
    );
  }
  return c.fullName?.trim() || "Customer";
}

export function ChangeInvoiceCustomerDialog({
  invoiceId,
  currentCustomerId,
  open,
  onOpenChange,
  onSaved,
}: ChangeInvoiceCustomerDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newForm, setNewForm] = useState<CustomerDirectoryFormData>(() =>
    emptyCustomerDirectoryForm("company"),
  );
  const [newFormErrors, setNewFormErrors] = useState<
    Partial<Record<keyof CustomerDirectoryFormData, string>>
  >({});
  const [cities, setCities] = useState<DeliveryCityRow[]>([]);

  const resetState = useCallback(() => {
    setTab("existing");
    setSearch("");
    setSelectedId(currentCustomerId ?? null);
    setNewForm(emptyCustomerDirectoryForm("company"));
    setNewFormErrors({});
  }, [currentCustomerId]);

  useEffect(() => {
    if (!open) return;
    resetState();
    void listDeliveryCities()
      .then(setCities)
      .catch(() => setCities([]));
  }, [open, resetState]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setListLoading(true);
    void (async () => {
      try {
        const { rows } = await listCustomers({
          search,
          includeInactive: false,
          page: 1,
          pageSize: 50,
        });
        if (!cancelled) setCustomers(rows);
      } catch {
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, search]);

  async function applyCustomer(c: CustomerRow) {
    const bill = buildBillToSnapshot(billToFromCustomer(c));
    await updateInvoiceCustomer(invoiceId, {
      customer_id: c.id,
      bill_to_snapshot: bill,
    });
  }

  async function handleSaveExisting() {
    if (!selectedId) {
      toast({
        title: "Select a customer",
        description: "Choose someone from the list, or create a new customer.",
        variant: "destructive",
      });
      return;
    }
    const c = customers.find((row) => row.id === selectedId);
    if (!c) {
      toast({
        title: "Customer not found",
        description: "Refresh the list and try again.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      await applyCustomer(c);
      toast({
        title: "Customer updated",
        description: `Bill-to is now ${customerDisplayName(c)}.`,
      });
      onOpenChange(false);
      onSaved?.();
    } catch (e: unknown) {
      toast({
        title: "Could not update customer",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNew() {
    const next = validateCustomerDirectoryForm(newForm, { requireCity: false });
    setNewFormErrors(next);
    if (Object.keys(next).length > 0) {
      toast({
        title: "Check the form",
        description: "Fix the highlighted fields.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const created = await addCustomer(customerDirectoryFormToPayload(newForm));
      await applyCustomer(created);
      toast({
        title: "Customer updated",
        description: `Invoice is now billed to ${customerDisplayName(created)}.`,
      });
      onOpenChange(false);
      onSaved?.();
    } catch (e: unknown) {
      toast({
        title: "Could not save customer",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden"
        onPointerDownOutside={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("[data-slot='popover-content']")) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("[data-slot='popover-content']")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Change customer</DialogTitle>
          <DialogDescription>
            Search your customer directory or add a new individual or company.
            Line items and totals stay the same.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v === "new" ? "new" : "existing")}
          className="flex min-h-0 flex-1 flex-col gap-3"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing customer</TabsTrigger>
            <TabsTrigger value="new">New customer</TabsTrigger>
          </TabsList>

          <TabsContent
            value="existing"
            className="mt-0 flex min-h-0 flex-1 flex-col gap-3 data-[state=inactive]:hidden"
          >
            <Input
              type="search"
              placeholder="Search by name, email, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              aria-label="Search customers"
            />
            <div className="min-h-[12rem] flex-1 space-y-2 overflow-y-auto pr-1">
              {listLoading && customers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Loading customers…
                </p>
              ) : null}
              {!listLoading && customers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No customers found. Try another search or add a new customer.
                </p>
              ) : null}
              {customers.map((c) => {
                const label = customerDisplayName(c);
                const line2 = [c.email, c.phone, c.cityName || c.city]
                  .filter((x) => String(x ?? "").trim())
                  .join(" · ");
                const isSelected = selectedId === c.id;
                const isCurrent = currentCustomerId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "hover:bg-accent",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {c.type === "company" ? (
                        <Building2
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      ) : (
                        <UserRound
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{label}</span>
                          {isCurrent ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Current
                            </span>
                          ) : null}
                        </div>
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
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent
            value="new"
            className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
          >
            <CustomerDirectoryFormFields
              formData={newForm}
              setFormData={setNewForm}
              errors={newFormErrors}
              cities={cities}
              requireCity={false}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={tab === "new" ? handleSaveNew : handleSaveExisting}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
