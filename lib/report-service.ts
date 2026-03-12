import { supabase } from "@/lib/supabaseClient";

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}
import type { InvoiceListRow } from "@/lib/invoices-service";
import type { ExpenseRow } from "@/lib/expenses-service";

function nameFromBillTo(bill?: { type?: string; company_name?: string; full_name?: string }) {
  if (!bill) return "";
  return bill.type === "company" ? bill.company_name ?? "" : bill.full_name ?? "";
}

function computeItemsTotal(items: { quantity: number; unit_price: number; tax_percent: number }[]) {
  return items.reduce((sum, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    const tax = line * (Number(it.tax_percent) / 100);
    return sum + line + tax;
  }, 0);
}

export type ReportData = {
  invoices: InvoiceListRow[];
  expenses: ExpenseRow[];
  totalPaid: number;
  totalExpense: number;
  profitableIncome: number;
  currency: string;
  startDate: string;
  endDate: string;
};

/**
 * Fetches report data for the given date range.
 * Only includes PAID invoices (no overdue/unpaid).
 */
export async function getReportData(
  startDate: string,
  endDate: string
): Promise<ReportData> {
  const userId = await getUserId();
  const [invResult, expResult] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        `
        id, number, issue_date, due_date, status, currency, bill_to_snapshot,
        invoice_items ( quantity, unit_price, tax_percent )
      `
      )
      .eq("status", "paid")
      .gte("issue_date", startDate)
      .lte("issue_date", endDate)
      .order("number", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, description, amount, currency, expense_date, notes")
      .eq("user_id", userId)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false }),
  ]);

  if (invResult.error) throw invResult.error;
  if (expResult.error) throw expResult.error;

  const invData = invResult.data ?? [];
  const expData = expResult.data ?? [];

  const invoices: InvoiceListRow[] = invData.map((r: any) => ({
    id: r.id,
    number: r.number,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    status: "paid" as const,
    currency: r.currency,
    clientName: nameFromBillTo(r.bill_to_snapshot),
    total: computeItemsTotal(r.invoice_items ?? []),
  }));

  const expenses: ExpenseRow[] = expData.map((r: any) => ({
    id: r.id,
    user_id: "",
    description: r.description ?? "",
    amount: Number(r.amount ?? 0),
    currency: r.currency ?? "MUR",
    expense_date: r.expense_date,
    notes: r.notes ?? undefined,
    line_items: [],
    created_at: "",
    updated_at: "",
  }));

  const totalPaid = invoices.reduce((acc, r) => acc + Number(r.total || 0), 0);
  const totalExpense = expenses.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const currency = invoices[0]?.currency || expenses[0]?.currency || "MUR";

  return {
    invoices,
    expenses,
    totalPaid,
    totalExpense,
    profitableIncome: totalPaid - totalExpense,
    currency,
    startDate,
    endDate,
  };
}
