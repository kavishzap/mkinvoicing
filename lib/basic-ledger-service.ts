import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

/** Chart of accounts (simplified for SME) */
export const CHART_OF_ACCOUNTS = [
  { code: "1100", name: "Cash", type: "Asset" as const },
  { code: "1200", name: "Accounts Receivable", type: "Asset" as const },
  { code: "2000", name: "Accounts Payable", type: "Liability" as const },
  { code: "4000", name: "Sales Revenue", type: "Revenue" as const },
  { code: "5100", name: "Purchases", type: "Expense" as const },
  { code: "5200", name: "Operating Expenses", type: "Expense" as const },
] as const;

export type JournalEntryLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
};

export type JournalEntry = {
  id: string;
  date: string;
  ref: string;
  source: "invoice" | "purchase_invoice" | "expense";
  description: string;
  lines: JournalEntryLine[];
  /** Sum of debits = sum of credits */
  totalDebit: number;
  totalCredit: number;
};

export type BasicLedgerFilters = {
  startDate: string;
  endDate: string;
};

export type BasicLedgerData = {
  currency: string;
  startDate: string;
  endDate: string;
  entries: JournalEntry[];
  trialBalance: { accountCode: string; accountName: string; debit: number; credit: number; balance: number }[];
};

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

function nameFromBillTo(bill?: { type?: string; company_name?: string; full_name?: string }) {
  if (!bill) return "Walk-in";
  const name = bill.type === "company" ? bill.company_name ?? "" : bill.full_name ?? "";
  return name.trim() || "Walk-in";
}

function nameFromFrom(snap?: Record<string, unknown>) {
  if (!snap) return "Unknown Supplier";
  const t = snap.type as string | undefined;
  return t === "company"
    ? String(snap.company_name ?? "Unknown Supplier")
    : String(snap.full_name ?? "Unknown Supplier");
}

function computeInvoiceTotal(
  items: { quantity: number; unit_price: number; tax_percent: number }[],
  discountType: string,
  discountAmount: number
) {
  const subtotal = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const taxTotal = items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
  const discount =
    discountType === "percent" ? (subtotal * Number(discountAmount || 0)) / 100 : Number(discountAmount || 0);
  return subtotal + taxTotal - discount;
}

