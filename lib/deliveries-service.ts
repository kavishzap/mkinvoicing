import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import { getCurrentUserId } from "@/lib/settings-service";
import { listDriverRoleTeamMembers, type TeamMemberRow } from "@/lib/company-team-service";
import {
  normalizeSalesOrderFulfillmentStatus,
  normalizeSalesOrderPaymentStatus,
  type SalesOrderFulfillmentStatus,
  type SalesOrderPaymentStatus,
} from "@/lib/sales-orders-service";

/** Fulfillment values allowed when picking sales orders for a new delivery note. */
export const DELIVERY_NOTE_ELIGIBLE_FULFILLMENT_STATUSES: SalesOrderFulfillmentStatus[] =
  ["new", "rescheduled"];

export function salesOrderEligibleForDeliveryNote(
  status: SalesOrderFulfillmentStatus | string | null | undefined,
): boolean {
  const normalized = normalizeSalesOrderFulfillmentStatus(status);
  return DELIVERY_NOTE_ELIGIBLE_FULFILLMENT_STATUSES.includes(normalized);
}

/** Fulfillment states whose order total counts toward driver cash for settlement. */
const DRIVER_SETTLEMENT_CASH_FULFILLMENT_KEYS = new Set([
  "delivered to customer",
  "completed",
  "upselling",
]);

/**
 * Sum order totals for cash settlement: sales orders with fulfillment
 * **Delivered to customer**, **Completed**, or **Upselling**.
 */
function salesOrderCountsForDriverSettlementCash(
  fulfillmentStatus: string | null | undefined
): boolean {
  const fulfillment = normalizeSalesOrderFulfillmentStatus(fulfillmentStatus);
  return DRIVER_SETTLEMENT_CASH_FULFILLMENT_KEYS.has(
    String(fulfillment).trim().toLowerCase()
  );
}

export const DELIVERY_NOTE_STATUSES = [
  "new",
  "delivered_to_driver",
  "completed",
] as const;

export type DeliveryNoteStatus = (typeof DELIVERY_NOTE_STATUSES)[number];

export const DELIVERY_NOTE_STATUS_LABELS: Record<DeliveryNoteStatus, string> = {
  new: "New",
  delivered_to_driver: "Delivered to driver",
  completed: "Completed",
};

export function normalizeDeliveryNoteStatus(
  raw: string | null | undefined
): DeliveryNoteStatus {
  const s = String(raw ?? "new").trim().toLowerCase();
  if (s === "new" || s === "delivered_to_driver" || s === "completed") {
    return s;
  }
  return "new";
}

function nextDeliveryNoteStatus(
  current: DeliveryNoteStatus
): DeliveryNoteStatus | null {
  if (current === "new") return "delivered_to_driver";
  if (current === "delivered_to_driver") return "completed";
  return null;
}

async function resolvePrimaryWarehouseId(
  companyId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("locations")
    .select("id")
    .eq("company_id", companyId)
    .eq("location_type", "warehouse")
    .eq("is_active", true)
    .eq("is_primary_warehouse", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data as { id?: string } | null;
  return row?.id ? String(row.id) : null;
}

/**
 * Driver's stock location: active `location_drivers` row whose location is an active `driver_location`.
 * Mirrors `mark_delivery_delivered_to_driver` in the database.
 */
async function resolveActiveDriverStockLocationId(
  companyId: string,
  driverUserId: string
): Promise<string | null> {
  const { data: links, error: ldErr } = await supabase
    .from("location_drivers")
    .select("location_id")
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId)
    .eq("is_active", true);

  if (ldErr) throw new Error(ldErr.message);

  const locIds = [
    ...new Set(
      (links ?? []).map((r: { location_id?: string }) =>
        String(r.location_id ?? "")
      )
    ),
  ].filter(Boolean);

  if (locIds.length === 0) return null;

  const { data: locs, error: locErr } = await supabase
    .from("locations")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("location_type", "driver_location")
    .in("id", locIds)
    .limit(1);

  if (locErr) throw new Error(locErr.message);
  const first = locs?.[0] as { id?: string } | undefined;
  return first?.id ? String(first.id) : null;
}

export type DeliveredToDriverPrecheck =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Validates setup before calling `mark_delivery_delivered_to_driver`
 * (primary warehouse, driver ↔ driver location, linked orders).
 * Stock levels are still enforced inside the RPC.
 */
export async function precheckDeliveryDeliveredToDriver(params: {
  companyId: string;
  driverUserId: string;
  salesOrderIds: string[];
}): Promise<DeliveredToDriverPrecheck> {
  if (params.salesOrderIds.length === 0) {
    return {
      ok: false,
      message: "This delivery has no linked sales orders.",
    };
  }

  const primaryId = await resolvePrimaryWarehouseId(params.companyId);
  if (!primaryId) {
    return {
      ok: false,
      message:
        "No active primary warehouse is configured. Mark exactly one active warehouse as the primary warehouse under Locations.",
    };
  }

  const driverLocId = await resolveActiveDriverStockLocationId(
    params.companyId,
    params.driverUserId
  );
  if (!driverLocId) {
    return {
      ok: false,
      message:
        "This driver is not assigned to an active driver location. Link them under Locations (driver location + Drivers tab).",
    };
  }

  return { ok: true };
}

/** Postgres `mark_delivery_delivered_to_driver` stock error (product id in legacy messages). */
const PRIMARY_WAREHOUSE_STOCK_ERROR_RE =
  /Not enough stock in (?:the )?primary warehouse for product ([^.\s]+)\.\s*Required\s*([\d.]+),\s*available\s*([\d.]+)\./i;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Replaces product id/uuid in RPC stock errors with catalog name (and SKU when helpful).
 */
async function humanizePrimaryWarehouseStockError(
  message: string,
  companyId: string,
): Promise<string> {
  const match = message.match(PRIMARY_WAREHOUSE_STOCK_ERROR_RE);
  if (!match) return message;

  const productRef = match[1];
  const required = match[2];
  const available = match[3];

  let query = supabase
    .from("products")
    .select("id, name, sku")
    .eq("company_id", companyId);

  if (UUID_RE.test(productRef)) {
    query = query.eq("id", productRef);
  } else {
    query = query.or(`id.eq.${productRef},sku.eq.${productRef}`);
  }

  const { data, error } = await query.maybeSingle();
  if (error) return message;

  const name = String(data?.name ?? "").trim();
  const sku = String(data?.sku ?? "").trim();
  const label =
    name && sku && name !== sku
      ? `${name} (${sku})`
      : name || sku || productRef;

  return `Not enough stock in primary warehouse for ${label}. Required ${required}, available ${available}.`;
}

export function getNextDeliveryNoteStatus(
  current: DeliveryNoteStatus
): DeliveryNoteStatus | null {
  return nextDeliveryNoteStatus(current);
}

export type DeliveryLineItem = {
  /** When set, line can be returned from driver stock via `return_driver_stock_to_warehouse`. */
  product_id: string | null;
  item: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_percent: number;
};

export type SalesOrderPickRow = {
  id: string;
  number: string;
  issueDate: string;
  validUntil: string;
  currency: string;
  total: number;
  paymentStatus: SalesOrderPaymentStatus;
  fulfillmentStatus: SalesOrderFulfillmentStatus;
  clientName: string;
  customerId: string | null;
  phone: string;
  email: string;
  /** Canonical city UUID when known (`sales_orders.city_id` or linked customer `city_id`). */
  cityId: string | null;
  city: string;
  /** From `sales_orders.delivery_date` when set. */
  deliveryDate: string | null;
  addressLines: string;
  items: DeliveryLineItem[];
};

