import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/settings-service";
import type { CustomerRow } from "@/lib/customers-service";

/** Only `active` (current) and `expired` (past valid_until or manual). */
export type SalesOrderStatus = "active" | "expired";

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
};

export type CreateSalesOrderPayload = {
  issue_date: string;
  valid_until: string;
  status: SalesOrderStatus;
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
};

export type SalesOrderDetail = {
  id: string;
  number: string;
  issue_date: string;
  valid_until: string;
  status: SalesOrderStatus;
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
  const { error } = await supabase
    .from("sales_orders")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .lt("valid_until", today)
    .eq("status", "active");

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
  const { data, error } = await supabase.rpc("create_sales_order", {
    p_sales_order: {
      issue_date: inv.issue_date,
      valid_until: inv.valid_until,
      status: inv.status,
      currency: inv.currency,
      discount_type: inv.discount_type,
      discount_amount: inv.discount_amount,
      shipping_amount: inv.shipping_amount ?? 0,
      notes: inv.notes ?? null,
      terms: inv.terms ?? null,
      customer_id: inv.customer_id,
      client_snapshot: inv.client_snapshot,
      from_snapshot: inv.from_snapshot,
      bill_to_snapshot: inv.bill_to_snapshot,
      created_from_quotation_id: created_from_quotation_id || null,
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

  let salesOrderId: string;
  if (typeof data === "string") {
    salesOrderId = data;
  } else if (data && typeof data === "object" && "sales_order_id" in (data as object)) {
    salesOrderId = (data as { sales_order_id: string }).sales_order_id;
  } else {
    salesOrderId = String(data);
  }
  return salesOrderId;
}

export async function listSalesOrders(opts?: {
  search?: string;
  status?: SalesOrderStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<{ rows: SalesOrderListRow[]; total: number }> {
  await expireStaleSalesOrders();

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("sales_orders")
    .select(
      "id, number, issue_date, valid_until, status, currency, bill_to_snapshot, total",
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
    currency: r.currency,
    clientName: nameFromBillTo(r.bill_to_snapshot),
    total: Number(r.total ?? 0),
  }));

  return { rows, total: count ?? 0 };
}

export async function getSalesOrder(id: string): Promise<SalesOrderDetail | null> {
  await expireStaleSalesOrders();

  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      `
      id, number, issue_date, valid_until, status, currency, customer_id, created_from_quotation_id,
      from_snapshot, bill_to_snapshot, client_snapshot,
      discount_type, discount_amount, shipping_amount, notes, terms,
      sales_order_items ( item, description, quantity, unit_price, tax_percent, sort_order )
    `
    )
    .eq("id", id)
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

export async function deleteSalesOrder(id: string): Promise<void> {
  const { count: invCount, error: invErr } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("created_from_sales_order_id", id);

  if (invErr) throw invErr;

  if ((invCount ?? 0) > 0) {
    throw new Error(
      "Cannot delete this sales order: it was converted to an invoice."
    );
  }

  const { error } = await supabase.from("sales_orders").delete().eq("id", id);
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
    .eq("id", id);

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
      .from("sales_order_items")
      .insert(rows);
    if (insErr) throw insErr;
  }
}
