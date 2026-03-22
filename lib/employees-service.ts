import { supabase } from "@/lib/supabaseClient";

export type PaymentType = "monthly" | "daily" | "hourly";
export type EmployeeStatus = "active" | "inactive";

export type EmployeePayload = {
  full_name: string;
  phone?: string;
  email?: string;
  position?: string;
  basic_salary: number;
  payment_type: PaymentType;
  join_date: string;
  status: EmployeeStatus;
  transport_allowance?: number;
  other_allowance?: number;
  currency?: string;
};

export type EmployeeRow = EmployeePayload & {
  id: string;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id,full_name,phone,email,position,basic_salary,payment_type,join_date,status,transport_allowance,other_allowance,currency,created_at,updated_at";

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

function mapRow(r: Record<string, unknown>): EmployeeRow {
  return {
    id: r.id as string,
    full_name: (r.full_name as string) ?? "",
    phone: (r.phone as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    position: (r.position as string) ?? undefined,
    basic_salary: Number(r.basic_salary ?? 0),
    payment_type: (r.payment_type as PaymentType) ?? "monthly",
    join_date: (r.join_date as string) ?? "",
    status: (r.status as EmployeeStatus) ?? "active",
    transport_allowance: Number(r.transport_allowance ?? 0),
    other_allowance: Number(r.other_allowance ?? 0),
    currency: (r.currency as string) ?? "MUR",
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

export async function listEmployees(opts?: {
  search?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: EmployeeRow[]; total: number }> {
  const userId = await getUserId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 50);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("employees")
    .select(COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .order("full_name", { ascending: true })
    .range(from, to);

  if (!opts?.includeInactive) {
    q = q.eq("status", "active");
  }

  const term = opts?.search?.trim();
  if (term) {
    const s = `%${term}%`;
    q = q.or(`full_name.ilike.${s},email.ilike.${s},position.ilike.${s}`);
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function getEmployee(id: string): Promise<EmployeeRow | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("employees")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function addEmployee(payload: EmployeePayload): Promise<EmployeeRow> {
  const userId = await getUserId();
  const insert = {
    user_id: userId,
    full_name: payload.full_name.trim(),
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    position: payload.position?.trim() || null,
    basic_salary: Number(payload.basic_salary) || 0,
    payment_type: payload.payment_type ?? "monthly",
    join_date: payload.join_date || new Date().toISOString().slice(0, 10),
    status: payload.status ?? "active",
    transport_allowance: Number(payload.transport_allowance) || 0,
    other_allowance: Number(payload.other_allowance) || 0,
    currency: payload.currency ?? "MUR",
  };

  const { data, error } = await supabase
    .from("employees")
    .insert(insert)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function updateEmployee(
  id: string,
  payload: Partial<EmployeePayload>
): Promise<EmployeeRow> {
  await getUserId();
  const update: Record<string, unknown> = {};
  if (payload.full_name !== undefined) update.full_name = payload.full_name.trim();
  if (payload.phone !== undefined) update.phone = payload.phone?.trim() || null;
  if (payload.email !== undefined) update.email = payload.email?.trim() || null;
  if (payload.position !== undefined) update.position = payload.position?.trim() || null;
  if (payload.basic_salary !== undefined) update.basic_salary = Number(payload.basic_salary);
  if (payload.payment_type !== undefined) update.payment_type = payload.payment_type;
  if (payload.join_date !== undefined) update.join_date = payload.join_date;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.transport_allowance !== undefined)
    update.transport_allowance = Number(payload.transport_allowance);
  if (payload.other_allowance !== undefined)
    update.other_allowance = Number(payload.other_allowance);
  if (payload.currency !== undefined) update.currency = payload.currency;

  const { data, error } = await supabase
    .from("employees")
    .update(update)
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteEmployee(id: string): Promise<void> {
  await getUserId();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw error;
}
