import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import {
  ensureUserSettingsRow,
  fetchPreferences,
  getCurrentUserId,
} from "@/lib/settings-service";
import type { Profile } from "@/lib/settings-service";
import type { CustomerRow } from "@/lib/customers-service";
import { listDeliveryCities } from "@/lib/delivery-zones-service";
import type { Database } from "@/src/types/supabase";

/** Only `active` (current) and `expired` (past valid_until or manual). */
export type SalesOrderStatus = "active" | "expired";

/** Fulfillment pipeline; stored as `sales_orders.fulfillment_status`. */
export type SalesOrderFulfillmentStatus =
  Database["public"]["Enums"]["sales_order_fulfillment_status"];

export const SALES_ORDER_FULFILLMENT_STATUSES: SalesOrderFulfillmentStatus[] = [
  "new",
  "pending",
  "delivery note created",
  "delivered to driver",
  "delivered to customer",
  "completed",
  "cancelled",
  "rescheduled",
];

/** Fulfillment states where line items and amounts may still be edited in the app. */
export function salesOrderFulfillmentAllowsEditing(
  status: SalesOrderFulfillmentStatus
): boolean {
  return status === "new" || status === "pending";
}

/** Older app / DB values → current enum (best-effort). */
const FULFILLMENT_LEGACY: Record<string, SalesOrderFulfillmentStatus> = {
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
  const fromLegacy =
    FULFILLMENT_LEGACY[v] ?? FULFILLMENT_LEGACY[v.toLowerCase()];
  if (fromLegacy) return fromLegacy;
  /** DB enum is lowercase `rescheduled`; accept legacy capital-R from older snapshots. */
  if (v.toLowerCase() === "rescheduled") return "rescheduled";
  if (v.toLowerCase() === "pending") return "pending";
  if (v.toLowerCase() === "completed") return "completed";
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
  pending: "Pending",
  "delivery note created": "Delivery note created",
  "delivered to driver": "Delivered to driver",
  "delivered to customer": "Delivered to customer",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
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
  city_id?: string | null;
  client_snapshot: Record<string, unknown> | null;
  from_snapshot: Record<string, unknown>;
  bill_to_snapshot: Record<string, unknown>;
  /** When converting from quotation — pass quotation id */
  created_from_quotation_id?: string | null;
  /** Planned delivery date (`sales_orders.delivery_date`). */
  delivery_date?: string | null;
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
  /** From joined `products` row when `product_id` is set. */
  product_name?: string | null;
  product_sku?: string | null;
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
  /** ISO date string `YYYY-MM-DD` or null. */
  delivery_date: string | null;
  /** Delivery catalog city (`cities.id`); source of truth for the City field on the form. */
  city_id: string | null;
  items: SalesOrderItemRow[];
};

export type SalesOrderListRow = {
  id: string;
  number: string;
  issueDate: string;
  validUntil: string;
  /** ISO `YYYY-MM-DD` or null when not set. */
  deliveryDate: string | null;
  /** ISO timestamp from `sales_orders.created_at`. */
  createdAt: string;
  /** Delivery catalog city name (`cities.name` via `city_id`), else bill-to snapshot city. */
  cityName: string;
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
  if (t === "company") {
    return String(bill.company_name ?? bill.name ?? "");
  }
  return String(bill.full_name ?? bill.name ?? "");
}

function cityLabelFromListRow(
  r: { city_id?: unknown; bill_to_snapshot?: unknown },
  cityById: Map<string, string>,
): string {
  const cid =
    r.city_id != null && String(r.city_id).trim()
      ? String(r.city_id)
      : "";
  if (cid && cityById.has(cid)) return cityById.get(cid)!;
  const bill = r.bill_to_snapshot as Record<string, unknown> | undefined;
  if (!bill) return "";
  return String(bill.city ?? "").trim();
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
    city: (c.cityName ?? c.city ?? "").trim(),
    postal: c.postal ?? "",
    country: c.country ?? "",
    address_line_1: c.address_line_1 ?? "",
    address_line_2: c.address_line_2 ?? "",
  };
}

/**
 * Resolves `sales_orders.city_id` from the delivery city dropdown (matched by city name).
 * The selected name always wins over the linked customer’s `city_id`.
 */
