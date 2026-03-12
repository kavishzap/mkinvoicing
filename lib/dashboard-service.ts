import { listInvoices } from "@/lib/invoices-service";
import { listExpenses } from "@/lib/expenses-service";

export type DashboardStats = {
  totalPaid: number;
  totalOverdue: number;
  totalExpense: number;
  profitableIncome: number; // totalPaid - totalExpense
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

export async function getDashboardStats(): Promise<DashboardStats> {
  const [invResult, expResult] = await Promise.all([
    listInvoices({ status: "all", pageSize: 5000 }),
    listExpenses({ pageSize: 5000 }),
  ]);

  const totalPaid = invResult.rows
    .filter((r) => r.status === "paid")
    .reduce((acc, r) => acc + Number(r.total || 0), 0);

  const totalOverdue = invResult.rows
    .filter((r) => r.status !== "paid" && r.status !== "cancelled")
    .reduce((acc, r) => acc + Number(r.total || 0), 0);

  const totalExpense = expResult.rows.reduce(
    (acc, r) => acc + Number(r.amount || 0),
    0
  );

  const currency = invResult.rows[0]?.currency || expResult.rows[0]?.currency || "MUR";

  return {
    totalPaid,
    totalOverdue,
    totalExpense,
    profitableIncome: totalPaid - totalExpense,
    currency,
  };
}

/** Returns income by month for the current year, Jan–Dec */
export async function getIncomeOverTime(
  year?: number
): Promise<IncomeByMonth[]> {
  const { rows } = await listInvoices({
    status: "all",
    pageSize: 5000,
  });

  const paidInvoices = rows.filter((r) => r.status === "paid");
  const byMonth = new Map<string, number>();

  const y = year ?? new Date().getFullYear();
  for (let m = 1; m <= 12; m++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    byMonth.set(key, 0);
  }

  paidInvoices.forEach((inv) => {
    const date = inv.issueDate || inv.dueDate;
    if (!date) return;
    const m = new Date(date);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    if (byMonth.has(key)) {
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(inv.total || 0));
    }
  });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, income]) => {
      const [y, m] = month.split("-");
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = d.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      return { month, label, income };
    });
}

/** Returns expense by month for the current year, Jan–Dec */
export async function getExpenseOverTime(
  year?: number
): Promise<ExpenseByMonth[]> {
  const { rows } = await listExpenses({ pageSize: 5000 });

  const byMonth = new Map<string, number>();
  const y = year ?? new Date().getFullYear();
  for (let m = 1; m <= 12; m++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    byMonth.set(key, 0);
  }

  rows.forEach((exp) => {
    const date = exp.expense_date;
    if (!date) return;
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (byMonth.has(key)) {
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(exp.amount || 0));
    }
  });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, expense]) => {
      const [yr, m] = month.split("-");
      const d = new Date(parseInt(yr), parseInt(m) - 1, 1);
      const label = d.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      return { month, label, expense };
    });
}
