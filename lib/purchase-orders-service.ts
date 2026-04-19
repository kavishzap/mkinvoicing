import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import type { Profile } from "@/lib/settings-service";
import type { SupplierRow } from "@/lib/suppliers-service";
import type { SalesOrderClientInfo } from "@/lib/sales-orders-service";

/** Same lifecycle as sales orders / quotations */
export type PurchaseOrderStatus = "active" | "expired";

export function normalizePurchaseOrderStatus(raw: string): PurchaseOrderStatus {
  return raw === "expired" ? "expired" : "active";
}

export type PurchaseOrderLinePayload = {
  item: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  sort_order?: number;
};

export type CreatePurchaseOrderPayload = {
  issue_date: string;
  valid_until: string;
  status: PurchaseOrderStatus;
  currency: string;
  discount_type: "value" | "percent";
  discount_amount: number;
  shipping_amount?: number;
  notes?: string;
  terms?: string;
  supplier_id: string | null;
  client_snapshot: Record<string, unknown> | null;
  from_snapshot: Record<string, unknown>;
  bill_to_snapshot: Record<string, unknown>;
  items: PurchaseOrderLinePayload[];
};

export type PurchaseOrderItemRow = {
  item: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  sort_order?: number;
};

export type PurchaseOrderDetail = {
  id: string;
  number: string;
  issue_date: string;
  valid_until: string;
  status: PurchaseOrderStatus;
  currency: string;
  supplier_id: string | null;
  from_snapshot: Record<string, unknown>;
  bill_to_snapshot: Record<string, unknown>;
  client_snapshot: Record<string, unknown> | null;
  discount_type: "value" | "percent";
  discount_amount: number;
  shipping_amount: number;
  notes: string | null;
  terms: string | null;
  items: PurchaseOrderItemRow[];
};

export type PurchaseOrderListRow = {
  id: string;
  number: string;
  issueDate: string;
  validUntil: string;
  status: PurchaseOrderStatus;
  currency: string;
  supplierName: string;
  total: number;
};

function nameFromBillTo(bill?: Record<string, unknown>) {
  if (!bill) return "";
  const t = bill.type as string | undefined;
  return t === "company"
    ? String(bill.company_name ?? "")
    : String(bill.full_name ?? "");
}

/** Map supplier row to the same bill-to shape as sales order customer */
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

export async function expireStalePurchaseOrders(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("purchase_orders")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .lt("valid_until", today)
    .eq("status", "active")
    .eq("company_id", companyId);

  if (error) {
    // eslint-disable-next-line no-console
    console.warn("expireStalePurchaseOrders:", error.message);
  }
}

export function computePurchaseOrderTotals(po: PurchaseOrderDetail) {
  const items = po.items ?? [];
  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const taxTotal = items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
  const discount =
    po.discount_type === "percent"
      ? (subtotal * Number(po.discount_amount || 0)) / 100
      : Number(po.discount_amount || 0);
  const ship = Number(po.shipping_amount ?? 0);
  const total = subtotal + taxTotal - discount + ship;
  return { subtotal, taxTotal, discount, shipping: ship, total };
}

export async function createPurchaseOrder(
  params: CreatePurchaseOrderPayload
): Promise<string> {
  const { items, ...inv } = params;
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase.rpc("create_purchase_order", {
    p_purchase_order: {
      company_id: companyId,
      issue_date: inv.issue_date,
      valid_until: inv.valid_until,
      status: inv.status,
      currency: inv.currency,
      discount_type: inv.discount_type,
      discount_amount: inv.discount_amount,
      shipping_amount: inv.shipping_amount ?? 0,
      notes: inv.notes ?? null,
      terms: inv.terms ?? null,
      supplier_id: inv.supplier_id,
      client_snapshot: inv.client_snapshot,
      from_snapshot: inv.from_snapshot,
      bill_to_snapshot: inv.bill_to_snapshot,
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
  } else if (data && typeof data === "object" && "purchase_order_id" in (data as object)) {
    id = (data as { purchase_order_id: string }).purchase_order_id;
  } else {
    id = String(data);
  }
  return id;
}

export async function listPurchaseOrders(opts?: {
  search?: string;
  status?: PurchaseOrderStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<{ rows: PurchaseOrderListRow[]; total: number }> {
  await expireStalePurchaseOrders();
  const companyId = await requireActiveCompanyId();

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("purchase_orders")
    .select(
      "id, number, issue_date, valid_until, status, currency, bill_to_snapshot, total",
      { count: "exact" }
    )
    .eq("company_id", companyId)
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

  const rows: PurchaseOrderListRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    number: r.number as string,
    issueDate: r.issue_date as string,
    validUntil: r.valid_until as string,
    status: normalizePurchaseOrderStatus(String(r.status)),
    currency: r.currency as string,
    supplierName: nameFromBillTo(r.bill_to_snapshot as Record<string, unknown>),
    total: Number(r.total ?? 0),
  }));

  return { rows, total: count ?? 0 };
}

export async function getPurchaseOrder(
  id: string
): Promise<PurchaseOrderDetail | null> {
  await expireStalePurchaseOrders();
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      `
      id, number, issue_date, valid_until, status, currency, supplier_id,
      from_snapshot, bill_to_snapshot, client_snapshot,
      discount_type, discount_amount, shipping_amount, notes, terms,
      purchase_order_items ( item, description, quantity, unit_price, tax_percent, sort_order )
    `
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) return null;

  const raw = (data.purchase_order_items ?? []) as PurchaseOrderItemRow[];
  const items = [...raw].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );

  return {
    id: data.id,
    number: data.number,
    issue_date: data.issue_date,
    valid_until: data.valid_until,
    status: normalizePurchaseOrderStatus(String(data.status)),
    currency: data.currency,
    supplier_id: (data.supplier_id as string) ?? null,
    from_snapshot: (data.from_snapshot ?? {}) as Record<string, unknown>,
    bill_to_snapshot: (data.bill_to_snapshot ?? {}) as Record<string, unknown>,
    client_snapshot: (data.client_snapshot ?? null) as Record<
      string,
      unknown
    > | null,
    discount_type: data.discount_type as "value" | "percent",
    discount_amount: Number(data.discount_amount ?? 0),
    shipping_amount: Number(data.shipping_amount ?? 0),
    notes: data.notes,
    terms: data.terms,
    items,
  };
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
}

export type UpdatePurchaseOrderPayload = Omit<
  CreatePurchaseOrderPayload,
  "items"
> & {
  items: PurchaseOrderLinePayload[];
};

export async function updatePurchaseOrder(
  id: string,
  params: UpdatePurchaseOrderPayload
): Promise<void> {
  const { items, ...inv } = params;
  const companyId = await requireActiveCompanyId();
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

  const { error: upErr } = await supabase
    .from("purchase_orders")
    .update({
      issue_date: inv.issue_date,
      valid_until: inv.valid_until,
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", companyId);

  if (upErr) throw upErr;

  const { error: delErr } = await supabase
    .from("purchase_order_items")
    .delete()
    .eq("purchase_order_id", id);
  if (delErr) throw delErr;

  const rows = items.map((it, idx) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    const lineTax = line * (Number(it.tax_percent) / 100);
    const sortOrder = it.sort_order ?? idx;
    return {
      purchase_order_id: id,
      company_id: companyId,
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
      .from("purchase_order_items")
      .insert(rows);
    if (insErr) throw insErr;
  }
}
