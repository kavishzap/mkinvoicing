import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type DashboardStats = {
  netSales: number;
  totalPaid: number;
  totalExpense: number;
  totalPurchases: number;
  profitableIncome: number;
  customerCount: number;
  salesInvoiceCount: number;
  driverSettlementCount: number;
  driverSettlementsCashTotal: number;
  driverSettlementsBankTotal: number;
  currency: string;
};

export type IncomeByMonth = {
  month: string;
  label: string;
  income: number;
};

export type DashboardData = {
  stats: DashboardStats;
  incomeByMonth: IncomeByMonth[];
};

type RawInvoice = {
  status: string;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  total: number | string | null;
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

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const CACHE_MS = 45_000;

const cache = new Map<string, { data: DashboardData; expires: number }>();

function invoiceTotal(inv: RawInvoice): number {
  const n = Number(inv.total ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function emptyMonthMap(year: number): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 1; i <= 12; i++) {
    m.set(`${year}-${String(i).padStart(2, "0")}`, 0);
  }
  return m;
}

function labelMonth(month: string): string {
  const [, mStr] = month.split("-");
  const mi = parseInt(mStr, 10) - 1;
  const y = month.slice(0, 4);
  return `${MONTH_SHORT[mi] ?? mStr} ${y}`;
}

async function fetchDashboardData(
  companyId: string,
  year: number,
): Promise<DashboardData> {
  const [invRes, expRes, custRes, piRes, drvSetRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("status, issue_date, due_date, currency, total")
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
  if (drvSetRes.error) throw drvSetRes.error;

  const invoices = (invRes.data ?? []) as RawInvoice[];
  const expenses = (expRes.data ?? []) as RawExpense[];
  const purchases = (piRes.data ?? []) as RawPurchaseInvoice[];

  let netSales = 0;
  let totalPaid = 0;
  let salesInvoiceCount = 0;
  let firstCurrency: string | undefined;
  const incomeMap = emptyMonthMap(year);

  for (const inv of invoices) {
    const total = invoiceTotal(inv);
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
        if (!Number.isNaN(dt.getTime()) && dt.getFullYear() === year) {
          const key = `${year}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
          const prev = incomeMap.get(key);
          if (prev !== undefined) incomeMap.set(key, prev + total);
        }
      }
    }
  }

  let totalExpense = 0;
  for (const e of expenses) {
    const amount = Number(e.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    totalExpense += amount;
    if (!firstCurrency && e.currency) firstCurrency = e.currency;
  }

  let totalPurchases = 0;
  for (const p of purchases) {
    if (p.status !== "cancelled") {
      totalPurchases += Number(p.total ?? 0);
    }
    if (!firstCurrency && p.currency) firstCurrency = p.currency;
  }

  const currency = firstCurrency || "MUR";
  const profitableIncome = totalPaid - totalPurchases - totalExpense;

  let driverSettlementCount = 0;
  let driverSettlementsCashTotal = 0;
  let driverSettlementsBankTotal = 0;
  for (const row of drvSetRes.data ?? []) {
    driverSettlementCount += 1;
    driverSettlementsCashTotal += Number(
      (row as { cash_amount?: number | string | null }).cash_amount ?? 0,
    );
    driverSettlementsBankTotal += Number(
      (row as { bank_transfer_amount?: number | string | null }).bank_transfer_amount ?? 0,
    );
  }

  const incomeByMonth: IncomeByMonth[] = [];
  for (let i = 1; i <= 12; i++) {
    const month = `${year}-${String(i).padStart(2, "0")}`;
    incomeByMonth.push({
      month,
      label: labelMonth(month),
      income: incomeMap.get(month) ?? 0,
    });
  }

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
    incomeByMonth,
  };
}

export function invalidateDashboardCache(companyId?: string): void {
  if (!companyId) {
    cache.clear();
    return;
  }
  const prefix = `${companyId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export async function getDashboardData(year?: number): Promise<DashboardData> {
  const companyId = await requireActiveCompanyId();
  const y = year ?? new Date().getFullYear();
  const key = `${companyId}:${y}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;

  const data = await fetchDashboardData(companyId, y);
  cache.set(key, { data, expires: Date.now() + CACHE_MS });
  return data;
}
