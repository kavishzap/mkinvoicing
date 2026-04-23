import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import {
  ensureUserSettingsRow,
  fetchPreferences,
  getCurrentUserId,
} from "@/lib/settings-service";
import type { Profile } from "@/lib/settings-service";
import type { CustomerRow } from "@/lib/customers-service";
import type { Database } from "@/types/supabase";

/** Only `active` (current) and `expired` (past valid_until or manual). */
export type SalesOrderStatus = "active" | "expired";

/** Fulfillment pipeline; stored as `sales_orders.fulfillment_status`. */
export type SalesOrderFulfillmentStatus =
  Database["public"]["Enums"]["sales_order_fulfillment_status"];

export const SALES_ORDER_FULFILLMENT_STATUSES: SalesOrderFulfillmentStatus[] = [
  "new",
  "delivery note created",
  "delivered to driver",
  "delivered to customer",
  "cancelled",
  "Rescheduled",
];

/** Older app / DB values → current enum (best-effort). */
const FULFILLMENT_LEGACY: Record<string, SalesOrderFulfillmentStatus> = {
  pending: "new",
  confirmed: "new",
  processing: "new",
  shipped: "new",
  delivered: "delivered to customer",
  delivered_to_driver: "delivered to driver",
  delivered_to_customer: "delivered to customer",
};

export function normalizeSalesOrderFulfillmentStatus(
  raw: string | null | undefined
): SalesOrderFulfillmentStatus {
  const v = String(raw ?? "").trim();
  const fromLegacy = FULFILLMENT_LEGACY[v];
  if (fromLegacy) return fromLegacy;
  if (v.toLowerCase() === "rescheduled") return "Rescheduled";
  if (
    SALES_ORDER_FULFILLMENT_STATUSES.includes(v as SalesOrderFulfillmentStatus)
  ) {
    return v as SalesOrderFulfillmentStatus;
  }
  return "new";
}

export const SALES_ORDER_FULFILLMENT_LABELS: Record<
  SalesOrderFulfillmentStatus,
  string
> = {
  new: "New",
  "delivery note created": "Delivery note created",
  "delivered to driver": "Delivered to driver",
  "delivered to customer": "Delivered to customer",
  cancelled: "Cancelled",
  Rescheduled: "Rescheduled",
};

/** Stored as `sales_orders.payment_status`. */
export type SalesOrderPaymentStatus = "unpaid" | "paid" | "partial";

export function normalizeSalesOrderPaymentStatus(
  raw: string | null | undefined
): SalesOrderPaymentStatus {
  const v = String(raw ?? "unpaid").trim().toLowerCase();
  if (v === "paid") return "paid";
  if (v === "partial" || v === "partially_paid") return "partial";
  return "unpaid";
}

export const SALES_ORDER_PAYMENT_LABELS: Record<
  SalesOrderPaymentStatus,
  string
> = {
  unpaid: "Unpaid",
  paid: "Paid",
  partial: "Partial",
};

/** Map DB / legacy values to the two-status model. */
export function normalizeSalesOrderStatus(raw: string): SalesOrderStatus {
  return raw === "expired" ? "expired" : "active";
}

export type SalesOrderLinePayload = {
  item: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  sort_order?: number;
  /** Links the line to `public.products` when chosen from inventory. */
  product_id?: string | null;
};

export type CreateSalesOrderPayload = {
  issue_date: string;
  valid_until: string;
  status: SalesOrderStatus;
  fulfillment_status: SalesOrderFulfillmentStatus;
  currency: string;
  discount_type: "value" | "percent";
  discount_amount: number;
  shipping_amount?: number;
  notes?: string;
  terms?: string;
  customer_id: string | null;
  client_snapshot: Record<string, unknown> | null;
  from_snapshot: Record<string, unknown>;
  bill_to_snapshot: Record<string, unknown>;
  /** When converting from quotation — pass quotation id */
  created_from_quotation_id?: string | null;
  items: SalesOrderLinePayload[];
};

export type SalesOrderItemRow = {
  item: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  sort_order?: number;
  product_id?: string | null;
};

