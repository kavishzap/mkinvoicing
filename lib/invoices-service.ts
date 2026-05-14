// lib/invoices-service.ts
import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import { ensureUserSettingsRow } from "@/lib/settings-service";

/* ------------------------------------------------------------------ *
 * In-memory caches (per browser tab) so navigating away and back to
 * the invoices list does not refire the 7 facet COUNT(*) queries and
 * the 1 list SELECT+COUNT each time. Entries are scoped by company
 * and invalidated on any mutation (create / cancel / mark paid / pay
 * update). UI content is unchanged: we always revalidate in the
 * background when the page mounts (stale-while-revalidate).
 * ------------------------------------------------------------------ */

const FACET_TTL_MS = 30_000;
const LIST_TTL_MS = 30_000;

type FacetCacheEntry = {
  companyId: string;
  expires: number;
  facets: InvoiceListFacets;
};

type ListCacheEntry = {
  key: string;
  expires: number;
  rows: InvoiceListRow[];
  total: number;
};

let facetCache: FacetCacheEntry | null = null;
const listCache = new Map<string, ListCacheEntry>();

function makeListCacheKey(
  companyId: string,
  opts: {
    search?: string;
    status?: InvoiceStatus | "all";
    period?: "all" | "month" | "quarter" | "year";
    customerId?: string;
    page?: number;
    pageSize?: number;
    sortBy?: SortByKey;
    sort?: SortDir;
  } | undefined,
) {
  return [
    companyId,
    opts?.search ?? "",
    opts?.status ?? "all",
    opts?.period ?? "all",
    opts?.customerId ?? "",
    opts?.page ?? 1,
    opts?.pageSize ?? 10,
    opts?.sortBy ?? "issueDate",
    opts?.sort ?? "desc",
  ].join("|");
}

/** Synchronous cache reads so the UI can render immediately while revalidating. */
export function getCachedInvoiceFacets(
  companyId: string,
): InvoiceListFacets | null {
  if (!facetCache) return null;
  if (facetCache.companyId !== companyId) return null;
  if (facetCache.expires <= Date.now()) return null;
  return facetCache.facets;
}

export function getCachedInvoiceList(
  companyId: string,
  opts?: Parameters<typeof makeListCacheKey>[1],
): { rows: InvoiceListRow[]; total: number } | null {
  const key = makeListCacheKey(companyId, opts);
  const hit = listCache.get(key);
  if (!hit || hit.expires <= Date.now()) return null;
  return { rows: hit.rows, total: hit.total };
}

/** Clears all invoice caches; call from any mutation that may change rows. */
export function invalidateInvoiceCaches() {
  facetCache = null;
  listCache.clear();
}

/* -------------------- Types -------------------- */

/** Allowed values for `invoices.payment_method` in the UI (create / update). */
export type InvoicePaymentMethod =
  | "Cash"
  | "Card Payment"
  | "Bank Transfer";

export type LineItemPayload = {
  item: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  /** Optional link to `public.products`; persisted after create if RPC omits it. */
  product_id?: string | null;
};

export type CreateInvoicePayload = {
  issue_date: string; // "YYYY-MM-DD"
  due_date: string; // "YYYY-MM-DD"
  status: "unpaid" | "paid" | "cancelled";
  currency: string; // e.g. "MUR"
  discount_type: "value" | "percent";
  discount_amount: number;
  shipping_amount?: number;
  notes?: string;
  terms?: string;
  payment_method?: InvoicePaymentMethod | null;
  amount_paid?: number;
  amount_due?: number;

  // Either link an existing customer or pass a client snapshot
  customer_id: string | null;
  client_snapshot: {
    type: "company" | "individual";
    company_name?: string | null;
    contact_name?: string | null;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    street?: string | null;
    city?: string | null;
    postal?: string | null;
    country?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
  } | null;

  /** When converting from quotation — pass quotation id */
  created_from_quotation_id?: string | null;
  /** When converting from sales order — pass sales order id */
  created_from_sales_order_id?: string | null;

  items: LineItemPayload[];
};

/** Set `company_id` on all lines for this invoice (same pattern as `sales_order_items`). */
async function ensureInvoiceItemsCompanyId(
  invoiceId: string,
  companyId: string
): Promise<void> {
  const { error } = await supabase
    .from("invoice_items")
    .update({ company_id: companyId })
    .eq("invoice_id", invoiceId);

  if (error) {
    console.warn("ensureInvoiceItemsCompanyId: update failed", error);
  }
}