export function cityIdFromDeliveryCityName(
  cityName: string,
  cities: { id: string; name: string }[]
): string | null {
  const t = cityName.trim();
  if (!t) return null;
  const match = cities.find((c) => c.name === t);
  return match?.id ?? null;
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
      city_id: inv.city_id ?? null,
      client_snapshot: inv.client_snapshot,
      from_snapshot: inv.from_snapshot,
      bill_to_snapshot: inv.bill_to_snapshot,
      created_from_quotation_id: created_from_quotation_id || null,
      delivery_date: inv.delivery_date?.trim()
        ? inv.delivery_date.trim().slice(0, 10)
        : null,
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

/**
 * Parallel head-only counts for the sales order directory KPI strip.
 * Does not run `expireStaleSalesOrders` — call that once before this when loading the list.
 */
export async function getSalesOrderKpiCounts(): Promise<{
  total: number;
  active: number;
  expired: number;
}> {
  const companyId = await requireActiveCompanyId();
  const mk = (status?: SalesOrderStatus) => {
    let q = supabase
      .from("sales_orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    if (status) q = q.eq("status", status);
    return q;
  };
  const [allRes, activeRes, expiredRes] = await Promise.all([
    mk(),
    mk("active"),
    mk("expired"),
  ]);
  if (allRes.error) throw allRes.error;
  if (activeRes.error) throw activeRes.error;
  if (expiredRes.error) throw expiredRes.error;
  return {
    total: allRes.count ?? 0,
    active: activeRes.count ?? 0,
    expired: expiredRes.count ?? 0,
  };
}

export async function listSalesOrders(opts?: {
  search?: string;
  status?: SalesOrderStatus | "all";
  /** When set (not `"all"`), filter by `sales_orders.fulfillment_status`. */
  fulfillmentStatus?: SalesOrderFulfillmentStatus | "all";
  /** When set, only orders linked to this customer (`sales_orders.customer_id`). */
  customerId?: string;
  page?: number;
  pageSize?: number;
  /**
   * When true, skips `expireStaleSalesOrders()` (caller should run it once before listing,
   * e.g. together with `getSalesOrderKpiCounts()`).
   */
  skipExpireStale?: boolean;
}): Promise<{ rows: SalesOrderListRow[]; total: number }> {
  if (!opts?.skipExpireStale) {
    await expireStaleSalesOrders();
  }
  const companyId = await requireActiveCompanyId();

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const citiesFetch = listDeliveryCities();

  let q = supabase
    .from("sales_orders")
    .select(
      "id, number, issue_date, valid_until, delivery_date, created_at, status, fulfillment_status, payment_status, currency, bill_to_snapshot, total, city_id",
      { count: "exact" }
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  if (opts?.fulfillmentStatus && opts.fulfillmentStatus !== "all") {
    q = q.eq("fulfillment_status", opts.fulfillmentStatus);
  }

  const cid = opts?.customerId?.trim();
  if (cid) {
    q = q.eq("customer_id", cid);
  }

  if (opts?.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(
      [`number.ilike.${s}`, `bill_to_snapshot->>company_name.ilike.${s}`, `bill_to_snapshot->>full_name.ilike.${s}`].join(
        ","
      )
    );
  }

  const [{ data, error, count }, cityRows] = await Promise.all([
    q,
    citiesFetch,
  ]);
  if (error) throw error;

  const cityById = new Map(cityRows.map((c) => [c.id, c.name] as const));

  const rows: SalesOrderListRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    number: r.number,
    issueDate: r.issue_date,
    validUntil: r.valid_until,
    deliveryDate:
      r.delivery_date != null && String(r.delivery_date).trim()
        ? String(r.delivery_date).slice(0, 10)
        : null,
    createdAt: r.created_at != null ? String(r.created_at) : "",
    cityName: cityLabelFromListRow(r, cityById),
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

/** Shape of `sales_orders` row returned by `getSalesOrder` embedded select (dynamic string breaks generated Supabase types). */
type SalesOrderSingleQueryRow = {
  id: string;
  number: string;
  issue_date: string;
  valid_until: string;
  delivery_date?: string | null;
  status: string;
  fulfillment_status?: string | null;
  payment_status?: string | null;
  currency: string;
  customer_id?: string | null;
  created_from_quotation_id?: string | null;
  from_snapshot?: unknown;
  bill_to_snapshot?: unknown;
  client_snapshot?: unknown;
  discount_type?: string;
  discount_amount?: unknown;
  shipping_amount?: unknown;
  notes?: string | null;
  terms?: string | null;
  city_id?: string | null;
  sales_order_items?: Record<string, unknown>[];
};

/**
 * Load a single sales order. Does **not** run `expireStaleSalesOrders` (that belongs on the list
 * flow only — it updates many rows and is slow on every detail view).
 *
 * @param mode `view` — omits `client_snapshot`; line items still include `product_id` and catalog name/SKU when linked.
 *   Use `full` (default) for edit / duplicate / invoice conversion.
 */
export async function getSalesOrder(
  id: string,
  opts?: { mode?: "view" | "full" }
): Promise<SalesOrderDetail | null> {
  const mode = opts?.mode ?? "full";
  const companyId = await requireActiveCompanyId();

  const itemsSelect = `
      sales_order_items (
        item,
        description,
        quantity,
        unit_price,
        tax_percent,
        sort_order,
        product_id,
        products ( id, name, sku )
      )
    `;

  const headerSelect =
    mode === "view"
      ? `
      id, number, issue_date, valid_until, delivery_date, status, fulfillment_status, payment_status, currency, customer_id, created_from_quotation_id,
      city_id,
      from_snapshot, bill_to_snapshot,
      discount_type, discount_amount, shipping_amount, notes, terms,
      ${itemsSelect}
    `
      : `
      id, number, issue_date, valid_until, delivery_date, status, fulfillment_status, payment_status, currency, customer_id, created_from_quotation_id,
      city_id,
      from_snapshot, bill_to_snapshot, client_snapshot,
      discount_type, discount_amount, shipping_amount, notes, terms,
      ${itemsSelect}
    `;

  const { data, error } = await supabase
    .from("sales_orders")
    .select(headerSelect)
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error || data == null) return null;

  const row = data as unknown as SalesOrderSingleQueryRow;

  const rawItems = (row.sales_order_items ?? []) as Record<string, unknown>[];
  const items: SalesOrderItemRow[] = [...rawItems]
    .sort(
      (a, b) =>
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    )
    .map((row) => {
      const nested = row.products;
      const pr = Array.isArray(nested) ? nested[0] : nested;
      const p =
        pr && typeof pr === "object"
          ? (pr as Record<string, unknown>)
          : null;
      const pid =
        row.product_id != null && String(row.product_id).trim()
          ? String(row.product_id)
          : null;
      return {
        item: String(row.item ?? ""),
        description: (row.description as string | null) ?? null,
        quantity: Number(row.quantity ?? 0),
        unit_price: Number(row.unit_price ?? 0),
        tax_percent: Number(row.tax_percent ?? 0),
        sort_order:
          row.sort_order != null ? Number(row.sort_order) : undefined,
        product_id: pid,
        product_name:
          p?.name != null && String(p.name).trim()
            ? String(p.name)
            : null,
        product_sku:
          p?.sku != null && String(p.sku).trim()
            ? String(p.sku)
            : null,
      };
    });

  const rawDelivery = row.delivery_date;

  return {
    id: row.id,
    number: row.number,
    issue_date: row.issue_date,
    valid_until: row.valid_until,
    status: normalizeSalesOrderStatus(String(row.status)),
    fulfillment_status: normalizeSalesOrderFulfillmentStatus(
      row.fulfillment_status
    ),
    payment_status: normalizeSalesOrderPaymentStatus(row.payment_status),
    currency: row.currency,
    customer_id: row.customer_id ?? null,
    created_from_quotation_id: row.created_from_quotation_id ?? null,
    from_snapshot: (row.from_snapshot ?? {}) as Record<string, unknown>,
    bill_to_snapshot: (row.bill_to_snapshot ?? {}) as Record<string, unknown>,
    client_snapshot:
      mode === "view"
        ? null
        : ((row.client_snapshot ?? null) as Record<string, unknown> | null),
    discount_type: row.discount_type as "value" | "percent",
    discount_amount: Number(row.discount_amount ?? 0),
    shipping_amount: Number(row.shipping_amount ?? 0),
    notes: row.notes ?? null,
    terms: row.terms ?? null,
    delivery_date:
      rawDelivery != null && String(rawDelivery).trim()
        ? String(rawDelivery).slice(0, 10)
        : null,
    city_id:
      row.city_id != null && String(row.city_id).trim()
        ? String(row.city_id)
        : null,
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

export async function updateSalesOrderFulfillmentStatus(
  id: string,
  fulfillment_status: SalesOrderFulfillmentStatus
): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const clearDriverDelivery =
    fulfillment_status === "delivered to customer" ||
    fulfillment_status === "completed" ||
    fulfillment_status === "cancelled";

  const patch: Record<string, unknown> = {
    fulfillment_status,
    updated_at: new Date().toISOString(),
  };
  if (clearDriverDelivery) {
    patch.active_driver_delivery_id = null;
  }

  const { error } = await supabase
    .from("sales_orders")
    .update(patch as never)
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
  const existingFulfillment = normalizeSalesOrderFulfillmentStatus(
    (existingRow as { fulfillment_status?: string | null }).fulfillment_status
  );
  if (!salesOrderFulfillmentAllowsEditing(existingFulfillment)) {
    throw new Error(
      "This sales order can only be edited while fulfillment status is New or Pending."
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
      city_id: inv.city_id ?? null,
      subtotal,
      tax_total: taxTotal,
      discount_type: inv.discount_type,
      discount_amount: inv.discount_amount,
      shipping_amount: ship,
      total,
      notes: inv.notes ?? null,
      terms: inv.terms ?? null,
      delivery_date: inv.delivery_date?.trim()
        ? inv.delivery_date.trim().slice(0, 10)
        : null,
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
