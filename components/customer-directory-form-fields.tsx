"use client";

import type { Dispatch, SetStateAction } from "react";
import { Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerPayload } from "@/lib/customers-service";

export type CustomerDirectoryFormData = {
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

export function emptyCustomerDirectoryForm(
  type: "company" | "individual",
): CustomerDirectoryFormData {
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

export function customerDirectoryFormToPayload(
  f: CustomerDirectoryFormData,
): CustomerPayload {
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

export function validateCustomerDirectoryForm(
  formData: CustomerDirectoryFormData,
): Partial<Record<keyof CustomerDirectoryFormData, string>> {
  const next: Partial<Record<keyof CustomerDirectoryFormData, string>> = {};
  const requiredCommon: (keyof CustomerDirectoryFormData)[] = [
    "email",
    "phone",
    "address_line_1",
  ];
  const requiredCompany: (keyof CustomerDirectoryFormData)[] = [
    "companyName",
    ...requiredCommon,
  ];
  const requiredIndividual: (keyof CustomerDirectoryFormData)[] = [
    "fullName",
    ...requiredCommon,
  ];

  const required =
    formData.type === "company" ? requiredCompany : requiredIndividual;

  for (const k of required) {
    const v = formData[k];
    if (!v || String(v).trim() === "") next[k] = "Required";
  }
  if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
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
  const {
    label,
    id,
    value,
    onChange,
    placeholder,
    type = "text",
    error,
  } = props;
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

type CustomerDirectoryFormFieldsProps = {
  formData: CustomerDirectoryFormData;
  setFormData: Dispatch<SetStateAction<CustomerDirectoryFormData>>;
  errors: Partial<Record<keyof CustomerDirectoryFormData, string>>;
  /** When false, type is shown read-only (edit mode). */
  allowTypeChange?: boolean;
};

export function CustomerDirectoryFormFields({
  formData,
  setFormData,
  errors,
  allowTypeChange = true,
}: CustomerDirectoryFormFieldsProps) {
  return (
    <div className="space-y-4 py-2">
      {allowTypeChange ? (
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
      ) : (
        <div>
          <Label>Type</Label>
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
              {formData.type === "company" ? (
                <Building2 className="h-3.5 w-3.5" />
              ) : (
                <User className="h-3.5 w-3.5" />
              )}
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

      <div className="grid gap-4 sm:grid-cols-2">
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
        label="Address Line 1 *"
        id="address_line_1"
        value={formData.address_line_1}
        onChange={(v) => setFormData({ ...formData, address_line_1: v })}
        error={errors.address_line_1}
        placeholder="e.g. 123 Main St, Port Louis"
      />
      <Field
        label="Address Line 2"
        id="address_line_2"
        value={formData.address_line_2}
        onChange={(v) => setFormData({ ...formData, address_line_2: v })}
        error={errors.address_line_2}
        placeholder="Apartment, suite, building, etc."
      />
    </div>
  );
}
