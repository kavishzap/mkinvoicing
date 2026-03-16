import { supabase } from "@/lib/supabaseClient";

export type CustomerCreditBalance = {
  user_id: string;
  customer_id: string;
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

  const userId = await getUserId();

  // Fetch existing balance (if any)
  const { data: existing, error: fetchError } = await supabase
    .from("customer_credit_balances")
    .select("*")
    .eq("user_id", userId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!existing) {
    // Insert new row
    const { data, error } = await supabase
      .from("customer_credit_balances")
      .insert({
        user_id: userId,
        customer_id: customerId,
        balance: delta,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as CustomerCreditBalance;
  }

  // Update existing balance
  const newBalance = Number(existing.balance || 0) + delta;

  const { data, error } = await supabase
    .from("customer_credit_balances")
    .update({ balance: newBalance })
    .eq("user_id", userId)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) throw error;
  return data as CustomerCreditBalance;
}

export async function getCustomerCredit(
  customerId: string
): Promise<CustomerCreditBalance | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("customer_credit_balances")
    .select("*")
    .eq("user_id", userId)
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
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("customer_credit_balances")
    .select(
      `
      user_id,
      customer_id,
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
    .eq("user_id", userId)
    .order("balance", { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    user_id: row.user_id,
    customer_id: row.customer_id,
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
  customer_id: string;
  invoice_id: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
};

export async function listCustomerSettlements(
  customerId: string
): Promise<CustomerCreditSettlement[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("customer_credit_settlements")
    .select("id,user_id,customer_id,invoice_id,amount,notes,created_at")
    .eq("user_id", userId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
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
  const userId = await getUserId();
  const { customerId, invoiceId, amount, notes } = options;

  if (amount <= 0) {
    throw new Error("Settlement amount must be greater than zero.");
  }

  // Insert settlement row
  const { error: insertError } = await supabase
    .from("customer_credit_settlements")
    .insert({
      user_id: userId,
      customer_id: customerId,
      invoice_id: invoiceId ?? null,
      amount,
      notes: notes ?? null,
    });

  if (insertError) throw insertError;

  // Decrease credit balance
  const { data: existing, error: fetchError } = await supabase
    .from("customer_credit_balances")
    .select("*")
    .eq("user_id", userId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!existing) {
    // If no balance row exists, nothing to decrement
    return;
  }

  const currentBalance = Number(existing.balance || 0);
  const newBalance = Math.max(0, currentBalance - amount);

  const { error: updateError } = await supabase
    .from("customer_credit_balances")
    .update({ balance: newBalance })
    .eq("user_id", userId)
    .eq("customer_id", customerId);

  if (updateError) throw updateError;
}

