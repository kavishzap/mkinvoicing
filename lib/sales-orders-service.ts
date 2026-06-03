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

/** Default validity window when valid-until is not shown on the form. */
export function computeSalesOrderValidUntil(
  issueDate: string,
  validForDays = 14,
): string {
  const base = new Date(issueDate || new Date().toISOString().split("T")[0]);
  base.setDate(base.getDate() + (Number(validForDays) || 14));
  return base.toISOString().split("T")[0];
}

/** Normalize stored discount to a fixed currency amount (sales orders use amount only). */
export function resolveDiscountAmount(
  discountType: "value" | "percent",
  discountAmount: number,
  subtotal: number,
): number {
  if (discountType === "percent") {
    return (subtotal * Number(discountAmount || 0)) / 100;
  }
  return Number(discountAmount || 0);
}

/** Fulfillment pipeline; stored as `sales_orders.fulfillment_status`. */
export type SalesOrderFulfillmentStatus =
  Database["public"]["Enums"]["sales_order_fulfillment_status"];

/** Raw Postgres enum label on `sales_orders.payment_status`. */
export type SalesOrderPaymentStatusDb =
  Database["public"]["Enums"]["sales_order_payment_status"];

let cachedFulfillmentEnumLabels: SalesOrderFulfillmentStatus[] | null = null;
let cachedFulfillmentEnumAt = 0;
let cachedPaymentEnumLabels: SalesOrderPaymentStatusDb[] | null = null;
let cachedPaymentEnumAt = 0;
const SALES_ORDER_ENUM_CACHE_MS = 5 * 60 * 1000;

let cachedDeliveryCitiesByCompany: {
  companyId: string;
  at: number;
  byId: Map<string, string>;
} | null = null;
const DELIVERY_CITIES_CACHE_MS = 5 * 60 * 1000;

/** List table projection — embed city name; omit unused date columns. */
const SALES_ORDER_LIST_SELECT =
  "id, number, issue_date, delivery_date, status, fulfillment_status, payment_status, currency, bill_to_snapshot, total, city_id, cities(name), user_id, notes, customer_id, customers!sales_orders_customer_id_fkey(type, company_name, full_name, contact_name, address_line_1, street)";

const userDisplayLabelCache = new Map<string, string>();

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function appendBillToPhoneFilters(
  filters: string[],
  trimmed: string,
  escaped: string,
) {
  const pattern = `%${escaped}%`;
  filters.push(`bill_to_snapshot->>phone.ilike.${pattern}`);

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length >= 2) {
    const digitPattern = `%${escapeIlikePattern(digitsOnly)}%`;
    if (digitPattern !== pattern) {
      filters.push(`bill_to_snapshot->>phone.ilike.${digitPattern}`);
    }
  }
}

const MAX_CUSTOMER_IDS_FOR_SALES_ORDER_SEARCH = 100;

/** Linked customer phones live on `customers`; resolved separately for `.or()`. */
async function findCustomerIdsForSalesOrderPhoneSearch(
  companyId: string,
  raw: string,
): Promise<string[]> {
  const trimmed = raw.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length < 2 && !/\d/.test(trimmed)) return [];

  const patterns: string[] = [];
  const escaped = escapeIlikePattern(trimmed);
  patterns.push(`%${escaped}%`);
  if (digitsOnly.length >= 2) {
    const digitPattern = `%${escapeIlikePattern(digitsOnly)}%`;
    if (!patterns.includes(digitPattern)) patterns.push(digitPattern);
  }

  const phoneOr = patterns.map((p) => `phone.ilike.${p}`).join(",");
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("company_id", companyId)
    .or(phoneOr)
    .limit(MAX_CUSTOMER_IDS_FOR_SALES_ORDER_SEARCH);

  if (error) throw error;
  return (data ?? [])
    .map((row) => String((row as { id: string }).id ?? ""))
    .filter(Boolean);
}

