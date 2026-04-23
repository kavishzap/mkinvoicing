import { supabase } from "@/lib/supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";

export type ProductPayload = {
  name: string;
  sku?: string | null;
  description?: string | null;
  unit?: string;
  costPrice?: number;
  salePrice?: number;
  currency?: string;
  is_active?: boolean;
  imageBase64?: string | null;
  imageMimeType?: string | null;
};

export type ProductRow = {
  id: string;
  company_id: string;
  user_id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  currency: string;
  isActive: boolean;
  imageMimeType: string;
  /** Populated only from `getProduct`; omitted in list queries for payload size. */
  imageBase64: string | null;
  created_at: string;
  updated_at: string;
};

const BASE_COLUMNS =
  "id,company_id,user_id,sku,name,description,unit,cost_price,sale_price,currency,is_active,created_at,updated_at";

const LIST_COLUMNS = BASE_COLUMNS;

const FULL_COLUMNS = `${BASE_COLUMNS},image_mime_type,image_base64`;

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

async function requireCompanyId(): Promise<string> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No company found for this account. Complete company setup before managing products."
    );
  }
  return companyId;
}

export async function listProducts(opts?: {
  search?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: ProductRow[]; total: number }> {
  const companyId = await requireCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("products")
    .select(LIST_COLUMNS, { count: "exact" })
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
      [`name.ilike.${s}`, `sku.ilike.${s}`, `description.ilike.${s}`].join(",")
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map((r) => mapRow(r, false)),
    total: count ?? 0,
  };
}

export async function getProduct(id: string): Promise<ProductRow> {
  const companyId = await requireCompanyId();

  const { data, error } = await supabase
    .from("products")
    .select(FULL_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Product not found or not accessible");
  return mapRow(data, true);
}

export async function addProduct(payload: ProductPayload): Promise<ProductRow> {
  const userId = await getUserId();
  const companyId = await requireCompanyId();

  const img = normalizeImageFields(
    payload.imageBase64 ?? null,
    payload.imageMimeType ?? null
  );

  const insert = {
    company_id: companyId,
    user_id: userId,
    name: payload.name.trim(),
    sku: payload.sku?.trim() || null,
    description: payload.description?.trim() || null,
    unit: (payload.unit ?? "ea").trim() || "ea",
    cost_price: payload.costPrice ?? 0,
    sale_price: payload.salePrice ?? 0,
    currency: (payload.currency ?? "MUR").trim() || "MUR",
    is_active: payload.is_active ?? true,
    image_base64: img.base64,
    image_mime_type: img.mime,
  };

  const { data, error } = await supabase
    .from("products")
    .insert(insert)
    .select(FULL_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data, true);
}

export async function addProductsBulk(
  payloads: ProductPayload[]
): Promise<{ inserted: number }> {
  if (payloads.length === 0) return { inserted: 0 };
  const userId = await getUserId();
  const companyId = await requireCompanyId();

  const rows = payloads.map((payload) => {
    const img = normalizeImageFields(
      payload.imageBase64 ?? null,
      payload.imageMimeType ?? null
    );
    return {
      company_id: companyId,
      user_id: userId,
      name: payload.name.trim(),
      sku: payload.sku?.trim() || null,
      description: payload.description?.trim() || null,
      unit: (payload.unit ?? "pcs").trim() || "pcs",
      cost_price: payload.costPrice ?? 0,
      sale_price: payload.salePrice ?? 0,
      currency: (payload.currency ?? "MUR").trim() || "MUR",
      is_active: payload.is_active ?? true,
      image_base64: img.base64,
      image_mime_type: img.mime,
    };
  });

  const { error } = await supabase.from("products").insert(rows);
  if (error) throw error;
  return { inserted: rows.length };
}

export async function updateProduct(
  id: string,
  payload: Partial<ProductPayload>
): Promise<ProductRow> {
  const companyId = await requireCompanyId();

  const update: Record<string, unknown> = {};
  if ("name" in payload && payload.name !== undefined)
    update.name = payload.name.trim();
  if ("sku" in payload) update.sku = payload.sku?.trim() || null;
  if ("description" in payload)
    update.description = payload.description?.trim() || null;
  if ("unit" in payload && payload.unit !== undefined)
    update.unit = payload.unit.trim() || "ea";
  if ("costPrice" in payload) update.cost_price = payload.costPrice ?? 0;
  if ("salePrice" in payload) update.sale_price = payload.salePrice ?? 0;
  if ("currency" in payload && payload.currency !== undefined)
    update.currency = payload.currency.trim() || "MUR";
  if ("is_active" in payload) update.is_active = payload.is_active;

  if ("imageBase64" in payload || "imageMimeType" in payload) {
    const img = normalizeImageFields(
      payload.imageBase64 ?? null,
      payload.imageMimeType ?? null
    );
    update.image_base64 = img.base64;
    update.image_mime_type = img.mime;
  }

  const { data, error } = await supabase
    .from("products")
    .update(update)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(FULL_COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Product not found or not accessible");
  return mapRow(data, true);
}

export async function setProductActive(
  id: string,
  active: boolean
): Promise<ProductRow> {
  const companyId = await requireCompanyId();

  const { data, error } = await supabase
    .from("products")
    .update({ is_active: active })
    .eq("id", id)
    .eq("company_id", companyId)
    .select(LIST_COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Product not found or not accessible");
  return mapRow(data, false);
}

export async function deleteProduct(id: string): Promise<void> {
  const companyId = await requireCompanyId();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) throw error;
}

function normalizeImageFields(
  base64: string | null,
  mime: string | null
): { base64: string | null; mime: string | null } {
  if (!base64 || !String(base64).trim()) {
    return { base64: null, mime: null };
  }
  const cleaned = stripDataUrlPrefix(String(base64).trim());
  const m = mime?.trim() || null;
  if (!m) {
    throw new Error("Image MIME type is required when uploading an image.");
  }
  return { base64: cleaned, mime: m };
}

/** Accepts raw base64 or a full data URL; returns payload-only base64. */
export function stripDataUrlPrefix(input: string): string {
  const t = input.trim();
  const m = t.match(/^data:([^;]+);base64,(.+)$/s);
  if (m) return m[2].replace(/\s/g, "");
  return t.replace(/\s/g, "");
}

function mapRow(r: Record<string, unknown>, includeImage: boolean): ProductRow {
  return {
    id: String(r.id),
    company_id: String(r.company_id ?? ""),
    user_id: String(r.user_id ?? ""),
    sku: String(r.sku ?? ""),
    name: String(r.name ?? ""),
    description: String(r.description ?? ""),
    unit: String(r.unit ?? "ea"),
    costPrice: Number(r.cost_price ?? 0),
    salePrice: Number(r.sale_price ?? 0),
    currency: String(r.currency ?? "MUR"),
    isActive: !!r.is_active,
    imageMimeType: String(r.image_mime_type ?? ""),
    imageBase64: includeImage
      ? r.image_base64 != null
        ? String(r.image_base64)
        : null
      : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}
