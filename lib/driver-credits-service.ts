import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import { setDriverSettlementStatus } from "@/lib/deliveries-service";

export type DriverBalanceSettlementStatus = "due" | "settled";

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type DriverCreditBalance = {
  user_id: string;
  driver_user_id: string;
  company_id: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
};

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

export type DriverCreditWithDriver = DriverCreditBalance & {
  driver?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  membership_id?: string | null;
  settlementStatus: DriverBalanceSettlementStatus;
  amountDue: number | null;
};

export async function listDriverCredits(): Promise<DriverCreditWithDriver[]> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("driver_credit_balances")
    .select(
      "user_id, driver_user_id, company_id, balance, created_at, updated_at",
    )
    .eq("company_id", companyId)
    .order("balance", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as DriverCreditBalance[];
  if (rows.length === 0) return [];

  const driverIds = [...new Set(rows.map((r) => r.driver_user_id))];

  const [profilesResult, membershipsResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, full_name, email, phone")
      .in("id", driverIds),
    supabase
      .from("company_users")
      .select("id, user_id")
      .eq("company_id", companyId)
      .in("user_id", driverIds),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const profileById = new Map(
    (profilesResult.data ?? []).map((p) => [
      String(p.id),
      {
        full_name: (p.full_name as string | null) ?? null,
        email: (p.email as string | null) ?? null,
        phone: (p.phone as string | null) ?? null,
      },
    ]),
  );

  const membershipByUserId = new Map(
    (membershipsResult.data ?? []).map((m) => [
      String(m.user_id),
      String(m.id),
    ]),
  );

  return rows.map((row) => {
    const balance = Number(row.balance || 0);
    const hasDue = balance > 0;
    return {
      ...row,
      balance,
      driver: profileById.get(row.driver_user_id) ?? null,
      membership_id: membershipByUserId.get(row.driver_user_id) ?? null,
      settlementStatus: hasDue ? "due" : "settled",
      amountDue: hasDue ? balance : null,
    };
  });
}

export type DriverCreditSettlement = {
  id: string;
  user_id: string;
  company_id: string | null;
  driver_user_id: string;
  delivery_id: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
};

export async function listDriverSettlements(
  driverUserId: string,
): Promise<DriverCreditSettlement[]> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("driver_credit_settlements")
    .select(
      "id, user_id, company_id, driver_user_id, delivery_id, amount, notes, created_at",
    )
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    company_id: row.company_id ?? null,
    driver_user_id: String(row.driver_user_id),
    delivery_id: row.delivery_id ?? null,
    amount: Number(row.amount || 0),
    notes: row.notes ?? null,
    created_at: String(row.created_at),
  }));
}

export async function createDriverSettlement(options: {
  driverUserId: string;
  deliveryId?: string | null;
  amount: number;
  notes?: string | null;
}): Promise<void> {
  const [userId, companyId] = await Promise.all([
    getUserId(),
    requireActiveCompanyId(),
  ]);
  const { driverUserId, deliveryId, amount, notes } = options;

  if (amount <= 0) {
    throw new Error("Settlement amount must be greater than zero.");
  }

  const { error: insertError } = await supabase
    .from("driver_credit_settlements")
    .insert({
      user_id: userId,
      company_id: companyId,
      driver_user_id: driverUserId,
      delivery_id: deliveryId ?? null,
      amount,
      notes: notes ?? null,
    });

  if (insertError) throw insertError;

  const { data: existing, error: fetchError } = await supabase
    .from("driver_credit_balances")
    .select("*")
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing) return;

  const currentBalance = Number(existing.balance || 0);
  const newBalance = Math.max(0, currentBalance - amount);

  const { error: updateError } = await supabase
    .from("driver_credit_balances")
    .update({ balance: newBalance })
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId);

  if (updateError) throw updateError;

  await allocateDriverBalancePayment(driverUserId, amount);
  if (newBalance <= 0) {
    await syncDeliveriesWhenDriverBalanceCleared(driverUserId);
  }
}

/** Applies a driver-balance payment against open delivery dues (oldest first). */
async function allocateDriverBalancePayment(
  driverUserId: string,
  paymentAmount: number,
): Promise<void> {
  const companyId = await requireActiveCompanyId();
  let remaining = roundMoney2(paymentAmount);
  if (remaining <= 0) return;

  const { data: driverDeliveries, error: dErr } = await supabase
    .from("deliveries")
    .select("id")
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId);

  if (dErr) throw dErr;

  const deliveryIds = (driverDeliveries ?? [])
    .map((d) => String((d as { id?: string }).id ?? ""))
    .filter(Boolean);
  if (deliveryIds.length === 0) return;

  const { data: settlements, error: sErr } = await supabase
    .from("delivery_driver_settlements")
    .select(
      "id, delivery_id, due_amount, cash_amount, bank_transfer_amount, created_at",
    )
    .eq("company_id", companyId)
    .in("delivery_id", deliveryIds)
    .gt("due_amount", 0)
    .order("created_at", { ascending: true });

  if (sErr) throw sErr;

  for (const row of settlements ?? []) {
    if (remaining <= 0) break;
    const applied = await applyDriverBalancePaymentToSettlement(row, remaining);
    remaining = roundMoney2(remaining - applied);
  }
}