/** Returns a PostgREST `or()` filter string, or null when search should be skipped. */
function buildSalesOrderSearchOrFilter(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const escaped = escapeIlikePattern(trimmed);
  const pattern = `%${escaped}%`;
  const digitsOnly = trimmed.replace(/\D/g, "");

  /** Order refs (e.g. SO-123), not bare phone numbers. */
  const orderNumberLike =
    trimmed.length <= 40 &&
    /^[\w\-/#.]+$/i.test(trimmed) &&
    /\d/.test(trimmed) &&
    /[a-z]/i.test(trimmed);

  if (orderNumberLike) {
    return `number.ilike.${pattern}`;
  }

  if (trimmed.length < 2 && digitsOnly.length < 2) return null;

  const filters = [
    `number.ilike.${pattern}`,
    `bill_to_snapshot->>company_name.ilike.${pattern}`,
    `bill_to_snapshot->>full_name.ilike.${pattern}`,
    `bill_to_snapshot->>contact_name.ilike.${pattern}`,
  ];

  if (digitsOnly.length >= 2 || /\d/.test(trimmed)) {
    appendBillToPhoneFilters(filters, trimmed, escaped);
  }

  return filters.join(",");
}

/** PostgREST `or()` clause for list/export queries (sales_orders columns + customer_id.in). */
async function buildSalesOrderListSearchOrClause(
  companyId: string,
  search?: string,
): Promise<string | null> {
  const trimmed = search?.trim();
  if (!trimmed) return null;

  const baseOr = buildSalesOrderSearchOrFilter(trimmed);
  const customerIds = await findCustomerIdsForSalesOrderPhoneSearch(
    companyId,
    trimmed,
  );

  const customerIn =
    customerIds.length > 0
      ? `customer_id.in.(${customerIds.join(",")})`
      : null;

  if (baseOr && customerIn) return `${baseOr},${customerIn}`;
  if (baseOr) return baseOr;
  if (customerIn) return customerIn;
  return null;
}

export type SalesOrderMissingCityFilter = "all" | "missing";
export type SalesOrderMissingAddressFilter = "all" | "missing";

/** Unified sidebar filter on /app/sales-orders (city, address, or both). */
export type SalesOrderLocationFilter =
  | "all"
  | "missing_city"
  | "missing_address"
  | "missing_both";

export function salesOrderLocationToListFilters(
  location: SalesOrderLocationFilter,
): {
  missingCity: SalesOrderMissingCityFilter;
  missingAddress: SalesOrderMissingAddressFilter;
} {
  switch (location) {
    case "missing_city":
      return { missingCity: "missing", missingAddress: "all" };
    case "missing_address":
      return { missingCity: "all", missingAddress: "missing" };
    case "missing_both":
      return { missingCity: "missing", missingAddress: "missing" };
    default:
      return { missingCity: "all", missingAddress: "all" };
  }
}

type SalesOrderListQueryOpts = {
  search?: string;
  status?: SalesOrderStatus | "all";
  fulfillmentStatus?: SalesOrderFulfillmentStatus | "all";
  paymentStatus?: SalesOrderPaymentStatusDb | "all";
  missingCity?: SalesOrderMissingCityFilter;
  missingAddress?: SalesOrderMissingAddressFilter;
  customerId?: string;
};

type SalesOrderListFilterBuilder<Q> = {
  eq: (col: string, val: string) => Q;
  or: (filters: string) => Q;
  is: (col: string, val: null) => Q;
  in: (col: string, vals: string[]) => Q;
};

const NO_MATCH_SALES_ORDER_ID = "00000000-0000-0000-0000-000000000000";

/** Rows with no `city_id` and no bill-to city text (matches empty list City column). */
function applySalesOrderMissingCityFilter<Q extends SalesOrderListFilterBuilder<Q>>(
  q: Q,
): Q {
  return q
    .is("city_id", null)
    .or("bill_to_snapshot->>city.is.null,bill_to_snapshot->>city.eq.");
}

async function fetchSalesOrderIdsMissingAddress(
  companyId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("sales_order_ids_missing_address", {
    p_company_id: companyId,
  });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map((id) => String(id)).filter(Boolean);
}

function applySalesOrderListFilters<Q extends SalesOrderListFilterBuilder<Q>>(
  q: Q,
  opts?: SalesOrderListQueryOpts,
  missingAddressIds?: string[] | null,
): Q {
  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }
  if (opts?.fulfillmentStatus && opts.fulfillmentStatus !== "all") {
    q = q.eq("fulfillment_status", opts.fulfillmentStatus);
  }
  if (opts?.paymentStatus && opts.paymentStatus !== "all") {
    q = q.eq("payment_status", opts.paymentStatus);
  }
  if (opts?.missingCity === "missing") {
    q = applySalesOrderMissingCityFilter(q);
  }
  if (opts?.missingAddress === "missing") {
    if (missingAddressIds === null) {
      q = q.or(
        "and(bill_to_snapshot->>address_line_1.is.null,bill_to_snapshot->>address_line_1.eq.,bill_to_snapshot->>street.is.null,bill_to_snapshot->>street.eq.,customer_id.is.null)",
      );
    } else if (!missingAddressIds?.length) {
      q = q.eq("id", NO_MATCH_SALES_ORDER_ID);
    } else {
      q = q.in("id", missingAddressIds);
    }
  }
  const cid = opts?.customerId?.trim();
  if (cid) {
    q = q.eq("customer_id", cid);
  }
  return q;
}