export type DeliveryListRow = {
  id: string;
  status: DeliveryNoteStatus;
  driverStatus: boolean;
  driverUserId: string;
  driverDisplay: string;
  /** `company_users.id` for `/app/company-team/[id]` when the driver is a team member. */
  driverMembershipId: string | null;
  createdByUserId: string;
  createdByDisplay: string;
  notes: string | null;
  deliveryDate: string | null;
  createdAt: string;
  orderCount: number;
  /** Sum of `sales_orders.total` for all orders linked to this delivery. */
  totalAmount: number;
  /**
   * Sum of `sales_orders.total` for orders on this delivery with fulfillment
   * **delivered to customer**, **completed**, or **upselling** (cash for settlement).
   */
  totalAmountCashForSettlement: number;
  /**
   * When `driver_status` is true and a settlement row exists: cash + bank paid to owner.
   * Null if collection is still pending, or settled without a settlement row (legacy).
   */
  driverCollectedAmount: number | null;
};

export type DeliveryDetailSalesOrder = {
  linkId: string;
  salesOrderId: string;
  number: string;
  /** ISO `YYYY-MM-DD` from `sales_orders.delivery_date`. */
  deliveryDate: string | null;
  currency: string;
  total: number;
  clientName: string;
  customerId: string | null;
  phone: string;
  email: string;
  addressLines: string;
  fulfillmentStatus: SalesOrderFulfillmentStatus;
  paymentStatus: SalesOrderPaymentStatus;
  /** Sales order row `updated_at` (used for day/week return filters). */
  updatedAt: string | null;
  items: DeliveryLineItem[];
};

export type DeliveryDetail = {
  id: string;
  status: DeliveryNoteStatus;
  /** True when driver cash/balance has been collected and recorded. */
  driverStatus: boolean;
  notes: string | null;
  deliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
  driverUserId: string;
  driverDisplay: string;
  driverMembershipId: string | null;
  createdByUserId: string;
  createdByDisplay: string;
  salesOrders: DeliveryDetailSalesOrder[];
  /** Sum of `sales_orders.total` for all orders on this delivery. */
  totalAmount: number;
  /** Sum of totals for orders with fulfillment delivered to customer, completed, or upselling (cash for settlement). */
  totalAmountCashForSettlement: number;
  /**
   * When `driver_status` is true and a settlement row exists: cash + bank paid to owner.
   */
  driverCollectedAmount: number | null;
};

export function deliverySettlementTotalsFromSalesOrders(
  salesOrders: Pick<
    DeliveryDetailSalesOrder,
    "total" | "paymentStatus" | "fulfillmentStatus"
  >[]
): { totalAmount: number; totalAmountCashForSettlement: number } {
  let totalAmount = 0;
  let totalAmountCashForSettlement = 0;
  for (const so of salesOrders) {
    totalAmount += so.total;
    if (salesOrderCountsForDriverSettlementCash(so.fulfillmentStatus)) {
      totalAmountCashForSettlement += so.total;
    }
  }
  return { totalAmount, totalAmountCashForSettlement };
}

function clientNameFromBill(bill: Record<string, unknown>) {
  const company = String(bill.company_name ?? "").trim();
  const full = String(bill.full_name ?? "").trim();
  const name = String(bill.name ?? "").trim();
  const contact = String(bill.contact_name ?? "").trim();
  const email = String(bill.email ?? "").trim();
  const t = String(bill.type ?? "").trim().toLowerCase();

  if (t === "company") {
    return company || contact || name || full || email;
  }
  if (t === "individual") {
    return full || name || company || email;
  }
  return company || full || name || contact || email;
}

function billSnapshotToContact(bill: Record<string, unknown>) {
  const clientName = clientNameFromBill(bill);
  const phone = String(bill.phone ?? "").trim();
  const email = String(bill.email ?? "").trim();
  const parts = [
    bill.address_line_1,
    bill.address_line_2,
    bill.street,
    [bill.city, bill.postal].filter(Boolean).join(" "),
    bill.country,
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  const addressLines = parts.join(" · ");
  return { clientName, phone, email, addressLines };
}

function cityNameFromMaybeRelation(rel: unknown): string {
  if (rel == null) return "";
  if (Array.isArray(rel)) {
    const first = rel[0];
    const n =
      first && typeof first === "object" && first !== null
        ? (first as { name?: unknown }).name
        : undefined;
    return String(n ?? "").trim();
  }
  if (typeof rel === "object" && rel !== null) {
    const n = (rel as { name?: unknown }).name;
    return String(n ?? "").trim();
  }
  return "";
}

function pickCityDisplayForDeliveryRow(
  row: Record<string, unknown>,
  bill: Record<string, unknown>
): string {
  const fromSoCityFk = cityNameFromMaybeRelation(row.cities);

  const cust = row.customers as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const custObj = Array.isArray(cust)
    ? (cust[0] as Record<string, unknown> | undefined)
    : (cust ?? undefined);

  let fromCustomer = "";
  if (custObj) {
    fromCustomer =
      cityNameFromMaybeRelation(custObj.cities) ||
      String(custObj.city ?? "").trim();
  }

  const fromBill = String(bill.city ?? "").trim();

  return fromSoCityFk || fromCustomer || fromBill;
}

function pickCityIdForDeliveryRow(row: Record<string, unknown>): string | null {
  const so = row.city_id;
  if (so != null && String(so).trim()) return String(so);

  const cust = row.customers as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const custObj = Array.isArray(cust)
    ? (cust[0] as Record<string, unknown> | undefined)
    : (cust ?? undefined);
  const cid = custObj?.city_id;
  if (cid != null && String(cid).trim()) return String(cid);

  return null;
}

async function profileDisplayMap(
  userIds: string[]
): Promise<Map<string, string>> {
  const uniq = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email")
    .in("id", uniq);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const r = row as { id: string; full_name: string | null; email: string | null };
    const label =
      (r.full_name && r.full_name.trim()) ||
      (r.email && r.email.trim()) ||
      r.id.slice(0, 8);
    map.set(r.id, label);
  }
  return map;
}

async function membershipIdsByUserId(
  companyId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;

  const { data, error } = await supabase
    .from("company_users")
    .select("id, user_id")
    .eq("company_id", companyId)
    .in("user_id", uniq);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const uid = String((row as { user_id?: unknown }).user_id ?? "");
    const mid = String((row as { id?: unknown }).id ?? "");
    if (uid && mid) map.set(uid, mid);
  }

  return map;
}

/** Team members whose role name includes “driver” (case-insensitive). */
export async function listDriverTeamMembers(): Promise<TeamMemberRow[]> {
  return listDriverRoleTeamMembers();
}

const SALES_ORDER_PICK_SELECT = `
      id, number, issue_date, valid_until, currency, total, payment_status, fulfillment_status, bill_to_snapshot, city_id, cities(name),
      delivery_date,
      customer_id,
      customers (
        city_id,
        city,
        cities ( name )
      ),
      sales_order_items ( product_id, item, description, quantity, unit_price, tax_percent, sort_order )
    `;

function mapSalesOrderRowToPickRow(row: Record<string, unknown>): SalesOrderPickRow {
  const bill = (row.bill_to_snapshot ?? {}) as Record<string, unknown>;
  const { clientName, phone, email, addressLines } = billSnapshotToContact(bill);
  const cityId = pickCityIdForDeliveryRow(row);
  const city = pickCityDisplayForDeliveryRow(row, bill);
  const rawItems = (row.sales_order_items ?? []) as Record<string, unknown>[];
  const items: DeliveryLineItem[] = [...rawItems]
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((it) => ({
      product_id: it.product_id != null ? String(it.product_id) : null,
      item: String(it.item ?? ""),
      description: (it.description as string | null) ?? null,
      quantity: Number(it.quantity ?? 0),
      unit_price: Number(it.unit_price ?? 0),
      tax_percent: Number(it.tax_percent ?? 0),
    }));

  return {
    id: row.id as string,
    number: String(row.number ?? ""),
    issueDate: String(row.issue_date ?? ""),
    validUntil: String(row.valid_until ?? ""),
    currency: String(row.currency ?? "MUR"),
    total: Number(row.total ?? 0),
    paymentStatus: normalizeSalesOrderPaymentStatus(
      row.payment_status as string | null | undefined,
    ),
    fulfillmentStatus: normalizeSalesOrderFulfillmentStatus(
      row.fulfillment_status as string | null | undefined,
    ),
    clientName,
    customerId: (row.customer_id as string | null) ?? null,
    phone,
    email,
    cityId,
    city,
    deliveryDate:
      row.delivery_date != null && String(row.delivery_date).trim()
        ? String(row.delivery_date).slice(0, 10)
        : null,
    addressLines,
    items,
  };
}

