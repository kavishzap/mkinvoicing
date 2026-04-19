import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type ExpenseReportFilters = {
  startDate: string;
  endDate: string;
};

export type ExpenseReportRow = {
  id: string;
  refNo: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
};

export type ExpenseByCategory = {
  category: string;
  amount: number;
};

export type ExpenseTimelineEntry = {
  date: string;
  amount: number;
};

export type ExpenseReportData = {
  companyName: string;
  currency: string;
  startDate: string;
  endDate: string;
  generatedOn: string;
  expenses: ExpenseReportRow[];
  totalExpenses: number;
  expenseCount: number;
  averageDailyExpense: number;
  byCategory: ExpenseByCategory[];
  timeline: ExpenseTimelineEntry[];
};

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function getExpenseReportData(
  filters: ExpenseReportFilters
): Promise<ExpenseReportData> {
  const companyId = await requireActiveCompanyId();

  const { data: rows, error } = await supabase
    .from("expenses")
    .select("id, description, amount, currency, expense_date")
    .eq("company_id", companyId)
    .gte("expense_date", filters.startDate)
    .lte("expense_date", filters.endDate)
    .order("expense_date", { ascending: true });

  if (error) throw error;

  const expenses: ExpenseReportRow[] = [];
  const categoryMap = new Map<string, number>();
  const timelineMap = new Map<string, number>();

  let totalExpenses = 0;

  for (const r of rows ?? []) {
    const amount = Number(r.amount ?? 0);
    const date = r.expense_date ?? "";
    const description = String(r.description ?? "").trim() || "Miscellaneous";
    const category = description;

    const shortId = r.id ? String(r.id).slice(0, 8).toUpperCase() : "";
    const refNo = `EXP-${shortId}`;

    expenses.push({
      id: r.id,
      refNo,
      date,
      category,
      description,
      amount,
      currency: r.currency ?? "MUR",
    });

    totalExpenses += amount;

    categoryMap.set(category, (categoryMap.get(category) ?? 0) + amount);
    timelineMap.set(date, (timelineMap.get(date) ?? 0) + amount);
  }

  const byCategory: ExpenseByCategory[] = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const timeline: ExpenseTimelineEntry[] = Array.from(timelineMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const start = new Date(filters.startDate);
  const end = new Date(filters.endDate);
  const daysInPeriod = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const averageDailyExpense = totalExpenses / daysInPeriod;

  const currency = (rows?.[0] as { currency?: string })?.currency ?? "MUR";

  return {
    companyName: "",
    currency,
    startDate: filters.startDate,
    endDate: filters.endDate,
    generatedOn: new Date().toISOString().slice(0, 10),
    expenses,
    totalExpenses,
    expenseCount: expenses.length,
    averageDailyExpense,
    byCategory,
    timeline,
  };
}
