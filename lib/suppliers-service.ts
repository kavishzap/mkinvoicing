import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type SupplierPayload = {
  type: "company" | "individual";
  companyName?: string;
  contactName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  postal?: string;
  country?: string;
  address_line_1?: string;
  address_line_2?: string;
  supplierCode?: string;
  vatNumber?: string;
  registrationId?: string;
  notes?: string;
  isActive?: boolean;
};

export type SupplierRow = SupplierPayload & {
  id: string;
  created_at: string;
  updated_at: string;
};

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

const COLUMNS =
  "id,type,company_name,contact_name,full_name,email,phone,street,city,postal,country,address_line_1,address_line_2,supplier_code,vat_number,registration_id,notes,is_active,created_at,updated_at";

function mapRow(r: Record<string, unknown>): SupplierRow {
  return {
    id: r.id as string,
    type: r.type as "company" | "individual",
    companyName: (r.company_name as string) ?? "",
    contactName: (r.contact_name as string) ?? "",
    fullName: (r.full_name as string) ?? "",
    email: (r.email as string) ?? "",
    phone: (r.phone as string) ?? "",
    street: (r.street as string) ?? "",
    city: (r.city as string) ?? "",
    postal: (r.postal as string) ?? "",
    country: (r.country as string) ?? "",
    address_line_1: (r.address_line_1 as string) ?? "",
    address_line_2: (r.address_line_2 as string) ?? "",
    supplierCode: (r.supplier_code as string) ?? "",
    vatNumber: (r.vat_number as string) ?? "",
    registrationId: (r.registration_id as string) ?? "",
    notes: (r.notes as string) ?? "",
    isActive: !!r.is_active,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function payloadToInsert(
  userId: string,
  companyId: string,
  payload: SupplierPayload
): Record<string, unknown> {
  return {
    user_id: userId,
    company_id: companyId,
    type: payload.type,
    company_name: payload.companyName ?? null,
    contact_name: payload.contactName ?? null,
    full_name: payload.fullName ?? null,
    email: payload.email?.trim() ? payload.email.trim().toLowerCase() : null,
    phone: payload.phone ?? null,
    street: payload.street ?? null,
    city: payload.city ?? null,
    postal: payload.postal ?? null,
    country: payload.country ?? null,
    address_line_1: payload.address_line_1 ?? null,
    address_line_2: payload.address_line_2 ?? null,
    supplier_code: payload.supplierCode?.trim() || null,
    vat_number: payload.vatNumber?.trim() || null,
    registration_id: payload.registrationId?.trim() || null,
    notes: payload.notes?.trim() || null,
    is_active: payload.isActive ?? true,
  };
}

export async function listSuppliers(opts?: {
  search?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: SupplierRow[]; total: number }> {
  const companyId = await requireActiveCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("suppliers")
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
      [
        `company_name.ilike.${s}`,
        `full_name.ilike.${s}`,
        `email.ilike.${s}`,
        `supplier_code.ilike.${s}`,
      ].join(",")
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function addSupplier(
  payload: SupplierPayload
): Promise<SupplierRow> {
  const [userId, companyId] = await Promise.all([
    getUserId(),
    requireActiveCompanyId(),
  ]);
  const insert = payloadToInsert(userId, companyId, payload);

  const { data, error } = await supabase
    .from("suppliers")
    .insert(insert)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

/** Single supplier by id (RLS ensures only your rows). */
export async function getSupplier(id: string): Promise<SupplierRow | null> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("suppliers")
    .select(COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function updateSupplier(
  id: string,
  payload: Partial<SupplierPayload>
): Promise<SupplierRow> {
  const companyId = await requireActiveCompanyId();

  const update: Record<string, unknown> = {};
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
  if ("street" in payload) update.street = payload.street ?? null;
  if ("city" in payload) update.city = payload.city ?? null;
  if ("postal" in payload) update.postal = payload.postal ?? null;
  if ("country" in payload) update.country = payload.country ?? null;
  if ("address_line_1" in payload)
    update.address_line_1 = payload.address_line_1 ?? null;
  if ("address_line_2" in payload)
    update.address_line_2 = payload.address_line_2 ?? null;
  if ("supplierCode" in payload)
    update.supplier_code = payload.supplierCode?.trim() || null;
  if ("vatNumber" in payload)
    update.vat_number = payload.vatNumber?.trim() || null;
  if ("registrationId" in payload)
    update.registration_id = payload.registrationId?.trim() || null;
  if ("notes" in payload) update.notes = payload.notes?.trim() || null;
  if ("isActive" in payload) update.is_active = payload.isActive;

  const { data, error } = await supabase
    .from("suppliers")
    .update(update)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Supplier not found or not accessible");
  return mapRow(data as Record<string, unknown>);
}

export async function setSupplierActive(
  id: string,
  active: boolean
): Promise<SupplierRow> {
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("suppliers")
    .update({ is_active: active })
    .eq("id", id)
    .eq("company_id", companyId)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Supplier not found or not accessible");
  return mapRow(data as Record<string, unknown>);
}
