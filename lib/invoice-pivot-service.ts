import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type InvoicePivotFilters = {
  startDate: string;
  endDate: string;
};

export type InvoicePivotRow = {
  product: string;
  totalQty: number;
  totalAmount: number;
};

export type InvoicePivotData = {
  currency: string;
  invoiceCount: number;
  startDate: string;
  endDate: string;
  rows: InvoicePivotRow[];
  grandTotalQty: number;
  grandTotalAmount: number;
};

type PivotItemRow = {
  item: string | null;
  quantity: number | null;
  unit_price: number | null;
};

export async function getInvoicePivotData(
  filters: InvoicePivotFilters,
): Promise<InvoicePivotData> {
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
      id, currency,
      invoice_items ( item, quantity, unit_price )
    `,
    )
    .eq("company_id", companyId)
    .neq("status", "cancelled")
    .gte("issue_date", filters.startDate)
    .lte("issue_date", filters.endDate);

  if (error) throw error;

  const productMap = new Map<string, { totalQty: number; totalAmount: number }>();
  let currency = "MUR";
  const invoiceCount = (data ?? []).length;

  for (const invoice of data ?? []) {
    currency = (invoice.currency as string) || currency;
    const items = (invoice.invoice_items ?? []) as PivotItemRow[];
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

  const rows: InvoicePivotRow[] = Array.from(productMap.entries())
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
    invoiceCount,
    startDate: filters.startDate,
    endDate: filters.endDate,
    rows,
    grandTotalQty,
    grandTotalAmount,
  };
}
