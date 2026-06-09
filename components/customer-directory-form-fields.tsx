"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import { Building2, ExternalLink, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableDeliveryCitySelect } from "@/components/searchable-delivery-city-select";
import type { CustomerPayload } from "@/lib/customers-service";
import type { DeliveryCityRow } from "@/lib/delivery-zones-service";
import { cn } from "@/lib/utils";

export type CustomerDirectoryFormData = {
  type: "company" | "individual";
  companyName: string;
  contactName: string;
  fullName: string;
  email: string;
  phone: string;
  phone_2: string;
  map_location: string;
  street: string;
  city: string;
  postal: string;
  country: string;
  cityId: string;
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
    phone_2: "",
    map_location: "",
    street: "",
    city: "",
    postal: "",
    country: "",
    cityId: "",
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
    phone_2: f.phone_2.trim() || undefined,
    map_location: f.map_location.trim() || undefined,
    street: f.street,
    city: f.city,
    cityId: f.cityId || null,
    postal: f.postal,
    country: f.country,
    address_line_1: f.address_line_1,
    address_line_2: f.address_line_2 || undefined,
  };
}

export type ValidateCustomerDirectoryOptions = {
  /** When false, delivery city is optional (e.g. quick add from invoice). Default true. */
  requireCity?: boolean;
};

export function validateCustomerDirectoryForm(
  formData: CustomerDirectoryFormData,
  options?: ValidateCustomerDirectoryOptions,
): Partial<Record<keyof CustomerDirectoryFormData, string>> {
  const next: Partial<Record<keyof CustomerDirectoryFormData, string>> = {};
  const required: (keyof CustomerDirectoryFormData)[] = ["phone"];
  if (options?.requireCity !== false) {
    required.push("cityId");
  }

  for (const k of required) {
    const v = formData[k];
    if (!v || String(v).trim() === "") next[k] = "Required";
  }
  if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    next.email = "Invalid email";
  }
  return next;
}

function mapLocationHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
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
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("h-8 text-xs", error ? "border-destructive" : "")}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

type CustomerDirectoryFormFieldsProps = {
  formData: CustomerDirectoryFormData;
  setFormData: Dispatch<SetStateAction<CustomerDirectoryFormData>>;
  errors: Partial<Record<keyof CustomerDirectoryFormData, string>>;
  cities: DeliveryCityRow[];
  /** When false, type is shown read-only (edit mode). */
  allowTypeChange?: boolean;
  /** When false, city picker is optional. Default true. */
  requireCity?: boolean;
  className?: string;
};

export function CustomerDirectoryFormFields({
  formData,
  setFormData,
  errors,
  cities,
  allowTypeChange = true,
  requireCity = true,
  className,
}: CustomerDirectoryFormFieldsProps) {
  const activeCities = useMemo(
    () => cities.filter((c) => c.isActive),
    [cities],
  );
  const mapHref = useMemo(
    () => mapLocationHref(formData.map_location),
    [formData.map_location],
  );

  return (
    <div className={cn("space-y-4 py-2", className)}>
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
          <Label className="text-xs font-medium">Type</Label>
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
            label="Company name"
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
          label="Full name"
          id="fullName"
          value={formData.fullName}
          onChange={(v) => setFormData({ ...formData, fullName: v })}
          error={errors.fullName}
          placeholder="John Doe"
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Email"
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Phone 2"
          id="phone_2"
          value={formData.phone_2}
          onChange={(v) => setFormData({ ...formData, phone_2: v })}
          placeholder="+230 5xx xx xx"
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="map_location" className="text-xs font-medium">
              Map location
            </Label>
            {mapHref ? (
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open map in new tab"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
          </div>
          <Input
            id="map_location"
            type="text"
            value={formData.map_location}
            onChange={(e) =>
              setFormData({ ...formData, map_location: e.target.value })
            }
            placeholder="Google Maps link or coordinates"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cityId" className="text-xs font-medium">
          {requireCity ? "City *" : "City"}
        </Label>
        <SearchableDeliveryCitySelect
          id="cityId"
          cities={activeCities}
          value={formData.cityId}
          onChange={(cityId) => {
            const row = cities.find((c) => c.id === cityId);
            setFormData({
              ...formData,
              cityId,
              city: row?.name ?? "",
            });
          }}
          placeholder="Search or pick a city"
          compact
          aria-invalid={!!errors.cityId}
          className={errors.cityId ? "border-destructive" : undefined}
        />
        {errors.cityId ? <p className="text-xs text-destructive">{errors.cityId}</p> : null}
      </div>

      <Field
        label="Address line 1"
        id="address_line_1"
        value={formData.address_line_1}
        onChange={(v) => setFormData({ ...formData, address_line_1: v })}
        error={errors.address_line_1}
        placeholder="Street, building, suite"
      />
    </div>
  );
}