/** Match inserted `invoice_items` rows to payload lines and set `product_id`. */
async function patchInvoiceItemsProductIds(
  invoiceId: string,
  companyId: string,
  items: LineItemPayload[]
): Promise<void> {
  if (!items.some((li) => li.product_id?.trim())) return;

  const { data: rows, error } = await supabase
    .from("invoice_items")
    .select("id, item, description, quantity, unit_price, tax_percent")
    .eq("invoice_id", invoiceId);

  if (error || !rows?.length) {
    console.warn("patchInvoiceItemsProductIds: could not load invoice_items", error);
    return;
  }

  const used = new Set<string>();
  const normDesc = (d: string | null | undefined) => (d ?? "").trim();
  const close = (a: number, b: number) =>
    Math.abs(Number(a) - Number(b)) < 0.01;

  for (const li of items) {
    const pid = li.product_id?.trim();
    if (!pid) continue;

    const match = rows.find(
      (r) =>
        !used.has(r.id) &&
        r.item === li.item &&
        normDesc(r.description) === normDesc(li.description) &&
        close(Number(r.quantity), Number(li.quantity)) &&
        close(Number(r.unit_price), Number(li.unit_price)) &&
        close(Number(r.tax_percent), Number(li.tax_percent))
    );

    if (!match) {
      console.warn("patchInvoiceItemsProductIds: no matching row for line", li.item);
      continue;
    }

    const { error: upErr } = await supabase
      .from("invoice_items")
      .update({ product_id: pid, company_id: companyId })
      .eq("id", match.id);

    if (upErr) {
      console.warn("patchInvoiceItemsProductIds: update failed", upErr);
    } else {
      used.add(match.id);
    }
  }
}

/* -------------------- Create -------------------- */

/**
 * Creates an invoice via RPC `create_invoice(p_invoice jsonb, p_items jsonb)`.
 * The DB will:
 *  - Atomically assign the next invoice number for the user
 *  - Insert items
 *  - Compute totals
 * Returns the created invoice id (uuid).
 */
export async function createInvoice(
  params: CreateInvoicePayload
): Promise<string> {
  const { items, ...inv } = params;
  const companyId = await requireActiveCompanyId();
  await ensureUserSettingsRow();

  // Never send `number` from client — server generates it.
  const { data, error } = await supabase.rpc("create_invoice", {
    p_invoice: {
      company_id: companyId,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      status: inv.status, // enum cast handled in function
      currency: inv.currency,
      discount_type: inv.discount_type,
      discount_amount: inv.discount_amount,
      shipping_amount: inv.shipping_amount ?? 0,
      notes: inv.notes ?? null,
      terms: inv.terms ?? null,
      payment_method: inv.payment_method ?? null,
      amount_paid: inv.amount_paid ?? 0,
      amount_due: inv.amount_due !== undefined && inv.amount_due !== null ? inv.amount_due : null, // Will be calculated if null
      customer_id: inv.customer_id,
      client_snapshot: inv.client_snapshot, // or null if using customer_id
    },
    p_items: items.map((li) => ({
      company_id: companyId,
      item: li.item,
      description: li.description ?? null,
      quantity: li.quantity,
      unit_price: li.unit_price,
      tax_percent: li.tax_percent,
      product_id: li.product_id ?? null,
    })),
  });

  if (error) throw error;

  // Function should return the uuid directly (text)
  // But if it ever returns an object, handle that too.
  let invoiceId: string;
  if (typeof data === "string") {
    invoiceId = data;
  } else if (data && typeof data === "object" && "invoice_id" in data) {
    invoiceId = (data as any).invoice_id as string;
  } else {
    throw new Error("Unexpected response from create_invoice RPC");
  }

  // Stamp invoices.company_id and fields the RPC may omit. Match by id only: new rows
  // often have company_id NULL until this update, so .eq("company_id", …) would match 0 rows.
  try {
    const updatePayload: {
      company_id: string;
      created_from_quotation_id?: string | null;
      created_from_sales_order_id?: string | null;
      payment_method?: InvoicePaymentMethod | null;
      amount_paid?: number;
      amount_due?: number | null;
    } = { company_id: companyId };

    if (inv.created_from_quotation_id !== undefined && inv.created_from_quotation_id !== null) {
      updatePayload.created_from_quotation_id = inv.created_from_quotation_id;
    }
    if (inv.created_from_sales_order_id !== undefined && inv.created_from_sales_order_id !== null) {
      updatePayload.created_from_sales_order_id = inv.created_from_sales_order_id;
    }
    if (inv.payment_method !== undefined) {
      updatePayload.payment_method = inv.payment_method ?? null;
    }
    if (inv.amount_paid !== undefined) {
      updatePayload.amount_paid = inv.amount_paid ?? 0;
    }
    if (inv.amount_due !== undefined) {
      updatePayload.amount_due = inv.amount_due !== null ? inv.amount_due : null;
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId);

    if (updateError) {
      console.warn("Failed to update invoice after creation:", updateError);
    }
  } catch (updateError) {
    console.warn("Failed to update invoice after creation:", updateError);
  }

  try {
    await ensureInvoiceItemsCompanyId(invoiceId, companyId);
    await patchInvoiceItemsProductIds(invoiceId, companyId, items);
  } catch (e) {
    console.warn("patchInvoiceItemsAfterCreate:", e);
  }

  invalidateInvoiceCaches();
  return invoiceId;
}

