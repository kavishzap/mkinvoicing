import { supabase } from "@/lib/supabaseClient";

export type CustomerPayload = {
  type: "company" | "individual";
  companyName?: string;
  contactName?: string;
  fullName?: string;
  email: string;
  phone?: string;
  street?: string;
  city?: string;
  postal?: string;
  country?: string;
  isActive?: boolean;
  address_line_1?: string;
  address_line_2?: string;
};

export type CustomerRow = CustomerPayload & {
  id: string;
  created_at: string;
  updated_at: string;
  isActive?: boolean;
};

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

const COLUMNS =
  "id,type,company_name,contact_name,full_name,email,phone,address_line_1,address_line_2,is_active,created_at,updated_at";

/**
 * Paged list with optional search & includeInactive.
 * Returns { rows, total }.
 */
export async function listCustomers(opts?: {
  search?: string;
  includeInactive?: boolean;
  page?: number; // 1-based
  pageSize?: number; // default 10
}): Promise<{ rows: CustomerRow[]; total: number }> {
  const userId = await getUserId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("customers")
    .select(COLUMNS, { count: "exact" })
    .eq("user_id", userId) // redundant with RLS but helps avoid silent no-ops
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!opts?.includeInactive) {
    q = q.eq("is_active", true);
  }

  const term = opts?.search?.trim();
  if (term) {
    const s = `%${term}%`;
    // search company name, full name, and email
    q = q.or(
      [
        `company_name.ilike.${s}`,
        `full_name.ilike.${s}`,
        `email.ilike.${s}`,
      ].join(",")
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map(mapRow),
    total: count ?? 0,
  };
}

/** Create customer */
export async function addCustomer(
  payload: CustomerPayload
): Promise<CustomerRow> {
  const userId = await getUserId();
  const insert = {
    user_id: userId,
    type: payload.type,
    company_name: payload.companyName || null,
    contact_name: payload.contactName || null,
    full_name: payload.fullName || null,
    email: (payload.email || "").toLowerCase(),
    phone: payload.phone || null,
    street: payload.street || null,
    city: payload.city || null,
    postal: payload.postal || null,
    country: payload.country || null,
    address_line_1: payload.address_line_1 || null,
    address_line_2: payload.address_line_2 || null,
    is_active: payload.isActive ?? true,
  };

  const { data, error } = await supabase
    .from("customers")
    .insert(insert)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data);
}

/** Update customer by id */
export async function updateCustomer(
  id: string,
  payload: Partial<CustomerPayload>
): Promise<CustomerRow> {
  await getUserId(); // ensure auth

  const update: Record<string, any> = {};
  if (payload.type) update.type = payload.type;
  if ("companyName" in payload)
    update.company_name = payload.companyName ?? null;
  if ("contactName" in payload)
    update.contact_name = payload.contactName ?? null;
  if ("fullName" in payload) update.full_name = payload.fullName ?? null;
  if ("email" in payload)
    update.email = payload.email ? payload.email.toLowerCase() : null;
  if ("phone" in payload) update.phone = payload.phone ?? null;
  if ("street" in payload) update.street = payload.street ?? null;
  if ("city" in payload) update.city = payload.city ?? null;
  if ("postal" in payload) update.postal = payload.postal ?? null;
  if ("country" in payload) update.country = payload.country ?? null;
  if ("address_line_1" in payload)
    update.address_line_1 = payload.address_line_1 ?? null;
  if ("address_line_2" in payload)
    update.address_line_2 = payload.address_line_2 ?? null;
  if ("isActive" in payload) update.is_active = payload.isActive;

  // Return updated row; if RLS blocks or id not found, data will be null.
  const { data, error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Customer not found or not accessible");
  return mapRow(data);
}

/** Toggle active */
export async function setCustomerActive(
  id: string,
  active: boolean
): Promise<CustomerRow> {
  await getUserId();

  const { data, error } = await supabase
    .from("customers")
    .update({ is_active: active })
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Customer not found or not accessible");
  return mapRow(data);
}

/** Delete by id */
export async function deleteCustomer(id: string): Promise<void> {
  await getUserId();

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) throw error;
}

function mapRow(r: any): CustomerRow {
  return {
    id: r.id,
    type: r.type,
    companyName: r.company_name ?? "",
    contactName: r.contact_name ?? "",
    fullName: r.full_name ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    street: r.street ?? "",
    city: r.city ?? "",
    postal: r.postal ?? "",
    country: r.country ?? "",
    address_line_1: r.address_line_1 ?? "",
    address_line_2: r.address_line_2 ?? "",
    isActive: !!r.is_active,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
