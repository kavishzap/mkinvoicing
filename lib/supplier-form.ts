import type { SupplierPayload, SupplierRow } from "@/lib/suppliers-service";

/** Form state for create / edit supplier pages */
export type SupplierFormData = {
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
  supplierCode: string;
  vatNumber: string;
  registrationId: string;
  notes: string;
};

export function emptySupplierForm(
  type: "company" | "individual" = "company"
): SupplierFormData {
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
    supplierCode: "",
    vatNumber: "",
    registrationId: "",
    notes: "",
  };
}

export function supplierRowToForm(s: SupplierRow): SupplierFormData {
  return {
    type: s.type,
    companyName: s.companyName ?? "",
    contactName: s.contactName ?? "",
    fullName: s.fullName ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    street: s.street ?? "",
    city: s.city ?? "",
    postal: s.postal ?? "",
    country: s.country ?? "",
    address_line_1: s.address_line_1 ?? "",
    address_line_2: s.address_line_2 ?? "",
    supplierCode: s.supplierCode ?? "",
    vatNumber: s.vatNumber ?? "",
    registrationId: s.registrationId ?? "",
    notes: s.notes ?? "",
  };
}

export function supplierFormToPayload(f: SupplierFormData): SupplierPayload {
  return {
    type: f.type,
    companyName: f.companyName.trim() || undefined,
    contactName: f.contactName.trim() || undefined,
    fullName: f.fullName.trim() || undefined,
    email: f.email.trim() || undefined,
    phone: f.phone.trim() || undefined,
    street: f.street.trim() || undefined,
    city: f.city.trim() || undefined,
    postal: f.postal.trim() || undefined,
    country: f.country.trim() || undefined,
    address_line_1: f.address_line_1.trim() || undefined,
    address_line_2: f.address_line_2.trim() || undefined,
    supplierCode: f.supplierCode.trim() || undefined,
    vatNumber: f.vatNumber.trim() || undefined,
    registrationId: f.registrationId.trim() || undefined,
    notes: f.notes.trim() || undefined,
  };
}

export function validateSupplierForm(
  f: SupplierFormData
): Partial<Record<keyof SupplierFormData, string>> {
  const next: Partial<Record<keyof SupplierFormData, string>> = {};
  if (f.type === "company") {
    if (!f.companyName.trim()) next.companyName = "Company name is required";
  } else {
    if (!f.fullName.trim()) next.fullName = "Full name is required";
  }
  if (f.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))
      next.email = "Invalid email";
  }
  return next;
}
