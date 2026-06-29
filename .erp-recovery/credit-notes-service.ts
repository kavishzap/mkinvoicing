import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import { ensureUserSettingsRow } from "@/lib/settings-service";
import { invalidateInvoiceCaches } from "@/lib/invoices-service";

const FACET_TTL_MS = 30_000;
const LIST_TTL_MS = 30_000;
const DETAIL_TTL_MS = 45_000;

type FacetCacheEntry = {
  companyId: string;
  expires: number;
  facets: CreditNoteListFacets;
};

type ListCacheEntry = {
  key: string;
  expires: number;
  rows: CreditNoteListRow[];
  total: number;
};

type DetailCacheEntry = {
  companyId: string;
  expires: number;
  detail: CreditNoteDetail;
};

let facetCache: FacetCacheEntry | null = null;
const listCache = new Map<string, ListCacheEntry>();
const detailCache = new Map<string, DetailCacheEntry>();

function detailCacheKey(companyId: string, id: string) {
  return `${companyId}|${id}`;
}

function makeListCacheKey(
  companyId: string,
  opts: {
    search?: string;
    status?: CreditNoteStatus | "all";
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

export function getCachedCreditNoteFacets(
  companyId: string,
): CreditNoteListFacets | null {
  if (!facetCache) return null;
  if (facetCache.companyId !== companyId) return null;
  if (facetCache.expires <= Date.now()) return null;
  return facetCache.facets;
}

export function getCachedCreditNoteList(
  companyId: string,
  opts?: Parameters<typeof makeListCacheKey>[1],
): { rows: CreditNoteListRow[]; total: number } | null {
  const key = makeListCacheKey(companyId, opts);
  const hit = listCache.get(key);
  if (!hit || hit.expires <= Date.now()) return null;
  return { rows: hit.rows, total: hit.total };
}

export function getCachedCreditNote(
  companyId: string,
  id: string,
): CreditNoteDetail | null {
  const hit = detailCache.get(detailCacheKey(companyId, id));
  if (!hit || hit.companyId !== companyId) return null;
  if (hit.expires <= Date.now()) return null;
  return hit.detail;
}

export function invalidateCreditNoteCaches() {
  facetCache = null;
  listCache.clear();
  detailCache.clear();
}

export const CREDIT_NOTE_REASONS = [
  { value: "goods_returned", label: "Goods Returned" },
  { value: "pricing_error", label: "Pricing Error" },
  { value: "damaged_goods", label: "Damaged Goods" },
  { value: "duplicate_invoice", label: "Duplicate Invoice" },
  { value: "discount", label: "Discount" },
  { value: "service_cancellation", label: "Service Cancellation" },
  { value: "other", label: "Other" },
] as const;

export type CreditNoteReason = (typeof CREDIT_NOTE_REASONS)[number]["value"];

export function creditNoteReasonLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return CREDIT_NOTE_REASONS.find((r) => r.value === code)?.label ?? code;
}

export type CreditNoteStatus = "draft" | "posted" | "cancelled";

export type CreditNoteCreditType = "full" | "partial";

export type CreditNoteLinePayload = {
  item: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  product_id?: string | null;
  invoice_item_id?: string | null;
};

export type CreateCreditNotePayload = {
  issue_date: string;
  status: "draft" | "posted";
  currency: string;
  credit_type: CreditNoteCreditType;
  discount_type: "value" | "percent";
  discount_amount: number;
  reason: CreditNoteReason;
  notes?: string | null;
  terms?: string | null;
  customer_id: string;
  related_invoice_id: string;
  items: CreditNoteLinePayload[];
};

export type CreditableInvoiceRow = {
  id: string;
  number: string;
  issueDate: string;
  currency: string;
  status: string;
  originalAmount: number;
  outstandingBalance: number;
  alreadyCredited: number;
  creditableBalance: number;
};

export async function listCreditableInvoices(
  customerId: string,
): Promise<CreditableInvoiceRow[]> {
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase.rpc("list_creditable_invoices", {
    p_company_id: companyId,
    p_customer_id: customerId,
  });

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    number: String(r.number),
    issueDate: String(r.issue_date),
    currency: String(r.currency),
    status: String(r.status),
    originalAmount: Number(r.original_amount ?? 0),
    outstandingBalance: Number(r.outstanding_balance ?? 0),
    alreadyCredited: Number(r.already_credited ?? 0),
    creditableBalance: Number(r.creditable_balance ?? 0),
  }));
}

