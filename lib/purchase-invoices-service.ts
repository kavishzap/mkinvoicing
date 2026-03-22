import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/settings-service";
import type { SupplierRow } from "@/lib/suppliers-service";
import type { SalesOrderClientInfo } from "@/lib/sales-orders-service";

export type PurchaseInvoiceStatus =
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export function normalizePurchaseInvoiceStatus(raw: string): PurchaseInvoiceStatus {
  const s = String(raw);
  if (
    s === "partially_paid" ||
    s === "paid" ||
    s === "overdue" ||
    s === "cancelled"
  ) {
    return s;
  }
  return "unpaid";
}

export type PurchaseInvoiceLinePayload = {
  item: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  sort_order?: number;
};

export type CreatePurchaseInvoicePayload = {
  issue_date: string;
  due_date: string;
  status: PurchaseInvoiceStatus;
  currency: string;
  discount_type: "value" | "percent";
  discount_amount: number;
  shipping_amount?: number;
  notes?: string;
  terms?: string;
  payment_method?:
    | "Cash"
    | "Card Payment"
    | "Credit Facilities"
    | "Bank Transfer"
    | null;
  amount_paid?: number;
  amount_due?: number;
  supplier_id: string | null;
  client_snapshot: Record<string, unknown> | null;
  from_snapshot: Record<string, unknown>;
  bill_to_snapshot: Record<string, unknown>;
  created_from_purchase_order_id?: string | null;
  items: PurchaseInvoiceLinePayload[];
};

export type PurchaseInvoiceItemRow = {
  item: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  sort_order?: number;
};

export type PurchaseInvoiceDetail = {
  id: string;
  number: string;
  issue_date: string;
  due_date: string;
  status: PurchaseInvoiceStatus;
  currency: string;
  supplier_id: string | null;
  created_from_purchase_order_id: string | null;
  from_snapshot: Record<string, unknown>;
  bill_to_snapshot: Record<string, unknown>;
  client_snapshot: Record<string, unknown> | null;
  discount_type: "value" | "percent";
  discount_amount: number;
  shipping_amount: number;
  notes: string | null;
  terms: string | null;
  payment_method:
    | "Cash"
    | "Card Payment"
    | "Credit Facilities"
    | "Bank Transfer"
    | null;
  amount_paid: number;
  amount_due: number;
  items: PurchaseInvoiceItemRow[];
};

export type PurchaseInvoiceListRow = {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  status: PurchaseInvoiceStatus;
  currency: string;
  supplierName: string;
  total: number;
  amountPaid: number;
  amountDue: number;
};

function nameFromBillTo(bill?: Record<string, unknown>) {
  if (!bill) return "";
  const t = bill.type as string | undefined;
  return t === "company"
    ? String(bill.company_name ?? "")
    : String(bill.full_name ?? "");
}

export function supplierToClientInfo(s: SupplierRow): SalesOrderClientInfo {
  return {
    type: s.type,
    companyName: s.companyName ?? "",
    contactName: s.contactName ?? "",
    fullName: s.fullName ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    street: s.street ?? "",
    city: s.city ?? "",
    postal: s.postal ?? "",
    country: s.country ?? "",
    address_line_1: s.address_line_1 ?? "",
    address_line_2: s.address_line_2 ?? "",
  };
}

export function computePurchaseInvoiceTotals(inv: PurchaseInvoiceDetail) {
  const items = inv.items ?? [];
  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const taxTotal = items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
  const discount =
    inv.discount_type === "percent"
      ? (subtotal * Number(inv.discount_amount || 0)) / 100
      : Number(inv.discount_amount || 0);
  const ship = Number(inv.shipping_amount ?? 0);
  const total = subtotal + taxTotal - discount + ship;
  return { subtotal, taxTotal, discount, shipping: ship, total };
}

