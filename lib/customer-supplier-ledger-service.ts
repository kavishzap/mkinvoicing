import { supabase } from "@/lib/supabaseClient";

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

export type CustomerLedgerTransaction = {
  id: string;
  date: string;
  ref: string;
  type: "sale" | "payment";
  description: string;
  debit: number;  // charge (increases AR)
  credit: number; // payment (decreases AR)
  balance: number; // running balance (what customer owes)
};

export type CustomerLedgerAccount = {
  customerName: string;
  totalSales: number;
  totalPayments: number;
  balance: number;
  transactions: CustomerLedgerTransaction[];
};

export type SupplierLedgerTransaction = {
  id: string;
  date: string;
  ref: string;
  type: "purchase" | "payment";
  description: string;
  debit: number;  // payment (decreases AP)
  credit: number; // charge (increases AP)
  balance: number; // running balance (what we owe)
};

export type SupplierLedgerAccount = {
  supplierName: string;
  totalPurchases: number;
  totalPayments: number;
  balance: number;
  transactions: SupplierLedgerTransaction[];
};

export type CustomerSupplierLedgerFilters = {
  startDate: string;
  endDate: string;
};

export type CustomerSupplierLedgerData = {
  currency: string;
  startDate: string;
  endDate: string;
  customers: CustomerLedgerAccount[];
  suppliers: SupplierLedgerAccount[];
  totalReceivable: number;
  totalPayable: number;
};

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function getCustomerSupplierLedgerData(
  filters: CustomerSupplierLedgerFilters
): Promise<CustomerSupplierLedgerData> {
  const userId = await getUserId();

  const [invRes, piRes] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        `
        id, number, issue_date, status, currency, bill_to_snapshot,
        discount_type, discount_amount, amount_paid, amount_due,
        invoice_items ( quantity, unit_price, tax_percent )
      `
      )
      .neq("status", "cancelled")
      .gte("issue_date", filters.startDate)
      .lte("issue_date", filters.endDate)
      .order("issue_date", { ascending: true }),
    supabase
      .from("purchase_invoices")
      .select("id, number, issue_date, status, currency, from_snapshot, amount_paid, amount_due, total")
      .neq("status", "cancelled")
      .gte("issue_date", filters.startDate)
      .lte("issue_date", filters.endDate)
      .order("issue_date", { ascending: true }),
  ]);

  if (invRes.error) throw invRes.error;
  if (piRes.error) throw piRes.error;

  const customerMap = new Map<string, CustomerLedgerTransaction[]>();
  const supplierMap = new Map<string, SupplierLedgerTransaction[]>();

  for (const r of invRes.data ?? []) {
    const items = (r.invoice_items ?? []) as { quantity: number; unit_price: number; tax_percent: number }[];
    const total = computeInvoiceTotal(items, r.discount_type ?? "value", r.discount_amount ?? 0);
    const amountPaid = Number(r.amount_paid ?? 0);
    const amountDue = Math.max(0, total - amountPaid);
    const clientName = nameFromBillTo(r.bill_to_snapshot);
    const key = clientName || "Walk-in";

    const txns: CustomerLedgerTransaction[] = [];
    txns.push({
      id: r.id,
      date: r.issue_date,
      ref: r.number,
      type: "sale",
      description: `Invoice ${r.number}`,
      debit: total,
      credit: 0,
      balance: 0,
    });
    if (amountPaid > 0) {
      txns.push({
        id: `${r.id}-pay`,
        date: r.issue_date,
        ref: r.number,
        type: "payment",
        description: `Payment received`,
        debit: 0,
        credit: amountPaid,
        balance: 0,
      });
    }

    const existing = customerMap.get(key) ?? [];
    customerMap.set(key, [...existing, ...txns]);
  }

  for (const r of piRes.data ?? []) {
    const total = Number(r.total ?? 0);
    const amountPaid = Number(r.amount_paid ?? 0);
    const amountDue = Math.max(0, Number(r.amount_due ?? total - amountPaid));
    const supplierName = nameFromFrom(r.from_snapshot as Record<string, unknown>);
    const key = supplierName;

    const txns: SupplierLedgerTransaction[] = [];
    txns.push({
      id: r.id,
      date: r.issue_date,
      ref: r.number,
      type: "purchase",
      description: `Purchase Invoice ${r.number}`,
      debit: 0,
      credit: total,
      balance: 0,
    });
    if (amountPaid > 0) {
      txns.push({
        id: `${r.id}-pay`,
        date: r.issue_date,
        ref: r.number,
        type: "payment",
        description: `Payment made`,
        debit: amountPaid,
        credit: 0,
        balance: 0,
      });
    }

    const existing = supplierMap.get(key) ?? [];
    supplierMap.set(key, [...existing, ...txns]);
  }

  const customers: CustomerLedgerAccount[] = [];
  let totalReceivable = 0;

  for (const [name, txns] of customerMap.entries()) {
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
    let balance = 0;
    const withBalance = sorted.map((t) => {
      balance += t.debit - t.credit;
      return { ...t, balance };
    });
    const totalSales = withBalance.reduce((s, t) => s + t.debit, 0);
    const totalPayments = withBalance.reduce((s, t) => s + t.credit, 0);
    totalReceivable += balance;
    customers.push({
      customerName: name,
      totalSales,
      totalPayments,
      balance,
      transactions: withBalance,
    });
  }
  customers.sort((a, b) => b.balance - a.balance);

  const suppliers: SupplierLedgerAccount[] = [];
  let totalPayable = 0;

  for (const [name, txns] of supplierMap.entries()) {
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
    let balance = 0;
    const withBalance = sorted.map((t) => {
      balance += t.credit - t.debit;
      return { ...t, balance };
    });
    const totalPurchases = withBalance.reduce((s, t) => s + t.credit, 0);
    const totalPayments = withBalance.reduce((s, t) => s + t.debit, 0);
    totalPayable += balance;
    suppliers.push({
      supplierName: name,
      totalPurchases,
      totalPayments,
      balance,
      transactions: withBalance,
    });
  }
  suppliers.sort((a, b) => b.balance - a.balance);

  const currency = "MUR";

  return {
    currency,
    startDate: filters.startDate,
    endDate: filters.endDate,
    customers,
    suppliers,
    totalReceivable,
    totalPayable,
  };
}
