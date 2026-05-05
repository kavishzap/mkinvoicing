import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import { getCurrentUserId } from "@/lib/settings-service";
import { listTeamMembers, type TeamMemberRow } from "@/lib/company-team-service";
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

export function getNextDeliveryNoteStatus(
  current: DeliveryNoteStatus
): DeliveryNoteStatus | null {
  return nextDeliveryNoteStatus(current);
}

export type DeliveryLineItem = {
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
  clientName: string;
  phone: string;
  email: string;
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
  items: DeliveryLineItem[];
};

export type DeliveryDetail = {
  id: string;
  status: DeliveryNoteStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  driverUserId: string;
  driverDisplay: string;
  createdByUserId: string;
  createdByDisplay: string;
  salesOrders: DeliveryDetailSalesOrder[];
};

function clientNameFromBill(bill: Record<string, unknown>) {
  const t = bill.type as string | undefined;
  return t === "company"
    ? String(bill.company_name ?? "")
    : String(bill.full_name ?? "");
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
  return all.filter(
    (m) =>
      m.isActive &&
      m.profile?.is_active !== false &&
      m.roleName.toLowerCase().includes("driver")
  );
}

/** Sales orders with fulfillment **New** and status **active**, including line items for the picker. */
export async function listSalesOrdersForDelivery(): Promise<SalesOrderPickRow[]> {
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      `
      id, number, issue_date, valid_until, currency, total, payment_status, bill_to_snapshot,
      sales_order_items ( item, description, quantity, unit_price, tax_percent, sort_order )
    `
    )
    .eq("company_id", companyId)
    .eq("fulfillment_status", "new")
    .eq("status", "active")
    .order("issue_date", { ascending: false })
    .limit(300);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const bill = (row.bill_to_snapshot ?? {}) as Record<string, unknown>;
    const { clientName, phone, email, addressLines } = billSnapshotToContact(bill);
    const rawItems = (row.sales_order_items ?? []) as Record<string, unknown>[];
    const items: DeliveryLineItem[] = [...rawItems]
      .sort(
        (a, b) =>
          Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
      )
      .map((it) => ({
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
      clientName,
      phone,
      email,
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
          sales_order_items (
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
      items,
    };
  });

  return {
    id: d.id as string,
    status: normalizeDeliveryNoteStatus(d.status as string | null | undefined),
    notes: (d.notes as string | null) ?? null,
    createdAt: String(d.created_at ?? ""),
    updatedAt: String(d.updated_at ?? ""),
    driverUserId: driverId,
    driverDisplay: names.get(driverId) ?? driverId.slice(0, 8),
    createdByUserId: createdId,
    createdByDisplay: names.get(createdId) ?? createdId.slice(0, 8),
    salesOrders,
  };
}

/**
 * Advance delivery note status one step (new → delivered_to_driver → completed)
 * and align linked sales orders’ fulfillment when possible.
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
  const now = new Date().toISOString();

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
    if (next === "delivered_to_driver") {
      // Every order on this delivery moves to "Delivered to driver" except terminal
      // fulfilment (cancelled, already delivered to customer).
      const { error: soErr } = await supabase
        .from("sales_orders")
        .update({
          fulfillment_status: "delivered to driver",
          updated_at: now,
        })
        .in("id", salesOrderIds)
        .eq("company_id", companyId)
        .neq("fulfillment_status", "cancelled")
        .neq("fulfillment_status", "delivered to customer");

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
    } else if (next === "completed") {
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
  }

  return getDelivery(deliveryId);
}

export type CreateDeliveryPayload = {
  driverUserId: string;
  salesOrderIds: string[];
  notes?: string | null;
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

  // New delivery notes always start at status `new` (see delivery_note_status enum).
  const { data: deliveryRow, error: dErr } = await supabase
    .from("deliveries")
    .insert({
      company_id: companyId,
      driver_user_id: payload.driverUserId,
      created_by: createdBy,
      notes: payload.notes?.trim() || null,
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
    .eq("fulfillment_status", "new")
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
    if (reverted.length > 0) {
      await supabase
        .from("sales_orders")
        .update({
          fulfillment_status: "new",
          updated_at: new Date().toISOString(),
        })
        .in("id", reverted)
        .eq("company_id", companyId);
    }
    await supabase.from("delivery_sales_orders").delete().eq("delivery_id", deliveryId);
    await supabase.from("deliveries").delete().eq("id", deliveryId);
    throw new Error(
      "Some sales orders are no longer eligible. They must be active with fulfillment **New**."
    );
  }

  return deliveryId;
}
