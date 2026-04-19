import { supabase } from "./supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";

type CompanyRow = {
  id: string;
  name: string;
  company_logo_url: string | null;
  brn: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  country: string | null;
};

function profileFromDbRow(row: Record<string, unknown>): Profile {
  return {
    accountType: (row.account_type ?? "company") as Profile["accountType"],
    companyName: (row.company_name as string) ?? "",
    logoUrl: (row.logo_url as string) ?? "",
    registrationId: (row.registration_id as string) ?? "",
    vatNumber: (row.vat_number as string) ?? "",
    vatRegistered: (row.vat_registered as boolean) ?? false,
    fullName: (row.full_name as string) ?? "",
    taxId: (row.tax_id as string) ?? "",
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    street: (row.street as string) ?? "",
    city: (row.city as string) ?? "",
    postal: (row.postal as string) ?? "",
    country: (row.country as string) ?? "",
    address_line_1: (row.address_line_1 as string) ?? "",
    address_line_2: (row.address_line_2 as string) ?? "",
    bank_name: (row.bank_name as string) ?? "",
    bank_acc_num: (row.bank_acc_num as string) ?? "",
  };
}

function mergeCompanyIntoProfile(p: Profile, c: CompanyRow): Profile {
  return {
    ...p,
    companyName: c.name ?? "",
    logoUrl: c.company_logo_url ?? "",
    registrationId: c.brn ?? "",
    vatNumber: c.vat_number ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    address_line_1: c.address_line_1 ?? "",
    address_line_2: c.address_line_2 ?? "",
    city: c.city ?? "",
    country: c.country ?? "",
  };
}

export type Profile = {
  accountType: "company" | "individual";
  companyName?: string;
  logoUrl?: string;
  registrationId?: string;
  vatNumber?: string;
  vatRegistered?: boolean;
  fullName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  postal?: string;
  country?: string;
  address_line_1?: string;
  address_line_2?: string;
  bank_name?: string;
  bank_acc_num?: string;
};

export type Preferences = {
  currency: string;
  numberPrefix: string;
  numberPadding: number;
  nextNumber: number;
  paymentTerms: number;
  defaultNotes?: string;
  defaultTerms?: string;
  /** Quotation numbering (user_settings.quotation_*) */
  quotationPrefix?: string;
  quotationNumberPadding?: number;
  quotationNextNumber?: number;
  /** Sales order numbering (user_settings.sales_order_*) */
  salesOrderPrefix?: string;
  salesOrderNumberPadding?: number;
  salesOrderNextNumber?: number;
  /** Purchase order numbering (user_settings.purchase_order_*) */
  purchaseOrderPrefix?: string;
  purchaseOrderNumberPadding?: number;
  purchaseOrderNextNumber?: number;
  /** Purchase invoice numbering (user_settings.purchase_invoice_*) */
  purchaseInvoicePrefix?: string;
  purchaseInvoiceNumberPadding?: number;
  purchaseInvoiceNextNumber?: number;
};

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function fetchProfile(): Promise<Profile> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // not found
  const row = data ?? {};
  let profile = profileFromDbRow(row as Record<string, unknown>);

  const companyId = await getActiveCompanyId();
  const isCompanyAccount = profile.accountType === "company";

  if (companyId && isCompanyAccount) {
    const { data: co, error: cErr } = await supabase
      .from("companies")
      .select(
        "id, name, company_logo_url, brn, vat_number, email, phone, address_line_1, address_line_2, city, country",
      )
      .eq("id", companyId)
      .maybeSingle();

    if (cErr && cErr.code !== "PGRST116") throw cErr;
    if (co) {
      profile = mergeCompanyIntoProfile(profile, co as CompanyRow);
    }
  }

  return profile;
}

