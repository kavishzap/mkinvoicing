import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type DashboardStats = {
  netSales: number;
  totalPaid: number; // Money In (Paid)
  totalExpense: number;
  /** Sum of purchase invoice totals (non-cancelled), same basis as reports */
  totalPurchases: number;
  /** Gross profit (paid sales − purchases) minus operating expenses */
  profitableIncome: number;
  customerCount: number;
  /** Non-cancelled sales invoices (same scope as net sales). */
  salesInvoiceCount: number;
  /** Driver balance settlements recorded for this company (delivery_driver_settlements). */
  driverSettlementCount: number;
  driverSettlementsCashTotal: number;
  driverSettlementsBankTotal: number;
  currency: string;
};

export type IncomeByMonth = {
  month: string; // "2024-01"
  label: string; // "Jan 2024"
  income: number;
};

export type ExpenseByMonth = {
  month: string;
  label: string;
  expense: number;
};

export type DashboardData = {
  stats: DashboardStats;
  incomeByMonth: IncomeByMonth[];
  expenseByMonth: ExpenseByMonth[];
};

type RawInvoiceItem = {
  quantity: number | string | null;
  unit_price: number | string | null;
  tax_percent: number | string | null;
};

type RawInvoice = {
  status: string;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  invoice_items: RawInvoiceItem[] | null;
};

type RawExpense = {
  amount: number | string | null;
  currency: string | null;
  expense_date: string | null;
};

type RawPurchaseInvoice = {
  status: string;
  total: number | string | null;
  currency: string | null;
};

type RawDriverSettlement = {
  cash_amount: number | string | null;
  bank_transfer_amount: number | string | null;
};

/** Same formula as the invoices list (subtotal + tax, no discount). */
function computeItemsTotal(items: RawInvoiceItem[] | null | undefined): number {
  if (!items || items.length === 0) return 0;
  let sum = 0;
  for (const it of items) {
    const qty = Number(it.quantity ?? 0);
    const price = Number(it.unit_price ?? 0);
    const tax = Number(it.tax_percent ?? 0);
    const line = qty * price;
    sum += line + (line * tax) / 100;
  }
  return sum;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function emptyMonthMap(year: number): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 1; i <= 12; i++) {
    m.set(`${year}-${String(i).padStart(2, "0")}`, 0);
  }
  return m;
}

