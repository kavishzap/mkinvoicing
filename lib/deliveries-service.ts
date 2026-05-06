import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import { getCurrentUserId } from "@/lib/settings-service";
import { listTeamMembers, isDriverRoleTeamMember, type TeamMemberRow } from "@/lib/company-team-service";
import {
  normalizeSalesOrderFulfillmentStatus,
  normalizeSalesOrderPaymentStatus,
  type SalesOrderFulfillmentStatus,
  type SalesOrderPaymentStatus,
} from "@/lib/sales-orders-service";

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
  createdByUserId: string;
  createdByDisplay: string;
  notes: string | null;
  deliveryDate: string | null;
  createdAt: string;
  orderCount: number;
  totalAmount: number;
};

export type DeliveryDetailSalesOrder = {
  linkId: string;
  salesOrderId: string;
  number: string;
  currency: string;
  total: number;
  clientName: string;
  phone: string;
  email: string;
  addressLines: string;
  fulfillmentStatus: SalesOrderFulfillmentStatus;
  /** Sales order row `updated_at` (used for day/week return filters). */
  updatedAt: string | null;
  items: DeliveryLineItem[];
};

export type DeliveryDetail = {
  id: string;
  status: DeliveryNoteStatus;
  notes: string | null;
  deliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
  driverUserId: string;
  driverDisplay: string;
  createdByUserId: string;
  createdByDisplay: string;
  salesOrders: DeliveryDetailSalesOrder[];
};

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

/** Team members whose role name includes “driver” (case-insensitive). */
export async function listDriverTeamMembers(): Promise<TeamMemberRow[]> {
  const all = await listTeamMembers();
  return all.filter(isDriverRoleTeamMember);
}