async function resolveMissingAddressIdsForFilter(
  companyId: string,
  opts?: SalesOrderListQueryOpts,
): Promise<string[] | null | undefined> {
  if (opts?.missingAddress !== "missing") return undefined;
  try {
    return await fetchSalesOrderIdsMissingAddress(companyId);
  } catch {
    return null;
  }
}

async function deliveryCityNameMapForCompany(
  companyId: string,
): Promise<Map<string, string>> {
  if (
    cachedDeliveryCitiesByCompany &&
    cachedDeliveryCitiesByCompany.companyId === companyId &&
    Date.now() - cachedDeliveryCitiesByCompany.at < DELIVERY_CITIES_CACHE_MS
  ) {
    return cachedDeliveryCitiesByCompany.byId;
  }

  const cityRows = await listDeliveryCities();
  const byId = new Map(cityRows.map((c) => [c.id, c.name] as const));
  cachedDeliveryCitiesByCompany = {
    companyId,
    at: Date.now(),
    byId,
  };
  return byId;
}

function parseFulfillmentEnumLabel(v: string): SalesOrderFulfillmentStatus | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed as SalesOrderFulfillmentStatus;
}

function dedupeOrderedEnumLabels<T extends string>(labels: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const label of labels) {
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function parsePaymentEnumLabel(v: string): SalesOrderPaymentStatusDb | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (trimmed === "partial" || trimmed === "partially_paid") return "partial paid";
  if (
    trimmed === "unpaid" ||
    trimmed === "partial paid" ||
    trimmed === "paid"
  ) {
    return trimmed as SalesOrderPaymentStatusDb;
  }
  return null;
}

/** Map stored `payment_status` to the Postgres enum label for filters and counts. */
export function paymentStatusDbFromRaw(
  raw: string | null | undefined,
): SalesOrderPaymentStatusDb {
  const parsed = parsePaymentEnumLabel(String(raw ?? "unpaid"));
  if (parsed) return parsed;
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "paid") return "paid";
  if (v === "partial" || v === "partially_paid") return "partial paid";
  return "unpaid";
}

/**
 * Ordered labels for `public.sales_order_fulfillment_status` from Postgres (`pg_enum`).
 * Requires RPC `sales_order_fulfillment_status_enum_values` — see `sql/patch_sales_order_status_enum_rpc.sql`.
 */
export async function fetchSalesOrderFulfillmentStatusEnumValues(): Promise<
  SalesOrderFulfillmentStatus[]
> {
  if (
    cachedFulfillmentEnumLabels &&
    Date.now() - cachedFulfillmentEnumAt < SALES_ORDER_ENUM_CACHE_MS
  ) {
    return cachedFulfillmentEnumLabels;
  }

  const { data, error } = await supabase.rpc(
    "sales_order_fulfillment_status_enum_values",
  );
  if (error) {
    throw new Error(
      `${error.message} — apply sql/patch_sales_order_status_enum_rpc.sql in Supabase.`,
    );
  }
  if (!data || !Array.isArray(data)) return [];

  const labels = dedupeOrderedEnumLabels(
    data
      .filter((x): x is string => typeof x === "string")
      .map(parseFulfillmentEnumLabel)
      .filter((x): x is SalesOrderFulfillmentStatus => x != null),
  );

  cachedFulfillmentEnumLabels = labels;
  cachedFulfillmentEnumAt = Date.now();
  return labels;
}

/**
 * Ordered labels for `public.sales_order_payment_status` from Postgres (`pg_enum`).
 * Requires RPC `sales_order_payment_status_enum_values` — see `sql/patch_sales_order_status_enum_rpc.sql`.
 */
export async function fetchSalesOrderPaymentStatusEnumValues(): Promise<
  SalesOrderPaymentStatusDb[]
> {
  if (
    cachedPaymentEnumLabels &&
    Date.now() - cachedPaymentEnumAt < SALES_ORDER_ENUM_CACHE_MS
  ) {
    return cachedPaymentEnumLabels;
  }

  const { data, error } = await supabase.rpc(
    "sales_order_payment_status_enum_values",
  );
  if (error) {
    throw new Error(
      `${error.message} — apply sql/patch_sales_order_status_enum_rpc.sql in Supabase.`,
    );
  }
  if (!data || !Array.isArray(data)) return [];

  const labels = dedupeOrderedEnumLabels(
    data
      .filter((x): x is string => typeof x === "string")
      .map(parsePaymentEnumLabel)
      .filter((x): x is SalesOrderPaymentStatusDb => x != null),
  );

  cachedPaymentEnumLabels = labels;
  cachedPaymentEnumAt = Date.now();
  return labels;
}