async function querySalesOrderPickRowsByIds(
  companyId: string,
  ids: string[],
): Promise<SalesOrderPickRow[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("sales_orders")
    .select(SALES_ORDER_PICK_SELECT)
    .eq("company_id", companyId)
    .eq("status", "active")
    .in("id", ids);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapSalesOrderRowToPickRow(row as Record<string, unknown>),
  );
}

/** Active sales orders with fulfillment **New** or **Rescheduled**, including line items for the picker. */
export async function listSalesOrdersForDelivery(): Promise<SalesOrderPickRow[]> {
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("sales_orders")
    .select(SALES_ORDER_PICK_SELECT)
    .eq("company_id", companyId)
    .in("fulfillment_status", DELIVERY_NOTE_ELIGIBLE_FULFILLMENT_STATUSES)
    .eq("status", "active")
    .order("issue_date", { ascending: false })
    .limit(300);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    mapSalesOrderRowToPickRow(row as Record<string, unknown>),
  );
}

/**
 * Orders on this delivery note plus eligible **New** / **Rescheduled** orders to add (status **new**).
 */
export async function listSalesOrdersForDeliveryEdit(
  deliveryId: string,
): Promise<SalesOrderPickRow[]> {
  const companyId = await requireActiveCompanyId();
  const delivery = await getDelivery(deliveryId);
  if (!delivery || delivery.status !== "new") {
    throw new Error("Only delivery notes with status New can be edited.");
  }

  const linkedIds = delivery.salesOrders.map((so) => so.salesOrderId);
  const [eligible, linked] = await Promise.all([
    listSalesOrdersForDelivery(),
    querySalesOrderPickRowsByIds(companyId, linkedIds),
  ]);

  const byId = new Map<string, SalesOrderPickRow>();
  for (const row of linked) byId.set(row.id, row);
  for (const row of eligible) byId.set(row.id, row);

  return [...byId.values()].sort((a, b) =>
    b.issueDate.localeCompare(a.issueDate),
  );
}

/** Nested shape aligned with `getDelivery` / pinned-order fetch. */
const SALES_ORDER_ROWS_FOR_DELIVERY_DETAIL = `
  id,
  number,
  delivery_date,
  currency,
  total,
  customer_id,
  payment_status,
  bill_to_snapshot,
  fulfillment_status,
  updated_at,
  sales_order_items (
    product_id,
    item,
    description,
    quantity,
    unit_price,
    tax_percent,
    sort_order
  )
`;

function deliveryDetailSalesOrderFromSoRecord(
  so: Record<string, unknown>,
  linkId: string,
  salesOrderIdFallback?: string
): DeliveryDetailSalesOrder {
  const bill = (so.bill_to_snapshot ?? {}) as Record<string, unknown>;
  const { clientName, phone, email, addressLines } = billSnapshotToContact(bill);
  const rawItems = (so.sales_order_items ?? []) as Record<string, unknown>[];
  const items: DeliveryLineItem[] = [...rawItems]
    .sort(
      (a, b) =>
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    )
    .map((it) => ({
      product_id: it.product_id != null ? String(it.product_id) : null,
      item: String(it.item ?? ""),
      description: (it.description as string | null) ?? null,
      quantity: Number(it.quantity ?? 0),
      unit_price: Number(it.unit_price ?? 0),
      tax_percent: Number(it.tax_percent ?? 0),
    }));

  return {
    linkId,
    salesOrderId: String(so.id ?? salesOrderIdFallback ?? ""),
    number: String(so.number ?? ""),
    deliveryDate:
      so.delivery_date != null && String(so.delivery_date).trim()
        ? String(so.delivery_date).slice(0, 10)
        : null,
    currency: String(so.currency ?? "MUR"),
    total: Number(so.total ?? 0),
    clientName,
    customerId:
      so.customer_id != null && String(so.customer_id).trim()
        ? String(so.customer_id)
        : null,
    phone,
    email,
    addressLines,
    fulfillmentStatus: normalizeSalesOrderFulfillmentStatus(
      so.fulfillment_status as string | null
    ),
    paymentStatus: normalizeSalesOrderPaymentStatus(
      so.payment_status as string | null | undefined
    ),
    updatedAt: so.updated_at != null ? String(so.updated_at) : null,
    items,
  };
}

/** Orders still attributed to this delivery for driver/stock UX when junction rows are gone (e.g. Rescheduled). */
async function fetchSalesOrdersPinnedToDriverDelivery(
  companyId: string,
  deliveryId: string,
  excludeSalesOrderIds: Set<string>
): Promise<DeliveryDetailSalesOrder[]> {
  const { data, error } = await supabase
    .from("sales_orders")
    .select(SALES_ORDER_ROWS_FOR_DELIVERY_DETAIL)
    .eq("company_id", companyId)
    .eq("active_driver_delivery_id", deliveryId)
    .neq("fulfillment_status", "cancelled");

  if (error) throw new Error(error.message);

  const out: DeliveryDetailSalesOrder[] = [];
  for (const row of data ?? []) {
    const rec = row as Record<string, unknown>;
    const sid = String(rec.id ?? "").trim();
    if (!sid || excludeSalesOrderIds.has(sid)) continue;
    out.push(deliveryDetailSalesOrderFromSoRecord(rec, `pinned:${sid}`, sid));
  }
  return out.sort((a, b) => a.number.localeCompare(b.number));
}