export async function upsertProfile(profile: Profile) {
  const userId = await getCurrentUserId();
  const companyId = await getActiveCompanyId();

  if (profile.accountType === "company" && !companyId) {
    throw new Error(
      "No active company is selected. You cannot save company details until a company is linked to this session.",
    );
  }

  const isCompany = profile.accountType === "company" && !!companyId;

  if (isCompany) {
    const { error: cErr } = await supabase
      .from("companies")
      .update({
        name: profile.companyName?.trim() || "",
        company_logo_url: profile.logoUrl?.trim() || null,
        brn: profile.registrationId?.trim() || null,
        vat_number: profile.vatNumber?.trim() || null,
        email: profile.email?.trim() || null,
        phone: profile.phone?.trim() || null,
        address_line_1: profile.address_line_1?.trim() || null,
        address_line_2: profile.address_line_2?.trim() || null,
        city: profile.city?.trim() || null,
        country: profile.country?.trim() || null,
      })
      .eq("id", companyId);
    if (cErr) throw cErr;

    const profilePayload = {
      id: userId,
      account_type: profile.accountType,
      vat_registered: profile.vatRegistered ?? false,
      full_name: profile.fullName || null,
      tax_id: profile.taxId || null,
      street: profile.street || null,
      postal: profile.postal || null,
      bank_name: profile.bank_name || null,
      bank_acc_num: profile.bank_acc_num || null,
      company_name: null,
      logo_url: null,
      registration_id: null,
      vat_number: null,
      email: null,
      phone: null,
      city: null,
      country: null,
      address_line_1: null,
      address_line_2: null,
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });
    if (error) throw error;
    return;
  }

  const payload = {
    id: userId,
    account_type: profile.accountType,
    company_name: profile.companyName || null,
    logo_url: profile.logoUrl || null,
    registration_id: profile.registrationId || null,
    vat_number: profile.vatNumber || null,
    vat_registered: profile.vatRegistered ?? false,
    full_name: profile.fullName || null,
    tax_id: profile.taxId || null,
    email: profile.email || null,
    phone: profile.phone || null,
    street: profile.street || null,
    city: profile.city || null,
    postal: profile.postal || null,
    country: profile.country || null,
    address_line_1: profile.address_line_1 || null,
    address_line_2: profile.address_line_2 || null,
    bank_name: profile.bank_name || null,
    bank_acc_num: profile.bank_acc_num || null,
  };

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });
  if (error) throw error;
}

export async function fetchPreferences(): Promise<Preferences> {
  const userId = await getCurrentUserId();
  const companyId = await getActiveCompanyId();
  let query = supabase.from("user_settings").select("*").eq("user_id", userId);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query.single();

  if (error && error.code !== "PGRST116") throw error;
  const row = data ?? {};

  return {
    currency: row.currency ?? "MUR",
    numberPrefix: row.number_prefix ?? "INV",
    numberPadding: row.number_padding ?? 4,
    nextNumber: row.next_number ?? 1,
    paymentTerms: row.payment_terms ?? 14,
    defaultNotes: row.default_notes ?? "",
    defaultTerms: row.default_terms ?? "",
    quotationPrefix: row.quotation_prefix ?? "QT",
    quotationNumberPadding: row.quotation_number_padding ?? 4,
    quotationNextNumber: row.quotation_next_number ?? 1,
    salesOrderPrefix: row.sales_order_prefix ?? "SO",
    salesOrderNumberPadding: row.sales_order_number_padding ?? 4,
    salesOrderNextNumber: row.sales_order_next_number ?? 1,
    purchaseOrderPrefix: row.purchase_order_prefix ?? "PO",
    purchaseOrderNumberPadding: row.purchase_order_number_padding ?? 4,
    purchaseOrderNextNumber: row.purchase_order_next_number ?? 1,
    purchaseInvoicePrefix: row.purchase_invoice_prefix ?? "PINV",
    purchaseInvoiceNumberPadding: row.purchase_invoice_number_padding ?? 4,
    purchaseInvoiceNextNumber: row.purchase_invoice_next_number ?? 1,
  };
}

export async function upsertPreferences(prefs: Preferences) {
  const userId = await getCurrentUserId();
  const companyId = await getActiveCompanyId();
  const payload: Record<string, unknown> = {
    user_id: userId,
    company_id: companyId,
    currency: prefs.currency,
    number_prefix: prefs.numberPrefix,
    number_padding: prefs.numberPadding,
    next_number: prefs.nextNumber,
    payment_terms: prefs.paymentTerms,
    default_notes: prefs.defaultNotes || null,
    default_terms: prefs.defaultTerms || null,
  };

  const { error } = await supabase
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}
