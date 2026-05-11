import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

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

/** Matches list filter sidebar — calendar month/year in local time. */
export type ExpensePeriodFilter = "all" | "month" | "year";

export type ExpenseListFacets = {
  companyTotal: number;
  thisMonthCount: number;
  thisYearCount: number;
  currencyCounts: { currency: string; count: number }[];
};

function localStartOfMonthISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function localStartOfYearISO(): string {
  return `${new Date().getFullYear()}-01-01`;
}

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

const COLUMNS =
  "id,user_id,description,amount,currency,expense_date,line_items,invoice_id,notes,created_at,updated_at";

/** Fetch a single expense by id (scoped to current user) */
export async function getExpense(id: string): Promise<ExpenseRow> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("expenses")
    .select(COLUMNS)
    .eq("company_id", companyId)
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Expense not found or not accessible");
  return mapRow(data as any);
}

/** Facet counts for filters (company-wide; independent of list filters). */
export async function fetchExpenseListFacets(): Promise<ExpenseListFacets> {
  const companyId = await requireActiveCompanyId();

  const head = () =>
    supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);

  const countOf = async (
    builder: ReturnType<typeof head>,
  ): Promise<number> => {
    const { count, error } = await builder;
    if (error) throw error;
    return count ?? 0;
  };

  const { count: companyTotalRaw, error: totalErr } = await head();
  if (totalErr) throw totalErr;
  const companyTotal = companyTotalRaw ?? 0;

  const som = localStartOfMonthISO();
  const soy = localStartOfYearISO();

  const [thisMonthCount, thisYearCount] = await Promise.all([
    countOf(head().gte("expense_date", som)),
    countOf(head().gte("expense_date", soy)),
  ]);

  const { data: curRows, error: curErr } = await supabase
    .from("expenses")
    .select("currency")
    .eq("company_id", companyId);

  if (curErr) throw curErr;

  const map = new Map<string, number>();
  for (const r of curRows ?? []) {
    const row = r as { currency?: string | null };
    const c =
      String(row.currency ?? "").trim() || "MUR";
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  const currencyCounts = [...map.entries()]
    .map(([currency, count]) => ({ currency, count }))
    .sort(
      (a, b) =>
        b.count - a.count || a.currency.localeCompare(b.currency),
    );

  return {
    companyTotal,
    thisMonthCount,
    thisYearCount,
    currencyCounts,
  };
}

/**
 * Paged list with optional search (description and notes), currency, and period.
 * Returns { rows, total }.
 */
export async function listExpenses(opts?: {
  search?: string;
  currency?: string | null;
  period?: ExpensePeriodFilter;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: ExpenseRow[]; total: number }> {
  const companyId = await requireActiveCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("expenses")
    .select(COLUMNS, { count: "exact" })
    .eq("company_id", companyId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  const cur = opts?.currency?.trim();
  if (cur && cur !== "all") {
    q = q.eq("currency", cur);
  }

  const period = opts?.period ?? "all";
  if (period === "month") {
    q = q.gte("expense_date", localStartOfMonthISO());
  } else if (period === "year") {
    q = q.gte("expense_date", localStartOfYearISO());
  }

  const term = opts?.search?.trim();
  if (term) {
    const s = `%${term}%`;
    q = q.or(`description.ilike.${s},notes.ilike.${s}`);
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map(mapRow),
    total: count ?? 0,
  };
}

/**
 * Returns every expense matching the current filters (no pagination).
 * Used by the expenses page Export CSV / Print actions.
 */
export async function listAllExpensesForExport(opts?: {
  search?: string;
  period?: ExpensePeriodFilter;
}): Promise<ExpenseRow[]> {
  const companyId = await requireActiveCompanyId();

  const BATCH = 1000;
  let from = 0;
  const out: ExpenseRow[] = [];

  for (;;) {
    let q = supabase
      .from("expenses")
      .select(COLUMNS)
      .eq("company_id", companyId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + BATCH - 1);

    const period = opts?.period ?? "all";
    if (period === "month") {
      q = q.gte("expense_date", localStartOfMonthISO());
    } else if (period === "year") {
      q = q.gte("expense_date", localStartOfYearISO());
    }

    const term = opts?.search?.trim();
    if (term) {
      const s = `%${term}%`;
      q = q.or(`description.ilike.${s},notes.ilike.${s}`);
    }

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []).map(mapRow);
    out.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return out;
}

/** Create expense */
export async function addExpense(payload: ExpensePayload): Promise<ExpenseRow> {
  const [userId, companyId] = await Promise.all([
    getUserId(),
    requireActiveCompanyId(),
  ]);
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
    company_id: companyId,
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
  const companyId = await requireActiveCompanyId();

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
    .eq("company_id", companyId)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Expense not found or not accessible");
  return mapRow(data);
}

/** Delete by id */
export async function deleteExpense(id: string): Promise<void> {
  const companyId = await requireActiveCompanyId();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

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
