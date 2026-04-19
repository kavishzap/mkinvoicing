import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type InvoiceStatus = "unpaid" | "paid" | "cancelled";
export type PaymentMethod = "Cash" | "Card Payment" | "Credit Facilities" | "Bank Transfer" | null;

export type SalesReportFilters = {
  startDate: string;
  endDate: string;
  customerId?: string | null;
  status?: InvoiceStatus | "all";
  paymentMethod?: PaymentMethod | "all";
};

export type SalesReportInvoice = {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: string;
  clientName: string;
  paymentMethod: PaymentMethod;
  total: number;
  amountPaid: number;
  amountDue: number;
  subtotal: number;
  taxTotal: number;
  discount: number;
  items: { item: string; quantity: number; unitPrice: number; total: number }[];
};

export type SalesByProduct = {
  product: string;
  qtySold: number;
  unitPrice: number;
  total: number;
};

export type SalesByCustomer = {
  customer: string;
  totalSales: number;
  paid: number;
  outstanding: number;
};

export type SalesTimelineEntry = {
  date: string;
  sales: number;
};

export type SalesBreakdown = {
  cash: number;
  credit: number;
  bankJuice: number;
};

export type SalesReportData = {
  companyName: string;
  currency: string;
  startDate: string;
  endDate: string;
  generatedOn: string;
  invoices: SalesReportInvoice[];
  totalSalesGross: number;
  totalDiscounts: number;
  totalTaxCollected: number;
  netSales: number;
  totalPaid: number;
  outstanding: number;
  salesBreakdown: SalesBreakdown;
  byProduct: SalesByProduct[];
  byCustomer: SalesByCustomer[];
  timeline: SalesTimelineEntry[];
  outstandingInvoices: SalesReportInvoice[];
};

function nameFromBillTo(bill?: { type?: string; company_name?: string; full_name?: string }) {
  if (!bill) return "Walk-in";
  const name = bill.type === "company" ? bill.company_name ?? "" : bill.full_name ?? "";
  return name.trim() || "Walk-in";
}

function computeInvoiceTotals(
  items: { quantity: number; unit_price: number; tax_percent: number }[],
  discountType: "value" | "percent",
  discountAmount: number
) {
  const subtotal = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const taxTotal = items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
  const discount =
    discountType === "percent" ? (subtotal * Number(discountAmount || 0)) / 100 : Number(discountAmount || 0);
  const total = subtotal + taxTotal - discount;
  return { subtotal, taxTotal, discount, total };
}

function mapPaymentToBreakdown(pm: PaymentMethod): keyof SalesBreakdown {
  if (pm === "Cash") return "cash";
  if (pm === "Credit Facilities") return "credit";
  if (pm === "Card Payment" || pm === "Bank Transfer") return "bankJuice";
  return "credit"; // null/unknown treat as credit
}

