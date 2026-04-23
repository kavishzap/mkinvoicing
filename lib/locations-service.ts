import { supabase } from "@/lib/supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";

export type LocationPayload = {
  name: string;
  code?: string | null;
  description?: string | null;
  map_link?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postal?: string | null;
  country?: string | null;
  is_active?: boolean;
  is_default?: boolean;
};

export type LocationRow = {
  id: string;
  company_id: string;
  user_id: string;
  name: string;
  code: string;
  description: string;
  map_link: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postal: string;
  country: string;
  isActive: boolean;
  isDefault: boolean;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id,company_id,user_id,name,code,description,map_link,address_line_1,address_line_2,city,postal,country,is_active,is_default,created_at,updated_at";

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

async function requireCompanyId(): Promise<string> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No company found for this account. Complete company setup before managing locations."
    );
  }
  return companyId;
}

async function clearDefaultForCompany(companyId: string, exceptId?: string) {
  let q = supabase
    .from("locations")
    .update({ is_default: false })
    .eq("company_id", companyId)
    .eq("is_default", true);
  if (exceptId) q = q.neq("id", exceptId);
  const { error } = await q;
  if (error) throw error;
}

export async function listLocations(opts?: {
  search?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: LocationRow[]; total: number }> {
  const companyId = await requireCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("locations")
    .select(COLUMNS, { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!opts?.includeInactive) {
    q = q.eq("is_active", true);
  }

  const term = opts?.search?.trim();
  if (term) {
    const s = `%${term}%`;
    q = q.or(
      [`name.ilike.${s}`, `code.ilike.${s}`, `city.ilike.${s}`].join(",")
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map(mapRow),
    total: count ?? 0,
  };
}

export async function getLocation(id: string): Promise<LocationRow> {
  const companyId = await requireCompanyId();
  const { data, error } = await supabase
    .from("locations")
    .select(COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Location not found or not accessible");
  return mapRow(data);
}

export async function addLocation(
  payload: LocationPayload
): Promise<LocationRow> {
  const userId = await getUserId();
  const companyId = await requireCompanyId();

  if (payload.is_default) {
    await clearDefaultForCompany(companyId);
  }

  const insert = {
    company_id: companyId,
    user_id: userId,
    name: payload.name.trim(),
    code: payload.code?.trim() || null,
    description: payload.description?.trim() || null,
    map_link: payload.map_link?.trim() || null,
    address_line_1: payload.address_line_1?.trim() || null,
    address_line_2: payload.address_line_2?.trim() || null,
    city: payload.city?.trim() || null,
    postal: payload.postal?.trim() || null,
    country: payload.country?.trim() || null,
    is_active: payload.is_active ?? true,
    is_default: payload.is_default ?? false,
  };

  const { data, error } = await supabase
    .from("locations")
    .insert(insert)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function updateLocation(
  id: string,
  payload: Partial<LocationPayload>
): Promise<LocationRow> {
  const companyId = await requireCompanyId();

  if (payload.is_default === true) {
    await clearDefaultForCompany(companyId, id);
  }

  const update: Record<string, unknown> = {};
  if ("name" in payload && payload.name !== undefined)
    update.name = payload.name.trim();
  if ("code" in payload) update.code = payload.code?.trim() || null;
  if ("description" in payload)
    update.description = payload.description?.trim() || null;
  if ("map_link" in payload) update.map_link = payload.map_link?.trim() || null;
  if ("address_line_1" in payload)
    update.address_line_1 = payload.address_line_1?.trim() || null;
  if ("address_line_2" in payload)
    update.address_line_2 = payload.address_line_2?.trim() || null;
  if ("city" in payload) update.city = payload.city?.trim() || null;
  if ("postal" in payload) update.postal = payload.postal?.trim() || null;
  if ("country" in payload) update.country = payload.country?.trim() || null;
  if ("is_active" in payload) update.is_active = payload.is_active;
  if ("is_default" in payload) update.is_default = payload.is_default;

  const { data, error } = await supabase
    .from("locations")
    .update(update)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Location not found or not accessible");
  return mapRow(data);
}

export async function setLocationActive(
  id: string,
  active: boolean
): Promise<LocationRow> {
  const companyId = await requireCompanyId();

  const { data, error } = await supabase
    .from("locations")
    .update({ is_active: active })
    .eq("id", id)
    .eq("company_id", companyId)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Location not found or not accessible");
  return mapRow(data);
}

export async function deleteLocation(id: string): Promise<void> {
  const companyId = await requireCompanyId();

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) throw error;
}

export type LocationOption = { id: string; name: string; code: string };

/** Active locations for the current company (dropdowns, no pagination). */
export async function listActiveLocationsForSelect(): Promise<LocationOption[]> {
  const companyId = await requireCompanyId();
  const { data, error } = await supabase
    .from("locations")
    .select("id,name,code")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((r: { id: string; name: string; code: string | null }) => ({
    id: r.id,
    name: r.name ?? "",
    code: r.code ?? "",
  }));
}

function mapRow(r: Record<string, unknown>): LocationRow {
  return {
    id: String(r.id),
    company_id: String(r.company_id ?? ""),
    user_id: String(r.user_id ?? ""),
    name: String(r.name ?? ""),
    code: String(r.code ?? ""),
    description: String(r.description ?? ""),
    map_link: String(r.map_link ?? ""),
    address_line_1: String(r.address_line_1 ?? ""),
    address_line_2: String(r.address_line_2 ?? ""),
    city: String(r.city ?? ""),
    postal: String(r.postal ?? ""),
    country: String(r.country ?? ""),
    isActive: !!r.is_active,
    isDefault: !!r.is_default,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}
