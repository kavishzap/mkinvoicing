import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

const FACET_TTL_MS = 45_000;
const LIST_TTL_MS = 45_000;
const DETAIL_TTL_MS = 45_000;

type CustomerFacetCacheEntry = {
  companyId: string;
  expires: number;
  facets: CustomerListFacets;
};

type CustomerListCacheEntry = {
  key: string;
  expires: number;
  rows: CustomerRow[];
  total: number;
};

type CustomerDetailCacheEntry = {
  companyId: string;
  expires: number;
  row: CustomerRow;
};

let facetCache: CustomerFacetCacheEntry | null = null;
const listCache = new Map<string, CustomerListCacheEntry>();
const detailCache = new Map<string, CustomerDetailCacheEntry>();

function customerListCacheKey(
  companyId: string,
  opts?: {
    search?: string;
    statusFilter?: CustomerStatusFilter;
    type?: "company" | "individual";
    page?: number;
    pageSize?: number;
  },
) {
  return [
    companyId,
    opts?.search ?? "",
    opts?.statusFilter ?? "active",
    opts?.type ?? "",
    opts?.page ?? 1,
    opts?.pageSize ?? 10,
  ].join("|");
}

export function getCachedCustomerListFacets(
  companyId: string,
): CustomerListFacets | null {
  if (!facetCache || facetCache.companyId !== companyId) return null;
  if (facetCache.expires <= Date.now()) return null;
  return facetCache.facets;
}

export function getCachedCustomerList(
  companyId: string,
  opts?: Parameters<typeof customerListCacheKey>[1],
): { rows: CustomerRow[]; total: number } | null {
  const hit = listCache.get(customerListCacheKey(companyId, opts));
  if (!hit || hit.expires <= Date.now()) return null;
  return { rows: hit.rows, total: hit.total };
}

export function getCachedCustomer(
  companyId: string,
  id: string,
): CustomerRow | null {
  const hit = detailCache.get(`${companyId}|${id}`);
  if (!hit || hit.companyId !== companyId) return null;
  if (hit.expires <= Date.now()) return null;
  return hit.row;
}

export function invalidateCustomerCaches() {
  facetCache = null;
  listCache.clear();
  detailCache.clear();
}

export type CustomerPayload = {
  type: "company" | "individual";
  companyName?: string;
  contactName?: string;
  fullName?: string;
  /** Empty / omitted is stored as null when the DB allows it. */
  email?: string;
  phone?: string;
  phone_2?: string;
  map_location?: string;
  street?: string;
  city?: string;
  postal?: string;
  country?: string;
  isActive?: boolean;
  cityId?: string | null;
  address_line_1?: string;
  address_line_2?: string;
};

export type CustomerRow = CustomerPayload & {
  id: string;
  cityName?: string;
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
  "id,type,company_name,contact_name,full_name,email,phone,phone_2,map_location,city,city_id,cities(name),address_line_1,address_line_2,is_active,created_at,updated_at";

/** Slim select for pickers (no city join). */
const CUSTOMER_PICKER_COLUMNS =
  "id,type,company_name,contact_name,full_name,email,phone,is_active,created_at,updated_at";

export type CustomerStatusFilter = "all" | "active" | "inactive";

export type CustomerListFacets = {
  companyTotal: number;
  activeCount: number;
  inactiveCount: number;
  companyTypeCount: number;
  individualTypeCount: number;
};

/** Facet counts for the active company (not filtered by search or list filters). */
export async function fetchCustomerListFacets(): Promise<CustomerListFacets> {
  const companyId = await requireActiveCompanyId();
  const scoped = () =>
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);

  const [
    { count: total },
    { count: active },
    { count: companyType },
    { count: individualType },
  ] = await Promise.all([
    scoped(),
    scoped().eq("is_active", true),
    scoped().eq("type", "company"),
    scoped().eq("type", "individual"),
  ]);

  const t = total ?? 0;
  const a = active ?? 0;
  const facets: CustomerListFacets = {
    companyTotal: t,
    activeCount: a,
    inactiveCount: Math.max(0, t - a),
    companyTypeCount: companyType ?? 0,
    individualTypeCount: individualType ?? 0,
  };

  facetCache = {
    companyId,
    expires: Date.now() + FACET_TTL_MS,
    facets,
  };

  return facets;
}

/**
 * Paged list with optional search, status, and type.
 * Returns { rows, total }.
 */
