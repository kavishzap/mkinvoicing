import { supabase } from "./supabaseClient";
import { getActiveCompanyId, requireActiveCompanyId } from "@/lib/active-company";

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

type CompanySettingsRow = CompanyRow & {
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  billing_contact_phone: string | null;
};

/** Settings → `companies` row only (matches public.companies columns). */
export type ActiveCompanySettings = {
  name: string;
  company_logo_url: string;
  brn: string;
  vat_number: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  country: string;
  billing_contact_name: string;
  billing_contact_email: string;
  billing_contact_phone: string;
};

function companyRowToSettings(c: CompanySettingsRow): ActiveCompanySettings {
  return {
    name: c.name ?? "",
    company_logo_url: c.company_logo_url ?? "",
    brn: c.brn ?? "",
    vat_number: c.vat_number ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    address_line_1: c.address_line_1 ?? "",
    address_line_2: c.address_line_2 ?? "",
    city: c.city ?? "",
    country: c.country ?? "",
    billing_contact_name: c.billing_contact_name ?? "",
    billing_contact_email: c.billing_contact_email ?? "",
    billing_contact_phone: c.billing_contact_phone ?? "",
  };
}

export function emptyActiveCompanySettings(): ActiveCompanySettings {
  return {
    name: "",
    company_logo_url: "",
    brn: "",
    vat_number: "",
    email: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    country: "",
    billing_contact_name: "",
    billing_contact_email: "",
    billing_contact_phone: "",
  };
}

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

/**
 * Maps `companies` row columns to the Profile shape used by Settings.
 * Company mode must show these values only from this table—not from `profiles`.
 */
function profileFieldsFromCompanyRow(c: CompanyRow): Partial<Profile> {
  return {
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

/** Clears company-backed fields so we never show stale `profiles` copies in company mode. */
function emptyCompanyTableProfileFields(): Partial<Profile> {
  return {
    companyName: "",
    logoUrl: "",
    registrationId: "",
    vatNumber: "",
    email: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    country: "",
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
    profile = {
      ...profile,
      ...(co
        ? profileFieldsFromCompanyRow(co as CompanyRow)
        : emptyCompanyTableProfileFields()),
    };
  }

  return profile;
}

/** Load the active `companies` row for the Settings company form (no `profiles` merge). */
export async function fetchActiveCompanySettings(): Promise<ActiveCompanySettings> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No active company is selected. You cannot edit company details until a company is linked to this session.",
    );
  }

  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, company_logo_url, brn, vat_number, email, phone, address_line_1, address_line_2, city, country, billing_contact_name, billing_contact_email, billing_contact_phone",
    )
    .eq("id", companyId)
    .single();

  if (error) throw error;
  return companyRowToSettings(data as CompanySettingsRow);
}

/** Read-only subscription snapshot for Settings (from `companies` + `plans`). */
export type CompanySubscriptionDetails = {
  company_code: string;
  company_is_active: boolean;
  is_trial: boolean | null;
  subscription_start_date: string;
  subscription_end_date: string | null;
  max_users_override: number | null;
  plan_name: string;
  plan_billing_cycle: string;
  plan_currency: string | null;
  plan_price: number;
  plan_max_users: number;
  plan_description: string | null;
  plan_catalog_active: boolean;
};

type PlanEmbed = {
  name: string;
  billing_cycle: string;
  currency: string | null;
  description: string | null;
  max_users: number;
  price: number;
  is_active: boolean;
};

export async function fetchCompanySubscriptionDetails(): Promise<CompanySubscriptionDetails> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No active company is selected. You cannot load subscription details until a company is linked to this session.",
    );
  }

  const { data, error } = await supabase
    .from("companies")
    .select(
      `
      company_code,
      is_active,
      is_trial,
      subscription_start_date,
      subscription_end_date,
      max_users_override,
      plans ( name, billing_cycle, currency, description, max_users, price, is_active )
    `,
    )
    .eq("id", companyId)
    .single();

  if (error) throw error;

  const rawPlans = (data as { plans?: PlanEmbed | PlanEmbed[] | null }).plans;
  const planRow: PlanEmbed | null = Array.isArray(rawPlans)
    ? rawPlans[0] ?? null
    : rawPlans ?? null;

  return {
    company_code: (data as { company_code: string }).company_code,
    company_is_active: Boolean((data as { is_active: boolean }).is_active),
    is_trial: (data as { is_trial: boolean | null }).is_trial,
    subscription_start_date: (data as { subscription_start_date: string })
      .subscription_start_date,
    subscription_end_date: (data as { subscription_end_date: string | null })
      .subscription_end_date,
    max_users_override: (data as { max_users_override: number | null })
      .max_users_override,
    plan_name: planRow?.name ?? "—",
    plan_billing_cycle: planRow?.billing_cycle ?? "—",
    plan_currency: planRow?.currency ?? null,
    plan_price: planRow ? Number(planRow.price) : 0,
    plan_max_users: planRow ? Number(planRow.max_users) : 0,
    plan_description: planRow?.description ?? null,
    plan_catalog_active: planRow?.is_active ?? false,
  };
}