export async function createPurchaseInvoice(
  params: CreatePurchaseInvoicePayload
): Promise<string> {
  const { items, ...inv } = params;
  const { data, error } = await supabase.rpc("create_purchase_invoice", {
    p_invoice: {
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      status: inv.status,
      currency: inv.currency,
      discount_type: inv.discount_type,
      discount_amount: inv.discount_amount,
      shipping_amount: inv.shipping_amount ?? 0,
      notes: inv.notes ?? null,
      terms: inv.terms ?? null,
      payment_method: inv.payment_method ?? null,
      amount_paid: inv.amount_paid ?? 0,
      amount_due:
        inv.amount_due !== undefined && inv.amount_due !== null
          ? inv.amount_due
          : null,
      supplier_id: inv.supplier_id,
      client_snapshot: inv.client_snapshot,
      from_snapshot: inv.from_snapshot,
      bill_to_snapshot: inv.bill_to_snapshot,
      created_from_purchase_order_id:
        inv.created_from_purchase_order_id ?? null,
    } as Record<string, unknown>,
    p_items: items.map((li, i) => ({
      item: li.item,
      description: li.description ?? null,
      quantity: li.quantity,
      unit_price: li.unit_price,
      tax_percent: li.tax_percent,
      sort_order: li.sort_order ?? i,
    })),
  });

  if (error) throw error;

  let id: string;
  if (typeof data === "string") {
    id = data;
  } else {
    id = String(data);
  }
  return id;
}

