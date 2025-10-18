// lib/invoices-service.ts
import { supabase } from "@/lib/supabaseClient";

/* -------------------- Types -------------------- */

export type LineItemPayload = {
  item: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
};

export type CreateInvoicePayload = {
  issue_date: string; // "YYYY-MM-DD"
  due_date: string;   // "YYYY-MM-DD"
  status: "unpaid" | "paid"; // only two statuses now
  currency: string;   // e.g. "MUR"
  discount_type: "value" | "percent";
  discount_amount: number;
  shipping_amount?: number;
  notes?: string;
  terms?: string;

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
  } | null;

  items: LineItemPayload[];
};

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

  // Never send `number` from client — server generates it.
  const { data, error } = await supabase.rpc("create_invoice", {
    p_invoice: {
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      status: inv.status, // enum cast handled in function
      currency: inv.currency,
      discount_type: inv.discount_type,
      discount_amount: inv.discount_amount,
      shipping_amount: inv.shipping_amount ?? 0,
      notes: inv.notes ?? null,
      terms: inv.terms ?? null,
      customer_id: inv.customer_id,
      client_snapshot: inv.client_snapshot, // or null if using customer_id
    },
    p_items: items.map((li) => ({
      item: li.item,
      description: li.description ?? null,
      quantity: li.quantity,
      unit_price: li.unit_price,
      tax_percent: li.tax_percent,
    })),
  });

  if (error) throw error;

  // Function should return the uuid directly (text)
  // But if it ever returns an object, handle that too.
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "invoice_id" in data) {
    return (data as any).invoice_id as string;
  }

  throw new Error("Unexpected response from create_invoice RPC");
}

/* -------------------- List -------------------- */

export type InvoiceStatus = "unpaid" | "paid";

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

function computeItemsTotal(
  items: { quantity: number; unit_price: number; tax_percent: number }[]
) {
  return items.reduce((sum, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    const tax = line * (Number(it.tax_percent) / 100);
    return sum + line + tax;
  }, 0);
}

function nameFromBillTo(bill?: any) {
  if (!bill) return "";
  return bill.type === "company"
    ? bill.company_name ?? ""
    : bill.full_name ?? "";
}

type SortByKey = "issueDate" | "number" | "dueDate" | "created_at";
type SortDir = "asc" | "desc";

export async function listInvoices(opts?: {
  search?: string;
  status?: InvoiceStatus | "all";
  period?: "all" | "month" | "quarter" | "year";
  page?: number; // 1-based
  pageSize?: number;
  sortBy?: SortByKey;
  sort?: SortDir;
}): Promise<{ rows: InvoiceListRow[]; total: number }> {
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
      `
      id, number, issue_date, due_date, status, currency, bill_to_snapshot, created_at,
      invoice_items ( quantity, unit_price, tax_percent )
    `,
      { count: "exact" }
    );

  // Filters
  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
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
    total: computeItemsTotal(r.invoice_items ?? []),
  }));

  return { rows, total: count ?? 0 };
}

/* -------------------- Detail -------------------- */

export type InvoiceItemRow = {
  item: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_percent: number;
};

export type InvoiceDetail = {
  id: string;
  number: string;
  issue_date: string;
  due_date: string;
  status: "unpaid" | "paid";
  currency: string;
  from_snapshot: any;
  bill_to_snapshot: any;
  discount_type: "value" | "percent";
  discount_amount: number;
  notes: string | null;
  terms: string | null;
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

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
      id, number, issue_date, due_date, status, currency,
      from_snapshot, bill_to_snapshot,
      discount_type, discount_amount,
      notes, terms,
      invoice_items ( item, description, quantity, unit_price, tax_percent )
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    return null;
  }

  return {
    id: data.id,
    number: data.number,
    issue_date: data.issue_date,
    due_date: data.due_date,
    status: data.status as "unpaid" | "paid",
    currency: data.currency,
    from_snapshot: data.from_snapshot,
    bill_to_snapshot: data.bill_to_snapshot,
    discount_type: data.discount_type,
    discount_amount: Number(data.discount_amount || 0),
    notes: data.notes,
    terms: data.terms,
    items: (data.invoice_items ?? []) as InvoiceItemRow[],
  };
}

export async function markInvoicePaid(id: string): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid" })
    .eq("id", id);

  if (error) throw error;
}