export async function listCustomers(opts?: {
  search?: string;
  /** When true, include active and inactive rows (same as `statusFilter: "all"`). */
  includeInactive?: boolean;
  /** Overrides `includeInactive` when set. */
  statusFilter?: CustomerStatusFilter;
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

  const statusFilter: CustomerStatusFilter =
    opts?.statusFilter ??
    (opts?.includeInactive ? "all" : "active");

  let q = supabase
    .from("customers")
    .select(COLUMNS, { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter === "active") {
    q = q.eq("is_active", true);
  } else if (statusFilter === "inactive") {
    q = q.eq("is_active", false);
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
        `contact_name.ilike.${s}`,
        `full_name.ilike.${s}`,
        `email.ilike.${s}`,
        `phone.ilike.${s}`,
      ].join(",")
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;

  const rows = (data ?? []).map(mapRow);
  const total = count ?? 0;
  const cacheKey = customerListCacheKey(companyId, {
    search: opts?.search,
    statusFilter,
    type: opts?.type,
    page: opts?.page,
    pageSize: opts?.pageSize,
  });
  listCache.set(cacheKey, {
    key: cacheKey,
    expires: Date.now() + LIST_TTL_MS,
    rows,
    total,
  });

  return { rows, total };
}

/**
 * Fetch every customer row matching the same filters as `listCustomers`, without pagination.
 * Used for CSV / Print exports. Internally pages through Supabase in batches of 1000.
 */
export async function listAllCustomersForExport(opts?: {
  search?: string;
  statusFilter?: CustomerStatusFilter;
  type?: "company" | "individual";
}): Promise<CustomerRow[]> {
  const companyId = await requireActiveCompanyId();
  const statusFilter: CustomerStatusFilter = opts?.statusFilter ?? "active";

  const BATCH = 1000;
  let from = 0;
  const out: CustomerRow[] = [];
  for (;;) {
    let q = supabase
      .from("customers")
      .select(COLUMNS)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(from, from + BATCH - 1);

    if (statusFilter === "active") {
      q = q.eq("is_active", true);
    } else if (statusFilter === "inactive") {
      q = q.eq("is_active", false);
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
          `phone.ilike.${s}`,
        ].join(","),
      );
    }

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []).map(mapRow);
    out.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }
  return out;
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
  const row = mapRow(data);
  detailCache.set(`${companyId}|${id}`, {
    companyId,
    expires: Date.now() + DETAIL_TTL_MS,
    row,
  });
  return row;
}

/**
 * Active customers for the current user's company (for WhatsApp groups, etc.).
 * Returns up to 500 rows; empty if no company context.
 * Use `columns: "picker"` for a faster payload (no city join / address fields).
 */
export async function listCustomersForCompany(opts?: {
  search?: string;
  columns?: "full" | "picker";
}): Promise<CustomerRow[]> {
  const companyId = await requireActiveCompanyId();
  const cols = opts?.columns === "picker" ? CUSTOMER_PICKER_COLUMNS : COLUMNS;

  let q = supabase
    .from("customers")
    .select(cols)
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
        `contact_name.ilike.${s}`,
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
    email: payload.email?.trim()
      ? payload.email.trim().toLowerCase()
      : null,
    phone: payload.phone || null,
    phone_2: payload.phone_2?.trim() || null,
    map_location: payload.map_location?.trim() || null,
    street: payload.street || null,
    city: payload.city || null,
    city_id: payload.cityId ?? null,
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
  invalidateCustomerCaches();
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
    email: payload.email?.trim()
      ? payload.email.trim().toLowerCase()
      : null,
    phone: payload.phone || null,
    phone_2: payload.phone_2?.trim() || null,
    map_location: payload.map_location?.trim() || null,
    street: payload.street || null,
    city: payload.city || null,
    city_id: payload.cityId ?? null,
    postal: payload.postal || null,
    country: payload.country || null,
    address_line_1: payload.address_line_1 || null,
    address_line_2: payload.address_line_2 || null,
    is_active: payload.isActive ?? true,
  }));

  const { error } = await supabase.from("customers").insert(rows);
  if (error) throw error;
  invalidateCustomerCaches();
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
    update.email = payload.email?.trim()
      ? payload.email.trim().toLowerCase()
      : null;
  if ("phone" in payload) update.phone = payload.phone ?? null;
  if ("phone_2" in payload) update.phone_2 = payload.phone_2?.trim() || null;
  if ("map_location" in payload)
    update.map_location = payload.map_location?.trim() || null;
  if ("street" in payload) update.street = payload.street ?? null;
  if ("city" in payload) update.city = payload.city ?? null;
  if ("cityId" in payload) update.city_id = payload.cityId ?? null;
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
  invalidateCustomerCaches();
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
  invalidateCustomerCaches();
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
  invalidateCustomerCaches();
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
  invalidateCustomerCaches();
}

function mapRow(r: any): CustomerRow {
  const cityRel = Array.isArray(r.cities) ? r.cities[0] : r.cities;
  const cityName = cityRel?.name ? String(cityRel.name) : "";
  return {
    id: r.id,
    type: r.type,
    companyName: r.company_name ?? "",
    contactName: r.contact_name ?? "",
    fullName: r.full_name ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    phone_2: r.phone_2 ?? "",
    map_location: r.map_location ?? "",
    street: r.street ?? "",
    city: r.city ?? "",
    cityId: r.city_id ?? null,
    cityName,
    postal: r.postal ?? "",
    country: r.country ?? "",
    address_line_1: r.address_line_1 ?? "",
    address_line_2: r.address_line_2 ?? "",
    isActive: !!r.is_active,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
