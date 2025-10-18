"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import {
  Plus, Search, MoreVertical, Pencil, Trash2, Building2, User, Users, Lock, Unlock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  addCustomer, deleteCustomer, listCustomers, setCustomerActive, updateCustomer,
  type CustomerRow, type CustomerPayload
} from "@/lib/customers-service";

type FormData = {
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

export default function CustomersPage() {
  const { toast } = useToast();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  // 🔹 Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);

  const [formData, setFormData] = useState<FormData>(emptyForm("company"));
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { rows, total } = await listCustomers({
          search: searchQuery,
          includeInactive,
          page,
          pageSize,
        });
        setCustomers(rows);
        setTotal(total);
      } catch (e: any) {
        toast({ title: "Failed to load customers", description: e?.message ?? "Please try again.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast, searchQuery, includeInactive, page, pageSize]);

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, includeInactive, pageSize]);

  function handleOpenDialog(customer?: CustomerRow) {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        type: customer.type,
        companyName: customer.companyName || "",
        contactName: customer.contactName || "",
        fullName: customer.fullName || "",
        email: customer.email || "",
        phone: customer.phone || "",
        street: customer.street || "",
        city: customer.city || "",
        postal: customer.postal || "",
        country: customer.country || "",
      });
    } else {
      setEditingCustomer(null);
      setFormData(emptyForm("company"));
    }
    setErrors({});
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!validate()) return;

    try {
      setSaving(true);
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, mapFormToPayload(formData));
        toast({ title: "Customer updated", description: "Customer information has been updated successfully." });
      } else {
        await addCustomer(mapFormToPayload(formData));
        toast({ title: "Customer added", description: "New customer has been added successfully." });
      }
      await reload();
      setIsDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function reload() {
    const { rows, total } = await listCustomers({
      search: searchQuery,
      includeInactive,
      page,
      pageSize,
    });
    setCustomers(rows);
    setTotal(total);
  }

  function validate() {
    const next: Partial<Record<keyof FormData, string>> = {};
    const requiredCommon: (keyof FormData)[] = ["email", "phone", "street", "city", "postal", "country"];
    const requiredCompany: (keyof FormData)[] = ["companyName", ...requiredCommon];
    const requiredIndividual: (keyof FormData)[] = ["fullName", ...requiredCommon];

    const required = formData.type === "company" ? requiredCompany : requiredIndividual;

    for (const k of required) {
      const v = formData[k];
      if (!v || String(v).trim() === "") next[k] = "Required";
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) next.email = "Invalid email";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleToggleActive(c: CustomerRow) {
    try {
      await setCustomerActive(c.id, !c.isActive);
      toast({
        title: c.isActive ? "Customer set inactive" : "Customer activated",
        description: c.isActive ? "They will be hidden from default lists." : "They are visible in lists again.",
      });
      await reload();
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCustomer(id);
      toast({ title: "Customer deleted", description: "Customer has been removed successfully." });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      // If last item on last page deleted, move back a page otherwise reload
      if (customers.length === 1 && page > 1) setPage((p) => p - 1);
      else reload();
      setConfirmDeleteId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const err = (k: keyof FormData) => (errors[k] ? "border-destructive" : "");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">Manage your customer database</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Search + filters OR skeleton */}
      {loading ? (
        <SkeletonFilters />
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers by name, email, or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                  />
                  Include inactive
                </label>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={5}>5 / page</option>
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table OR skeleton */}
      {loading ? (
        <SkeletonTable rows={Math.min(pageSize, 6)} />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">City</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                      {c.type === "company" ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                      {c.type}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{c.type === "company" ? c.companyName : c.fullName}</td>
                  <td className="p-3">{c.email}</td>
                  <td className="p-3">{c.phone}</td>
                  <td className="p-3">{c.city}</td>
                  <td className="p-3">
                    {c.isActive ? (
                      <span className="inline-flex px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs">Active</span>
                    ) : (
                      <span className="inline-flex px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">Inactive</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDialog(c)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(c)}>
                          {c.isActive ? (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              Set inactive
                            </>
                          ) : (
                            <>
                              <Unlock className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirmDeleteId(c.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-10 w-10" />
                      {searchQuery ? "No matches. Try a different search." : "No customers yet. Add your first one!"}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination footer OR skeleton */}
      {loading ? (
        <SkeletonPagination />
      ) : (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing <span className="font-medium text-foreground">{start || 0}</span>–
            <span className="font-medium text-foreground">{end || 0}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span>
              Page <span className="font-medium text-foreground">{page}</span> / {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(total / pageSize)), p + 1))}
              disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? "Update customer information" : "Fill in the details to add a new customer"}
            </DialogDescription>
          </DialogHeader>

          <CustomerFormBody
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            editing={!!editingCustomer}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingCustomer ? "Update" : "Add"} Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this customer? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------- Form subcomponent ----------------- */
function CustomerFormBody({
  formData, setFormData, errors, editing,
}: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  errors: Partial<Record<keyof FormData, string>>;
  editing: boolean;
}) {
  return (
    <div className="space-y-4 py-2">
      {!editing ? (
        <div className="flex gap-2">
          <Button
            variant={formData.type === "company" ? "default" : "outline"}
            size="sm"
            onClick={() => setFormData({ ...formData, type: "company" })}
            className="flex-1"
          >
            Company
          </Button>
          <Button
            variant={formData.type === "individual" ? "default" : "outline"}
            size="sm"
            onClick={() => setFormData({ ...formData, type: "individual" })}
            className="flex-1"
          >
            Individual
          </Button>
        </div>
      ) : (
        <div>
          <Label>Type</Label>
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
              {formData.type === "company" ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              {formData.type}
            </span>
          </div>
        </div>
      )}

      {formData.type === "company" ? (
        <>
          <Field
            label="Company Name *"
            id="companyName"
            value={formData.companyName}
            onChange={(v) => setFormData({ ...formData, companyName: v })}
            error={errors.companyName}
            placeholder="Acme Corp"
          />
          <Field
            label="Contact Name"
            id="contactName"
            value={formData.contactName}
            onChange={(v) => setFormData({ ...formData, contactName: v })}
            placeholder="Jane Doe"
            required={false}
          />
        </>
      ) : (
        <Field
          label="Full Name *"
          id="fullName"
          value={formData.fullName}
          onChange={(v) => setFormData({ ...formData, fullName: v })}
          error={errors.fullName}
          placeholder="John Doe"
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Email *"
          id="email"
          type="email"
          value={formData.email}
          onChange={(v) => setFormData({ ...formData, email: v })}
          error={errors.email}
          placeholder="customer@example.com"
        />
        <Field
          label="Phone *"
          id="phone"
          value={formData.phone}
          onChange={(v) => setFormData({ ...formData, phone: v })}
          error={errors.phone}
          placeholder="+230 5xx xx xx"
        />
      </div>

      <Field
        label="Street Address *"
        id="street"
        value={formData.street}
        onChange={(v) => setFormData({ ...formData, street: v })}
        error={errors.street}
        placeholder="123 Main St"
      />

      <div className="grid grid-cols-3 gap-4">
        <Field
          label="City *"
          id="city"
          value={formData.city}
          onChange={(v) => setFormData({ ...formData, city: v })}
          error={errors.city}
          placeholder="Port Louis"
        />
        <Field
          label="Postal *"
          id="postal"
          value={formData.postal}
          onChange={(v) => setFormData({ ...formData, postal: v })}
          error={errors.postal}
          placeholder="742CU001"
        />
        <Field
          label="Country *"
          id="country"
          value={formData.country}
          onChange={(v) => setFormData({ ...formData, country: v })}
          error={errors.country}
          placeholder="Mauritius"
        />
      </div>
    </div>
  );
}

/* ----------------- Helpers ----------------- */
function emptyForm(type: "company" | "individual"): FormData {
  return {
    type,
    companyName: "",
    contactName: "",
    fullName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    postal: "",
    country: "",
  };
}

function mapFormToPayload(f: FormData): CustomerPayload {
  return {
    type: f.type,
    companyName: f.type === "company" ? f.companyName : undefined,
    contactName: f.type === "company" ? f.contactName : undefined,
    fullName: f.type === "individual" ? f.fullName : undefined,
    email: f.email,
    phone: f.phone,
    street: f.street,
    city: f.city,
    postal: f.postal,
    country: f.country,
  };
}

function Field(props: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  required?: boolean;
}) {
  const { label, id, value, onChange, placeholder, type = "text", error } = props;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={error ? "border-destructive" : ""}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/* ----------------- Skeletons ----------------- */
function SkeletonFilters() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="h-9 w-full sm:flex-1 bg-muted rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-5 w-36 bg-muted rounded animate-pulse" />
            <div className="h-9 w-28 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="text-left p-3">Type</th>
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Email</th>
            <th className="text-left p-3">Phone</th>
            <th className="text-left p-3">City</th>
            <th className="text-left p-3">Status</th>
            <th className="text-right p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t">
              <td className="p-3"><div className="h-5 w-16 bg-muted rounded animate-pulse" /></td>
              <td className="p-3"><div className="h-5 w-40 bg-muted rounded animate-pulse" /></td>
              <td className="p-3"><div className="h-5 w-48 bg-muted rounded animate-pulse" /></td>
              <td className="p-3"><div className="h-5 w-28 bg-muted rounded animate-pulse" /></td>
              <td className="p-3"><div className="h-5 w-24 bg-muted rounded animate-pulse" /></td>
              <td className="p-3"><div className="h-5 w-16 bg-muted rounded animate-pulse" /></td>
              <td className="p-3 text-right"><div className="h-8 w-8 bg-muted rounded-md ml-auto animate-pulse" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonPagination() {
  return (
    <div className="flex items-center justify-between">
      <div className="h-5 w-48 bg-muted rounded animate-pulse" />
      <div className="flex items-center gap-2">
        <div className="h-8 w-20 bg-muted rounded animate-pulse" />
        <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        <div className="h-8 w-16 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}
