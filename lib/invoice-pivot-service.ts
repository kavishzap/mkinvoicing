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

type PivotInvoiceRow = {
  id?: string;
  currency: string | null;
  invoice_items: PivotItemRow[] | null;
};

const FETCH_BATCH = 1000;

/** Skip RPC after a missing-function response until this timestamp. */
let rpcUnavailableUntil = 0;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isRpcMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("could not find the function") || msg.includes("get_invoice_pivot_data");
}

function aggregatePivotRows(invoices: PivotInvoiceRow[]): {
  currency: string;
  invoiceCount: number;
  rows: InvoicePivotRow[];
  grandTotalQty: number;
  grandTotalAmount: number;
} {
  const productMap = new Map<string, { totalQty: number; totalAmount: number }>();
  let currency = "MUR";

  for (const invoice of invoices) {
    currency = (invoice.currency as string) || currency;
    const items = invoice.invoice_items ?? [];
    for (const it of items) {
      const product = (it.item ?? "").trim() || "Unknown";
      const qty = num(it.quantity);
      const unitPrice = num(it.unit_price);
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
    invoiceCount: invoices.length,
    rows,
    grandTotalQty,
    grandTotalAmount,
  };
}

function parseRpcPivotData(
  raw: Record<string, unknown>,
  filters: InvoicePivotFilters,
): InvoicePivotData {
  const rows = Array.isArray(raw.rows)
    ? (raw.rows as Array<{ product?: unknown; totalQty?: unknown; totalAmount?: unknown }>)
        .map((row) => ({
          product: String(row.product ?? "Unknown"),
          totalQty: num(row.totalQty),
          totalAmount: num(row.totalAmount),
        }))
        .sort((a, b) => a.product.localeCompare(b.product))
    : [];

  const grandTotalQty = num(raw.grandTotalQty) || rows.reduce((s, r) => s + r.totalQty, 0);
  const grandTotalAmount =
    num(raw.grandTotalAmount) || rows.reduce((s, r) => s + r.totalAmount, 0);

  return {
    currency: String(raw.currency ?? "MUR") || "MUR",
    invoiceCount: num(raw.invoiceCount),
    startDate: filters.startDate,
    endDate: filters.endDate,
    rows,
    grandTotalQty,
    grandTotalAmount,
  };
}

async function fetchInvoicePivotViaRpc(
  companyId: string,
  filters: InvoicePivotFilters,
): Promise<InvoicePivotData | null> {
  if (Date.now() < rpcUnavailableUntil) return null;

  const { data, error } = await supabase.rpc("get_invoice_pivot_data", {
    p_company_id: companyId,
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
  });

  if (error) {
    if (isRpcMissingError(error)) {
      rpcUnavailableUntil = Date.now() + 24 * 60 * 60 * 1000;
    }
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  rpcUnavailableUntil = 0;
  return parseRpcPivotData(data as Record<string, unknown>, filters);
}

async function fetchAllInvoicesForPivot(
  companyId: string,
  filters: InvoicePivotFilters,
): Promise<PivotInvoiceRow[]> {
  const select = `
    id, currency,
    invoice_items ( item, quantity, unit_price )
  `;

  const fetchPage = (from: number, to: number, withCount: boolean) =>
    supabase
      .from("invoices")
      .select(select, withCount ? { count: "exact" } : undefined)
      .eq("company_id", companyId)
      .neq("status", "cancelled")
      .gte("issue_date", filters.startDate)
      .lte("issue_date", filters.endDate)
      .order("id", { ascending: true })
      .range(from, to);

  const first = await fetchPage(0, FETCH_BATCH - 1, true);
  if (first.error) throw first.error;

  const out = [...((first.data ?? []) as PivotInvoiceRow[])];
  const total = first.count ?? out.length;
  if (total <= out.length) return out;

  const pageCount = Math.ceil(total / FETCH_BATCH);
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => {
      const from = (index + 1) * FETCH_BATCH;
      return fetchPage(from, from + FETCH_BATCH - 1, false);
    }),
  );

  for (const page of rest) {
    if (page.error) throw page.error;
    out.push(...((page.data ?? []) as PivotInvoiceRow[]));
  }

  return out;
}

async function fetchInvoicePivotLegacy(
  companyId: string,
  filters: InvoicePivotFilters,
): Promise<InvoicePivotData> {
  const invoices = await fetchAllInvoicesForPivot(companyId, filters);
  const aggregated = aggregatePivotRows(invoices);
  return {
    ...aggregated,
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
}

/** Call after deploying `get_invoice_pivot_data` so the next load retries the RPC. */
export function resetInvoicePivotRpcAvailability(): void {
  rpcUnavailableUntil = 0;
}

export async function getInvoicePivotData(
  filters: InvoicePivotFilters,
): Promise<InvoicePivotData> {
  const companyId = await requireActiveCompanyId();

  const rpcData = await fetchInvoicePivotViaRpc(companyId, filters);
  if (rpcData) return rpcData;

  return fetchInvoicePivotLegacy(companyId, filters);
}