export type SalesOrderDetail = {
  id: string;
  number: string;
  issue_date: string;
  valid_until: string;
  status: SalesOrderStatus;
  fulfillment_status: SalesOrderFulfillmentStatus;
  payment_status: SalesOrderPaymentStatus;
  currency: string;
  customer_id: string | null;
  created_from_quotation_id: string | null;
  from_snapshot: Record<string, unknown>;
  bill_to_snapshot: Record<string, unknown>;
  client_snapshot: Record<string, unknown> | null;
  discount_type: "value" | "percent";
  discount_amount: number;
  shipping_amount: number;
  notes: string | null;
  terms: string | null;
  items: SalesOrderItemRow[];
};

export type SalesOrderListRow = {
  id: string;
  number: string;
  issueDate: string;
  validUntil: string;
  status: SalesOrderStatus;
  fulfillmentStatus: SalesOrderFulfillmentStatus;
  paymentStatus: SalesOrderPaymentStatus;
  currency: string;
  clientName: string;
  total: number;
};

function nameFromBillTo(bill?: Record<string, unknown>) {
  if (!bill) return "";
  const t = bill.type as string | undefined;
  return t === "company"
    ? String(bill.company_name ?? "")
    : String(bill.full_name ?? "");
}

export type SalesOrderClientInfo = {
  type: "company" | "individual";
  companyName: string;
  contactName: string;
  fullName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  postal: string;
  country: string;
  address_line_1: string;
  address_line_2: string;
};

export function buildFromSnapshotForSalesOrder(
  profile: Profile
): Record<string, unknown> {
  if (profile.accountType === "company") {
    return {
      type: "company",
      company_name: profile.companyName ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      street: profile.street ?? "",
      city: profile.city ?? "",
      postal: profile.postal ?? "",
      country: profile.country ?? "",
      address_line_1: profile.address_line_1 ?? "",
      address_line_2: profile.address_line_2 ?? "",
      registration_id: profile.registrationId ?? "",
      vat_number: profile.vatNumber ?? "",
    };
  }
  return {
    type: "individual",
    full_name: profile.fullName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    street: profile.street ?? "",
    city: profile.city ?? "",
    postal: profile.postal ?? "",
    country: profile.country ?? "",
    address_line_1: profile.address_line_1 ?? "",
    address_line_2: profile.address_line_2 ?? "",
  };
}

export function buildBillToSnapshot(
  c: SalesOrderClientInfo
): Record<string, unknown> {
  return {
    type: c.type,
    company_name: c.companyName || null,
    contact_name: c.contactName || null,
    full_name: c.fullName || null,
    email: c.email || null,
    phone: c.phone || null,
    street: c.street || null,
    city: c.city || null,
    postal: c.postal || null,
    country: c.country || null,
    address_line_1: c.address_line_1 || null,
    address_line_2: c.address_line_2 || null,
  };
}

export function clientInfoFromBillSnapshot(
  bill: Record<string, unknown>
): SalesOrderClientInfo {
  const t = bill.type === "individual" ? "individual" : "company";
  return {
    type: t,
    companyName: String(bill.company_name ?? ""),
    contactName: String(bill.contact_name ?? ""),
    fullName: String(bill.full_name ?? ""),
    email: String(bill.email ?? ""),
    phone: String(bill.phone ?? ""),
    street: String(bill.street ?? ""),
    city: String(bill.city ?? ""),
    postal: String(bill.postal ?? ""),
    country: String(bill.country ?? ""),
    address_line_1: String(bill.address_line_1 ?? ""),
    address_line_2: String(bill.address_line_2 ?? ""),
  };
}

/**
 * Marks active sales orders as expired when valid_until is before today (server date).
 */
export async function expireStaleSalesOrders(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("sales_orders")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .lt("valid_until", today)
    .eq("status", "active")
    .eq("company_id", companyId);

  if (error) {
    // eslint-disable-next-line no-console
    console.warn("expireStaleSalesOrders:", error.message);
  }
}

export function billToFromCustomer(c: CustomerRow): SalesOrderClientInfo {
  return {
    type: c.type,
    companyName: c.companyName ?? "",
    contactName: c.contactName ?? "",
    fullName: c.fullName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    street: c.street ?? "",
    city: c.city ?? "",
    postal: c.postal ?? "",
    country: c.country ?? "",
    address_line_1: c.address_line_1 ?? "",
    address_line_2: c.address_line_2 ?? "",
  };
}