async function ensureCreditNoteItemsCompanyId(
  creditNoteId: string,
  companyId: string,
): Promise<void> {
  await supabase
    .from("credit_note_items")
    .update({ company_id: companyId })
    .eq("credit_note_id", creditNoteId);
}

export async function createCreditNote(
  params: CreateCreditNotePayload,
): Promise<string> {
  const { items, ...cn } = params;
  const companyId = await requireActiveCompanyId();
  await ensureUserSettingsRow();

  const { data, error } = await supabase.rpc("create_credit_note", {
    p_credit_note: {
      company_id: companyId,
      issue_date: cn.issue_date,
      status: cn.status,
      currency: cn.currency,
      credit_type: cn.credit_type,
      discount_type: cn.discount_type,
      discount_amount: cn.discount_amount,
      reason: cn.reason,
      notes: cn.notes ?? null,
      terms: cn.terms ?? null,
      customer_id: cn.customer_id,
      related_invoice_id: cn.related_invoice_id,
    },
    p_items: items.map((li) => ({
      company_id: companyId,
      item: li.item,
      description: li.description ?? null,
      quantity: li.quantity,
      unit_price: li.unit_price,
      tax_percent: li.tax_percent,
      product_id: li.product_id ?? null,
      invoice_item_id: li.invoice_item_id ?? null,
    })),
  });

  if (error) throw error;

  let creditNoteId: string;
  if (typeof data === "string") {
    creditNoteId = data;
  } else if (data && typeof data === "object" && "credit_note_id" in data) {
    creditNoteId = (data as { credit_note_id: string }).credit_note_id;
  } else {
    throw new Error("Unexpected response from create_credit_note RPC");
  }

  try {
    await ensureCreditNoteItemsCompanyId(creditNoteId, companyId);
  } catch {
    /* best-effort */
  }

  invalidateCreditNoteCaches();
  if (cn.status === "posted") {
    invalidateInvoiceCaches();
  }
  return creditNoteId;
}

export async function postCreditNote(id: string): Promise<void> {
  const { error } = await supabase.rpc("post_credit_note", {
    p_credit_note_id: id,
  });
  if (error) throw error;
  invalidateCreditNoteCaches();
  invalidateInvoiceCaches();
}

export type CreditNoteListRow = {
  id: string;
  number: string;
  issueDate: string;
  status: CreditNoteStatus;
  currency: string;
  clientName: string;
  customerId: string | null;
  total: number;
  reason: string | null;
  creditType: CreditNoteCreditType | null;
  relatedInvoiceId: string | null;
  relatedInvoiceNumber: string | null;
};

function listRowLineAndTaxTotal(subtotal: number, taxTotal: number): number {
  return Number(subtotal ?? 0) + Number(taxTotal ?? 0);
}

function nameFromBillTo(bill?: Record<string, unknown> | null) {
  if (!bill) return "";
  return bill.type === "company"
    ? String(bill.company_name ?? "")
    : String(bill.full_name ?? "");
}

function nameFromCustomerRecord(
  c?: {
    type?: string;
    company_name?: string | null;
    full_name?: string | null;
    contact_name?: string | null;
  } | null,
): string {
  if (!c) return "";
  if (c.type === "company") {
    return String(c.company_name ?? c.contact_name ?? "").trim();
  }
  return String(c.full_name ?? "").trim();
}

function customerLinkFromRow(r: {
  customer_id?: string | null;
  bill_to_snapshot?: unknown;
  customers?:
    | {
        type?: string;
        company_name?: string | null;
        full_name?: string | null;
        contact_name?: string | null;
      }
    | {
        type?: string;
        company_name?: string | null;
        full_name?: string | null;
        contact_name?: string | null;
      }[]
    | null;
}): { customerId: string | null; clientName: string } {
  const customerId = r.customer_id ?? null;
  const billName = nameFromBillTo(
    r.bill_to_snapshot as Record<string, unknown> | null,
  ).trim();
  const rel = r.customers;
  const row = Array.isArray(rel) ? rel[0] : rel;
  const recordName = nameFromCustomerRecord(row);
  return { customerId, clientName: billName || recordName };
}