/* -------------------- List -------------------- */

export type InvoiceStatus = "unpaid" | "paid" | "cancelled";

export type InvoiceListRow = {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: string;
  clientName: string;
  total: number;
};

/** Same figure the list table showed when totals came from line items: subtotal + line taxes (no header discount). */
function listRowLineAndTaxTotal(subtotal: number, taxTotal: number): number {
  return Number(subtotal ?? 0) + Number(taxTotal ?? 0);
}

function nameFromBillTo(bill?: any) {
  if (!bill) return "";
  return bill.type === "company"
    ? bill.company_name ?? ""
    : bill.full_name ?? "";
}

type SortByKey = "issueDate" | "number" | "dueDate" | "created_at";
type SortDir = "asc" | "desc";

/** Counts for invoice directory sidebars (independent of current list filters). */
export type InvoiceListFacets = {
  companyTotal: number;
  unpaidCount: number;
  paidCount: number;
  cancelledCount: number;
  thisMonthCount: number;
  thisQuarterCount: number;
  thisYearCount: number;
};

function invoiceFacetPeriodStarts(): {
  month: string;
  quarter: string;
  year: string;
} {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const quarterStart = new Date(today);
  quarterStart.setMonth(today.getMonth() - 2);
  quarterStart.setDate(1);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  return {
    month: monthStart.toISOString().slice(0, 10),
    quarter: quarterStart.toISOString().slice(0, 10),
    year: yearStart.toISOString().slice(0, 10),
  };
}

/**
 * Parallel head counts for the invoice list filter sidebars.
 * Uses the same `company_id` / null-or rule as {@link listInvoices}.
 */
export async function fetchInvoiceListFacets(): Promise<InvoiceListFacets> {
  const companyId = await requireActiveCompanyId();
  const cached = getCachedInvoiceFacets(companyId);
  if (cached) return cached;

  const period = invoiceFacetPeriodStarts();

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "get_invoice_nav_facets",
    {
      p_company_id: companyId,
      p_month_start: period.month,
      p_quarter_start: period.quarter,
      p_year_start: period.year,
    },
  );

  if (!rpcErr && rpcData && typeof rpcData === "object" && !Array.isArray(rpcData)) {
    const d = rpcData as Record<string, unknown>;
    const num = (k: string) => Number(d[k] ?? 0);
    const facets: InvoiceListFacets = {
      companyTotal: num("companyTotal"),
      unpaidCount: num("unpaidCount"),
      paidCount: num("paidCount"),
      cancelledCount: num("cancelledCount"),
      thisMonthCount: num("thisMonthCount"),
      thisQuarterCount: num("thisQuarterCount"),
      thisYearCount: num("thisYearCount"),
    };
    facetCache = {
      companyId,
      expires: Date.now() + FACET_TTL_MS,
      facets,
    };
    return facets;
  }

  const baseOr = `company_id.eq.${companyId},company_id.is.null`;

  const head = () =>
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .or(baseOr);

  const countOf = async (
    builder: ReturnType<typeof head>,
  ): Promise<number> => {
    const { count, error } = await builder;
    if (error) throw error;
    return count ?? 0;
  };

  const [
    companyTotal,
    unpaidCount,
    paidCount,
    cancelledCount,
    thisMonthCount,
    thisQuarterCount,
    thisYearCount,
  ] = await Promise.all([
    countOf(head()),
    countOf(head().eq("status", "unpaid")),
    countOf(head().eq("status", "paid")),
    countOf(head().eq("status", "cancelled")),
    countOf(head().gte("issue_date", period.month)),
    countOf(head().gte("issue_date", period.quarter)),
    countOf(head().gte("issue_date", period.year)),
  ]);

  const facets: InvoiceListFacets = {
    companyTotal,
    unpaidCount,
    paidCount,
    cancelledCount,
    thisMonthCount,
    thisQuarterCount,
    thisYearCount,
  };
  facetCache = {
    companyId,
    expires: Date.now() + FACET_TTL_MS,
    facets,
  };
  return facets;
}