function labelMonth(month: string): string {
  const [yStr, mStr] = month.split("-");
  const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/**
 * Fetches everything the dashboard needs in a single round-trip (4 parallel
 * Supabase requests, no `count: 'exact'`, slim column lists). Both the KPI
 * stats and the monthly income/expense charts are derived from the same data,
 * so invoices/expenses aren't fetched twice.
 */
export async function getDashboardData(year?: number): Promise<DashboardData> {
  const companyId = await requireActiveCompanyId();
  const y = year ?? new Date().getFullYear();
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;

  const [invRes, expRes, custRes, piRes, drvSetRes] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "status, issue_date, due_date, currency, invoice_items ( quantity, unit_price, tax_percent )",
      )
      .or(`company_id.eq.${companyId},company_id.is.null`),
    supabase
      .from("expenses")
      .select("amount, currency, expense_date")
      .eq("company_id", companyId),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("purchase_invoices")
      .select("status, total, currency")
      .eq("company_id", companyId),
    supabase
      .from("delivery_driver_settlements")
      .select("cash_amount, bank_transfer_amount")
      .eq("company_id", companyId),
  ]);

  if (invRes.error) throw invRes.error;
  if (expRes.error) throw expRes.error;
  if (custRes.error) throw custRes.error;
  if (piRes.error) throw piRes.error;

  const invoices = (invRes.data ?? []) as unknown as RawInvoice[];
  const expenses = (expRes.data ?? []) as unknown as RawExpense[];
  const purchases = (piRes.data ?? []) as unknown as RawPurchaseInvoice[];

  let netSales = 0;
  let totalPaid = 0;
  let salesInvoiceCount = 0;
  let firstCurrency: string | undefined;
  const incomeMap = emptyMonthMap(y);

  for (const inv of invoices) {
    const total = computeItemsTotal(inv.invoice_items);
    if (!firstCurrency && inv.currency) firstCurrency = inv.currency;
    if (inv.status !== "cancelled") {
      netSales += total;
      salesInvoiceCount += 1;
    }
    if (inv.status === "paid") {
      totalPaid += total;
      const d = inv.issue_date || inv.due_date;
      if (d) {
        const dt = new Date(d);
        if (!Number.isNaN(dt.getTime()) && dt.getFullYear() === y) {
          const key = monthKey(dt);
          if (incomeMap.has(key)) {
            incomeMap.set(key, (incomeMap.get(key) ?? 0) + total);
          }
        }
      }
    }
  }

  let totalExpense = 0;
  const expenseMap = emptyMonthMap(y);
  for (const e of expenses) {
    const amount = Number(e.amount ?? 0);
    totalExpense += amount;
    if (!firstCurrency && e.currency) firstCurrency = e.currency;
    if (e.expense_date) {
      const dt = new Date(e.expense_date);
      if (!Number.isNaN(dt.getTime()) && dt.getFullYear() === y) {
        const key = monthKey(dt);
        if (expenseMap.has(key)) {
          expenseMap.set(key, (expenseMap.get(key) ?? 0) + amount);
        }
      }
    }
  }

  let totalPurchases = 0;
  for (const p of purchases) {
    if (p.status !== "cancelled") {
      totalPurchases += Number(p.total ?? 0);
    }
    if (!firstCurrency && p.currency) firstCurrency = p.currency;
  }

  const currency = firstCurrency || "MUR";
  const grossProfit = totalPaid - totalPurchases;
  const profitableIncome = grossProfit - totalExpense;

  let driverSettlementCount = 0;
  let driverSettlementsCashTotal = 0;
  let driverSettlementsBankTotal = 0;
  if (!drvSetRes.error && drvSetRes.data) {
    const rows = drvSetRes.data as unknown as RawDriverSettlement[];
    for (const row of rows) {
      driverSettlementCount += 1;
      driverSettlementsCashTotal += Number(row.cash_amount ?? 0);
      driverSettlementsBankTotal += Number(row.bank_transfer_amount ?? 0);
    }
  }

  const toSorted = (m: Map<string, number>) =>
    [...m.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Suppress unused-var warning while keeping computed bounds for future filters.
  void yearStart;
  void yearEnd;

  return {
    stats: {
      netSales,
      totalPaid,
      totalExpense,
      totalPurchases,
      profitableIncome,
      customerCount: custRes.count ?? 0,
      salesInvoiceCount,
      driverSettlementCount,
      driverSettlementsCashTotal,
      driverSettlementsBankTotal,
      currency,
    },
    incomeByMonth: toSorted(incomeMap).map(([month, income]) => ({
      month,
      label: labelMonth(month),
      income,
    })),
    expenseByMonth: toSorted(expenseMap).map(([month, expense]) => ({
      month,
      label: labelMonth(month),
      expense,
    })),
  };
}

/* ----------------------- Back-compat wrappers ----------------------- */
/*
 * Existing callers that only need one of the two outputs keep working, but
 * prefer `getDashboardData` to avoid refetching: the dashboard page already
 * uses the combined call.
 */

export async function getDashboardStats(): Promise<DashboardStats> {
  const { stats } = await getDashboardData();
  return stats;
}

export async function getIncomeOverTime(
  year?: number,
): Promise<IncomeByMonth[]> {
  const { incomeByMonth } = await getDashboardData(year);
  return incomeByMonth;
}

export async function getExpenseOverTime(
  year?: number,
): Promise<ExpenseByMonth[]> {
  const { expenseByMonth } = await getDashboardData(year);
  return expenseByMonth;
}