function invoiceLinkFromRow(r: {
  related_invoice_id?: string | null;
  invoices?:
    | { number?: string | null }
    | { number?: string | null }[]
    | null;
}): { relatedInvoiceId: string | null; relatedInvoiceNumber: string | null } {
  const relatedInvoiceId = r.related_invoice_id ?? null;
  if (!relatedInvoiceId) {
    return { relatedInvoiceId: null, relatedInvoiceNumber: null };
  }
  const rel = r.invoices;
  const inv = Array.isArray(rel) ? rel[0] : rel;
  const num = inv?.number != null ? String(inv.number).trim() : "";
  return { relatedInvoiceId, relatedInvoiceNumber: num || null };
}

type SortByKey = "issueDate" | "number" | "created_at";
type SortDir = "asc" | "desc";

export type CreditNoteListFacets = {
  companyTotal: number;
  draftCount: number;
  postedCount: number;
  cancelledCount: number;
  thisMonthCount: number;
  thisQuarterCount: number;
  thisYearCount: number;
};

function facetPeriodStarts() {
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

export async function fetchCreditNoteListFacets(): Promise<CreditNoteListFacets> {
  const companyId = await requireActiveCompanyId();
  const cached = getCachedCreditNoteFacets(companyId);
  if (cached) return cached;

  const period = facetPeriodStarts();

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "get_credit_note_nav_facets",
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
    const facets: CreditNoteListFacets = {
      companyTotal: num("companyTotal"),
      draftCount: num("draftCount") || num("issuedCount"),
      postedCount: num("postedCount") || num("appliedCount"),
      cancelledCount: num("cancelledCount"),
      thisMonthCount: num("thisMonthCount"),
      thisQuarterCount: num("thisQuarterCount"),
      thisYearCount: num("thisYearCount"),
    };
    facetCache = { companyId, expires: Date.now() + FACET_TTL_MS, facets };
    return facets;
  }

  const head = () =>
    supabase
      .from("credit_notes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

  const countOf = async (builder: ReturnType<typeof head>) => {
    const { count, error } = await builder;
    if (error) throw error;
    return count ?? 0;
  };

  const periodStarts = facetPeriodStarts();
  const [
    companyTotal,
    draftCount,
    postedCount,
    cancelledCount,
    thisMonthCount,
    thisQuarterCount,
    thisYearCount,
  ] = await Promise.all([
    countOf(head()),
    countOf(head().eq("status", "draft")),
    countOf(head().eq("status", "posted")),
    countOf(head().eq("status", "cancelled")),
    countOf(head().gte("issue_date", periodStarts.month)),
    countOf(head().gte("issue_date", periodStarts.quarter)),
    countOf(head().gte("issue_date", periodStarts.year)),
  ]);

  const facets: CreditNoteListFacets = {
    companyTotal,
    draftCount,
    postedCount,
    cancelledCount,
    thisMonthCount,
    thisQuarterCount,
    thisYearCount,
  };
  facetCache = { companyId, expires: Date.now() + FACET_TTL_MS, facets };
  return facets;
}

export async function listCreditNotes(opts?: {
  search?: string;
  status?: CreditNoteStatus | "all";
  period?: "all" | "month" | "quarter" | "year";
  customerId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SortByKey;
  sort?: SortDir;
}): Promise<{ rows: CreditNoteListRow[]; total: number }> {
  const companyId = await requireActiveCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const sortFieldMap: Record<SortByKey, string> = {
    issueDate: "issue_date",
    number: "number",
    created_at: "created_at",
  };

  const sortByKey: SortByKey = opts?.sortBy ?? "issueDate";
  const sortColumn = sortFieldMap[sortByKey] ?? "issue_date";
  const ascending = (opts?.sort ?? "desc") === "asc";

  let q = supabase
    .from("credit_notes")
    .select(
      "id, number, issue_date, status, currency, reason, credit_type, bill_to_snapshot, created_at, subtotal, tax_total, customer_id, related_invoice_id, customers!credit_notes_customer_id_fkey(type, company_name, full_name, contact_name), invoices!credit_notes_related_invoice_id_fkey(number)",
      { count: "exact" },
    )
    .eq("company_id", companyId);

  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const cid = opts?.customerId?.trim();
  if (cid) q = q.eq("customer_id", cid);

  const today = new Date();
  if (opts?.period && opts.period !== "all") {
    let start: Date;
    if (opts.period === "month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (opts.period === "quarter") {
      start = new Date(today);
      start.setMonth(today.getMonth() - 2);
      start.setDate(1);
    } else {
      start = new Date(today.getFullYear(), 0, 1);
    }
    q = q.gte("issue_date", start.toISOString().slice(0, 10));
  }

  if (opts?.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(
      [
        `number.ilike.${s}`,
        `reason.ilike.${s}`,
        `bill_to_snapshot->>company_name.ilike.${s}`,
        `bill_to_snapshot->>full_name.ilike.${s}`,
      ].join(","),
    );
  }

  q = q.order(sortColumn, { ascending });
  q = q.order("number", { ascending: false, nullsFirst: false });
  q = q.range(from, to);

  const { data, count, error } = await q;
  if (error) throw error;

  const rows: CreditNoteListRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const { customerId, clientName } = customerLinkFromRow(
      r as Parameters<typeof customerLinkFromRow>[0],
    );
    const { relatedInvoiceId, relatedInvoiceNumber } = invoiceLinkFromRow(
      r as Parameters<typeof invoiceLinkFromRow>[0],
    );
    return {
      id: String(r.id),
      number: String(r.number),
      issueDate: String(r.issue_date),
      status: r.status as CreditNoteStatus,
      currency: String(r.currency),
      clientName,
      customerId,
      total: listRowLineAndTaxTotal(
        Number(r.subtotal ?? 0),
        Number(r.tax_total ?? 0),
      ),
      reason: r.reason != null ? String(r.reason) : null,
      creditType: (r.credit_type as CreditNoteCreditType) ?? null,
      relatedInvoiceId,
      relatedInvoiceNumber,
    };
  });

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

