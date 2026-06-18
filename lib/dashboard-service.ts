import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type SalesInvoicesByYear = {
  year: number;
  count: number;
};

export type DashboardStats = {
  netSales: number;
  totalPaid: number;
  totalExpense: number;
  totalPurchases: number;
  profitableIncome: number;
  customerCount: number;
  productCount: number;
  salesInvoiceCount: number;
  /** Non-cancelled invoice counts grouped by issue year. */
  salesInvoicesByYear: SalesInvoicesByYear[];
  driverSettlementCount: number;
  driverSettlementsCashTotal: number;
  driverSettlementsBankTotal: number;
  /** Sum still owed on delivery notes (due_amount on settlement rows). */
  driverSettlementsDueOpenTotal: number;
  /** Manual payments recorded on Driver Balance (clears due). */
  driverSettlementsDuePaidTotal: number;
  /** Delivery notes with outstanding driver settlement due. */
  driverSettlementsOpenDueCount: number;
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
const FETCH_BATCH = 1000;

const cache = new Map<string, { data: DashboardData; expires: number }>();
/** Skip RPC after a missing-function response until this timestamp. */
let rpcUnavailableUntil = 0;

function isRpcMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("could not find the function") || msg.includes("get_dashboard_stats");
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function invoiceTotal(inv: RawInvoice): number {
  return num(inv.total);
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

function invoiceIssueYear(inv: RawInvoice): number | null {
  const d = inv.issue_date?.trim() || inv.due_date?.trim();
  if (!d || d.length < 4) return null;
  const y = parseInt(d.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

function buildIncomeByMonth(
  year: number,
  incomeRows: Array<{ month?: unknown; income?: unknown }>,
): IncomeByMonth[] {
  const incomeMap = emptyMonthMap(year);
  for (const row of incomeRows) {
    const month = String(row.month ?? "");
    if (!incomeMap.has(month)) continue;
    incomeMap.set(month, num(row.income));
  }
  const out: IncomeByMonth[] = [];
  for (let i = 1; i <= 12; i++) {
    const month = `${year}-${String(i).padStart(2, "0")}`;
    out.push({
      month,
      label: labelMonth(month),
      income: incomeMap.get(month) ?? 0,
    });
  }
  return out;
}

function parseRpcDashboardData(
  raw: Record<string, unknown>,
  year: number,
): DashboardData {
  const totalPaid = num(raw.totalPaid);
  const totalPurchases = num(raw.totalPurchases);
  const totalExpense = num(raw.totalExpense);

  const salesInvoicesByYear = Array.isArray(raw.salesInvoicesByYear)
    ? (raw.salesInvoicesByYear as Array<{ year?: unknown; count?: unknown }>)
        .map((row) => ({
          year: num(row.year),
          count: num(row.count),
        }))
        .filter((row) => row.year > 0)
        .sort((a, b) => b.year - a.year)
    : [];

  const incomeByMonth = buildIncomeByMonth(
    year,
    Array.isArray(raw.incomeByMonth)
      ? (raw.incomeByMonth as Array<{ month?: unknown; income?: unknown }>)
      : [],
  );

  return {
    stats: {
      netSales: num(raw.netSales),
      totalPaid,
      totalExpense,
      totalPurchases,
      profitableIncome: totalPaid - totalPurchases - totalExpense,
      customerCount: num(raw.customerCount),
      productCount: num(raw.productCount),
      salesInvoiceCount: num(raw.salesInvoiceCount),
      salesInvoicesByYear,
      driverSettlementCount: num(raw.driverSettlementCount),
      driverSettlementsCashTotal: num(raw.driverSettlementsCashTotal),
      driverSettlementsBankTotal: num(raw.driverSettlementsBankTotal),
      driverSettlementsDueOpenTotal: num(raw.driverSettlementsDueOpenTotal),
      driverSettlementsDuePaidTotal: num(raw.driverSettlementsDuePaidTotal),
      driverSettlementsOpenDueCount: num(raw.driverSettlementsOpenDueCount),
      currency: String(raw.currency ?? "MUR") || "MUR",
    },
    incomeByMonth,
  };
}

async function fetchDashboardDataViaRpc(
  companyId: string,
  year: number,
): Promise<DashboardData | null> {
  if (Date.now() < rpcUnavailableUntil) return null;

  const { data, error } = await supabase.rpc("get_dashboard_stats", {
    p_company_id: companyId,
    p_year: year,
  });

  if (error) {
    if (isRpcMissingError(error)) {
      rpcUnavailableUntil = Date.now() + 24 * 60 * 60 * 1000;
    }
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  rpcUnavailableUntil = 0;
  return parseRpcDashboardData(data as Record<string, unknown>, year);
}

type PageResult<T> = {
  data: T[] | null;
  count: number | null;
  error: { message: string; code?: string } | null;
};

async function fetchAllRowsParallel<T>(
  fetchPage: (
    from: number,
    to: number,
    withCount: boolean,
  ) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const first = await fetchPage(0, FETCH_BATCH - 1, true);
  if (first.error) throw first.error;

  const out = [...(first.data ?? [])];
  const total = first.count ?? out.length;
  if (total <= out.length) return out;

  const pageCount = Math.ceil(total / FETCH_BATCH);
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => {
      const from = (index + 1) * FETCH_BATCH;
      return fetchPage(from, from + FETCH_BATCH - 1, false);
    }),
  );

  for (const page of rest) {
    if (page.error) throw page.error;
    out.push(...(page.data ?? []));
  }

  return out;
}

async function fetchDashboardDataLegacy(
  companyId: string,
  year: number,
): Promise<DashboardData> {
  const [invoices, expenses, custRes, prodRes, purchases, drvSettlements, drvCreditSetRes] =
    await Promise.all([
      fetchAllRowsParallel<RawInvoice>((from, to, withCount) =>
        supabase
          .from("invoices")
          .select("status, issue_date, due_date, currency, total", withCount ? { count: "exact" } : undefined)
          .eq("company_id", companyId)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAllRowsParallel<RawExpense>((from, to, withCount) =>
        supabase
          .from("expenses")
          .select("amount, currency, expense_date", withCount ? { count: "exact" } : undefined)
          .eq("company_id", companyId)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId),
      fetchAllRowsParallel<RawPurchaseInvoice>((from, to, withCount) =>
        supabase
          .from("purchase_invoices")
          .select("status, total, currency", withCount ? { count: "exact" } : undefined)
          .eq("company_id", companyId)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAllRowsParallel<{
        cash_amount?: number | string | null;
        bank_transfer_amount?: number | string | null;
        due_amount?: number | string | null;
      }>((from, to, withCount) =>
        supabase
          .from("delivery_driver_settlements")
          .select("cash_amount, bank_transfer_amount, due_amount", withCount ? { count: "exact" } : undefined)
          .eq("company_id", companyId)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      supabase
        .from("driver_credit_settlements")
        .select("amount, delivery_id")
        .eq("company_id", companyId),
    ]);

  if (custRes.error) throw custRes.error;
  if (prodRes.error) throw prodRes.error;

  const driverCreditSettlements =
    drvCreditSetRes.error &&
    (drvCreditSetRes.error.code === "42P01" ||
      drvCreditSetRes.error.message.includes("does not exist"))
      ? []
      : drvCreditSetRes.error
        ? (() => {
            throw drvCreditSetRes.error;
          })()
        : (drvCreditSetRes.data ?? []);

  let netSales = 0;
  let totalPaid = 0;
  let salesInvoiceCount = 0;
  const salesInvoicesByYearMap = new Map<number, number>();
  let firstCurrency: string | undefined;
  const incomeMap = emptyMonthMap(year);

  for (const inv of invoices) {
    const total = invoiceTotal(inv);
    if (!firstCurrency && inv.currency) firstCurrency = inv.currency;
    if (inv.status !== "cancelled") {
      netSales += total;
      salesInvoiceCount += 1;
      const issueYear = invoiceIssueYear(inv);
      if (issueYear != null) {
        salesInvoicesByYearMap.set(
          issueYear,
          (salesInvoicesByYearMap.get(issueYear) ?? 0) + 1,
        );
      }
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
    const amount = num(e.amount);
    if (!Number.isFinite(amount)) continue;
    totalExpense += amount;
    if (!firstCurrency && e.currency) firstCurrency = e.currency;
  }

  let totalPurchases = 0;
  for (const p of purchases) {
    if (p.status !== "cancelled") {
      totalPurchases += num(p.total);
    }
    if (!firstCurrency && p.currency) firstCurrency = p.currency;
  }

  const currency = firstCurrency || "MUR";
  const profitableIncome = totalPaid - totalPurchases - totalExpense;

  let driverSettlementCount = 0;
  let driverSettlementsCashTotal = 0;
  let driverSettlementsBankTotal = 0;
  let driverSettlementsDueOpenTotal = 0;
  let driverSettlementsOpenDueCount = 0;
  for (const row of drvSettlements) {
    driverSettlementCount += 1;
    driverSettlementsCashTotal += num(row.cash_amount);
    driverSettlementsBankTotal += num(row.bank_transfer_amount);
    const due = num(row.due_amount);
    if (due > 0) {
      driverSettlementsDueOpenTotal += due;
      driverSettlementsOpenDueCount += 1;
    }
  }

  let driverSettlementsDuePaidTotal = 0;
  for (const row of driverCreditSettlements) {
    const rec = row as {
      amount?: number | string | null;
      delivery_id?: string | null;
    };
    if (rec.delivery_id != null && String(rec.delivery_id).trim()) continue;
    const amount = num(rec.amount);
    if (amount > 0) driverSettlementsDuePaidTotal += amount;
  }

  const salesInvoicesByYear: SalesInvoicesByYear[] = Array.from(
    salesInvoicesByYearMap.entries(),
  )
    .map(([yr, count]) => ({ year: yr, count }))
    .sort((a, b) => b.year - a.year);

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
      productCount: prodRes.count ?? 0,
      salesInvoiceCount,
      salesInvoicesByYear,
      driverSettlementCount,
      driverSettlementsCashTotal,
      driverSettlementsBankTotal,
      driverSettlementsDueOpenTotal,
      driverSettlementsDuePaidTotal,
      driverSettlementsOpenDueCount,
      currency,
    },
    incomeByMonth,
  };
}

async function fetchDashboardData(
  companyId: string,
  year: number,
): Promise<DashboardData> {
  const rpcData = await fetchDashboardDataViaRpc(companyId, year);
  if (rpcData) return rpcData;
  return fetchDashboardDataLegacy(companyId, year);
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

/** Call after deploying `get_dashboard_stats` so the next load retries the RPC. */
export function resetDashboardRpcAvailability(): void {
  rpcUnavailableUntil = 0;
}

/** Returns cached dashboard data when still fresh (for instant paint). */
export function peekDashboardCache(year?: number): DashboardData | null {
  // Sync peek only works when company id is already known from a prior fetch in this tab.
  const companyId =
    typeof window !== "undefined"
      ? window.sessionStorage.getItem("mkinv:active_company_id")
      : null;
  if (!companyId) return null;
  const y = year ?? new Date().getFullYear();
  const hit = cache.get(`${companyId}:${y}`);
  if (!hit || hit.expires <= Date.now()) return null;
  return hit.data;
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