/** Active sales orders with fulfillment **New** or **Rescheduled**, including line items for the picker. */
export async function listSalesOrdersForDelivery(): Promise<SalesOrderPickRow[]> {
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      `
      id, number, issue_date, valid_until, currency, total, payment_status, fulfillment_status, bill_to_snapshot, city_id, cities(name),
      delivery_date,
      customer_id,
      customers (
        city_id,
        city,
        cities ( name )
      ),
      sales_order_items ( product_id, item, description, quantity, unit_price, tax_percent, sort_order )
    `
    )
    .eq("company_id", companyId)
    .in("fulfillment_status", ["new", "rescheduled"])
    .eq("status", "active")
    .order("issue_date", { ascending: false })
    .limit(300);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const bill = (row.bill_to_snapshot ?? {}) as Record<string, unknown>;
    const { clientName, phone, email, addressLines } = billSnapshotToContact(bill);
    const cityId = pickCityIdForDeliveryRow(row);
    const city = pickCityDisplayForDeliveryRow(row, bill);
    const rawItems = (row.sales_order_items ?? []) as Record<string, unknown>[];
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
      id: row.id as string,
      number: String(row.number ?? ""),
      issueDate: String(row.issue_date ?? ""),
      validUntil: String(row.valid_until ?? ""),
      currency: String(row.currency ?? "MUR"),
      total: Number(row.total ?? 0),
      paymentStatus: normalizeSalesOrderPaymentStatus(
        row.payment_status as string | null | undefined
      ),
      fulfillmentStatus: normalizeSalesOrderFulfillmentStatus(
        row.fulfillment_status as string | null | undefined
      ),
      clientName,
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
  });
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
      notes,
      delivery_date,
      created_at,
      updated_at,
      delivery_sales_orders (
        id,
        sales_orders ( total )
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
  const names = await profileDisplayMap(userIds);

  return rows.map((r: Record<string, unknown>) => {
    const lines = (r.delivery_sales_orders ?? []) as Record<string, unknown>[];
    const totalAmount = lines.reduce((sum, line) => {
      const nested = line.sales_orders;
      const so = (Array.isArray(nested) ? nested[0] : nested) as
        | Record<string, unknown>
        | undefined;
      return sum + Number(so?.total ?? 0);
    }, 0);
    const driverId = r.driver_user_id as string;
    const createdId = r.created_by as string;
    return {
      id: r.id as string,
      status: normalizeDeliveryNoteStatus(r.status as string | null | undefined),
      driverStatus: Boolean(r.driver_status),
      driverUserId: driverId,
      driverDisplay: names.get(driverId) ?? driverId.slice(0, 8),
      createdByUserId: createdId,
      createdByDisplay: names.get(createdId) ?? createdId.slice(0, 8),
      notes: (r.notes as string | null) ?? null,
      deliveryDate:
        r.delivery_date != null && String(r.delivery_date).trim()
          ? String(r.delivery_date).slice(0, 10)
          : null,
      createdAt: String(r.created_at ?? ""),
      orderCount: lines.length,
      totalAmount,
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

export async function getDelivery(id: string): Promise<DeliveryDetail | null> {
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("deliveries")
    .select(
      `
      id,
      status,
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
          currency,
          total,
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
  const names = await profileDisplayMap([driverId, createdId]);

  const links = (d.delivery_sales_orders ?? []) as Record<string, unknown>[];
  const salesOrders: DeliveryDetailSalesOrder[] = links.map((link) => {
    const nested = link.sales_orders;
    const soRaw = Array.isArray(nested) ? nested[0] : nested;
    const so = (
      soRaw && typeof soRaw === "object" ? soRaw : {}
    ) as Record<string, unknown>;

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
      linkId: link.id as string,
      salesOrderId: String(so.id ?? link.sales_order_id),
      number: String(so.number ?? ""),
      currency: String(so.currency ?? "MUR"),
      total: Number(so.total ?? 0),
      clientName,
      phone,
      email,
      addressLines,
      fulfillmentStatus: normalizeSalesOrderFulfillmentStatus(
        so.fulfillment_status as string | null
      ),
      updatedAt:
        so.updated_at != null ? String(so.updated_at) : null,
      items,
    };
  });

  return {
    id: d.id as string,
    status: normalizeDeliveryNoteStatus(d.status as string | null | undefined),
    notes: (d.notes as string | null) ?? null,
    deliveryDate:
      d.delivery_date != null && String(d.delivery_date).trim()
        ? String(d.delivery_date).slice(0, 10)
        : null,
    createdAt: String(d.created_at ?? ""),
    updatedAt: String(d.updated_at ?? ""),
    driverUserId: driverId,
    driverDisplay: names.get(driverId) ?? driverId.slice(0, 8),
    createdByUserId: createdId,
    createdByDisplay: names.get(createdId) ?? createdId.slice(0, 8),
    salesOrders,
  };
}

export type DriverStockReturnLine = {
  productId: string;
  productName: string;
  deliveryQty: number;
};

export type DriverStockReturnPeriod = "day" | "week";

export type DriverStockReturnContext = {
  lines: DriverStockReturnLine[];
  /** Current quantity at the driver's active stock location per product. */
  availableByProduct: Record<string, number>;
  period: DriverStockReturnPeriod;
};

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday 00:00:00 local time for the calendar week containing `d`. */
function startOfLocalWeekMonday(d = new Date()): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function salesOrderInDriverReturnPeriod(
  updatedAtIso: string | null,
  period: DriverStockReturnPeriod
): boolean {
  const start =
    period === "day" ? startOfLocalDay() : startOfLocalWeekMonday();
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
  opts: { period: DriverStockReturnPeriod }
): DriverStockReturnLine[] {
  const map = new Map<string, { name: string; qty: number }>();
  for (const so of d.salesOrders) {
    if (so.fulfillmentStatus !== "delivered to driver") continue;
    if (!salesOrderInDriverReturnPeriod(so.updatedAt, opts.period)) continue;
    for (const line of so.items) {
      const pid = line.product_id?.trim();
      if (!pid) continue;
      const q = Number(line.quantity ?? 0);
      if (!Number.isFinite(q) || q <= 0) continue;
      const name = String(line.item ?? "").trim() || "Product";
      const prev = map.get(pid);
      map.set(pid, {
        name: prev?.name ?? name,
        qty: (prev?.qty ?? 0) + q,
      });
    }
  }
  return [...map.entries()]
    .map(([productId, v]) => ({
      productId,
      productName: v.name,
      deliveryQty: v.qty,
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
 * Catalog-linked lines for sales orders still in **Delivered to driver** on this delivery,
 * scoped by calendar **day** or **week** (order `updated_at` vs local start of day / Monday).
 */
export async function getDriverStockReturnContext(
  deliveryId: string,
  opts?: { period?: DriverStockReturnPeriod }
): Promise<DriverStockReturnContext> {
  const period = opts?.period ?? "week";
  const d = await getDelivery(deliveryId);
  if (!d) {
    return { lines: [], availableByProduct: {}, period };
  }
  const lines = aggregateDeliveryProductLines(d, { period });
  const companyId = await requireActiveCompanyId();
  const availableByProduct = await getDriverLocationStockForProducts(
    companyId,
    d.driverUserId,
    lines.map((l) => l.productId)
  );
  return { lines, availableByProduct, period };
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
      throw new Error(
        rpcErr.message ??
          "Could not transfer stock for this delivery. Check primary warehouse stock and try again."
      );
    }

    if (salesOrderIds.length > 0) {
      const { error: soErr } = await supabase
        .from("sales_orders")
        .update({
          fulfillment_status: "delivered to driver",
          updated_at: now,
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

  if (salesOrderIds.length > 0) {
    const { error: soErr } = await supabase
      .from("sales_orders")
      .update({
        fulfillment_status: "delivered to customer",
        updated_at: now,
      })
      .in("id", salesOrderIds)
      .eq("company_id", companyId)
      .in("fulfillment_status", [
        "delivered to driver",
        "delivery note created",
      ]);

    if (soErr) {
      await supabase
        .from("deliveries")
        .update({
          status: current,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deliveryId)
        .eq("company_id", companyId);
      throw new Error(soErr.message ?? "Failed to update sales orders.");
    }
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
    if (fs !== "new" && fs !== "rescheduled") {
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
    .in("fulfillment_status", ["new", "rescheduled"])
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