export function salesOrderFulfillmentFilterLabel(status: string): string {
  return salesOrderFulfillmentDisplayLabel(status);
}

export function salesOrderPaymentFilterLabel(status: string): string {
  return formatEnumLabel(status);
}

function formatEnumLabel(enumLabel: string): string {
  if (!enumLabel.trim()) return "";
  return enumLabel
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

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

export function salesOrderFulfillmentDisplayLabel(status: string): string {
  const v = String(status ?? "").trim();
  if (!v) return SALES_ORDER_FULFILLMENT_LABELS.new;
  const normalized = normalizeSalesOrderFulfillmentStatus(v);
  return (
    SALES_ORDER_FULFILLMENT_LABELS[
      normalized as keyof typeof SALES_ORDER_FULFILLMENT_LABELS
    ] ?? formatEnumLabel(v)
  );
}

export function normalizeSalesOrderFulfillmentStatus(
  raw: string | null | undefined
): SalesOrderFulfillmentStatus {
  const v = String(raw ?? "").trim();
  if (!v) return "new";
  const fromLegacy =
    FULFILLMENT_LEGACY[v] ?? FULFILLMENT_LEGACY[v.toLowerCase()];
  if (fromLegacy) return fromLegacy;
  /** Preserve Postgres enum labels (including values added after app codegen). */
  return v as SalesOrderFulfillmentStatus;
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
  /** ISO `YYYY-MM-DD` from `issue_date`. */
  issueDate: string;
  /** ISO `YYYY-MM-DD` or null when not set. */
  deliveryDate: string | null;
  /** Delivery catalog city name (`cities.name` via `city_id`), else bill-to snapshot city. */
  cityName: string;
  status: SalesOrderStatus;
  fulfillmentStatus: SalesOrderFulfillmentStatus;
  paymentStatus: SalesOrderPaymentStatus;
  currency: string;
  /** Bill-to / linked customer display name. */
  clientName: string;
  /** Bill-to address on the order, else linked customer address. */
  address: string;
  customerId: string | null;
  total: number;
  /** Display label for the user who created the order (full name → email → short id). */
  createdByName: string;
  /** Raw notes from `sales_orders.notes`, trimmed. Empty string when none. */
  notes: string;
};

function nameFromBillTo(bill?: Record<string, unknown>) {
  if (!bill) return "";
  const t = bill.type as string | undefined;
  if (t === "company") {
    return String(bill.company_name ?? bill.name ?? "");
  }
  return String(bill.full_name ?? bill.name ?? "");
}

function addressFromRecord(
  record?: {
    address_line_1?: string | null;
    street?: string | null;
  } | null,
): string {
  if (!record) return "";
  const line1 = String(record.address_line_1 ?? "").trim();
  if (line1) return line1;
  return String(record.street ?? "").trim();
}

/** Order bill-to address first, then linked customer record. */
function salesOrderListAddress(
  bill?: Record<string, unknown>,
  customer?: {
    address_line_1?: string | null;
    street?: string | null;
  } | null,
): string {
  const fromBill = addressFromRecord(
    bill
      ? {
          address_line_1: bill.address_line_1 as string | null | undefined,
          street: bill.street as string | null | undefined,
        }
      : null,
  );
  if (fromBill) return fromBill;
  return addressFromRecord(customer ?? null);
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

function customerLinkFromSalesOrderRow(r: Record<string, unknown>): {
  customerId: string | null;
  clientName: string;
} {
  const customerId =
    r.customer_id != null && String(r.customer_id).trim()
      ? String(r.customer_id)
      : null;
  const billName = nameFromBillTo(
    r.bill_to_snapshot as Record<string, unknown>,
  ).trim();
  const rel = r.customers;
  const row = Array.isArray(rel) ? rel[0] : rel;
  const recordName = nameFromCustomerRecord(
    row as {
      type?: string;
      company_name?: string | null;
      full_name?: string | null;
      contact_name?: string | null;
    } | null,
  );
  return { customerId, clientName: billName || recordName };
}

async function userDisplayMap(
  userIds: string[]
): Promise<Map<string, string>> {
  const uniq = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;

  const missing = uniq.filter((id) => !userDisplayLabelCache.has(id));
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", missing);

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const r = row as {
        id: string;
        full_name: string | null;
        email: string | null;
      };
      const label =
        (r.full_name && r.full_name.trim()) ||
        (r.email && r.email.trim()) ||
        r.id.slice(0, 8);
      userDisplayLabelCache.set(r.id, label);
    }
  }

  for (const id of uniq) {
    map.set(id, userDisplayLabelCache.get(id) ?? id.slice(0, 8));
  }
  return map;
}

