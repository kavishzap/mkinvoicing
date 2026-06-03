import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import {
  normalizeDeliveryNoteStatus,
  type DeliveryNoteStatus,
} from "@/lib/deliveries-service";

export type DriverSettlementReportFilters = {
  startDate: string;
  endDate: string;
  /** Filter by assigned driver (`auth.users.id`). */
  driverUserId?: string | null;
  /** Full UUID or partial match against delivery note id. */
  deliveryIdQuery?: string | null;
  /** Filter by delivery note workflow status. */
  deliveryStatus?: DeliveryNoteStatus | "all";
};

export type DriverSettlementLinkedOrder = {
  id: string;
  number: string;
  total: number;
};

export type DriverSettlementReportRow = {
  settlementId: string;
  deliveryId: string;
  deliveryStatus: DeliveryNoteStatus;
  deliveryDriverSettled: boolean;
  deliveryDate: string | null;
  deliveryCreatedAt: string;
  deliveryNotes: string | null;
  deliveryCreatedByUserId: string;
  deliveryCreatedByDisplay: string;
  driverUserId: string;
  driverDisplay: string;
  driverMembershipId: string | null;
  recordedByUserId: string;
  recordedByDisplay: string;
  settlementCreatedAt: string;
  currency: string;
  linkedOrdersTotal: number | null;
  settlementCashTotal: number | null;
  driverDailyRate: number | null;
  amountToOwner: number;
  cashAmount: number;
  bankTransferAmount: number;
  bankReference: string | null;
  expenseId: string | null;
  linkedOrders: DriverSettlementLinkedOrder[];
  orderCount: number;
};

export type DriverSettlementReportSummary = {
  settlementCount: number;
  totalAmountToOwner: number;
  totalCash: number;
  totalBank: number;
  totalLinkedOrders: number;
  totalSettlementCashTotal: number;
  totalDriverDailyRate: number;
};

export type DriverSettlementReportData = {
  companyName: string;
  currency: string;
  startDate: string;
  endDate: string;
  generatedOn: string;
  rows: DriverSettlementReportRow[];
  summary: DriverSettlementReportSummary;
};

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function settlementEndIso(endDate: string): string {
  return `${endDate}T23:59:59.999Z`;
}

function settlementStartIso(startDate: string): string {
  return `${startDate}T00:00:00.000Z`;
}

async function profileDisplayMap(
  userIds: string[],
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

function parseLinkedOrders(
  deliveryRec: Record<string, unknown> | null | undefined,
): DriverSettlementLinkedOrder[] {
  if (!deliveryRec) return [];
  const lines = (deliveryRec.delivery_sales_orders ?? []) as Record<string, unknown>[];
  const out: DriverSettlementLinkedOrder[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const nested = line.sales_orders;
    const so = (Array.isArray(nested) ? nested[0] : nested) as
      | Record<string, unknown>
      | undefined;
    const id = String(so?.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      number: String(so?.number ?? id.slice(0, 8)).trim() || id.slice(0, 8),
      total: roundMoney2(Number(so?.total ?? 0)),
    });
  }

  return out.sort((a, b) => a.number.localeCompare(b.number));
}

