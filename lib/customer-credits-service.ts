import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type CustomerCreditBalance = {
  user_id: string;
  customer_id: string;
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

export async function addCustomerCredit(
  customerId: string,
  delta: number
): Promise<CustomerCreditBalance> {
  if (delta <= 0) {
    throw new Error("Delta must be positive to add customer credit");
  }

  const [userId, companyId] = await Promise.all([
    getUserId(),
    requireActiveCompanyId(),
  ]);

  const { data: existing, error: fetchError } = await supabase
    .from("customer_credit_balances")
    .select("*")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!existing) {
    const { data, error } = await supabase
      .from("customer_credit_balances")
      .insert({
        user_id: userId,
        company_id: companyId,
        customer_id: customerId,
        balance: delta,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as CustomerCreditBalance;
  }

  const newBalance = Number(existing.balance || 0) + delta;

  const { data, error } = await supabase
    .from("customer_credit_balances")
    .update({ balance: newBalance })
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) throw error;
  return data as CustomerCreditBalance;
}

export async function getCustomerCredit(
  customerId: string
): Promise<CustomerCreditBalance | null> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("customer_credit_balances")
    .select("*")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) throw error;
  return (data as CustomerCreditBalance) ?? null;
}

export type CustomerCreditWithCustomer = CustomerCreditBalance & {
  customer?: {
    company_name: string | null;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

export async function listCustomerCredits(): Promise<
  CustomerCreditWithCustomer[]
> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("customer_credit_balances")
    .select(
      `
      user_id,
      customer_id,
      company_id,
      balance,
      created_at,
      updated_at,
      customers (
        company_name,
        full_name,
        email,
        phone
      )
    `
    )
    .eq("company_id", companyId)
    .order("balance", { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    user_id: row.user_id,
    customer_id: row.customer_id,
    company_id: row.company_id ?? null,
    balance: Number(row.balance || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer: row.customers
      ? {
          company_name: row.customers.company_name ?? null,
          full_name: row.customers.full_name ?? null,
          email: row.customers.email ?? null,
          phone: row.customers.phone ?? null,
        }
      : null,
  }));
}

export type CustomerCreditSettlement = {
  id: string;
  user_id: string;
  company_id: string | null;
  customer_id: string;
  invoice_id: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
};

export async function listCustomerSettlements(
  customerId: string
): Promise<CustomerCreditSettlement[]> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("customer_credit_settlements")
    .select(
      "id,user_id,company_id,customer_id,invoice_id,amount,notes,created_at"
    )
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    company_id: row.company_id ?? null,
    customer_id: row.customer_id,
    invoice_id: row.invoice_id ?? null,
    amount: Number(row.amount || 0),
    notes: row.notes ?? null,
    created_at: row.created_at,
  }));
}

export async function createCustomerSettlement(options: {
  customerId: string;
  invoiceId?: string | null;
  amount: number;
  notes?: string | null;
}): Promise<void> {
  const [userId, companyId] = await Promise.all([
    getUserId(),
    requireActiveCompanyId(),
  ]);
  const { customerId, invoiceId, amount, notes } = options;

  if (amount <= 0) {
    throw new Error("Settlement amount must be greater than zero.");
  }

  const { error: insertError } = await supabase
    .from("customer_credit_settlements")
    .insert({
      user_id: userId,
      company_id: companyId,
      customer_id: customerId,
      invoice_id: invoiceId ?? null,
      amount,
      notes: notes ?? null,
    });

  if (insertError) throw insertError;

  const { data: existing, error: fetchError } = await supabase
    .from("customer_credit_balances")
    .select("*")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!existing) {
    return;
  }

  const currentBalance = Number(existing.balance || 0);
  const newBalance = Math.max(0, currentBalance - amount);

  const { error: updateError } = await supabase
    .from("customer_credit_balances")
    .update({ balance: newBalance })
    .eq("company_id", companyId)
    .eq("customer_id", customerId);

  if (updateError) throw updateError;
}