function embeddedCityName(citiesField: unknown): string {
  if (citiesField == null) return "";
  if (Array.isArray(citiesField)) {
    const first = citiesField[0] as { name?: unknown } | undefined;
    return String(first?.name ?? "").trim();
  }
  if (typeof citiesField === "object" && "name" in (citiesField as object)) {
    return String((citiesField as { name: unknown }).name ?? "").trim();
  }
  return "";
}

function cityLabelFromListRow(
  r: { city_id?: unknown; bill_to_snapshot?: unknown; cities?: unknown },
  cityById?: Map<string, string>,
): string {
  const embedded = embeddedCityName(r.cities);
  if (embedded) return embedded;

  const cid =
    r.city_id != null && String(r.city_id).trim()
      ? String(r.city_id)
      : "";
  if (cid && cityById?.has(cid)) return cityById.get(cid)!;

  const bill = r.bill_to_snapshot as Record<string, unknown> | undefined;
  if (!bill) return "";
  return String(bill.city ?? "").trim();
}

async function finishSalesOrderListRows(
  rawRows: Array<Record<string, unknown>>,
  cityById?: Map<string, string>,
): Promise<SalesOrderListRow[]> {
  if (rawRows.length === 0) return [];

  const creatorIds = rawRows
    .map((r) => (r.user_id != null ? String(r.user_id) : ""))
    .filter(Boolean);
  const creatorNames =
    creatorIds.length > 0 ? await userDisplayMap(creatorIds) : new Map();

  return rawRows.map((r: Record<string, unknown>) => {
    const creatorId = r.user_id != null ? String(r.user_id) : "";
    const createdByName = creatorId
      ? creatorNames.get(creatorId) ?? creatorId.slice(0, 8)
      : "";
    const bill = r.bill_to_snapshot as Record<string, unknown> | undefined;
    const { customerId, clientName } = customerLinkFromSalesOrderRow(r);
    const custRel = r.customers;
    const custRow = Array.isArray(custRel) ? custRel[0] : custRel;
    return {
      id: String(r.id),
      number: String(r.number ?? ""),
      issueDate: String(r.issue_date ?? "").slice(0, 10),
      deliveryDate:
        r.delivery_date != null && String(r.delivery_date).trim()
          ? String(r.delivery_date).slice(0, 10)
          : null,
      cityName: cityLabelFromListRow(r, cityById),
      status: normalizeSalesOrderStatus(String(r.status)),
      fulfillmentStatus: normalizeSalesOrderFulfillmentStatus(
        r.fulfillment_status as string | null | undefined,
      ),
      paymentStatus: normalizeSalesOrderPaymentStatus(
        r.payment_status as string | null | undefined,
      ),
      currency: String(r.currency ?? ""),
      clientName,
      address: salesOrderListAddress(
        bill,
        custRow as {
          address_line_1?: string | null;
          street?: string | null;
        } | null,
      ),
      customerId,
      total: Number(r.total ?? 0),
      createdByName,
      notes: r.notes != null ? String(r.notes).trim() : "",
    };
  });
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
    /* non-fatal: list still loads */
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
      /* number bump is best-effort */
    }

    invalidateSalesOrderCaches();
    return salesOrderId;
  }

  throw new Error(
    lastError[0]?.message ??
      "Could not allocate a unique sales order number. Try again."
  );
}

/**
 * Sidebar facet counts and ordered enum labels from Postgres (`pg_enum` RPCs).
 * Does not run `expireStaleSalesOrders` — call that once before this when loading the list.
 */
export type SalesOrderListFacets = {
  total: number;
  fulfillmentEnum: SalesOrderFulfillmentStatus[];
  paymentEnum: SalesOrderPaymentStatusDb[];
  byFulfillment: Record<string, number>;
  byPayment: Record<string, number>;
  /** Orders with no delivery city and no bill-to city on the snapshot. */
  missingCity: number;
  /** Orders with no bill-to or linked customer address. */
  missingAddress: number;
  /** Orders missing both city and address (intersection). */
  missingBoth: number;
};

let cachedListFacets:
  | { companyId: string; at: number; data: SalesOrderListFacets }
  | null = null;