export async function listPurchaseInvoices(opts?: {
  search?: string;
  status?: PurchaseInvoiceStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<{ rows: PurchaseInvoiceListRow[]; total: number }> {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("purchase_invoices")
    .select(
      "id, number, issue_date, due_date, status, currency, bill_to_snapshot, total, amount_paid, amount_due",
      { count: "exact" }
    )
    .order("issue_date", { ascending: false })
    .range(from, to);

  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
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

  const { data, error, count } = await q;
  if (error) throw error;

  const rows: PurchaseInvoiceListRow[] = (data ?? []).map(
    (r: Record<string, unknown>) => ({
      id: r.id as string,
      number: r.number as string,
      issueDate: r.issue_date as string,
      dueDate: r.due_date as string,
      status: normalizePurchaseInvoiceStatus(String(r.status)),
      currency: r.currency as string,
      supplierName: nameFromBillTo(r.bill_to_snapshot as Record<string, unknown>),
      total: Number(r.total ?? 0),
      amountPaid: Number(r.amount_paid ?? 0),
      amountDue: Number(r.amount_due ?? 0),
    })
  );

  return { rows, total: count ?? 0 };
}

export async function getPurchaseInvoice(
  id: string
): Promise<PurchaseInvoiceDetail | null> {
  const { data, error } = await supabase
    .from("purchase_invoices")
    .select(
      `
      id, number, issue_date, due_date, status, currency, supplier_id,
      created_from_purchase_order_id,
      from_snapshot, bill_to_snapshot, client_snapshot,
      discount_type, discount_amount, shipping_amount, notes, terms,
      payment_method, amount_paid, amount_due,
      purchase_invoice_items ( item, description, quantity, unit_price, tax_percent, sort_order )
    `
    )
    .eq("id", id)
    .single();

  if (error) return null;

  const raw = (data.purchase_invoice_items ?? []) as PurchaseInvoiceItemRow[];
  const items = [...raw].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );

  const totals = computePurchaseInvoiceTotals({
    id: data.id as string,
    number: data.number as string,
    issue_date: data.issue_date as string,
    due_date: data.due_date as string,
    status: normalizePurchaseInvoiceStatus(String(data.status)),
    currency: data.currency as string,
    supplier_id: (data.supplier_id as string) ?? null,
    created_from_purchase_order_id:
      (data.created_from_purchase_order_id as string) ?? null,
    from_snapshot: (data.from_snapshot ?? {}) as Record<string, unknown>,
    bill_to_snapshot: (data.bill_to_snapshot ?? {}) as Record<string, unknown>,
    client_snapshot: (data.client_snapshot ?? null) as Record<
      string,
      unknown
    > | null,
    discount_type: data.discount_type as "value" | "percent",
    discount_amount: Number(data.discount_amount ?? 0),
    shipping_amount: Number(data.shipping_amount ?? 0),
    notes: data.notes as string | null,
    terms: data.terms as string | null,
    payment_method: data.payment_method as PurchaseInvoiceDetail["payment_method"],
    amount_paid: Number(data.amount_paid ?? 0),
    amount_due: Number(data.amount_due ?? 0),
    items,
  });
  const amountPaid = Number(data.amount_paid || 0);
  const storedDue =
    data.amount_due !== null && data.amount_due !== undefined
      ? Number(data.amount_due)
      : null;
  const calculatedDue = Math.max(0, totals.total - amountPaid);
  const amountDue =
    storedDue !== null && storedDue >= 0 && storedDue <= totals.total
      ? storedDue
      : calculatedDue;

  return {
    id: data.id as string,
    number: data.number as string,
    issue_date: data.issue_date as string,
    due_date: data.due_date as string,
    status: normalizePurchaseInvoiceStatus(String(data.status)),
    currency: data.currency as string,
    supplier_id: (data.supplier_id as string) ?? null,
    created_from_purchase_order_id:
      (data.created_from_purchase_order_id as string) ?? null,
    from_snapshot: (data.from_snapshot ?? {}) as Record<string, unknown>,
    bill_to_snapshot: (data.bill_to_snapshot ?? {}) as Record<string, unknown>,
    client_snapshot: (data.client_snapshot ?? null) as Record<
      string,
      unknown
    > | null,
    discount_type: data.discount_type as "value" | "percent",
    discount_amount: Number(data.discount_amount ?? 0),
    shipping_amount: Number(data.shipping_amount ?? 0),
    notes: data.notes as string | null,
    terms: data.terms as string | null,
    payment_method: data.payment_method as PurchaseInvoiceDetail["payment_method"],
    amount_paid: amountPaid,
    amount_due: amountDue,
    items,
  };
}

export async function deletePurchaseInvoice(id: string): Promise<void> {
  const { error } = await supabase.from("purchase_invoices").delete().eq("id", id);
  if (error) throw error;
}

export type UpdatePurchaseInvoicePayload = Omit<
  CreatePurchaseInvoicePayload,
  "created_from_purchase_order_id"
> & {
  items: PurchaseInvoiceLinePayload[];
  /** Preserve link when editing */
  created_from_purchase_order_id?: string | null;
};

export async function updatePurchaseInvoice(
  id: string,
  params: UpdatePurchaseInvoicePayload
): Promise<void> {
  const { items, ...inv } = params;
  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const taxTotal = items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
  const discount =
    inv.discount_type === "percent"
      ? (subtotal * Number(inv.discount_amount || 0)) / 100
      : Number(inv.discount_amount || 0);
  const ship = inv.shipping_amount ?? 0;
  const total = subtotal + taxTotal - discount + ship;

  const amountPaid = Number(inv.amount_paid ?? 0);
  const amountDue =
    inv.amount_due !== undefined && inv.amount_due !== null
      ? Number(inv.amount_due)
      : Math.max(0, total - amountPaid);

  const { error: upErr } = await supabase
    .from("purchase_invoices")
    .update({
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      status: inv.status,
      currency: inv.currency,
      from_snapshot: inv.from_snapshot,
      bill_to_snapshot: inv.bill_to_snapshot,
      client_snapshot: inv.client_snapshot,
      supplier_id: inv.supplier_id,
      subtotal,
      tax_total: taxTotal,
      discount_type: inv.discount_type,
      discount_amount: inv.discount_amount,
      shipping_amount: ship,
      total,
      notes: inv.notes ?? null,
      terms: inv.terms ?? null,
      payment_method: inv.payment_method ?? null,
      amount_paid: amountPaid,
      amount_due: amountDue,
      created_from_purchase_order_id:
        inv.created_from_purchase_order_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (upErr) throw upErr;

  const { error: delErr } = await supabase
    .from("purchase_invoice_items")
    .delete()
    .eq("purchase_invoice_id", id);
  if (delErr) throw delErr;

  const rows = items.map((it, idx) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    const lineTax = line * (Number(it.tax_percent) / 100);
    const sortOrder = it.sort_order ?? idx;
    return {
      purchase_invoice_id: id,
      item: it.item,
      description: it.description ?? null,
      quantity: it.quantity,
      unit_price: it.unit_price,
      tax_percent: it.tax_percent,
      line_subtotal: line,
      line_tax: lineTax,
      line_total: line + lineTax,
      sort_order: sortOrder,
    };
  });

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("purchase_invoice_items")
      .insert(rows);
    if (insErr) throw insErr;
  }
}

export async function updatePurchaseInvoicePayment(
  id: string,
  payment: {
    payment_method?: PurchaseInvoiceDetail["payment_method"];
    amount_paid?: number;
    amount_due?: number;
    status?: PurchaseInvoiceStatus;
  }
): Promise<void> {
  const { error } = await supabase.from("purchase_invoices").update(payment).eq("id", id);
  if (error) throw error;
}

export async function cancelPurchaseInvoice(id: string): Promise<void> {
  const { error } = await supabase
    .from("purchase_invoices")
    .update({
      status: "cancelled",
      amount_paid: 0,
      amount_due: 0,
    })
    .eq("id", id);
  if (error) throw error;
}