export async function listInvoices(opts?: {
  search?: string;
  status?: InvoiceStatus | "all";
  period?: "all" | "month" | "quarter" | "year";
  /** When set, only invoices linked to this customer (`invoices.customer_id`). */
  customerId?: string;
  page?: number; // 1-based
  pageSize?: number;
  sortBy?: SortByKey;
  sort?: SortDir;
}): Promise<{ rows: InvoiceListRow[]; total: number }> {
  const companyId = await requireActiveCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Map UI sort keys to DB columns
  const sortFieldMap: Record<SortByKey, string> = {
    issueDate: "issue_date",
    dueDate: "due_date",
    number: "number",
    created_at: "created_at",
  };

  // Defaults: newest first by issue_date
  const sortByKey: SortByKey = opts?.sortBy ?? "issueDate";
  const sortColumn = sortFieldMap[sortByKey] ?? "issue_date";
  const ascending = (opts?.sort ?? "desc") === "asc";

  let q = supabase
    .from("invoices")
    .select(
      "id, number, issue_date, due_date, status, currency, bill_to_snapshot, created_at, subtotal, tax_total",
      { count: "exact" },
    )
    .or(`company_id.eq.${companyId},company_id.is.null`);

  // Filters
  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const cid = opts?.customerId?.trim();
  if (cid) {
    q = q.eq("customer_id", cid);
  }

  const today = new Date();
  if (opts?.period && opts.period !== "all") {
    let start: Date;
    if (opts.period === "month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (opts.period === "quarter") {
      start = new Date(today);
      start.setMonth(today.getMonth() - 2); // approximate last 3 months
      start.setDate(1);
    } else {
      // "year"
      start = new Date(today.getFullYear(), 0, 1);
    }
    q = q.gte("issue_date", start.toISOString().slice(0, 10));
  }

  if (opts?.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(
      [
        `number.ilike.${s}`,
        `bill_to_snapshot->>company_name.ilike.${s}`,
        `bill_to_snapshot->>full_name.ilike.${s}`,
      ].join(",")
    );
  }

  // Sorting (primary + a stable secondary for deterministic results)
  q = q.order(sortColumn, { ascending });
  // Secondary order by number desc to stabilize (optional—adjust to taste)
  q = q.order("number", { ascending: false, nullsFirst: false });

  // Pagination
  q = q.range(from, to);

  const { data, count, error } = await q;
  if (error) throw error;

  const rows: InvoiceListRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    number: r.number,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    status: r.status as InvoiceStatus,
    currency: r.currency,
    clientName: nameFromBillTo(r.bill_to_snapshot),
    total: listRowLineAndTaxTotal(
      Number(r.subtotal ?? 0),
      Number(r.tax_total ?? 0),
    ),
  }));

  const total = count ?? 0;
  const cacheKey = makeListCacheKey(companyId, opts);
  listCache.set(cacheKey, {
    key: cacheKey,
    expires: Date.now() + LIST_TTL_MS,
    rows,
    total,
  });

  return { rows, total };
}

export async function listAllInvoicesForExport(opts?: {
  search?: string;
  status?: InvoiceStatus | "all";
  period?: "all" | "month" | "quarter" | "year";
  customerId?: string;
  sortBy?: SortByKey;
  sort?: SortDir;
  /** Safety cap to avoid huge exports. Defaults to 10k. */
  maxRows?: number;
}): Promise<InvoiceListRow[]> {
  const maxRows = Math.max(1, opts?.maxRows ?? 10_000);
  const pageSize = 1000;
  const pages = Math.ceil(maxRows / pageSize);

  const out: InvoiceListRow[] = [];
  for (let page = 1; page <= pages; page++) {
    const { rows, total } = await listInvoices({
      search: opts?.search,
      status: opts?.status,
      period: opts?.period,
      customerId: opts?.customerId,
      sortBy: opts?.sortBy,
      sort: opts?.sort,
      page,
      pageSize,
    });
    out.push(...rows);

    if (out.length >= total) break;
    if (rows.length === 0) break;
    if (out.length >= maxRows) break;
  }

  return out.slice(0, maxRows);
}

/* -------------------- Detail -------------------- */

export type InvoiceItemRow = {
  company_id?: string | null;
  item: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  product_id?: string | null;
};