export async function getSalesReportData(filters: SalesReportFilters): Promise<SalesReportData> {
  const companyId = await requireActiveCompanyId();
  let q = supabase
    .from("invoices")
    .select(
      `
      id, number, issue_date, due_date, status, currency, bill_to_snapshot,
      discount_type, discount_amount, payment_method, amount_paid, amount_due,
      invoice_items ( item, quantity, unit_price, tax_percent )
    `
    )
    .eq("company_id", companyId)
    .neq("status", "cancelled")
    .gte("issue_date", filters.startDate)
    .lte("issue_date", filters.endDate)
    .order("issue_date", { ascending: true });

  if (filters.status && filters.status !== "all") {
    q = q.eq("status", filters.status);
  }
  if (filters.customerId) {
    q = q.eq("customer_id", filters.customerId);
  }
  if (filters.paymentMethod && filters.paymentMethod !== "all") {
    q = q.eq("payment_method", filters.paymentMethod);
  }

  const { data: rows, error } = await q;
  if (error) throw error;

  const invoices: SalesReportInvoice[] = [];
  const productMap = new Map<string, { qty: number; unitPrice: number; total: number }>();
  const customerMap = new Map<string, { total: number; paid: number; outstanding: number }>();
  const timelineMap = new Map<string, number>();
  const breakdown: SalesBreakdown = { cash: 0, credit: 0, bankJuice: 0 };

  let totalSalesGross = 0;
  let totalDiscounts = 0;
  let totalTaxCollected = 0;
  let totalPaid = 0;

  for (const r of rows ?? []) {
    const items = (r.invoice_items ?? []) as { item: string; quantity: number; unit_price: number; tax_percent: number }[];
    const { subtotal, taxTotal, discount, total } = computeInvoiceTotals(
      items,
      r.discount_type ?? "value",
      r.discount_amount ?? 0
    );
    const amountPaid = Number(r.amount_paid ?? 0);
    const amountDue = Math.max(0, total - amountPaid);
    const clientName = nameFromBillTo(r.bill_to_snapshot);
    const pm = r.payment_method as PaymentMethod;

    const inv: SalesReportInvoice = {
      id: r.id,
      number: r.number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      status: r.status as InvoiceStatus,
      currency: r.currency,
      clientName,
      paymentMethod: pm,
      total,
      amountPaid,
      amountDue,
      subtotal,
      taxTotal,
      discount,
      items: items.map((it) => ({
        item: it.item ?? "",
        quantity: Number(it.quantity ?? 0),
        unitPrice: Number(it.unit_price ?? 0),
        total: Number(it.quantity ?? 0) * Number(it.unit_price ?? 0),
      })),
    };
    invoices.push(inv);

    totalSalesGross += total;
    totalDiscounts += discount;
    totalTaxCollected += taxTotal;
    totalPaid += amountPaid;

    const bucket = mapPaymentToBreakdown(pm);
    breakdown[bucket] += total;

    for (const it of items) {
      const key = it.item || "Unknown";
      const qty = Number(it.quantity ?? 0);
      const unitPrice = Number(it.unit_price ?? 0);
      const taxPct = Number(it.tax_percent ?? 0);
      const lineWithTax = qty * unitPrice * (1 + taxPct / 100);
      const existing = productMap.get(key);
      if (existing) {
        existing.qty += qty;
        existing.total += lineWithTax;
      } else {
        productMap.set(key, { qty, unitPrice, total: lineWithTax });
      }
    }

    const custKey = clientName || "Walk-in";
    const cust = customerMap.get(custKey);
    if (cust) {
      cust.total += total;
      cust.paid += amountPaid;
      cust.outstanding += amountDue;
    } else {
      customerMap.set(custKey, { total, paid: amountPaid, outstanding: amountDue });
    }

    const dateKey = r.issue_date;
    timelineMap.set(dateKey, (timelineMap.get(dateKey) ?? 0) + total);
  }

  const byProduct: SalesByProduct[] = Array.from(productMap.entries()).map(([product, v]) => ({
    product,
    qtySold: v.qty,
    unitPrice: v.unitPrice,
    total: v.total,
  }));
  byProduct.sort((a, b) => b.total - a.total);

  const byCustomer: SalesByCustomer[] = Array.from(customerMap.entries()).map(([customer, v]) => ({
    customer,
    totalSales: v.total,
    paid: v.paid,
    outstanding: v.outstanding,
  }));
  byCustomer.sort((a, b) => b.totalSales - a.totalSales);

  const timeline: SalesTimelineEntry[] = Array.from(timelineMap.entries())
    .map(([date, sales]) => ({ date, sales }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const outstandingInvoices = invoices.filter((i) => i.amountDue > 0);
  const outstanding = outstandingInvoices.reduce((s, i) => s + i.amountDue, 0);

  const currency = invoices[0]?.currency ?? "MUR";

  return {
    companyName: "",
    currency,
    startDate: filters.startDate,
    endDate: filters.endDate,
    generatedOn: new Date().toISOString().slice(0, 10),
    invoices,
    totalSalesGross,
    totalDiscounts,
    totalTaxCollected,
    netSales: totalSalesGross,
    totalPaid,
    outstanding,
    salesBreakdown: breakdown,
    byProduct,
    byCustomer,
    timeline,
    outstandingInvoices,
  };
}