export function computeSalesOrderTotals(so: SalesOrderDetail) {
  const items = so.items ?? [];
  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const taxTotal = items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
  const discount =
    so.discount_type === "percent"
      ? (subtotal * Number(so.discount_amount || 0)) / 100
      : Number(so.discount_amount || 0);
  const ship = Number(so.shipping_amount ?? 0);
  const total = subtotal + taxTotal - discount + ship;
  return { subtotal, taxTotal, discount, shipping: ship, total };
}

export async function createSalesOrder(
  params: CreateSalesOrderPayload
): Promise<string> {
  const { items, created_from_quotation_id, ...inv } = params;
  const companyId = await requireActiveCompanyId();
  const userId = await getCurrentUserId();
  await ensureUserSettingsRow();

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

  const lastError: { message?: string; code?: string }[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    const prefs = await fetchPreferences();
    const prefix = prefs.salesOrderPrefix ?? "SO";
    const pad = prefs.salesOrderNumberPadding ?? 4;
    const nextNum = prefs.salesOrderNextNumber ?? 1;
    const number = `${prefix}-${String(nextNum).padStart(pad, "0")}`;

    const orderRow = {
      company_id: companyId,
      user_id: userId,
      number,
      issue_date: inv.issue_date,
      valid_until: inv.valid_until,
      status: inv.status,
      fulfillment_status: inv.fulfillment_status,
      payment_status: "unpaid" as const,
      currency: inv.currency,
      discount_type: inv.discount_type,
      discount_amount: inv.discount_amount,
      shipping_amount: ship,
      subtotal,
      tax_total: taxTotal,
      total,
      notes: inv.notes ?? null,
      terms: inv.terms ?? null,
      customer_id: inv.customer_id,
      client_snapshot: inv.client_snapshot,
      from_snapshot: inv.from_snapshot,
      bill_to_snapshot: inv.bill_to_snapshot,
      created_from_quotation_id: created_from_quotation_id || null,
    };

    const { data: inserted, error: insSo } = await supabase
      .from("sales_orders")
      .insert(orderRow)
      .select("id")
      .single();

    if (insSo) {
      lastError[0] = { message: insSo.message, code: insSo.code };
      if (insSo.code === "23505") continue;
      throw insSo;
    }

    const salesOrderId = inserted.id as string;

    const itemRows = items.map((it, idx) => {
      const line = Number(it.quantity) * Number(it.unit_price);
      const lineTax = line * (Number(it.tax_percent) / 100);
      const sortOrder = it.sort_order ?? idx;
      return {
        sales_order_id: salesOrderId,
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
        product_id: it.product_id ?? null,
      };
    });

    const { error: insItems } = await supabase
      .from("sales_order_items")
      .insert(itemRows);
    if (insItems) {
      await supabase.from("sales_orders").delete().eq("id", salesOrderId);
      throw insItems;
    }

    const { error: bumpErr } = await supabase
      .from("user_settings")
      .update({ sales_order_next_number: nextNum + 1 })
      .eq("user_id", userId)
      .eq("company_id", companyId);
    if (bumpErr) {
      // eslint-disable-next-line no-console
      console.warn("createSalesOrder: could not bump sales_order_next_number:", bumpErr.message);
    }

    return salesOrderId;
  }

  throw new Error(
    lastError[0]?.message ??
      "Could not allocate a unique sales order number. Try again."
  );
}