export async function listDeliveries(): Promise<DeliveryListRow[]> {
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("deliveries")
    .select(
      `
      id,
      status,
      driver_status,
      driver_user_id,
      created_by,
      delivery_date,
      created_at,
      delivery_sales_orders (
        sales_orders ( id, total, fulfillment_status, payment_status )
      )
    `
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const userIds = rows.flatMap((r: Record<string, unknown>) => [
    r.driver_user_id as string,
    r.created_by as string,
  ]);
  const deliveryIds = rows
    .map((r: Record<string, unknown>) => String(r.id ?? "").trim())
    .filter(Boolean);

  const pinnedQuery =
    deliveryIds.length === 0
      ? Promise.resolve({
          data: [] as Record<string, unknown>[],
          error: null as null,
        })
      : supabase
          .from("sales_orders")
          .select(
            "id, total, fulfillment_status, payment_status, active_driver_delivery_id"
          )
          .eq("company_id", companyId)
          .in("active_driver_delivery_id", deliveryIds)
          .neq("fulfillment_status", "cancelled");

  const settlementsQuery =
    deliveryIds.length === 0
      ? Promise.resolve({
          data: [] as Record<string, unknown>[],
          error: null as null,
        })
      : supabase
          .from("delivery_driver_settlements")
          .select("delivery_id, cash_amount, bank_transfer_amount")
          .eq("company_id", companyId)
          .in("delivery_id", deliveryIds);

  const driverUserIds = [
    ...new Set(
      rows
        .map((r) => String((r as Record<string, unknown>).driver_user_id ?? ""))
        .filter(Boolean),
    ),
  ];

  const [names, memberships, pinnedRes, settlementsRes] = await Promise.all([
    profileDisplayMap(userIds),
    membershipIdsByUserId(companyId, driverUserIds),
    pinnedQuery,
    settlementsQuery,
  ]);

  if (pinnedRes.error) throw new Error(pinnedRes.error.message);
  if (settlementsRes.error) throw new Error(settlementsRes.error.message);

  const settlementByDelivery = new Map<string, { cash: number; bank: number }>();
  for (const row of settlementsRes.data ?? []) {
    const rec = row as Record<string, unknown>;
    const did = String(rec.delivery_id ?? "").trim();
    if (!did) continue;
    settlementByDelivery.set(did, {
      cash: Number(rec.cash_amount ?? 0),
      bank: Number(rec.bank_transfer_amount ?? 0),
    });
  }

  const partials = rows.map((r: Record<string, unknown>) => {
    const lines = (r.delivery_sales_orders ?? []) as Record<string, unknown>[];
    const linkedIds = new Set<string>();
    let totalAmount = 0;
    let totalAmountCashForSettlement = 0;
    for (const line of lines) {
      const nested = line.sales_orders;
      const so = (Array.isArray(nested) ? nested[0] : nested) as
        | Record<string, unknown>
        | undefined;
      const sid = String(so?.id ?? "").trim();
      if (sid) linkedIds.add(sid);
      totalAmount += Number(so?.total ?? 0);
      if (
        salesOrderCountsForDriverSettlementCash(
          so?.fulfillment_status as string | null | undefined
        )
      ) {
        totalAmountCashForSettlement += Number(so?.total ?? 0);
      }
    }
    const driverId = r.driver_user_id as string;
    const createdId = r.created_by as string;
    return {
      r,
      linkedIds,
      lineCount: lines.length,
      totalAmount,
      totalAmountCashForSettlement,
      driverId,
      createdId,
    };
  });

  const pinnedRows = (pinnedRes.data ?? []) as Record<string, unknown>[];
  const pinnedByDelivery = new Map<
    string,
    {
      id: string;
      total: number;
      fulfillment_status: string | null;
      payment_status: string | null;
    }[]
  >();

  for (const row of pinnedRows) {
    const pr = row as {
      id: string;
      total: unknown;
      fulfillment_status: string | null;
      payment_status: string | null;
      active_driver_delivery_id: string | null;
    };
    const did = pr.active_driver_delivery_id;
    if (!did) continue;
    const arr = pinnedByDelivery.get(did) ?? [];
    arr.push({
      id: pr.id,
      total: Number(pr.total ?? 0),
      fulfillment_status: pr.fulfillment_status,
      payment_status: pr.payment_status,
    });
    pinnedByDelivery.set(did, arr);
  }

  return partials.map((p) => {
    const extras = (pinnedByDelivery.get(p.r.id as string) ?? []).filter(
      (x) => !p.linkedIds.has(x.id)
    );
    let addTotal = 0;
    let addSettlementCash = 0;
    for (const x of extras) {
      addTotal += x.total;
      if (salesOrderCountsForDriverSettlementCash(x.fulfillment_status)) {
        addSettlementCash += x.total;
      }
    }

    const deliveryId = p.r.id as string;
    const settled = Boolean(p.r.driver_status);
    const split = settlementByDelivery.get(deliveryId);
    const driverCollectedAmount =
      settled && split != null
        ? roundMoney2(split.cash + split.bank)
        : null;

    return {
      id: deliveryId,
      status: normalizeDeliveryNoteStatus(p.r.status as string | null | undefined),
      driverStatus: settled,
      driverUserId: p.driverId,
      driverDisplay: names.get(p.driverId) ?? p.driverId.slice(0, 8),
      driverMembershipId: memberships.get(p.driverId) ?? null,
      createdByUserId: p.createdId,
      createdByDisplay: names.get(p.createdId) ?? p.createdId.slice(0, 8),
      notes: null,
      deliveryDate:
        p.r.delivery_date != null && String(p.r.delivery_date).trim()
          ? String(p.r.delivery_date).slice(0, 10)
          : null,
      createdAt: String(p.r.created_at ?? ""),
      orderCount: p.lineCount + extras.length,
      totalAmount: p.totalAmount + addTotal,
      totalAmountCashForSettlement:
        p.totalAmountCashForSettlement + addSettlementCash,
      driverCollectedAmount,
    };
  });
}

export async function setDeliveryDriverStatus(
  deliveryId: string,
  driverStatus: boolean
): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("deliveries")
    .update({
      driver_status: driverStatus,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", deliveryId)
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type DeliveryUpsellingCommissionRow = {
  salesOrderId: string;
  commissionAmount: number;
  currency: string;
};

export async function listDeliveryUpsellingCommissions(
  deliveryId: string
): Promise<DeliveryUpsellingCommissionRow[]> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("delivery_upselling_commissions")
    .select("sales_order_id, commission_amount, currency")
    .eq("company_id", companyId)
    .eq("delivery_id", deliveryId);

  if (error) {
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      salesOrderId: String(r.sales_order_id ?? ""),
      commissionAmount: Number(r.commission_amount ?? 0),
      currency: String(r.currency ?? "MUR").trim() || "MUR",
    };
  });
}

export async function upsertDeliveryUpsellingCommissions(
  deliveryId: string,
  rows: { salesOrderId: string; commissionAmount: number; currency?: string }[]
): Promise<void> {
  if (rows.length === 0) return;
  const companyId = await requireActiveCompanyId();
  const uid = await getCurrentUserId();
  const now = new Date().toISOString();

  const payload = rows.map((r) => ({
    company_id: companyId,
    delivery_id: deliveryId,
    sales_order_id: r.salesOrderId,
    commission_amount: roundMoney2(Number(r.commissionAmount)),
    currency: (r.currency ?? "MUR").trim() || "MUR",
    recorded_by: uid,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("delivery_upselling_commissions")
    .upsert(payload, { onConflict: "delivery_id,sales_order_id" });

  if (error) throw new Error(error.message);
}

export async function deleteDeliveryUpsellingCommissions(
  deliveryId: string
): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("delivery_upselling_commissions")
    .delete()
    .eq("company_id", companyId)
    .eq("delivery_id", deliveryId);
  if (error) {
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return;
    }
    throw new Error(error.message);
  }
}

export function deliveryUpsellingSalesOrders(
  salesOrders: DeliveryDetailSalesOrder[]
): DeliveryDetailSalesOrder[] {
  return salesOrders.filter((so) => {
    const norm = normalizeSalesOrderFulfillmentStatus(so.fulfillmentStatus);
    return String(norm).trim().toLowerCase() === "upselling";
  });
}

export type InsertDeliveryDriverSettlementParams = {
  deliveryId: string;
  driverUserId: string;
  amountToOwner: number;
  currency?: string;
  settlementCashTotal?: number | null;
  driverDailyRate?: number | null;
  linkedOrdersTotal?: number | null;
  /** Portion of amount_to_owner paid in cash (>= 0). */
  cashAmount: number;
  /** Portion of amount_to_owner paid by bank transfer (>= 0). */
  bankTransferAmount: number;
  /** Optional note when any amount was paid by bank transfer. */
  bankReference?: string | null;
  expenseId?: string | null;
};

/**
 * Inserts a row in `delivery_driver_settlements` (RLS: same company, `recorded_by` = current user).
 * When amount_to_owner > 0, cash_amount + bank_transfer_amount must match (enforced in DB and here).
 */
export async function insertDeliveryDriverSettlement(
  params: InsertDeliveryDriverSettlementParams
): Promise<{ id: string }> {
  const companyId = await requireActiveCompanyId();
  const uid = await getCurrentUserId();
  const cash = roundMoney2(Number(params.cashAmount));
  const bank = roundMoney2(Number(params.bankTransferAmount));
  const due = roundMoney2(Number(params.amountToOwner));
  const refTrim = String(params.bankReference ?? "").trim();

  if (!Number.isFinite(cash) || !Number.isFinite(bank) || cash < 0 || bank < 0) {
    throw new Error("Cash and bank amounts must be valid non-negative numbers.");
  }
  if (due > 0) {
    if (roundMoney2(cash + bank) !== due) {
      throw new Error("Cash plus bank transfer must equal the Return to Owner Amount.");
    }
    if (cash <= 0 && bank <= 0) {
      throw new Error("Enter at least one of cash or bank transfer amount.");
    }
  } else if (cash !== 0 || bank !== 0) {
    throw new Error("When the net amount to owner is zero or negative, leave cash and bank amounts at zero.");
  }

  const insert = {
    company_id: companyId,
    delivery_id: params.deliveryId,
    driver_user_id: params.driverUserId,
    recorded_by: uid,
    amount_to_owner: due,
    currency: (params.currency ?? "MUR").trim() || "MUR",
    settlement_cash_total: params.settlementCashTotal ?? null,
    driver_daily_rate: params.driverDailyRate ?? null,
    linked_orders_total: params.linkedOrdersTotal ?? null,
    cash_amount: cash,
    bank_transfer_amount: bank,
    bank_reference: bank > 0 && refTrim ? refTrim : null,
    expense_id: params.expenseId ?? null,
  };

  const { data, error } = await supabase
    .from("delivery_driver_settlements")
    .insert(insert)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const id = String((data as { id?: string })?.id ?? "").trim();
  if (!id) throw new Error("Settlement insert returned no id.");
  return { id };
}

/** Used to roll back if a later step fails after a successful settlement insert. */
export async function deleteDeliveryDriverSettlement(id: string): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("delivery_driver_settlements")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);
}

