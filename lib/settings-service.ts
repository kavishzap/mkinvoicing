import { supabase } from "./supabaseClient";

export type Profile = {
  accountType: "company" | "individual";
  companyName?: string;
  logoUrl?: string;
  registrationId?: string;
  fullName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  postal?: string;
  country?: string;
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
    fullName: row.full_name ?? "",
    taxId: row.tax_id ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    street: row.street ?? "",
    city: row.city ?? "",
    postal: row.postal ?? "",
    country: row.country ?? "",
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
    full_name: profile.fullName || null,
    tax_id: profile.taxId || null,
    email: profile.email || null,
    phone: profile.phone || null,
    street: profile.street || null,
    city: profile.city || null,
    postal: profile.postal || null,
    country: profile.country || null,
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
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

  const { error } = await supabase.from("user_settings").upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}
