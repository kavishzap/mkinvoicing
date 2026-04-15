import { supabase } from "@/lib/supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";

export type ProductLocationStockLine = {
  id: string;
  location_id: string;
  quantity: number;
  locationName: string;
  locationCode: string;
};

async function requireCompanyId(): Promise<string> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No company found for this account. Complete company setup first."
    );
  }
  return companyId;
}

export async function listStocksByProduct(
  productId: string
): Promise<ProductLocationStockLine[]> {
  const companyId = await requireCompanyId();

  const { data: rows, error } = await supabase
    .from("product_location_stocks")
    .select("id, location_id, quantity")
    .eq("product_id", productId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const list = rows ?? [];
  const locIds = [...new Set(list.map((r) => r.location_id as string))];
  const nameById = new Map<string, { name: string; code: string }>();

  if (locIds.length > 0) {
    const { data: locs, error: locErr } = await supabase
      .from("locations")
      .select("id,name,code")
      .in("id", locIds)
      .eq("company_id", companyId);

    if (locErr) throw locErr;
    for (const loc of locs ?? []) {
      nameById.set(String(loc.id), {
        name: String(loc.name ?? ""),
        code: String(loc.code ?? ""),
      });
    }
  }

  return list.map((row) => {
    const meta = nameById.get(String(row.location_id));
    return {
      id: String(row.id),
      location_id: String(row.location_id ?? ""),
      quantity: Number(row.quantity ?? 0),
      locationName: meta?.name ?? "",
      locationCode: meta?.code ?? "",
    };
  });
}

/**
 * Replaces all stock rows for a product with the given lines (same location must not repeat).
 */
export async function replaceProductLocationStocks(
  productId: string,
  lines: { locationId: string; quantity: number }[]
): Promise<void> {
  const companyId = await requireCompanyId();

  const { error: delError } = await supabase
    .from("product_location_stocks")
    .delete()
    .eq("product_id", productId)
    .eq("company_id", companyId);

  if (delError) throw delError;

  if (lines.length === 0) return;

  const insertRows = lines.map((l) => ({
    company_id: companyId,
    product_id: productId,
    location_id: l.locationId,
    quantity: l.quantity,
  }));

  const { error: insError } = await supabase
    .from("product_location_stocks")
    .insert(insertRows);

  if (insError) throw insError;
}