export type CreditNoteItemRow = {
  company_id?: string | null;
  item: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  product_id?: string | null;
  invoice_item_id?: string | null;
};

export type CreditNoteDetail = {
  id: string;
  number: string;
  issue_date: string;
  status: CreditNoteStatus;
  currency: string;
  credit_type: CreditNoteCreditType;
  customer_id: string | null;
  related_invoice_id: string | null;
  relatedInvoiceNumber: string | null;
  reason: string | null;
  from_snapshot: Record<string, unknown> | null;
  bill_to_snapshot: Record<string, unknown> | null;
  discount_type: "value" | "percent";
  discount_amount: number;
  notes: string | null;
  terms: string | null;
  items: CreditNoteItemRow[];
};

export function computeCreditNoteTotals(cn: CreditNoteDetail) {
  const subtotal = cn.items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0,
  );
  const taxTotal = cn.items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
  const discount =
    cn.discount_type === "percent"
      ? (subtotal * Number(cn.discount_amount || 0)) / 100
      : Number(cn.discount_amount || 0);
  const total = subtotal + taxTotal - discount;
  return { subtotal, taxTotal, discount, total };
}

export function creditNoteIsEditable(cn: CreditNoteDetail | null | undefined) {
  return cn?.status === "draft";
}

const CREDIT_NOTE_DETAIL_SELECT = `
      id, company_id, number, issue_date, status, currency, credit_type, customer_id,
      related_invoice_id,
      invoices!credit_notes_related_invoice_id_fkey(number),
      reason,
      from_snapshot, bill_to_snapshot,
      discount_type, discount_amount,
      notes, terms,
      credit_note_items ( company_id, item, description, quantity, unit_price, tax_percent, product_id, invoice_item_id )
    `;

