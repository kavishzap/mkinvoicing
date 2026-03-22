import { supabase } from "@/lib/supabaseClient";

export type AdvanceStatus = "active" | "fully_deducted";

export type EmployeeAdvanceRow = {
  id: string;
  user_id: string;
  employee_id: string;
  amount: number;
  amount_deducted: number;
  deduction_per_period: number;
  status: AdvanceStatus;
  notes: string | null;
  created_at: string;
};

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

function mapRow(r: Record<string, unknown>): EmployeeAdvanceRow {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    employee_id: r.employee_id as string,
    amount: Number(r.amount ?? 0),
    amount_deducted: Number(r.amount_deducted ?? 0),
    deduction_per_period: Number(r.deduction_per_period ?? 0),
    status: (r.status as AdvanceStatus) ?? "active",
    notes: (r.notes as string) ?? null,
    created_at: r.created_at as string,
  };
}

export async function listAdvancesByEmployee(employeeId: string): Promise<EmployeeAdvanceRow[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("employee_advances")
    .select("*")
    .eq("user_id", userId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getActiveAdvancesForEmployee(employeeId: string): Promise<EmployeeAdvanceRow[]> {
  const rows = await listAdvancesByEmployee(employeeId);
  return rows.filter((r) => r.status === "active" && r.amount_deducted < r.amount);
}

export async function addAdvance(params: {
  employee_id: string;
  amount: number;
  deduction_per_period: number;
  notes?: string;
}): Promise<EmployeeAdvanceRow> {
  const userId = await getUserId();
  const insert = {
    user_id: userId,
    employee_id: params.employee_id,
    amount: Number(params.amount),
    amount_deducted: 0,
    deduction_per_period: Number(params.deduction_per_period),
    status: "active",
    notes: params.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from("employee_advances")
    .insert(insert)
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function updateAdvanceDeducted(
  id: string,
  amountDeducted: number
): Promise<void> {
  await getUserId();
  const { data: existing } = await supabase
    .from("employee_advances")
    .select("amount, amount_deducted")
    .eq("id", id)
    .single();

  if (!existing) throw new Error("Advance not found");
  const total = Number(existing.amount_deducted ?? 0) + amountDeducted;
  const newDeducted = Math.min(total, Number(existing.amount ?? 0));
  const status = newDeducted >= Number(existing.amount ?? 0) ? "fully_deducted" : "active";

  const { error } = await supabase
    .from("employee_advances")
    .update({ amount_deducted: newDeducted, status })
    .eq("id", id);

  if (error) throw error;
}