export async function listSalesOrders(opts?: {
  search?: string;
  status?: SalesOrderStatus | "all";
  /** When set (not `"all"`), filter by `sales_orders.fulfillment_status`. */
  fulfillmentStatus?: SalesOrderFulfillmentStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<{ rows: SalesOrderListRow[]; total: number }> {
  await expireStaleSalesOrders();
  const companyId = await requireActiveCompanyId();

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("sales_orders")
    .select(
      "id, number, issue_date, valid_until, status, fulfillment_status, payment_status, currency, bill_to_snapshot, total",
      { count: "exact" }
    )
    .eq("company_id", companyId)
    .order("issue_date", { ascending: false })
    .range(from, to);

  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  if (opts?.fulfillmentStatus && opts.fulfillmentStatus !== "all") {
    q = q.eq("fulfillment_status", opts.fulfillmentStatus);
  }

  if (opts?.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(
      [`number.ilike.${s}`, `bill_to_snapshot->>company_name.ilike.${s}`, `bill_to_snapshot->>full_name.ilike.${s}`].join(
        ","
      )
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;

  const rows: SalesOrderListRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    number: r.number,
    issueDate: r.issue_date,
    validUntil: r.valid_until,
    status: normalizeSalesOrderStatus(String(r.status)),
    fulfillmentStatus: normalizeSalesOrderFulfillmentStatus(
      r.fulfillment_status
    ),
    paymentStatus: normalizeSalesOrderPaymentStatus(r.payment_status),
    currency: r.currency,
    clientName: nameFromBillTo(r.bill_to_snapshot),
    total: Number(r.total ?? 0),
  }));

  return { rows, total: count ?? 0 };
}

export async function getSalesOrder(id: string): Promise<SalesOrderDetail | null> {
  await expireStaleSalesOrders();
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      `
      id, number, issue_date, valid_until, status, fulfillment_status, payment_status, currency, customer_id, created_from_quotation_id,
      from_snapshot, bill_to_snapshot, client_snapshot,
      discount_type, discount_amount, shipping_amount, notes, terms,
      sales_order_items ( item, description, quantity, unit_price, tax_percent, sort_order, product_id )
    `
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) return null;

  const raw = (data.sales_order_items ?? []) as SalesOrderItemRow[];
  const items = [...raw].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );

  return {
    id: data.id,
    number: data.number,
    issue_date: data.issue_date,
    valid_until: data.valid_until,
    status: normalizeSalesOrderStatus(String(data.status)),
    fulfillment_status: normalizeSalesOrderFulfillmentStatus(
      (data as { fulfillment_status?: string | null }).fulfillment_status
    ),
    payment_status: normalizeSalesOrderPaymentStatus(
      (data as { payment_status?: string | null }).payment_status
    ),
    currency: data.currency,
    customer_id: (data.customer_id as string) ?? null,
    created_from_quotation_id: (data.created_from_quotation_id as string) ?? null,
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

export async function updateSalesOrderPaymentStatus(
  id: string,
  payment_status: SalesOrderPaymentStatus
): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("sales_orders")
    .update({
      payment_status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function deleteSalesOrder(id: string): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { count: invCount, error: invErr } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("created_from_sales_order_id", id)
    .eq("company_id", companyId);

  if (invErr) throw invErr;

  if ((invCount ?? 0) > 0) {
    throw new Error(
      "Cannot delete this sales order: it was converted to an invoice."
    );
  }

  const { error } = await supabase
    .from("sales_orders")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
}

export type UpdateSalesOrderPayload = Omit<
  CreateSalesOrderPayload,
  "items" | "created_from_quotation_id"
> & {
  items: SalesOrderLinePayload[];
};

export async function updateSalesOrder(
  id: string,
  params: UpdateSalesOrderPayload
): Promise<void> {
  const { items, ...inv } = params;
  const companyId = await requireActiveCompanyId();

  const { data: existingRow, error: existingErr } = await supabase
    .from("sales_orders")
    .select("fulfillment_status")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (!existingRow) {
    throw new Error("Sales order not found.");
  }
  if (
    normalizeSalesOrderFulfillmentStatus(
      (existingRow as { fulfillment_status?: string | null }).fulfillment_status
    ) !== "new"
  ) {
    throw new Error(
      "This sales order can only be edited while fulfillment status is New."
    );
  }

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
    .from("sales_orders")
    .update({
      issue_date: inv.issue_date,
      valid_until: inv.valid_until,
      status: inv.status,
      fulfillment_status: inv.fulfillment_status,
      currency: inv.currency,
      from_snapshot: inv.from_snapshot,
      bill_to_snapshot: inv.bill_to_snapshot,
      client_snapshot: inv.client_snapshot,
      customer_id: inv.customer_id,
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
    .from("sales_order_items")
    .delete()
    .eq("sales_order_id", id);
  if (delErr) throw delErr;

  const rows = items.map((it, idx) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    const lineTax = line * (Number(it.tax_percent) / 100);
    const sortOrder = it.sort_order ?? idx;
    return {
      sales_order_id: id,
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
      product_id: it.product_id ?? null,
    };
  });

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("sales_order_items")
      .insert(rows);
    if (insErr) throw insErr;
  }
}