const LIST_FACETS_CACHE_MS = 45 * 1000;
const LIST_CACHE_MS = 45 * 1000;
const DETAIL_CACHE_MS = 45 * 1000;

type SalesOrderListCacheEntry = {
  key: string;
  expires: number;
  rows: SalesOrderListRow[];
  total: number;
};

type SalesOrderDetailCacheEntry = {
  companyId: string;
  expires: number;
  detail: SalesOrderDetail;
};

const listCache = new Map<string, SalesOrderListCacheEntry>();
const detailCache = new Map<string, SalesOrderDetailCacheEntry>();

function salesOrderListCacheKey(
  companyId: string,
  opts?: {
    search?: string;
    status?: SalesOrderStatus | "all";
    fulfillmentStatus?: SalesOrderFulfillmentStatus | "all";
    paymentStatus?: SalesOrderPaymentStatusDb | "all";
    missingCity?: SalesOrderMissingCityFilter;
    missingAddress?: SalesOrderMissingAddressFilter;
    customerId?: string;
    page?: number;
    pageSize?: number;
  },
) {
  return [
    companyId,
    opts?.search ?? "",
    opts?.status ?? "all",
    opts?.fulfillmentStatus ?? "all",
    opts?.paymentStatus ?? "all",
    opts?.missingCity ?? "all",
    opts?.missingAddress ?? "all",
    opts?.customerId ?? "",
    opts?.page ?? 1,
    opts?.pageSize ?? 10,
  ].join("|");
}

function salesOrderDetailCacheKey(
  companyId: string,
  id: string,
  mode: "view" | "full",
) {
  return `${companyId}|${id}|${mode}`;
}

/** Synchronous facet read for stale-while-revalidate on the list page. */
export function getCachedSalesOrderListFacets(
  companyId: string,
): SalesOrderListFacets | null {
  if (!cachedListFacets || cachedListFacets.companyId !== companyId) {
    return null;
  }
  if (Date.now() - cachedListFacets.at >= LIST_FACETS_CACHE_MS) {
    return null;
  }
  return cachedListFacets.data;
}

export function getCachedSalesOrderList(
  companyId: string,
  opts?: Parameters<typeof salesOrderListCacheKey>[1],
): { rows: SalesOrderListRow[]; total: number } | null {
  const hit = listCache.get(salesOrderListCacheKey(companyId, opts));
  if (!hit || hit.expires <= Date.now()) return null;
  return { rows: hit.rows, total: hit.total };
}

export function getCachedSalesOrder(
  companyId: string,
  id: string,
  mode: "view" | "full" = "full",
): SalesOrderDetail | null {
  const hit = detailCache.get(salesOrderDetailCacheKey(companyId, id, mode));
  if (!hit || hit.companyId !== companyId) return null;
  if (hit.expires <= Date.now()) return null;
  return hit.detail;
}

/** Clears list, facet, and detail caches after mutations. */
export function invalidateSalesOrderCaches() {
  cachedListFacets = null;
  listCache.clear();
  detailCache.clear();
}

function facetCountMap(
  enumLabels: string[],
  raw: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    enumLabels.map((s) => [s, Number(src[s] ?? 0)]),
  );
}