async function applyDriverBalancePaymentToSettlement(
  row: Record<string, unknown>,
  remaining: number,
): Promise<number> {
  const companyId = await requireActiveCompanyId();
  const settlementId = String(row.id ?? "").trim();
  const deliveryId = String(row.delivery_id ?? "").trim();
  if (!settlementId || !deliveryId || remaining <= 0) return 0;

  const currentDue = roundMoney2(Number(row.due_amount ?? 0));
  if (currentDue <= 0) return 0;

  const applied = roundMoney2(Math.min(remaining, currentDue));
  const newDue = roundMoney2(currentDue - applied);
  const newCash = roundMoney2(Number(row.cash_amount ?? 0) + applied);

  const { error: updErr } = await supabase
    .from("delivery_driver_settlements")
    .update({
      due_amount: newDue,
      cash_amount: newCash,
    })
    .eq("id", settlementId)
    .eq("company_id", companyId);

  if (updErr) throw updErr;

  if (newDue <= 0) {
    await setDriverSettlementStatus(deliveryId, "settled");
  }

  return applied;
}

/** Clears delivery dues when the driver's aggregate balance is fully paid. */
async function syncDeliveriesWhenDriverBalanceCleared(
  driverUserId: string,
): Promise<void> {
  const companyId = await requireActiveCompanyId();

  const { data: balRow, error: balErr } = await supabase
    .from("driver_credit_balances")
    .select("balance")
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId)
    .maybeSingle();

  if (balErr) throw balErr;

  const balance = roundMoney2(Number(balRow?.balance ?? 0));
  if (balance > 0) return;

  const { data: driverDeliveries, error: dErr } = await supabase
    .from("deliveries")
    .select("id")
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId);

  if (dErr) throw dErr;

  const deliveryIds = (driverDeliveries ?? [])
    .map((d) => String((d as { id?: string }).id ?? ""))
    .filter(Boolean);
  if (deliveryIds.length === 0) return;

  const { data: settlements, error: sErr } = await supabase
    .from("delivery_driver_settlements")
    .select("id, delivery_id, due_amount, cash_amount")
    .eq("company_id", companyId)
    .in("delivery_id", deliveryIds)
    .gt("due_amount", 0);

  if (sErr) throw sErr;

  for (const row of settlements ?? []) {
    const rec = row as Record<string, unknown>;
    const settlementId = String(rec.id ?? "").trim();
    const deliveryId = String(rec.delivery_id ?? "").trim();
    if (!settlementId || !deliveryId) continue;

    const currentDue = roundMoney2(Number(rec.due_amount ?? 0));
    if (currentDue <= 0) continue;

    const newCash = roundMoney2(Number(rec.cash_amount ?? 0) + currentDue);

    const { error: updErr } = await supabase
      .from("delivery_driver_settlements")
      .update({
        due_amount: 0,
        cash_amount: newCash,
      })
      .eq("id", settlementId)
      .eq("company_id", companyId);

    if (updErr) throw updErr;
    await setDriverSettlementStatus(deliveryId, "settled");
  }
}

/** Records outstanding amount owed by the driver after a delivery settlement. */
export async function recordDriverBalanceDueFromDelivery(options: {
  driverUserId: string;
  deliveryId: string;
  amount: number;
  notes?: string | null;
}): Promise<{ settlementId: string }> {
  const [userId, companyId] = await Promise.all([
    getUserId(),
    requireActiveCompanyId(),
  ]);
  const { driverUserId, deliveryId, amount, notes } = options;

  if (amount <= 0) {
    throw new Error("Due amount must be greater than zero.");
  }

  const { data: inserted, error: insertError } = await supabase
    .from("driver_credit_settlements")
    .insert({
      user_id: userId,
      company_id: companyId,
      driver_user_id: driverUserId,
      delivery_id: deliveryId,
      amount,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  const settlementId = String((inserted as { id?: string })?.id ?? "").trim();
  if (!settlementId) {
    throw new Error("Driver balance due insert returned no id.");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("driver_credit_balances")
    .select("*")
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!existing) {
    const { error } = await supabase.from("driver_credit_balances").insert({
      user_id: userId,
      company_id: companyId,
      driver_user_id: driverUserId,
      balance: amount,
    });
    if (error) throw error;
    return { settlementId };
  }

  const newBalance = Number(existing.balance || 0) + amount;
  const { error: updateError } = await supabase
    .from("driver_credit_balances")
    .update({ balance: newBalance })
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId);

  if (updateError) throw updateError;
  return { settlementId };
}

/** Roll back {@link recordDriverBalanceDueFromDelivery} if a later step fails. */
export async function revertDriverBalanceDueRecord(
  settlementId: string,
): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("driver_credit_settlements")
    .select("driver_user_id, amount")
    .eq("company_id", companyId)
    .eq("id", settlementId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return;

  const driverUserId = String(data.driver_user_id);
  const amount = Number(data.amount || 0);

  const { error: deleteError } = await supabase
    .from("driver_credit_settlements")
    .delete()
    .eq("company_id", companyId)
    .eq("id", settlementId);

  if (deleteError) throw deleteError;

  const { data: existing, error: fetchError } = await supabase
    .from("driver_credit_balances")
    .select("balance")
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing) return;

  const newBalance = Math.max(0, Number(existing.balance || 0) - amount);
  const { error: updateError } = await supabase
    .from("driver_credit_balances")
    .update({ balance: newBalance })
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId);

  if (updateError) throw updateError;
}