export async function getBasicLedgerData(filters: BasicLedgerFilters): Promise<BasicLedgerData> {
  const companyId = await requireActiveCompanyId();

  const [invRes, piRes, expRes] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        `
        id, number, issue_date, status, currency, bill_to_snapshot,
        discount_type, discount_amount, amount_paid, amount_due,
        invoice_items ( quantity, unit_price, tax_percent )
      `
      )
      .eq("company_id", companyId)
      .neq("status", "cancelled")
      .gte("issue_date", filters.startDate)
      .lte("issue_date", filters.endDate)
      .order("issue_date", { ascending: true }),
    supabase
      .from("purchase_invoices")
      .select("id, number, issue_date, status, currency, from_snapshot, amount_paid, amount_due, total")
      .eq("company_id", companyId)
      .neq("status", "cancelled")
      .gte("issue_date", filters.startDate)
      .lte("issue_date", filters.endDate)
      .order("issue_date", { ascending: true }),
    supabase
      .from("expenses")
      .select("id, description, amount, currency, expense_date")
      .eq("company_id", companyId)
      .gte("expense_date", filters.startDate)
      .lte("expense_date", filters.endDate)
      .order("expense_date", { ascending: true }),
  ]);

  if (invRes.error) throw invRes.error;
  if (piRes.error) throw piRes.error;
  if (expRes.error) throw expRes.error;

  const entries: JournalEntry[] = [];
  const accountBalances = new Map<string, { debit: number; credit: number }>();
  for (const a of CHART_OF_ACCOUNTS) {
    accountBalances.set(a.code, { debit: 0, credit: 0 });
  }

  const currency = "MUR";

  // Sales invoices: Dr Cash (paid) + Dr AR (due), Cr Revenue (total)
  for (const r of invRes.data ?? []) {
    const items = (r.invoice_items ?? []) as { quantity: number; unit_price: number; tax_percent: number }[];
    const total = computeInvoiceTotal(items, r.discount_type ?? "value", r.discount_amount ?? 0);
    const amountPaid = Number(r.amount_paid ?? 0);
    const amountDue = Math.max(0, total - amountPaid);
    const clientName = nameFromBillTo(r.bill_to_snapshot);

    const lines: JournalEntryLine[] = [];
    if (amountPaid > 0) {
      lines.push({
        accountCode: "1100",
        accountName: "Cash",
        debit: amountPaid,
        credit: 0,
        description: `Payment received - Inv ${r.number}`,
      });
      const bal = accountBalances.get("1100")!;
      bal.debit += amountPaid;
    }
    if (amountDue > 0) {
      lines.push({
        accountCode: "1200",
        accountName: "Accounts Receivable",
        debit: amountDue,
        credit: 0,
        description: `Sale to ${clientName} - Inv ${r.number}`,
      });
      const bal = accountBalances.get("1200")!;
      bal.debit += amountDue;
    }
    if (total > 0) {
      lines.push({
        accountCode: "4000",
        accountName: "Sales Revenue",
        debit: 0,
        credit: total,
        description: `Sale to ${clientName} - Inv ${r.number}`,
      });
      const bal = accountBalances.get("4000")!;
      bal.credit += total;
    }

    if (lines.length > 0) {
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      entries.push({
        id: r.id,
        date: r.issue_date,
        ref: r.number,
        source: "invoice",
        description: `Invoice ${r.number} - ${clientName}`,
        lines,
        totalDebit,
        totalCredit,
      });
    }
  }

  // Purchase invoices: Dr Purchases (total), Cr Cash (paid), Cr AP (due)
  for (const r of piRes.data ?? []) {
    const total = Number(r.total ?? 0);
    const amountPaid = Number(r.amount_paid ?? 0);
    const amountDue = Math.max(0, Number(r.amount_due ?? total - amountPaid));
    const supplierName = nameFromFrom(r.from_snapshot as Record<string, unknown>);

    if (total <= 0) continue;

    const lines: JournalEntryLine[] = [
      {
        accountCode: "5100",
        accountName: "Purchases",
        debit: total,
        credit: 0,
        description: `Purchase from ${supplierName} - PINV ${r.number}`,
      },
    ];
    accountBalances.get("5100")!.debit += total;

    if (amountPaid > 0) {
      lines.push({
        accountCode: "1100",
        accountName: "Cash",
        debit: 0,
        credit: amountPaid,
        description: `Payment - PINV ${r.number}`,
      });
      accountBalances.get("1100")!.credit += amountPaid;
    }
    if (amountDue > 0) {
      lines.push({
        accountCode: "2000",
        accountName: "Accounts Payable",
        debit: 0,
        credit: amountDue,
        description: `Owed to ${supplierName} - PINV ${r.number}`,
      });
      accountBalances.get("2000")!.credit += amountDue;
    }

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    entries.push({
      id: r.id,
      date: r.issue_date,
      ref: r.number,
      source: "purchase_invoice",
      description: `Purchase Invoice ${r.number} - ${supplierName}`,
      lines,
      totalDebit,
      totalCredit,
    });
  }

  // Expenses: Dr Operating Expenses, Cr Cash
  for (const r of expRes.data ?? []) {
    const amount = Number(r.amount ?? 0);
    if (amount <= 0) continue;

    const desc = String(r.description ?? "").trim() || "Expense";

    const lines: JournalEntryLine[] = [
      {
        accountCode: "5200",
        accountName: "Operating Expenses",
        debit: amount,
        credit: 0,
        description: desc,
      },
      {
        accountCode: "1100",
        accountName: "Cash",
        debit: 0,
        credit: amount,
        description: desc,
      },
    ];
    accountBalances.get("5200")!.debit += amount;
    accountBalances.get("1100")!.credit += amount;

    const shortId = r.id ? String(r.id).slice(0, 8) : "";
    entries.push({
      id: r.id,
      date: r.expense_date,
      ref: `EXP-${shortId}`,
      source: "expense",
      description: desc,
      lines,
      totalDebit: amount,
      totalCredit: amount,
    });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));

  const trialBalance = CHART_OF_ACCOUNTS.map((acc) => {
    const bal = accountBalances.get(acc.code)!;
    const balance = acc.type === "Asset" || acc.type === "Expense"
      ? bal.debit - bal.credit
      : bal.credit - bal.debit;
    return {
      accountCode: acc.code,
      accountName: acc.name,
      debit: bal.debit,
      credit: bal.credit,
      balance,
    };
  }).filter((r) => r.debit > 0 || r.credit > 0);

  return {
    currency,
    startDate: filters.startDate,
    endDate: filters.endDate,
    entries,
    trialBalance,
  };
}
