import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type SalesOrderPivotFilters = {
  startDate: string;
  endDate: string;
};

export type SalesOrderPivotRow = {
  product: string;
  totalQty: number;
  totalAmount: number;
};

export type SalesOrderPivotData = {
  currency: string;
  orderCount: number;
  startDate: string;
  endDate: string;
  rows: SalesOrderPivotRow[];
  grandTotalQty: number;
  grandTotalAmount: number;
};

type PivotItemRow = {
  item: string | null;
  quantity: number | null;
  unit_price: number | null;
};

export async function getSalesOrderPivotData(
  filters: SalesOrderPivotFilters,
): Promise<SalesOrderPivotData> {
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      `
      id, currency,
      sales_order_items ( item, quantity, unit_price )
    `,
    )
    .eq("company_id", companyId)
    .neq("status", "expired")
    .gte("issue_date", filters.startDate)
    .lte("issue_date", filters.endDate);

  if (error) throw error;

  const productMap = new Map<string, { totalQty: number; totalAmount: number }>();
  let currency = "MUR";
  const orderCount = (data ?? []).length;

  for (const order of data ?? []) {
    currency = (order.currency as string) || currency;
    const items = (order.sales_order_items ?? []) as PivotItemRow[];
    for (const it of items) {
      const product = (it.item ?? "").trim() || "Unknown";
      const qty = Number(it.quantity ?? 0);
      const unitPrice = Number(it.unit_price ?? 0);
      const lineAmount = qty * unitPrice;

      const existing = productMap.get(product);
      if (existing) {
        existing.totalQty += qty;
        existing.totalAmount += lineAmount;
      } else {
        productMap.set(product, { totalQty: qty, totalAmount: lineAmount });
      }
    }
  }

  const rows: SalesOrderPivotRow[] = Array.from(productMap.entries())
    .map(([product, v]) => ({
      product,
      totalQty: v.totalQty,
      totalAmount: v.totalAmount,
    }))
    .sort((a, b) => a.product.localeCompare(b.product));

  const grandTotalQty = rows.reduce((s, r) => s + r.totalQty, 0);
  const grandTotalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);

  return {
    currency,
    orderCount,
    startDate: filters.startDate,
    endDate: filters.endDate,
    rows,
    grandTotalQty,
    grandTotalAmount,
  };
}