export type InvoiceDetail = {
  id: string;
  number: string;
  issue_date: string;
  due_date: string;
  status: "unpaid" | "paid" | "cancelled";
  currency: string;
  customer_id: string | null;
  created_from_quotation_id: string | null;
  created_from_sales_order_id: string | null;
  from_snapshot: any;
  bill_to_snapshot: any;
  shipping_amount: number;
  discount_type: "value" | "percent";
  discount_amount: number;
  notes: string | null;
  terms: string | null;
  /** DB value; may include legacy strings not shown in payment dropdowns. */
  payment_method: string | null;
  amount_paid: number;
  amount_due: number;
  items: InvoiceItemRow[];
};

function computeSubtotal(items: InvoiceItemRow[]) {
  return items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
}
function computeTaxTotal(items: InvoiceItemRow[]) {
  return items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
}
export function computeTotals(inv: InvoiceDetail) {
  const subtotal = computeSubtotal(inv.items);
  const taxTotal = computeTaxTotal(inv.items);
  const discount =
    inv.discount_type === "percent"
      ? (subtotal * Number(inv.discount_amount || 0)) / 100
      : Number(inv.discount_amount || 0);
  const total = subtotal + taxTotal - discount;
  return { subtotal, taxTotal, discount, total };
}

const INVOICE_DETAIL_SELECT = `
      id, company_id, number, issue_date, due_date, status, currency, customer_id,
      created_from_quotation_id, created_from_sales_order_id,
      from_snapshot, bill_to_snapshot,
      shipping_amount,
      discount_type, discount_amount,
      notes, terms,
      payment_method, amount_paid, amount_due,
      invoice_items ( company_id, item, description, quantity, unit_price, tax_percent, product_id )
    `;

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const companyId = await requireActiveCompanyId();

  // Load by id only so RLS can return the row even when invoices.company_id is NULL
  // or out of sync; then enforce workspace and stamp NULL → active company.
  const { data: row, error: loadErr } = await supabase
    .from("invoices")
    .select(INVOICE_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !row) {
    return null;
  }

  if (row.company_id && row.company_id !== companyId) {
    return null;
  }

  if (!row.company_id) {
    const { error: stampErr } = await supabase
      .from("invoices")
      .update({ company_id: companyId })
      .eq("id", id)
      .is("company_id", null);
    if (!stampErr) {
      (row as { company_id: string }).company_id = companyId;
    }
  }

  const data = row;

  // Calculate totals to determine correct amount_due
  const items = (data.invoice_items ?? []) as InvoiceItemRow[];
  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const taxTotal = items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
  const discount =
    data.discount_type === "percent"
      ? (subtotal * Number(data.discount_amount || 0)) / 100
      : Number(data.discount_amount || 0);
  const total = subtotal + taxTotal - discount;
  
  const amountPaid = Number(data.amount_paid || 0);
  // Match invoice UI: derive balance from line totals minus paid. Stored amount_due can be 0/null
  // for new unpaid rows, which must not hide the real balance on screen or in exports.
  const amountDue =
    data.status === "paid" || data.status === "cancelled"
      ? 0
      : Math.max(0, total - amountPaid);

  return {
    id: data.id,
    number: data.number,
    issue_date: data.issue_date,
    due_date: data.due_date,
    status: data.status as "unpaid" | "paid" | "cancelled",
    currency: data.currency,
    customer_id: (data.customer_id as string) ?? null,
    created_from_quotation_id: (data.created_from_quotation_id as string) ?? null,
    created_from_sales_order_id: (data.created_from_sales_order_id as string) ?? null,
    from_snapshot: data.from_snapshot,
    bill_to_snapshot: data.bill_to_snapshot,
    shipping_amount: Number(data.shipping_amount ?? 0),
    discount_type: data.discount_type,
    discount_amount: Number(data.discount_amount || 0),
    notes: data.notes,
    terms: data.terms,
    payment_method: (data.payment_method as string | null) ?? null,
    amount_paid: amountPaid,
    amount_due: amountDue,
    items: items,
  };
}

export async function markInvoicePaid(id: string): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid" })
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) throw error;
  invalidateInvoiceCaches();
}

/** Cancel invoice: sets status to cancelled and amount_paid to 0 so it does not count in total paid or overdue */
export async function cancelInvoice(id: string): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "cancelled", amount_paid: 0, amount_due: 0 })
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) throw error;
  invalidateInvoiceCaches();
}

export async function updateInvoicePayment(
  id: string,
  payment: {
    payment_method?: InvoicePaymentMethod | null;
    amount_paid?: number;
    amount_due?: number;
    status?: "unpaid" | "paid" | "cancelled";
    credit_applied?: number;
  }
): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("invoices")
    .update(payment)
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) throw error;
  invalidateInvoiceCaches();
}