/** Persist Settings company form fields to `companies.company_logo_url` and related columns. */
export async function updateActiveCompanySettings(
  s: ActiveCompanySettings,
): Promise<void> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No active company is selected. You cannot save company details until a company is linked to this session.",
    );
  }

  const { error } = await supabase
    .from("companies")
    .update({
      name: s.name.trim() || "",
      company_logo_url: s.company_logo_url.trim() || null,
      brn: s.brn.trim() || null,
      vat_number: s.vat_number.trim() || null,
      email: s.email.trim() || null,
      phone: s.phone.trim() || null,
      address_line_1: s.address_line_1.trim() || null,
      address_line_2: s.address_line_2.trim() || null,
      city: s.city.trim() || null,
      country: s.country.trim() || null,
      billing_contact_name: s.billing_contact_name.trim() || null,
      billing_contact_email: s.billing_contact_email.trim() || null,
      billing_contact_phone: s.billing_contact_phone.trim() || null,
    })
    .eq("id", companyId);

  if (error) throw error;
}

/** Writes a personal `profiles` row only (not used for active-company document identity). */
export async function upsertProfile(profile: Profile) {
  if (profile.accountType === "company") {
    throw new Error(
      "Company details are saved with updateActiveCompanySettings from Settings.",
    );
  }

  const userId = await getCurrentUserId();

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

  if (companyId) {
    await ensureUserSettingsRow();
  }

  let query = supabase.from("user_settings").select("*").eq("user_id", userId);
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query.maybeSingle();

  if (error) throw error;
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

/**
 * Document RPCs (invoice, quotation, sales order, etc.) expect a `user_settings` row
 * for numbering. New users may not have one until they save Preferences once — this
 * creates the row with the same defaults as {@link fetchPreferences}.
 */
export async function ensureUserSettingsRow(): Promise<void> {
  const userId = await getCurrentUserId();
  const companyId = await requireActiveCompanyId();

  const { data: row, error } = await supabase
    .from("user_settings")
    .select("user_id, company_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const defaults = {
    user_id: userId,
    company_id: companyId,
    currency: "MUR",
    number_prefix: "INV",
    number_padding: 4,
    next_number: 1,
    payment_terms: 14,
    default_notes: null,
    default_terms: null,
    quotation_prefix: "QT",
    quotation_number_padding: 4,
    quotation_next_number: 1,
    sales_order_prefix: "SO",
    sales_order_number_padding: 4,
    sales_order_next_number: 1,
    purchase_order_prefix: "PO",
    purchase_order_number_padding: 4,
    purchase_order_next_number: 1,
    purchase_invoice_prefix: "PINV",
    purchase_invoice_number_padding: 4,
    purchase_invoice_next_number: 1,
  };

  if (!row) {
    const { error: insErr } = await supabase.from("user_settings").insert(defaults);
    if (insErr) {
      if (insErr.code === "23505") {
        const { error: fixCo } = await supabase
          .from("user_settings")
          .update({ company_id: companyId })
          .eq("user_id", userId);
        if (fixCo) throw fixCo;
        return;
      }
      throw insErr;
    }
    return;
  }

  if (!row.company_id || row.company_id !== companyId) {
    const { error: updErr } = await supabase
      .from("user_settings")
      .update({ company_id: companyId })
      .eq("user_id", userId);
    if (updErr) throw updErr;
  }
}

export async function upsertPreferences(prefs: Preferences) {
  const userId = await getCurrentUserId();
  const companyId = await requireActiveCompanyId();
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