/** One settlement row per delivery (when recorded). */
export type DeliveryDriverSettlementSnapshot = {
  id: string;
  amountToOwner: number;
  currency: string;
  settlementCashTotal: number | null;
  driverDailyRate: number | null;
  linkedOrdersTotal: number | null;
  cashAmount: number;
  bankTransferAmount: number;
  bankReference: string | null;
  createdAt: string;
};

export async function getDeliveryDriverSettlement(
  deliveryId: string
): Promise<DeliveryDriverSettlementSnapshot | null> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("delivery_driver_settlements")
    .select(
      "id, amount_to_owner, currency, settlement_cash_total, driver_daily_rate, linked_orders_total, cash_amount, bank_transfer_amount, bank_reference, created_at"
    )
    .eq("company_id", companyId)
    .eq("delivery_id", deliveryId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const r = data as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    amountToOwner: roundMoney2(Number(r.amount_to_owner ?? 0)),
    currency: String(r.currency ?? "MUR").trim() || "MUR",
    settlementCashTotal:
      r.settlement_cash_total != null && String(r.settlement_cash_total).trim() !== ""
        ? roundMoney2(Number(r.settlement_cash_total))
        : null,
    driverDailyRate:
      r.driver_daily_rate != null && String(r.driver_daily_rate).trim() !== ""
        ? roundMoney2(Number(r.driver_daily_rate))
        : null,
    linkedOrdersTotal:
      r.linked_orders_total != null && String(r.linked_orders_total).trim() !== ""
        ? roundMoney2(Number(r.linked_orders_total))
        : null,
    cashAmount: roundMoney2(Number(r.cash_amount ?? 0)),
    bankTransferAmount: roundMoney2(Number(r.bank_transfer_amount ?? 0)),
    bankReference: r.bank_reference != null ? String(r.bank_reference) : null,
    createdAt: String(r.created_at ?? ""),
  };
}