export async function getDriverSettlementReportData(
  filters: DriverSettlementReportFilters,
): Promise<DriverSettlementReportData> {
  const companyId = await requireActiveCompanyId();
  const deliveryIdQuery = String(filters.deliveryIdQuery ?? "").trim().toLowerCase();

  let q = supabase
    .from("delivery_driver_settlements")
    .select(
      `
      id,
      delivery_id,
      driver_user_id,
      recorded_by,
      amount_to_owner,
      currency,
      settlement_cash_total,
      driver_daily_rate,
      linked_orders_total,
      cash_amount,
      bank_transfer_amount,
      bank_reference,
      expense_id,
      created_at,
      deliveries (
        id,
        status,
        driver_status,
        delivery_date,
        created_at,
        notes,
        created_by,
        delivery_sales_orders (
          sales_orders ( id, number, total )
        )
      )
    `,
    )
    .eq("company_id", companyId)
    .gte("created_at", settlementStartIso(filters.startDate))
    .lte("created_at", settlementEndIso(filters.endDate))
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.driverUserId) {
    q = q.eq("driver_user_id", filters.driverUserId);
  }

  if (deliveryIdQuery && isUuid(deliveryIdQuery)) {
    q = q.eq("delivery_id", deliveryIdQuery);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rawRows = (data ?? []) as Record<string, unknown>[];

  const userIds = rawRows.flatMap((r) => {
    const delivery = (Array.isArray(r.deliveries) ? r.deliveries[0] : r.deliveries) as
      | Record<string, unknown>
      | undefined;
    return [
      String(r.driver_user_id ?? ""),
      String(r.recorded_by ?? ""),
      String(delivery?.created_by ?? ""),
    ];
  });

  const driverUserIds = [
    ...new Set(rawRows.map((r) => String(r.driver_user_id ?? "")).filter(Boolean)),
  ];

  const [names, memberships] = await Promise.all([
    profileDisplayMap(userIds),
    membershipIdsByUserId(companyId, driverUserIds),
  ]);

  const rows: DriverSettlementReportRow[] = [];

  for (const r of rawRows) {
    const deliveryRaw = r.deliveries;
    const delivery = (Array.isArray(deliveryRaw) ? deliveryRaw[0] : deliveryRaw) as
      | Record<string, unknown>
      | undefined;

    const deliveryId = String(r.delivery_id ?? delivery?.id ?? "").trim();
    if (!deliveryId) continue;

    if (deliveryIdQuery && !isUuid(deliveryIdQuery)) {
      if (!deliveryId.toLowerCase().includes(deliveryIdQuery)) continue;
    }

    const deliveryStatus = normalizeDeliveryNoteStatus(
      delivery?.status as string | null | undefined,
    );

    if (filters.deliveryStatus && filters.deliveryStatus !== "all") {
      if (deliveryStatus !== filters.deliveryStatus) continue;
    }

    const driverUserId = String(r.driver_user_id ?? "").trim();
    const recordedByUserId = String(r.recorded_by ?? "").trim();
    const deliveryCreatedByUserId = String(delivery?.created_by ?? "").trim();
    const linkedOrders = parseLinkedOrders(delivery);

    rows.push({
      settlementId: String(r.id ?? ""),
      deliveryId,
      deliveryStatus,
      deliveryDriverSettled: Boolean(delivery?.driver_status),
      deliveryDate:
        delivery?.delivery_date != null && String(delivery.delivery_date).trim()
          ? String(delivery.delivery_date).slice(0, 10)
          : null,
      deliveryCreatedAt: String(delivery?.created_at ?? ""),
      deliveryNotes:
        delivery?.notes != null && String(delivery.notes).trim()
          ? String(delivery.notes).trim()
          : null,
      deliveryCreatedByUserId,
      deliveryCreatedByDisplay:
        names.get(deliveryCreatedByUserId) || deliveryCreatedByUserId.slice(0, 8) || "—",
      driverUserId,
      driverDisplay: names.get(driverUserId) || driverUserId.slice(0, 8) || "—",
      driverMembershipId: memberships.get(driverUserId) ?? null,
      recordedByUserId,
      recordedByDisplay: names.get(recordedByUserId) || recordedByUserId.slice(0, 8) || "—",
      settlementCreatedAt: String(r.created_at ?? ""),
      currency: String(r.currency ?? "MUR").trim() || "MUR",
      linkedOrdersTotal:
        r.linked_orders_total != null && String(r.linked_orders_total).trim() !== ""
          ? roundMoney2(Number(r.linked_orders_total))
          : null,
      settlementCashTotal:
        r.settlement_cash_total != null && String(r.settlement_cash_total).trim() !== ""
          ? roundMoney2(Number(r.settlement_cash_total))
          : null,
      driverDailyRate:
        r.driver_daily_rate != null && String(r.driver_daily_rate).trim() !== ""
          ? roundMoney2(Number(r.driver_daily_rate))
          : null,
      amountToOwner: roundMoney2(Number(r.amount_to_owner ?? 0)),
      cashAmount: roundMoney2(Number(r.cash_amount ?? 0)),
      bankTransferAmount: roundMoney2(Number(r.bank_transfer_amount ?? 0)),
      bankReference:
        r.bank_reference != null && String(r.bank_reference).trim()
          ? String(r.bank_reference).trim()
          : null,
      expenseId:
        r.expense_id != null && String(r.expense_id).trim()
          ? String(r.expense_id).trim()
          : null,
      linkedOrders,
      orderCount: linkedOrders.length,
    });
  }

  const summary: DriverSettlementReportSummary = {
    settlementCount: rows.length,
    totalAmountToOwner: roundMoney2(rows.reduce((s, row) => s + row.amountToOwner, 0)),
    totalCash: roundMoney2(rows.reduce((s, row) => s + row.cashAmount, 0)),
    totalBank: roundMoney2(rows.reduce((s, row) => s + row.bankTransferAmount, 0)),
    totalLinkedOrders: roundMoney2(
      rows.reduce((s, row) => s + (row.linkedOrdersTotal ?? 0), 0),
    ),
    totalSettlementCashTotal: roundMoney2(
      rows.reduce((s, row) => s + (row.settlementCashTotal ?? 0), 0),
    ),
    totalDriverDailyRate: roundMoney2(
      rows.reduce((s, row) => s + (row.driverDailyRate ?? 0), 0),
    ),
  };

  const currency = rows[0]?.currency ?? "MUR";

  return {
    companyName: "",
    currency,
    startDate: filters.startDate,
    endDate: filters.endDate,
    generatedOn: new Date().toISOString().slice(0, 10),
    rows,
    summary,
  };
}
