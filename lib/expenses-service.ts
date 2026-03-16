import { supabase } from "@/lib/supabaseClient";

export type ExpenseLineItem = {
  item: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  line_total: number;
};

export type ExpensePayload = {
  description?: string; // derived from first line item if empty
  amount: number; // sum of line totals
  currency?: string;
  expense_date?: string;
  line_items: ExpenseLineItem[];
  invoice_id?: string | null;
  notes?: string | null;
};

export type ExpenseRow = Omit<ExpensePayload, "line_items"> & {
  line_items: ExpenseLineItem[];
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

const COLUMNS =
  "id,user_id,description,amount,currency,expense_date,line_items,invoice_id,notes,created_at,updated_at";

/** Fetch a single expense by id (scoped to current user) */
export async function getExpense(id: string): Promise<ExpenseRow> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("expenses")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Expense not found or not accessible");
  return mapRow(data as any);
}

/**
 * Paged list with optional search (searches description and line item names).
 * Returns { rows, total }.
 */
export async function listExpenses(opts?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: ExpenseRow[]; total: number }> {
  const userId = await getUserId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("expenses")
    .select(COLUMNS, { count: "exact" })
    .eq("user_id", userId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  const term = opts?.search?.trim();
  if (term) {
    q = q.ilike("description", `%${term}%`);
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map(mapRow),
    total: count ?? 0,
  };
}

/** Create expense */
export async function addExpense(payload: ExpensePayload): Promise<ExpenseRow> {
  const userId = await getUserId();
  const lineItems = payload.line_items ?? [];
  const amount =
    lineItems.length > 0
      ? lineItems.reduce(
          (s, li) => s + Number(li.line_total || 0),
          0
        )
      : Number(payload.amount) || 0;
  const description =
    payload.description?.trim() ||
    (lineItems[0]?.item?.trim() || "Expense");

  const insert = {
    user_id: userId,
    description,
    amount,
    currency: payload.currency ?? "MUR",
    expense_date: payload.expense_date || new Date().toISOString().slice(0, 10),
    line_items: lineItems,
    invoice_id: payload.invoice_id ?? null,
    notes: payload.notes ?? null,
  };

  const { data, error } = await supabase
    .from("expenses")
    .insert(insert)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data);
}

/** Update expense by id */
export async function updateExpense(
  id: string,
  payload: Partial<ExpensePayload>
): Promise<ExpenseRow> {
  await getUserId();

  const update: Record<string, unknown> = {};
  if (payload.line_items !== undefined) {
    update.line_items = payload.line_items;
    const amount = payload.line_items.reduce(
      (s, li) => s + Number(li.line_total || 0),
      0
    );
    update.amount = amount;
    update.description =
      payload.description?.trim() ||
      (payload.line_items[0]?.item?.trim() || "Expense");
  }
  if (payload.description !== undefined && !payload.line_items)
    update.description = payload.description;
  if (payload.amount !== undefined && !payload.line_items)
    update.amount = Number(payload.amount);
  if (payload.currency !== undefined) update.currency = payload.currency;
  if (payload.expense_date !== undefined)
    update.expense_date = payload.expense_date;
  if (payload.invoice_id !== undefined) update.invoice_id = payload.invoice_id;
  if (payload.notes !== undefined) update.notes = payload.notes;

  const { data, error } = await supabase
    .from("expenses")
    .update(update)
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Expense not found or not accessible");
  return mapRow(data);
}

/** Delete by id */
export async function deleteExpense(id: string): Promise<void> {
  await getUserId();

  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) throw error;
}

function mapRow(r: Record<string, unknown>): ExpenseRow {
  const rawItems = r.line_items;
  const lineItems: ExpenseLineItem[] = Array.isArray(rawItems)
    ? rawItems.map((li: unknown) => {
        const anyLi = li as any;
        const legacyPrice = Number(anyLi?.price ?? 0);
        const quantity = Number(anyLi?.quantity ?? 1) || 1;
        const unitPrice =
          anyLi?.unit_price !== undefined
            ? Number(anyLi.unit_price)
            : legacyPrice || 0;
        const taxPercent = Number(anyLi?.tax_percent ?? 0);
        const computedLineTotal =
          quantity * unitPrice * (1 + taxPercent / 100);
        const lineTotal =
          anyLi?.line_total !== undefined
            ? Number(anyLi.line_total)
            : computedLineTotal;

        return {
          item: String(anyLi?.item ?? ""),
          description:
            anyLi?.description !== undefined
              ? String(anyLi.description)
              : undefined,
          quantity,
          unit_price: unitPrice,
          tax_percent: taxPercent,
          line_total: lineTotal,
        };
      })
    : [];

  return {
    id: r.id as string,
    user_id: r.user_id as string,
    description: (r.description as string) ?? "",
    amount: Number(r.amount) ?? 0,
    currency: (r.currency as string) ?? "MUR",
    expense_date: (r.expense_date as string) ?? undefined,
    line_items: lineItems,
    invoice_id: (r.invoice_id as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}