export async function getDelivery(id: string): Promise<DeliveryDetail | null> {
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("deliveries")
    .select(
      `
      id,
      status,
      driver_status,
      driver_user_id,
      created_by,
      notes,
      delivery_date,
      created_at,
      updated_at,
      delivery_sales_orders (
        id,
        sales_order_id,
        sales_orders (
          id,
          number,
          delivery_date,
          currency,
          total,
          customer_id,
          payment_status,
          bill_to_snapshot,
          fulfillment_status,
          updated_at,
          sales_order_items (
            product_id,
            item,
            description,
            quantity,
            unit_price,
            tax_percent,
            sort_order
          )
        )
      )
    `
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const d = data as Record<string, unknown>;
  const driverId = d.driver_user_id as string;
  const createdId = d.created_by as string;
  const [names, memberships] = await Promise.all([
    profileDisplayMap([driverId, createdId]),
    membershipIdsByUserId(companyId, [driverId]),
  ]);

  const links = (d.delivery_sales_orders ?? []) as Record<string, unknown>[];
  const salesOrders: DeliveryDetailSalesOrder[] = links.map((link) => {
    const nested = link.sales_orders;
    const soRaw = Array.isArray(nested) ? nested[0] : nested;
    const so = (
      soRaw && typeof soRaw === "object" ? soRaw : {}
    ) as Record<string, unknown>;
    return deliveryDetailSalesOrderFromSoRecord(
      so,
      String(link.id ?? ""),
      String(link.sales_order_id ?? "")
    );
  });

  const linkedIds = new Set(salesOrders.map((s) => s.salesOrderId));
  const pinned = await fetchSalesOrdersPinnedToDriverDelivery(
    companyId,
    id,
    linkedIds
  );
  salesOrders.push(...pinned);
  salesOrders.sort((a, b) => a.number.localeCompare(b.number));

  const { totalAmount, totalAmountCashForSettlement } =
    deliverySettlementTotalsFromSalesOrders(salesOrders);
  const settled = Boolean(d.driver_status);
  let driverCollectedAmount: number | null = null;
  if (settled) {
    const settlement = await getDeliveryDriverSettlement(id);
    if (settlement) {
      driverCollectedAmount = roundMoney2(
        settlement.cashAmount + settlement.bankTransferAmount
      );
    }
  }

  return {
    id: d.id as string,
    status: normalizeDeliveryNoteStatus(d.status as string | null | undefined),
    driverStatus: settled,
    notes: (d.notes as string | null) ?? null,
    deliveryDate:
      d.delivery_date != null && String(d.delivery_date).trim()
        ? String(d.delivery_date).slice(0, 10)
        : null,
    createdAt: String(d.created_at ?? ""),
    updatedAt: String(d.updated_at ?? ""),
    driverUserId: driverId,
    driverDisplay: names.get(driverId) ?? driverId.slice(0, 8),
    driverMembershipId: memberships.get(driverId) ?? null,
    createdByUserId: createdId,
    createdByDisplay: names.get(createdId) ?? createdId.slice(0, 8),
    salesOrders,
    totalAmount,
    totalAmountCashForSettlement,
    driverCollectedAmount,
  };
}

/** Per sales order contribution to a return line (same product may appear on several orders). */
export type DriverStockReturnLineSalesOrder = {
  salesOrderId: string;
  salesOrderNumber: string;
  salesOrderTotal: number;
  currency: string;
  qty: number;
  fulfillmentStatus: SalesOrderFulfillmentStatus;
};

export type DriverStockReturnLine = {
  productId: string;
  productName: string;
  /** Sum of matching line quantities for this product on eligible orders. */
  deliveryQty: number;
  salesOrders: DriverStockReturnLineSalesOrder[];
};

export type DriverStockReturnContext = {
  lines: DriverStockReturnLine[];
  /** Current quantity at the driver's active stock location per product. */
  availableByProduct: Record<string, number>;
  /** Calendar-day lookback from local start of today, or **0** = no date filter (all updates). */
  p_days: number;
};

/** Fulfillment states whose lines count toward driver stock return preview for this delivery. */
const DRIVER_STOCK_RETURN_FULFILLMENT = new Set<SalesOrderFulfillmentStatus>([
  "delivered to driver",
  "rescheduled",
  "pending",
]);

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Inclusive calendar-day window ending today (local midnight boundary).
 * `p_days === 1` → orders updated today; `p_days === 7` → today and the prior 6 days.
 */
function salesOrderInReturnWindow(
  updatedAtIso: string | null,
  pDays: number
): boolean {
  const days = Math.max(1, Math.min(366, Math.floor(Number(pDays)) || 1));
  const end = startOfLocalDay();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const startMs = start.getTime();
  if (updatedAtIso == null || !String(updatedAtIso).trim()) {
    return true;
  }
  const t = new Date(updatedAtIso).getTime();
  if (Number.isNaN(t)) {
    return true;
  }
  return t >= startMs;
}

function aggregateDeliveryProductLines(
  d: DeliveryDetail,
  opts: { p_days: number }
): DriverStockReturnLine[] {
  type Agg = {
    name: string;
    qty: number;
    bySo: Map<string, DriverStockReturnLineSalesOrder>;
  };
  const map = new Map<string, Agg>();
  const pDays = opts.p_days;

  for (const so of d.salesOrders) {
    if (!DRIVER_STOCK_RETURN_FULFILLMENT.has(so.fulfillmentStatus)) continue;
    if (
      pDays > 0 &&
      !salesOrderInReturnWindow(so.updatedAt, pDays)
    ) {
      continue;
    }

    const soId = so.salesOrderId;
    const soNum = so.number;
    const soTotal = Number(so.total ?? 0);
    const soCcy = String(so.currency ?? "MUR").trim() || "MUR";

    for (const line of so.items) {
      const pid = line.product_id?.trim();
      if (!pid) continue;
      const q = Number(line.quantity ?? 0);
      if (!Number.isFinite(q) || q <= 0) continue;
      const name = String(line.item ?? "").trim() || "Product";

      let agg = map.get(pid);
      if (!agg) {
        agg = { name, qty: 0, bySo: new Map() };
        map.set(pid, agg);
      }
      agg.name = agg.name || name;
      agg.qty += q;

      const prevSeg = agg.bySo.get(soId);
      if (prevSeg) {
        prevSeg.qty += q;
      } else {
        agg.bySo.set(soId, {
          salesOrderId: soId,
          salesOrderNumber: soNum,
          salesOrderTotal: soTotal,
          currency: soCcy,
          qty: q,
          fulfillmentStatus: so.fulfillmentStatus,
        });
      }
    }
  }

  return [...map.entries()]
    .map(([productId, v]) => ({
      productId,
      productName: v.name,
      deliveryQty: v.qty,
      salesOrders: [...v.bySo.values()].sort((a, b) =>
        a.salesOrderNumber.localeCompare(b.salesOrderNumber)
      ),
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

async function getDriverLocationStockForProducts(
  companyId: string,
  driverUserId: string,
  productIds: string[]
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (productIds.length === 0) return out;

  const locId = await resolveActiveDriverStockLocationId(companyId, driverUserId);
  if (!locId) return out;

  const { data, error } = await supabase
    .from("product_location_stocks")
    .select("product_id, quantity")
    .eq("company_id", companyId)
    .eq("location_id", locId)
    .in("product_id", productIds);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const r = row as { product_id?: string; quantity?: unknown };
    const pid = String(r.product_id ?? "");
    if (!pid) continue;
    out[pid] = Number(r.quantity ?? 0);
  }
  return out;
}

/**
 * Catalog-linked lines for sales orders on this delivery whose fulfillment is
 * **Delivered to driver**, **Rescheduled**, or **Pending**.
 * When `p_days` is **0**, every matching order is included (no `updated_at` window).
 * When `p_days` is 1–366, only orders whose `updated_at` falls in that inclusive day window
 * (local midnight) are included; missing `updated_at` is treated as included.
 */
export async function getDriverStockReturnContext(
  deliveryId: string,
  opts?: { p_days?: number; delivery?: DeliveryDetail }
): Promise<DriverStockReturnContext> {
  const raw = opts?.p_days;
  const n = Math.floor(Number(raw));
  const p_days = Number.isFinite(n)
    ? Math.max(0, Math.min(366, n))
    : 0;
  const d = opts?.delivery ?? (await getDelivery(deliveryId));
  if (!d) {
    return { lines: [], availableByProduct: {}, p_days };
  }
  const lines = aggregateDeliveryProductLines(d, { p_days });
  const companyId = await requireActiveCompanyId();
  const availableByProduct = await getDriverLocationStockForProducts(
    companyId,
    d.driverUserId,
    lines.map((l) => l.productId)
  );
  return { lines, availableByProduct, p_days };
}

export type DeliveryDetailPageData = {
  delivery: DeliveryDetail;
  drivers: TeamMemberRow[];
  stockReturn: DriverStockReturnContext | null;
};

/** Single coordinated load for the delivery note detail page (one `getDelivery` call). */
export async function loadDeliveryDetailPageData(
  deliveryId: string
): Promise<DeliveryDetailPageData | null> {
  const delivery = await getDelivery(deliveryId);
  if (!delivery) return null;

  const [drivers, stockReturn] = await Promise.all([
    listDriverTeamMembers(),
    delivery.driverStatus
      ? Promise.resolve(null)
      : getDriverStockReturnContext(deliveryId, { p_days: 0, delivery }),
  ]);

  return { delivery, drivers, stockReturn };
}

/**
 * Moves stock from the driver’s location to the primary warehouse via the DB RPC
 * `return_driver_stock_to_warehouse`, which updates balances and inserts an
 * `inventory_movements` row with `event_type` **transfer** (driver → warehouse).
 */
export async function returnDriverStockToWarehouse(params: {
  driverUserId: string;
  productId: string;
  quantity: number;
}): Promise<void> {
  const q = Number(params.quantity);
  if (!Number.isFinite(q) || q <= 0) {
    throw new Error("Return quantity must be greater than zero.");
  }
  const userId = await getCurrentUserId();
  const { error } = await supabase.rpc("return_driver_stock_to_warehouse", {
    p_driver_user_id: params.driverUserId,
    p_product_id: params.productId,
    p_quantity: q,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

/** Fulfillment values updated to **delivered to customer** when a delivery note is completed. */
const SALES_ORDER_FULFILLMENT_ON_DN_COMPLETE: SalesOrderFulfillmentStatus[] = [
  "new",
  "pending",
  "rescheduled",
  "delivery note created",
  "delivered to driver",
];

/** Sets linked (and driver-pinned) sales orders to **delivered to customer**. */
async function markLinkedSalesOrdersDeliveredToCustomer(
  companyId: string,
  deliveryId: string,
  linkedSalesOrderIds: string[],
  now: string,
): Promise<void> {
  const idsForCustomerUpdate = new Set(
    linkedSalesOrderIds.filter(Boolean),
  );

  const { data: pinnedForCompletion, error: pinErr } = await supabase
    .from("sales_orders")
    .select("id")
    .eq("company_id", companyId)
    .eq("active_driver_delivery_id", deliveryId)
    .in("fulfillment_status", SALES_ORDER_FULFILLMENT_ON_DN_COMPLETE);

  if (pinErr) throw new Error(pinErr.message);

  for (const row of pinnedForCompletion ?? []) {
    idsForCustomerUpdate.add(String((row as { id: string }).id));
  }

  if (idsForCustomerUpdate.size === 0) return;

  const { error: soErr } = await supabase
    .from("sales_orders")
    .update({
      fulfillment_status: "delivered to customer",
      updated_at: now,
      active_driver_delivery_id: null,
    })
    .in("id", [...idsForCustomerUpdate])
    .eq("company_id", companyId)
    .in("fulfillment_status", SALES_ORDER_FULFILLMENT_ON_DN_COMPLETE);

  if (soErr) {
    throw new Error(soErr.message ?? "Failed to update sales orders.");
  }
}

/**
 * Advance delivery note status one step (new → delivered_to_driver → completed)
 * and align linked sales orders’ fulfillment when possible.
 *
 * Transition to **delivered_to_driver** runs the DB RPC `mark_delivery_delivered_to_driver`,
 * which transfers stock from the company primary warehouse to the driver’s location and
 * updates the delivery row (including `from_location_id` / `location_id`).
 */
export async function advanceDeliveryNoteStatus(
  deliveryId: string
): Promise<DeliveryDetail | null> {
  const companyId = await requireActiveCompanyId();

  const { data: row, error } = await supabase
    .from("deliveries")
    .select(
      `
      id,
      status,
      driver_user_id,
      delivery_sales_orders ( sales_order_id )
    `
    )
    .eq("id", deliveryId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const r = row as Record<string, unknown>;
  const current = normalizeDeliveryNoteStatus(r.status as string | null | undefined);
  const next = nextDeliveryNoteStatus(current);
  if (!next) {
    throw new Error("This delivery is already completed.");
  }

  const links = (r.delivery_sales_orders ?? []) as { sales_order_id: string }[];
  const salesOrderIds = links.map((l) => l.sales_order_id).filter(Boolean);
  const driverUserId = String(r.driver_user_id ?? "");
  const now = new Date().toISOString();

  if (next === "delivered_to_driver") {
    const pre = await precheckDeliveryDeliveredToDriver({
      companyId,
      driverUserId,
      salesOrderIds,
    });
    if (!pre.ok) {
      throw new Error(pre.message);
    }

    const userId = await getCurrentUserId();
    const { error: rpcErr } = await supabase.rpc(
      "mark_delivery_delivered_to_driver",
      {
        p_delivery_id: deliveryId,
        p_user_id: userId,
      }
    );

    if (rpcErr) {
      const raw =
        rpcErr.message ??
        "Could not transfer stock for this delivery. Check primary warehouse stock and try again.";
      const message = await humanizePrimaryWarehouseStockError(raw, companyId);
      throw new Error(message);
    }

    if (salesOrderIds.length > 0) {
      const { error: soErr } = await supabase
        .from("sales_orders")
        .update({
          fulfillment_status: "delivered to driver",
          updated_at: now,
          active_driver_delivery_id: deliveryId,
        })
        .in("id", salesOrderIds)
        .eq("company_id", companyId)
        .neq("fulfillment_status", "cancelled")
        .neq("fulfillment_status", "delivered to customer")
        .neq("fulfillment_status", "completed");

      if (soErr) {
        throw new Error(
          `${soErr.message ?? "Failed to update sales orders."} Inventory was already transferred for this delivery; if sales order statuses look wrong, update them manually or contact support.`
        );
      }
    }

    return getDelivery(deliveryId);
  }

  if (next === "completed") {
    await markLinkedSalesOrdersDeliveredToCustomer(
      companyId,
      deliveryId,
      salesOrderIds,
      now,
    );
  }

  const { data: updatedRow, error: upErr } = await supabase
    .from("deliveries")
    .update({ status: next, updated_at: now })
    .eq("id", deliveryId)
    .eq("company_id", companyId)
    .eq("status", current)
    .select("id")
    .maybeSingle();

  if (upErr) throw new Error(upErr.message);
  if (!updatedRow) {
    throw new Error(
      "Could not update status (it may have changed). Refresh and try again."
    );
  }

  return getDelivery(deliveryId);
}

/**
 * Marks the delivery note **completed** and linked sales orders **delivered to customer**.
 * Does not require an intermediate “delivered to driver” step or stock transfer (used by settlement).
 */
export async function ensureDeliveryNoteCompleted(
  deliveryId: string
): Promise<DeliveryDetail | null> {
  const companyId = await requireActiveCompanyId();

  const { data: row, error } = await supabase
    .from("deliveries")
    .select(
      `
      id,
      status,
      delivery_sales_orders ( sales_order_id )
    `
    )
    .eq("id", deliveryId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const current = normalizeDeliveryNoteStatus(
    (row as { status?: string | null }).status
  );
  if (current === "completed") {
    return getDelivery(deliveryId);
  }

  const links = (row as { delivery_sales_orders?: { sales_order_id: string }[] })
    .delivery_sales_orders ?? [];
  const salesOrderIds = links.map((l) => l.sales_order_id).filter(Boolean);
  const now = new Date().toISOString();

  await markLinkedSalesOrdersDeliveredToCustomer(
    companyId,
    deliveryId,
    salesOrderIds,
    now,
  );

  const { data: updatedRow, error: upErr } = await supabase
    .from("deliveries")
    .update({ status: "completed", updated_at: now })
    .eq("id", deliveryId)
    .eq("company_id", companyId)
    .neq("status", "completed")
    .select("id")
    .maybeSingle();

  if (upErr) throw new Error(upErr.message);
  if (!updatedRow) {
    throw new Error(
      "Could not mark delivery note completed (it may have changed). Refresh and try again."
    );
  }

  return getDelivery(deliveryId);
}

export type CreateDeliveryPayload = {
  driverUserId: string;
  salesOrderIds: string[];
  notes?: string | null;
  /** Saved to `deliveries.delivery_date` (ISO date `YYYY-MM-DD`). */
  deliveryDate?: string | null;
};

export async function createDelivery(
  payload: CreateDeliveryPayload
): Promise<string> {
  const companyId = await requireActiveCompanyId();
  const createdBy = await getCurrentUserId();

  const drivers = await listDriverTeamMembers();
  if (!drivers.some((d) => d.userId === payload.driverUserId)) {
    throw new Error("Select an active driver from the company team.");
  }

  const ids = [...new Set(payload.salesOrderIds.filter(Boolean))];
  if (ids.length === 0) {
    throw new Error("Select at least one sales order.");
  }

  const now = new Date().toISOString();

  const deliveryDateIso =
    payload.deliveryDate?.trim()
      ? payload.deliveryDate.trim().slice(0, 10)
      : null;
  if (!deliveryDateIso) {
    throw new Error("Choose a delivery date.");
  }

  const { data: soCheckRows, error: soCheckErr } = await supabase
    .from("sales_orders")
    .select("id, delivery_date, fulfillment_status")
    .eq("company_id", companyId)
    .in("id", ids);

  if (soCheckErr) {
    throw new Error(soCheckErr.message ?? "Could not validate sales orders.");
  }
  const foundIds = new Set(
    (soCheckRows ?? []).map((r: { id: string }) => String(r.id)),
  );
  if (foundIds.size !== ids.length) {
    throw new Error(
      "One or more sales orders were not found or do not belong to this company.",
    );
  }

  const previousFulfillmentById = new Map<string, SalesOrderFulfillmentStatus>();

  for (const row of soCheckRows ?? []) {
    const id = String((row as { id: string }).id);
    const raw = (row as { delivery_date?: unknown }).delivery_date;
    const soDate =
      raw != null && String(raw).trim()
        ? String(raw).slice(0, 10)
        : null;
    if (soDate != null && soDate !== deliveryDateIso) {
      throw new Error(
        "Each sales order must have no delivery date or the same delivery date as this note.",
      );
    }
    const fs = normalizeSalesOrderFulfillmentStatus(
      (row as { fulfillment_status?: string | null }).fulfillment_status
    );
    if (!salesOrderEligibleForDeliveryNote(fs)) {
      throw new Error(
        "Each sales order must have fulfillment New or Rescheduled.",
      );
    }
    previousFulfillmentById.set(id, fs);
  }

  // New delivery notes always start at status `new` (see delivery_note_status enum).
  const { data: deliveryRow, error: dErr } = await supabase
    .from("deliveries")
    .insert({
      company_id: companyId,
      driver_user_id: payload.driverUserId,
      created_by: createdBy,
      notes: payload.notes?.trim() || null,
      delivery_date: deliveryDateIso,
      status: "new" as const,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (dErr || !deliveryRow) {
    throw new Error(dErr?.message ?? "Failed to create delivery.");
  }

  const deliveryId = (deliveryRow as { id: string }).id;

  const lineRows = ids.map((sales_order_id) => ({
    delivery_id: deliveryId,
    sales_order_id,
    created_at: now,
  }));

  const { error: lineErr } = await supabase
    .from("delivery_sales_orders")
    .insert(lineRows);

  if (lineErr) {
    await supabase.from("deliveries").delete().eq("id", deliveryId);
    throw new Error(lineErr.message ?? "Failed to link sales orders.");
  }

  const { data: updated, error: upErr } = await supabase
    .from("sales_orders")
    .update({
      fulfillment_status: "delivery note created",
      updated_at: now,
    })
    .in("id", ids)
    .eq("company_id", companyId)
    .in("fulfillment_status", DELIVERY_NOTE_ELIGIBLE_FULFILLMENT_STATUSES)
    .select("id");

  if (upErr) {
    await supabase.from("delivery_sales_orders").delete().eq("delivery_id", deliveryId);
    await supabase.from("deliveries").delete().eq("id", deliveryId);
    throw new Error(upErr.message ?? "Failed to update sales orders.");
  }

  const updatedCount = updated?.length ?? 0;
  if (updatedCount !== ids.length) {
    const updatedIds = new Set((updated ?? []).map((r: { id: string }) => r.id));
    const reverted = [...updatedIds];
    for (const rid of reverted) {
      const prev = previousFulfillmentById.get(rid);
      if (!prev) continue;
      await supabase
        .from("sales_orders")
        .update({
          fulfillment_status: prev,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rid)
        .eq("company_id", companyId);
    }
    await supabase.from("delivery_sales_orders").delete().eq("delivery_id", deliveryId);
    await supabase.from("deliveries").delete().eq("id", deliveryId);
    throw new Error(
      "Some sales orders are no longer eligible. They must be active with fulfillment New or Rescheduled."
    );
  }

  return deliveryId;
}

export type UpdateDeliveryPayload = CreateDeliveryPayload;

/** Update a delivery note while status is **new** (driver, date, notes, linked sales orders). */
export async function updateDelivery(
  deliveryId: string,
  payload: UpdateDeliveryPayload,
): Promise<void> {
  const companyId = await requireActiveCompanyId();

  const { data: deliveryRow, error: delErr } = await supabase
    .from("deliveries")
    .select("id, status")
    .eq("id", deliveryId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (delErr) {
    throw new Error(delErr.message ?? "Could not load delivery note.");
  }
  if (!deliveryRow) {
    throw new Error("Delivery note not found.");
  }
  if ((deliveryRow as { status: string }).status !== "new") {
    throw new Error("Only delivery notes with status New can be edited.");
  }

  const drivers = await listDriverTeamMembers();
  if (!drivers.some((d) => d.userId === payload.driverUserId)) {
    throw new Error("Select an active driver from the company team.");
  }

  const nextIds = [...new Set(payload.salesOrderIds.filter(Boolean))];
  if (nextIds.length === 0) {
    throw new Error("Select at least one sales order.");
  }

  const deliveryDateIso =
    payload.deliveryDate?.trim()
      ? payload.deliveryDate.trim().slice(0, 10)
      : null;
  if (!deliveryDateIso) {
    throw new Error("Choose a delivery date.");
  }

  const { data: linkRows, error: linkErr } = await supabase
    .from("delivery_sales_orders")
    .select("sales_order_id")
    .eq("delivery_id", deliveryId);

  if (linkErr) {
    throw new Error(linkErr.message ?? "Could not load linked sales orders.");
  }

  const currentIds = new Set(
    (linkRows ?? []).map((r) =>
      String((r as { sales_order_id: string }).sales_order_id),
    ),
  );
  const nextIdSet = new Set(nextIds);
  const toRemove = [...currentIds].filter((id) => !nextIdSet.has(id));
  const toAdd = nextIds.filter((id) => !currentIds.has(id));

  const { data: soCheckRows, error: soCheckErr } = await supabase
    .from("sales_orders")
    .select("id, delivery_date, fulfillment_status")
    .eq("company_id", companyId)
    .in("id", nextIds);

  if (soCheckErr) {
    throw new Error(soCheckErr.message ?? "Could not validate sales orders.");
  }
  const foundIds = new Set(
    (soCheckRows ?? []).map((r: { id: string }) => String(r.id)),
  );
  if (foundIds.size !== nextIds.length) {
    throw new Error(
      "One or more sales orders were not found or do not belong to this company.",
    );
  }

  const previousFulfillmentById = new Map<string, SalesOrderFulfillmentStatus>();

  for (const row of soCheckRows ?? []) {
    const id = String((row as { id: string }).id);
    const fs = normalizeSalesOrderFulfillmentStatus(
      (row as { fulfillment_status?: string | null }).fulfillment_status,
    );
    const onThisDelivery = currentIds.has(id);
    const isAdd = toAdd.includes(id);

    if (isAdd) {
      if (!salesOrderEligibleForDeliveryNote(fs)) {
        throw new Error(
          "Each added sales order must have fulfillment New or Rescheduled.",
        );
      }
      previousFulfillmentById.set(id, fs);
    } else if (onThisDelivery && nextIdSet.has(id)) {
      if (fs !== "delivery note created") {
        throw new Error(
          "A linked sales order is no longer on this delivery note.",
        );
      }
    } else {
      throw new Error(
        "One or more sales orders are not valid for this delivery note.",
      );
    }
  }

  const now = new Date().toISOString();

  const { error: updDelErr } = await supabase
    .from("deliveries")
    .update({
      driver_user_id: payload.driverUserId,
      notes: payload.notes?.trim() || null,
      delivery_date: deliveryDateIso,
      updated_at: now,
    })
    .eq("id", deliveryId)
    .eq("company_id", companyId)
    .eq("status", "new");

  if (updDelErr) {
    throw new Error(updDelErr.message ?? "Failed to update delivery note.");
  }

  if (toRemove.length > 0) {
    const { error: unlinkErr } = await supabase
      .from("delivery_sales_orders")
      .delete()
      .eq("delivery_id", deliveryId)
      .in("sales_order_id", toRemove);

    if (unlinkErr) {
      throw new Error(unlinkErr.message ?? "Failed to unlink sales orders.");
    }

    await supabase
      .from("sales_orders")
      .update({
        fulfillment_status: "new",
        delivery_date: null,
        updated_at: now,
      })
      .in("id", toRemove)
      .eq("company_id", companyId)
      .eq("fulfillment_status", "delivery note created");
  }

  if (toAdd.length > 0) {
    const lineRows = toAdd.map((sales_order_id) => ({
      delivery_id: deliveryId,
      sales_order_id,
      created_at: now,
    }));

    const { error: lineErr } = await supabase
      .from("delivery_sales_orders")
      .insert(lineRows);

    if (lineErr) {
      throw new Error(lineErr.message ?? "Failed to link sales orders.");
    }

    const { data: updated, error: upErr } = await supabase
      .from("sales_orders")
      .update({
        fulfillment_status: "delivery note created",
        delivery_date: deliveryDateIso,
        updated_at: now,
      })
      .in("id", toAdd)
      .eq("company_id", companyId)
      .in("fulfillment_status", DELIVERY_NOTE_ELIGIBLE_FULFILLMENT_STATUSES)
      .select("id");

    if (upErr) {
      throw new Error(upErr.message ?? "Failed to update sales orders.");
    }

    const updatedCount = updated?.length ?? 0;
    if (updatedCount !== toAdd.length) {
      for (const rid of toAdd) {
        const prev = previousFulfillmentById.get(rid);
        if (!prev) continue;
        await supabase
          .from("sales_orders")
          .update({
            fulfillment_status: prev,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rid)
          .eq("company_id", companyId);
      }
      await supabase
        .from("delivery_sales_orders")
        .delete()
        .eq("delivery_id", deliveryId)
        .in("sales_order_id", toAdd);
      throw new Error(
        "Some added sales orders are no longer eligible. They must be active with fulfillment New or Rescheduled.",
      );
    }
  }

  const { error: dateSyncErr } = await supabase
    .from("sales_orders")
    .update({
      delivery_date: deliveryDateIso,
      updated_at: now,
    })
    .in("id", nextIds)
    .eq("company_id", companyId);

  if (dateSyncErr) {
    throw new Error(
      dateSyncErr.message ?? "Failed to update sales order delivery dates.",
    );
  }
}

export function deliveryNoteAllowsEditing(
  status: DeliveryNoteStatus,
): boolean {
  return status === "new";
}