async function fetchSalesOrderListFacetsLegacy(
  companyId: string,
  fulfillmentEnum: SalesOrderFulfillmentStatus[],
  paymentEnum: SalesOrderPaymentStatusDb[],
): Promise<Pick<SalesOrderListFacets, "total" | "byFulfillment" | "byPayment">> {
  const head = () =>
    supabase
      .from("sales_orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

  const countOf = async (
    builder: ReturnType<typeof head>,
  ): Promise<number> => {
    const { count, error } = await builder;
    if (error) throw error;
    return count ?? 0;
  };

  const [total, ...statusCounts] = await Promise.all([
    countOf(head()),
    ...fulfillmentEnum.map((s) =>
      countOf(head().eq("fulfillment_status", s)),
    ),
    ...paymentEnum.map((s) => countOf(head().eq("payment_status", s))),
  ]);

  const fulfillmentCounts = statusCounts.slice(0, fulfillmentEnum.length);
  const paymentCounts = statusCounts.slice(fulfillmentEnum.length);

  return {
    total,
    byFulfillment: Object.fromEntries(
      fulfillmentEnum.map((s, i) => [s, fulfillmentCounts[i] ?? 0]),
    ),
    byPayment: Object.fromEntries(
      paymentEnum.map((s, i) => [s, paymentCounts[i] ?? 0]),
    ),
  };
}

export async function getSalesOrderListFacets(opts?: {
  force?: boolean;
}): Promise<SalesOrderListFacets> {
  const companyId = await requireActiveCompanyId();

  if (
    !opts?.force &&
    cachedListFacets &&
    cachedListFacets.companyId === companyId &&
    Date.now() - cachedListFacets.at < LIST_FACETS_CACHE_MS
  ) {
    return cachedListFacets.data;
  }

  const [fulfillmentEnum, paymentEnum, rpcRes] = await Promise.all([
    fetchSalesOrderFulfillmentStatusEnumValues(),
    fetchSalesOrderPaymentStatusEnumValues(),
    supabase.rpc("get_sales_order_list_facets", {
      p_company_id: companyId,
    }),
  ]);

  let total = 0;
  let byFulfillment: Record<string, number> = {};
  let byPayment: Record<string, number> = {};

  if (
    !rpcRes.error &&
    rpcRes.data &&
    typeof rpcRes.data === "object" &&
    !Array.isArray(rpcRes.data)
  ) {
    const d = rpcRes.data as Record<string, unknown>;
    total = Number(d.total ?? 0);
    byFulfillment = facetCountMap(
      fulfillmentEnum,
      d.byFulfillment as Record<string, unknown> | undefined,
    );
    byPayment = facetCountMap(
      paymentEnum,
      d.byPayment as Record<string, unknown> | undefined,
    );
  } else {
    const legacy = await fetchSalesOrderListFacetsLegacy(
      companyId,
      fulfillmentEnum,
      paymentEnum,
    );
    total = legacy.total;
    byFulfillment = legacy.byFulfillment;
    byPayment = legacy.byPayment;
  }

  let missingCity = Number(
    (rpcRes.data as Record<string, unknown> | null)?.missingCity ?? NaN,
  );
  let missingAddress = Number(
    (rpcRes.data as Record<string, unknown> | null)?.missingAddress ?? NaN,
  );
  let missingBoth = Number(
    (rpcRes.data as Record<string, unknown> | null)?.missingBoth ?? NaN,
  );
  const needMissingCity = !Number.isFinite(missingCity);
  const needMissingAddress = !Number.isFinite(missingAddress);
  const needMissingBoth = !Number.isFinite(missingBoth);
  if (needMissingCity || needMissingAddress || needMissingBoth) {
    const [cityCnt, addressCnt, bothCnt] = await Promise.all([
      needMissingCity
        ? countSalesOrdersMissingCity(companyId)
        : Promise.resolve(missingCity),
      needMissingAddress
        ? countSalesOrdersMissingAddress(companyId)
        : Promise.resolve(missingAddress),
      needMissingBoth
        ? countSalesOrdersMissingBoth(companyId)
        : Promise.resolve(missingBoth),
    ]);
    if (needMissingCity) missingCity = cityCnt;
    if (needMissingAddress) missingAddress = addressCnt;
    if (needMissingBoth) missingBoth = bothCnt;
  }

  const data: SalesOrderListFacets = {
    total,
    fulfillmentEnum,
    paymentEnum,
    byFulfillment,
    byPayment,
    missingCity,
    missingAddress,
    missingBoth,
  };

  cachedListFacets = { companyId, at: Date.now(), data };
  return data;
}

async function countSalesOrdersMissingCity(companyId: string): Promise<number> {
  const { data, error } = await supabase.rpc(
    "count_sales_orders_missing_city",
    { p_company_id: companyId },
  );
  if (!error && data != null) {
    return Number(data) || 0;
  }
  let q = supabase
    .from("sales_orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  q = applySalesOrderMissingCityFilter(q);
  const { count, error: headErr } = await q;
  if (headErr) throw headErr;
  return count ?? 0;
}

async function countSalesOrdersMissingAddress(companyId: string): Promise<number> {
  const { data, error } = await supabase.rpc(
    "count_sales_orders_missing_address",
    { p_company_id: companyId },
  );
  if (!error && data != null) {
    return Number(data) || 0;
  }
  const ids = await fetchSalesOrderIdsMissingAddress(companyId).catch(() => []);
  return ids.length;
}

async function countSalesOrdersMissingBoth(companyId: string): Promise<number> {
  const { data, error } = await supabase.rpc(
    "count_sales_orders_missing_both",
    { p_company_id: companyId },
  );
  if (!error && data != null) {
    return Number(data) || 0;
  }
  const addressIds = await fetchSalesOrderIdsMissingAddress(companyId).catch(
    () => [] as string[],
  );
  if (addressIds.length === 0) return 0;
  let q = supabase
    .from("sales_orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("id", addressIds);
  q = applySalesOrderMissingCityFilter(q);
  const { count, error: headErr } = await q;
  if (headErr) throw headErr;
  return count ?? 0;
}

/** @deprecated Use {@link getSalesOrderListFacets}. */
export async function getSalesOrderKpiCounts(): Promise<{
  total: number;
  byFulfillment: Record<SalesOrderFulfillmentStatus, number>;
}> {
  const facets = await getSalesOrderListFacets();
  return {
    total: facets.total,
    byFulfillment: facets.byFulfillment as Record<
      SalesOrderFulfillmentStatus,
      number
    >,
  };
}

export async function listSalesOrders(opts?: {
  search?: string;
  status?: SalesOrderStatus | "all";
  /** When set (not `"all"`), filter by `sales_orders.fulfillment_status`. */
  fulfillmentStatus?: SalesOrderFulfillmentStatus | "all";
  /** When set (not `"all"`), filter by `sales_orders.payment_status` (Postgres enum). */
  paymentStatus?: SalesOrderPaymentStatusDb | "all";
  /** When `"missing"`, only orders with no city on the order. */
  missingCity?: SalesOrderMissingCityFilter;
  /** When `"missing"`, only orders with no address on bill-to or linked customer. */
  missingAddress?: SalesOrderMissingAddressFilter;
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

  const missingAddressIds = await resolveMissingAddressIdsForFilter(
    companyId,
    opts,
  );

  let q = supabase
    .from("sales_orders")
    .select(SALES_ORDER_LIST_SELECT, { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  q = applySalesOrderListFilters(q, opts, missingAddressIds);
  const searchOr = await buildSalesOrderListSearchOrClause(
    companyId,
    opts?.search,
  );
  if (searchOr) q = q.or(searchOr);

  const { data, error, count } = await q;
  if (error) throw error;

  const rawRows = (data ?? []) as Array<Record<string, unknown>>;
  const cityById = await deliveryCityNameMapForCompany(companyId);
  const rows = await finishSalesOrderListRows(rawRows, cityById);

  const total = count ?? 0;
  const cacheKey = salesOrderListCacheKey(companyId, opts);
  listCache.set(cacheKey, {
    key: cacheKey,
    expires: Date.now() + LIST_CACHE_MS,
    rows,
    total,
  });

  return { rows, total };
}

/**
 * All sales order rows matching the same filters as `listSalesOrders`, without pagination.
 * Used for CSV / PDF export. Pages through Supabase in batches of 1000.
 */
export async function listAllSalesOrdersForExport(opts?: {
  search?: string;
  fulfillmentStatus?: SalesOrderFulfillmentStatus | "all";
  paymentStatus?: SalesOrderPaymentStatusDb | "all";
  missingCity?: SalesOrderMissingCityFilter;
  missingAddress?: SalesOrderMissingAddressFilter;
  customerId?: string;
  status?: SalesOrderStatus | "all";
  /**
   * When true, skips `expireStaleSalesOrders()` (caller should run it once before export).
   */
  skipExpireStale?: boolean;
}): Promise<SalesOrderListRow[]> {
  if (!opts?.skipExpireStale) {
    await expireStaleSalesOrders();
  }
  const companyId = await requireActiveCompanyId();
  const cityById = await deliveryCityNameMapForCompany(companyId);

  const BATCH = 1000;
  let from = 0;
  const out: SalesOrderListRow[] = [];

  const missingAddressIds = await resolveMissingAddressIdsForFilter(
    companyId,
    opts,
  );

  for (;;) {
    let q = supabase
      .from("sales_orders")
      .select(SALES_ORDER_LIST_SELECT)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + BATCH - 1);

    q = applySalesOrderListFilters(q, opts, missingAddressIds);
    const searchOr = await buildSalesOrderListSearchOrClause(
      companyId,
      opts?.search,
    );
    if (searchOr) q = q.or(searchOr);

    const { data, error } = await q;
    if (error) throw error;
    const rawRows = (data ?? []) as Array<Record<string, unknown>>;
    const batch = await finishSalesOrderListRows(rawRows, cityById);
    out.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return out;
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

  const detail: SalesOrderDetail = {
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

  detailCache.set(salesOrderDetailCacheKey(companyId, id, mode), {
    companyId,
    expires: Date.now() + DETAIL_CACHE_MS,
    detail,
  });

  return detail;
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
  invalidateSalesOrderCaches();
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
  invalidateSalesOrderCaches();
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
  invalidateSalesOrderCaches();
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

  invalidateSalesOrderCaches();
}
