import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

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
  /** When set, only rows of this customer type. */
  type?: "company" | "individual";
  page?: number; // 1-based
  pageSize?: number; // default 10
}): Promise<{ rows: CustomerRow[]; total: number }> {
  const companyId = await requireActiveCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("customers")
    .select(COLUMNS, { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!opts?.includeInactive) {
    q = q.eq("is_active", true);
  }

  if (opts?.type) {
    q = q.eq("type", opts.type);
  }

  const term = opts?.search?.trim();
  if (term) {
    const s = `%${term}%`;
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

/** One customer for the active company, or null if not found / wrong tenant. */
export async function getCustomer(id: string): Promise<CustomerRow | null> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("customers")
    .select(COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data);
}

/**
 * Active customers for the current user's company (for WhatsApp groups, etc.).
 * Returns up to 500 rows; empty if no company context.
 */
export async function listCustomersForCompany(opts?: {
  search?: string;
}): Promise<CustomerRow[]> {
  const companyId = await requireActiveCompanyId();

  let q = supabase
    .from("customers")
    .select(COLUMNS)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(500);

  const term = opts?.search?.trim();
  if (term) {
    const s = `%${term}%`;
    q = q.or(
      [
        `company_name.ilike.${s}`,
        `full_name.ilike.${s}`,
        `email.ilike.${s}`,
        `phone.ilike.${s}`,
      ].join(",")
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** Create customer */
export async function addCustomer(
  payload: CustomerPayload
): Promise<CustomerRow> {
  const [userId, companyId] = await Promise.all([
    getUserId(),
    requireActiveCompanyId(),
  ]);
  const insert = {
    user_id: userId,
    company_id: companyId,
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

export async function addCustomersBulk(
  payloads: CustomerPayload[]
): Promise<{ inserted: number }> {
  if (payloads.length === 0) return { inserted: 0 };
  const [userId, companyId] = await Promise.all([
    getUserId(),
    requireActiveCompanyId(),
  ]);

  const rows = payloads.map((payload) => ({
    user_id: userId,
    company_id: companyId,
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
  }));

  const { error } = await supabase.from("customers").insert(rows);
  if (error) throw error;
  return { inserted: rows.length };
}

/** Normalize customer name for import duplicate checks (within file vs existing DB). */
export function normalizeCustomerImportDedupeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Stable key: `individual:{norm}` or `company:{norm}` — must match import preview logic. */
export function customerPayloadImportDedupeKey(
  payload: CustomerPayload
): string | null {
  if (payload.type === "company") {
    const n = normalizeCustomerImportDedupeValue(payload.companyName ?? "");
    return n ? `company:${n}` : null;
  }
  const n = normalizeCustomerImportDedupeValue(payload.fullName ?? "");
  return n ? `individual:${n}` : null;
}

const IMPORT_DEDUPE_PAGE = 1000;

/**
 * Dedupe keys for every customer already stored for the active company (active and inactive),
 * using the same rules as bulk import preview (`customerPayloadImportDedupeKey`).
 */
export async function getExistingCustomerImportDedupeKeys(): Promise<
  Set<string>
> {
  const companyId = await requireActiveCompanyId();
  const keys = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("customers")
      .select("type, full_name, company_name")
      .eq("company_id", companyId)
      .range(from, from + IMPORT_DEDUPE_PAGE - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const r of data as {
      type: string;
      full_name?: string | null;
      company_name?: string | null;
    }[]) {
      const payload: CustomerPayload =
        r.type === "company"
          ? {
              type: "company",
              companyName: r.company_name ?? "",
              email: "",
            }
          : {
              type: "individual",
              fullName: r.full_name ?? "",
              email: "",
            };
      const k = customerPayloadImportDedupeKey(payload);
      if (k) keys.add(k);
    }

    if (data.length < IMPORT_DEDUPE_PAGE) break;
    from += IMPORT_DEDUPE_PAGE;
  }

  return keys;
}

/** Update customer by id */
export async function updateCustomer(
  id: string,
  payload: Partial<CustomerPayload>
): Promise<CustomerRow> {
  const companyId = await requireActiveCompanyId();

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

  const { data, error } = await supabase
    .from("customers")
    .update(update)
    .eq("id", id)
    .eq("company_id", companyId)
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
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("customers")
    .update({ is_active: active })
    .eq("id", id)
    .eq("company_id", companyId)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Customer not found or not accessible");
  return mapRow(data);
}

/** Customers per month for chart (current year, uses created_at) */
export type CustomersByMonth = {
  month: string;
  label: string;
  count: number;
};

export async function getCustomersByMonth(
  year?: number
): Promise<CustomersByMonth[]> {
  const companyId = await requireActiveCompanyId();
  const y = year ?? new Date().getFullYear();
  const startDate = `${y}-01-01T00:00:00`;
  const endDate = `${y}-12-31T23:59:59`;
  const { data, error } = await supabase
    .from("customers")
    .select("created_at")
    .eq("company_id", companyId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) throw error;

  const byMonth = new Map<string, number>();
  for (let m = 1; m <= 12; m++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    byMonth.set(key, 0);
  }

  (data ?? []).forEach((r: { created_at?: string }) => {
    const d = r.created_at;
    if (!d) return;
    const date = new Date(d);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => {
      const [yr, m] = month.split("-");
      const date = new Date(parseInt(yr), parseInt(m) - 1, 1);
      const label = date.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      return { month, label, count };
    });
}

/** Customers per month for a date range (e.g. for reports) */
export async function getCustomersByMonthForRange(
  startDate: string,
  endDate: string
): Promise<CustomersByMonth[]> {
  const companyId = await requireActiveCompanyId();
  const start = `${startDate}T00:00:00`;
  const end = `${endDate}T23:59:59`;
  const { data, error } = await supabase
    .from("customers")
    .select("created_at")
    .eq("company_id", companyId)
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) throw error;

  const [startY, startM] = startDate.split("-").map(Number);
  const [endY, endM] = endDate.split("-").map(Number);
  const byMonth = new Map<string, number>();
  for (let y = startY; y <= endY; y++) {
    const mStart = y === startY ? startM : 1;
    const mEnd = y === endY ? endM : 12;
    for (let m = mStart; m <= mEnd; m++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      byMonth.set(key, 0);
    }
  }

  (data ?? []).forEach((r: { created_at?: string }) => {
    const d = r.created_at;
    if (!d) return;
    const date = new Date(d);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => {
      const [yr, m] = month.split("-");
      const date = new Date(parseInt(yr), parseInt(m) - 1, 1);
      const label = date.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      return { month, label, count };
    });
}

/** Delete by id */
export async function deleteCustomer(id: string): Promise<void> {
  const companyId = await requireActiveCompanyId();

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) throw error;
}

/** Delete many by id (scoped to the active company). */
export async function deleteCustomers(ids: string[]): Promise<void> {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (uniq.length === 0) return;
  const companyId = await requireActiveCompanyId();

  const { error } = await supabase
    .from("customers")
    .delete()
    .in("id", uniq)
    .eq("company_id", companyId);

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
