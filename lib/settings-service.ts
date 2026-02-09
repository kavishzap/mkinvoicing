import { supabase } from "./supabaseClient";

export type Profile = {
  accountType: "company" | "individual";
  companyName?: string;
  logoUrl?: string;
  registrationId?: string;
  vatNumber?: string;
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

  return {
    accountType: (row.account_type ?? "company") as Profile["accountType"],
    companyName: row.company_name ?? "",
    logoUrl: row.logo_url ?? "",
    registrationId: row.registration_id ?? "",
    vatNumber: row.vat_number ?? "",
    fullName: row.full_name ?? "",
    taxId: row.tax_id ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    street: row.street ?? "",
    city: row.city ?? "",
    postal: row.postal ?? "",
    country: row.country ?? "",
    address_line_1: row.address_line_1 ?? "",
    address_line_2: row.address_line_2 ?? "",
    bank_name: row.bank_name ?? "",
    bank_acc_num: row.bank_acc_num ?? "",
  };
}

export async function upsertProfile(profile: Profile) {
  const userId = await getCurrentUserId();
  const payload = {
    id: userId,
    account_type: profile.accountType,
    company_name: profile.companyName || null,
    logo_url: profile.logoUrl || null,
    registration_id: profile.registrationId || null,
    vat_number: profile.vatNumber || null,
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
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

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
  };
}

export async function upsertPreferences(prefs: Preferences) {
  const userId = await getCurrentUserId();
  const payload = {
    user_id: userId,
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
