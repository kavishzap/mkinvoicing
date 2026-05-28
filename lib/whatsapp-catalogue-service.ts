import { supabase } from "@/lib/supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";
import { stripDataUrlPrefix } from "@/lib/products-service";

export type CataloguePostPayload = {
  description: string;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export type WhatsAppListStatus = "all" | "active" | "inactive";

export type WhatsAppListFacets = {
  companyTotal: number;
  activeCount: number;
  inactiveCount: number;
};

export async function fetchWhatsAppCatalogueListFacets(): Promise<WhatsAppListFacets> {
  const companyId = await requireCompanyId();
  const base = () =>
    supabase
      .from("whatsapp_catalogue_posts")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

  const [r0, r1, r2] = await Promise.all([
    base(),
    base().eq("is_active", true),
    base().eq("is_active", false),
  ]);

  if (r0.error) throw new Error(r0.error.message);
  if (r1.error) throw new Error(r1.error.message);
  if (r2.error) throw new Error(r2.error.message);

  return {
    companyTotal: r0.count ?? 0,
    activeCount: r1.count ?? 0,
    inactiveCount: r2.count ?? 0,
  };
}

function resolveCatalogueListStatus(opts?: {
  status?: WhatsAppListStatus;
  includeInactive?: boolean;
}): WhatsAppListStatus {
  if (opts?.status) return opts.status;
  return opts?.includeInactive ? "all" : "active";
}

export type CataloguePostRow = {
  id: string;
  company_id: string;
  user_id: string;
  description: string;
  imageBase64: string | null;
  imageMimeType: string;
  sort_order: number;
  isActive: boolean;
  created_at: string;
  updated_at: string;
};

const LIST_COLUMNS =
  "id,company_id,user_id,description,sort_order,is_active,image_mime_type,created_at,updated_at";
const FULL_COLUMNS = `${LIST_COLUMNS},image_base64`;

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

async function requireCompanyId(): Promise<string> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No company found for this account. Complete company setup first."
    );
  }
  return companyId;
}

function normalizeImage(
  base64: string | null | undefined,
  mime: string | null | undefined
): { base64: string | null; mime: string | null } {
  if (!base64?.trim()) return { base64: null, mime: null };
  const b = stripDataUrlPrefix(base64.trim());
  const m = mime?.trim();
  if (!m) throw new Error("Image MIME type is required when uploading an image.");
  return { base64: b, mime: m };
}

function mapRow(r: Record<string, unknown>, includeImage: boolean): CataloguePostRow {
  return {
    id: String(r.id),
    company_id: String(r.company_id ?? ""),
    user_id: String(r.user_id ?? ""),
    description: String(r.description ?? ""),
    imageMimeType: String(r.image_mime_type ?? ""),
    imageBase64: includeImage && r.image_base64 != null ? String(r.image_base64) : null,
    sort_order: Number(r.sort_order ?? 0),
    isActive: !!r.is_active,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function listCataloguePosts(opts?: {
  search?: string;
  status?: WhatsAppListStatus;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: CataloguePostRow[]; total: number }> {
  const companyId = await requireCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const status = resolveCatalogueListStatus(opts);

  let q = supabase
    .from("whatsapp_catalogue_posts")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status === "active") q = q.eq("is_active", true);
  else if (status === "inactive") q = q.eq("is_active", false);

  const term = opts?.search?.trim();
  if (term) {
    const s = `%${term}%`;
    q = q.ilike("description", s);
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>, false)),
    total: count ?? 0,
  };
}

export async function getCataloguePost(id: string): Promise<CataloguePostRow> {
  const companyId = await requireCompanyId();
  const { data, error } = await supabase
    .from("whatsapp_catalogue_posts")
    .select(FULL_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Post not found");
  return mapRow(data as Record<string, unknown>, true);
}

export async function addCataloguePost(
  payload: CataloguePostPayload
): Promise<CataloguePostRow> {
  const userId = await getUserId();
  const companyId = await requireCompanyId();
  const img = normalizeImage(payload.imageBase64 ?? null, payload.imageMimeType ?? null);

  const { data, error } = await supabase
    .from("whatsapp_catalogue_posts")
    .insert({
      company_id: companyId,
      user_id: userId,
      description: (payload.description ?? "").trim(),
      image_base64: img.base64,
      image_mime_type: img.mime,
      sort_order: payload.sort_order ?? 0,
      is_active: payload.is_active ?? true,
    })
    .select(FULL_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>, true);
}

export async function updateCataloguePost(
  id: string,
  payload: Partial<CataloguePostPayload>
): Promise<CataloguePostRow> {
  const companyId = await requireCompanyId();
  const patch: Record<string, unknown> = {};

  if (payload.description !== undefined) {
    patch.description = payload.description.trim();
  }
  if (payload.sort_order !== undefined) patch.sort_order = payload.sort_order;
  if (payload.is_active !== undefined) patch.is_active = payload.is_active;

  if ("imageBase64" in payload || "imageMimeType" in payload) {
    const img = normalizeImage(
      payload.imageBase64 ?? null,
      payload.imageMimeType ?? null
    );
    patch.image_base64 = img.base64;
    patch.image_mime_type = img.mime;
  }

  const { data, error } = await supabase
    .from("whatsapp_catalogue_posts")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(FULL_COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Post not found");
  return mapRow(data as Record<string, unknown>, true);
}

export async function deleteCataloguePost(id: string): Promise<void> {
  const companyId = await requireCompanyId();
  const { error } = await supabase
    .from("whatsapp_catalogue_posts")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) throw error;
}