export async function getCreditNote(id: string): Promise<CreditNoteDetail | null> {
  const companyId = await requireActiveCompanyId();

  const { data: row, error: loadErr } = await supabase
    .from("credit_notes")
    .select(CREDIT_NOTE_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !row) return null;

  if (row.company_id && row.company_id !== companyId) return null;

  const items = (row.credit_note_items ?? []) as CreditNoteItemRow[];

  const detail: CreditNoteDetail = {
    id: row.id,
    number: row.number,
    issue_date: row.issue_date,
    status: row.status as CreditNoteStatus,
    currency: row.currency,
    credit_type: (row.credit_type as CreditNoteCreditType) ?? "partial",
    customer_id: (row.customer_id as string) ?? null,
    related_invoice_id: (row.related_invoice_id as string) ?? null,
    relatedInvoiceNumber: (() => {
      const rel = (
        row as { invoices?: { number?: string } | { number?: string }[] }
      ).invoices;
      const inv = Array.isArray(rel) ? rel[0] : rel;
      const num = inv?.number != null ? String(inv.number).trim() : "";
      return num || null;
    })(),
    reason: row.reason,
    from_snapshot: row.from_snapshot as Record<string, unknown> | null,
    bill_to_snapshot: row.bill_to_snapshot as Record<string, unknown> | null,
    discount_type: row.discount_type,
    discount_amount: Number(row.discount_amount || 0),
    notes: row.notes,
    terms: row.terms,
    items,
  };

  detailCache.set(detailCacheKey(companyId, id), {
    companyId,
    expires: Date.now() + DETAIL_TTL_MS,
    detail,
  });

  return detail;
}

export async function updateCreditNoteDraft(
  id: string,
  params: Omit<CreateCreditNotePayload, "status">,
): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const existing = await getCreditNote(id);
  if (!existing) throw new Error("Credit note not found.");
  if (existing.status !== "draft") {
    throw new Error("Only draft credit notes can be edited.");
  }

  const { items, ...cn } = params;
  const totals = (() => {
    const subtotal = items.reduce(
      (s, li) => s + li.quantity * li.unit_price,
      0,
    );
    const taxTotal = items.reduce((s, li) => {
      const line = li.quantity * li.unit_price;
      return s + line * (li.tax_percent / 100);
    }, 0);
    const discount =
      cn.discount_type === "percent"
        ? (subtotal * cn.discount_amount) / 100
        : cn.discount_amount;
    return {
      subtotal,
      taxTotal,
      total: Math.max(0, subtotal + taxTotal - discount),
    };
  })();

  const { error: upErr } = await supabase
    .from("credit_notes")
    .update({
      issue_date: cn.issue_date,
      currency: cn.currency,
      credit_type: cn.credit_type,
      discount_type: cn.discount_type,
      discount_amount: cn.discount_amount,
      reason: cn.reason,
      notes: cn.notes ?? null,
      terms: cn.terms ?? null,
      customer_id: cn.customer_id,
      related_invoice_id: cn.related_invoice_id,
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", companyId)
    .eq("status", "draft");

  if (upErr) throw upErr;

  const { error: delErr } = await supabase
    .from("credit_note_items")
    .delete()
    .eq("credit_note_id", id);

  if (delErr) throw delErr;

  if (items.length > 0) {
    const { error: insErr } = await supabase.from("credit_note_items").insert(
      items.map((li, i) => ({
        credit_note_id: id,
        company_id: companyId,
        product_id: li.product_id ?? null,
        invoice_item_id: li.invoice_item_id ?? null,
        item: li.item,
        description: li.description ?? null,
        quantity: li.quantity,
        unit_price: li.unit_price,
        tax_percent: li.tax_percent,
        line_subtotal: li.quantity * li.unit_price,
        line_tax: li.quantity * li.unit_price * (li.tax_percent / 100),
        line_total:
          li.quantity * li.unit_price * (1 + li.tax_percent / 100),
        sort_order: i + 1,
      })),
    );
    if (insErr) throw insErr;
  }

  invalidateCreditNoteCaches();
}

export async function cancelCreditNote(id: string): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("credit_notes")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("company_id", companyId)
    .eq("status", "draft");

  if (error) throw error;
  invalidateCreditNoteCaches();
}
