import { supabase } from "@/lib/supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";

export type StockBalanceRow = {
  company_id: string;
  location_id: string;
  location_name: string;
  location_code: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  balance_updated_at: string;
};

export type InventoryMovementRow = {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  event_type: "transfer" | "refill" | "adjustment_out";
  from_location_id: string | null;
  to_location_id: string | null;
  from_label: string;
  to_label: string;
  quantity: number;
  note: string;
  created_at: string;
};

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

function mapBalance(r: Record<string, unknown>): StockBalanceRow {
  return {
    company_id: String(r.company_id ?? ""),
    location_id: String(r.location_id ?? ""),
    location_name: String(r.location_name ?? ""),
    location_code: String(r.location_code ?? ""),
    product_id: String(r.product_id ?? ""),
    product_name: String(r.product_name ?? ""),
    product_sku: String(r.product_sku ?? ""),
    quantity: Number(r.quantity ?? 0),
    balance_updated_at: String(r.balance_updated_at ?? ""),
  };
}

export async function listStockBalances(opts?: {
  search?: string;
  locationId?: string;
  productId?: string;
  includeZero?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: StockBalanceRow[]; total: number }> {
  const companyId = await requireCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 20);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("inventory_stock_by_location")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("location_name", { ascending: true })
    .order("product_name", { ascending: true })
    .range(from, to);

  if (opts?.locationId) {
    q = q.eq("location_id", opts.locationId);
  }
  if (opts?.productId) {
    q = q.eq("product_id", opts.productId);
  }
  if (!opts?.includeZero) {
    q = q.gt("quantity", 0);
  }

  const term = opts?.search?.trim();
  if (term) {
    const s = `%${term}%`;
    q = q.or(
      [
        `product_name.ilike.${s}`,
        `product_sku.ilike.${s}`,
        `location_name.ilike.${s}`,
      ].join(",")
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map((r) => mapBalance(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

/** All positive balances for one product (for transfer / adjust “from” pickers). */
export async function listStockBalancesForProduct(
  productId: string
): Promise<StockBalanceRow[]> {
  const companyId = await requireCompanyId();
  const { data, error } = await supabase
    .from("inventory_stock_by_location")
    .select("*")
    .eq("company_id", companyId)
    .eq("product_id", productId)
    .gt("quantity", 0)
    .order("location_name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => mapBalance(r as Record<string, unknown>));
}

async function fetchProductNames(
  companyId: string,
  ids: string[]
): Promise<Map<string, { name: string; sku: string }>> {
  const map = new Map<string, { name: string; sku: string }>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("products")
    .select("id,name,sku")
    .eq("company_id", companyId)
    .in("id", ids);
  if (error) throw error;
  for (const row of data ?? []) {
    map.set(String(row.id), {
      name: String(row.name ?? ""),
      sku: String(row.sku ?? ""),
    });
  }
  return map;
}

async function fetchLocationLabels(
  companyId: string,
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("locations")
    .select("id,name,code")
    .eq("company_id", companyId)
    .in("id", ids);
  if (error) throw error;
  for (const row of data ?? []) {
    const code = row.code ? String(row.code) : "";
    const label = code
      ? `${String(row.name ?? "")} (${code})`
      : String(row.name ?? "");
    map.set(String(row.id), label);
  }
  return map;
}

export async function listInventoryMovements(opts?: {
  page?: number;
  pageSize?: number;
}): Promise<{ rows: InventoryMovementRow[]; total: number }> {
  const companyId = await requireCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 15);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("inventory_movements")
    .select(
      "id, user_id, product_id, event_type, from_location_id, to_location_id, quantity, note, created_at",
      { count: "exact" }
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const rowsRaw = data ?? [];
  const productIds = [...new Set(rowsRaw.map((r) => r.product_id as string))];
  const locIds = new Set<string>();
  for (const r of rowsRaw) {
    if (r.from_location_id) locIds.add(r.from_location_id as string);
    if (r.to_location_id) locIds.add(r.to_location_id as string);
  }

  const [products, locs] = await Promise.all([
    fetchProductNames(companyId, productIds),
    fetchLocationLabels(companyId, [...locIds]),
  ]);

  const rows: InventoryMovementRow[] = rowsRaw.map((r) => {
    const pid = String(r.product_id);
    const p = products.get(pid);
    const fromId = r.from_location_id as string | null;
    const toId = r.to_location_id as string | null;
    return {
      id: String(r.id),
      user_id: String(r.user_id ?? ""),
      product_id: pid,
      product_name: p?.name ?? "—",
      product_sku: p?.sku ?? "",
      event_type: r.event_type as InventoryMovementRow["event_type"],
      from_location_id: fromId,
      to_location_id: toId,
      from_label: fromId ? (locs.get(fromId) ?? fromId) : "—",
      to_label: toId ? (locs.get(toId) ?? toId) : "—",
      quantity: Number(r.quantity ?? 0),
      note: String(r.note ?? ""),
      created_at: String(r.created_at ?? ""),
    };
  });

  return { rows, total: count ?? 0 };
}

export async function recordInventoryTransfer(params: {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  note?: string | null;
}): Promise<void> {
  const userId = await getUserId();
  const companyId = await requireCompanyId();

  const { error } = await supabase.from("inventory_movements").insert({
    company_id: companyId,
    user_id: userId,
    product_id: params.productId,
    event_type: "transfer",
    from_location_id: params.fromLocationId,
    to_location_id: params.toLocationId,
    quantity: params.quantity,
    note: params.note?.trim() || null,
  });

  if (error) throw error;
}

export async function recordInventoryRefill(params: {
  productId: string;
  toLocationId: string;
  quantity: number;
  note?: string | null;
}): Promise<void> {
  const userId = await getUserId();
  const companyId = await requireCompanyId();

  const { error } = await supabase.from("inventory_movements").insert({
    company_id: companyId,
    user_id: userId,
    product_id: params.productId,
    event_type: "refill",
    from_location_id: null,
    to_location_id: params.toLocationId,
    quantity: params.quantity,
    note: params.note?.trim() || null,
  });

  if (error) throw error;
}

export async function recordInventoryAdjustmentOut(params: {
  productId: string;
  fromLocationId: string;
  quantity: number;
  note?: string | null;
}): Promise<void> {
  const userId = await getUserId();
  const companyId = await requireCompanyId();

  const { error } = await supabase.from("inventory_movements").insert({
    company_id: companyId,
    user_id: userId,
    product_id: params.productId,
    event_type: "adjustment_out",
    from_location_id: params.fromLocationId,
    to_location_id: null,
    quantity: params.quantity,
    note: params.note?.trim() || null,
  });

  if (error) throw error;
}
