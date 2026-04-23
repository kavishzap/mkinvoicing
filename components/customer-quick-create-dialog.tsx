"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  addCustomer,
  type CustomerPayload,
  type CustomerRow,
} from "@/lib/customers-service";

export type CustomerQuickFormData = {
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

function emptyForm(type: "company" | "individual"): CustomerQuickFormData {
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
    address_line_1: "",
    address_line_2: "",
  };
}

function toPayload(f: CustomerQuickFormData): CustomerPayload {
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
    address_line_1: f.address_line_1,
    address_line_2: f.address_line_2 || undefined,
  };
}

function validateForm(
  formData: CustomerQuickFormData
): Partial<Record<keyof CustomerQuickFormData, string>> {
  const next: Partial<Record<keyof CustomerQuickFormData, string>> = {};
  const requiredCommon: (keyof CustomerQuickFormData)[] = [
    "email",
    "phone",
    "address_line_1",
  ];
  const requiredCompany: (keyof CustomerQuickFormData)[] = [
    "companyName",
    ...requiredCommon,
  ];
  const requiredIndividual: (keyof CustomerQuickFormData)[] = [
    "fullName",
    ...requiredCommon,
  ];
  const required =
    formData.type === "company" ? requiredCompany : requiredIndividual;
  for (const k of required) {
    const v = formData[k];
    if (!v || String(v).trim() === "") next[k] = "Required";
  }
  if (
    formData.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
  ) {
    next.email = "Invalid email";
  }
  return next;
}

function Field(props: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
}) {
  const { label, id, value, onChange, placeholder, type = "text", error } =
    props;
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
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

type CustomerQuickCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful create with the new row. */
  onCreated: (row: CustomerRow) => void;
};

export function CustomerQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: CustomerQuickCreateDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CustomerQuickFormData>(() =>
    emptyForm("company")
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof CustomerQuickFormData, string>>
  >({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormData(emptyForm("company"));
    setErrors({});
  }, [open]);

  async function handleSave() {
    const next = validateForm(formData);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setSaving(true);
      const row = await addCustomer(toPayload(formData));
      toast({
        title: "Customer added",
        description: "They are ready to select on this order.",
      });
      onCreated(row);
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Could not create customer",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>
            Add them to your directory, then they appear in the picker list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={formData.type === "company" ? "default" : "outline"}
              size="sm"
              onClick={() => setFormData({ ...formData, type: "company" })}
              className="flex-1"
            >
              Company
            </Button>
            <Button
              type="button"
              variant={formData.type === "individual" ? "default" : "outline"}
              size="sm"
              onClick={() => setFormData({ ...formData, type: "individual" })}
              className="flex-1"
            >
              Individual
            </Button>
          </div>

          {formData.type === "company" ? (
            <>
              <Field
                label="Company Name *"
                id="qc-companyName"
                value={formData.companyName}
                onChange={(v) => setFormData({ ...formData, companyName: v })}
                error={errors.companyName}
                placeholder="Acme Corp"
              />
              <Field
                label="Contact Name"
                id="qc-contactName"
                value={formData.contactName}
                onChange={(v) => setFormData({ ...formData, contactName: v })}
                placeholder="Jane Doe"
              />
            </>
          ) : (
            <Field
              label="Full Name *"
              id="qc-fullName"
              value={formData.fullName}
              onChange={(v) => setFormData({ ...formData, fullName: v })}
              error={errors.fullName}
              placeholder="John Doe"
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Email *"
              id="qc-email"
              type="email"
              value={formData.email}
              onChange={(v) => setFormData({ ...formData, email: v })}
              error={errors.email}
              placeholder="customer@example.com"
            />
            <Field
              label="Phone *"
              id="qc-phone"
              value={formData.phone}
              onChange={(v) => setFormData({ ...formData, phone: v })}
              error={errors.phone}
              placeholder="+230 5xx xx xx"
            />
          </div>
          <Field
            label="Address Line 1 *"
            id="qc-address1"
            value={formData.address_line_1}
            onChange={(v) =>
              setFormData({ ...formData, address_line_1: v })
            }
            error={errors.address_line_1}
            placeholder="e.g. 123 Main St, Port Louis"
          />
          <Field
            label="Address Line 2"
            id="qc-address2"
            value={formData.address_line_2}
            onChange={(v) =>
              setFormData({ ...formData, address_line_2: v })
            }
            placeholder="Apartment, suite, building, etc."
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Create customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
