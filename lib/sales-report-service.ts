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

export type SalesReportSource = "invoice" | "sales_order";

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
  source: SalesReportSource;
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
  due: number;
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

function mapPaymentToBreakdown(pm: PaymentMethod): Exclude<keyof SalesBreakdown, "due"> {
  if (pm === "Cash") return "cash";
  if (pm === "Credit Facilities") return "credit";
  if (pm === "Card Payment" || pm === "Bank Transfer") return "bankJuice";
  return "credit";
}

function applySalesBreakdown(sale: SalesReportInvoice, breakdown: SalesBreakdown) {
  if (sale.amountDue > 0) {
    breakdown.due += sale.amountDue;
  }
  if (sale.amountPaid <= 0) return;
  breakdown[mapPaymentToBreakdown(sale.paymentMethod)] += sale.amountPaid;
}

type LineItemRow = {
  item: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
};

function addSaleToAggregates(
  sale: SalesReportInvoice,
  items: LineItemRow[],
  aggregates: {
    invoices: SalesReportInvoice[];
    productMap: Map<string, { qty: number; unitPrice: number; total: number }>;
    customerMap: Map<string, { total: number; paid: number; outstanding: number }>;
    timelineMap: Map<string, number>;
    breakdown: SalesBreakdown;
    totalSalesGross: number;
    totalDiscounts: number;
    totalTaxCollected: number;
    totalPaid: number;
  },
) {
  aggregates.invoices.push(sale);
  aggregates.totalSalesGross += sale.total;
  aggregates.totalDiscounts += sale.discount;
  aggregates.totalTaxCollected += sale.taxTotal;
  aggregates.totalPaid += sale.amountPaid;
  applySalesBreakdown(sale, aggregates.breakdown);

  for (const it of items) {
    const key = it.item || "Unknown";
    const qty = Number(it.quantity ?? 0);
    const unitPrice = Number(it.unit_price ?? 0);
    const taxPct = Number(it.tax_percent ?? 0);
    const lineWithTax = qty * unitPrice * (1 + taxPct / 100);
    const existing = aggregates.productMap.get(key);
    if (existing) {
      existing.qty += qty;
      existing.total += lineWithTax;
    } else {
      aggregates.productMap.set(key, { qty, unitPrice, total: lineWithTax });
    }
  }

  const custKey = sale.clientName || "Walk-in";
  const cust = aggregates.customerMap.get(custKey);
  if (cust) {
    cust.total += sale.total;
    cust.paid += sale.amountPaid;
    cust.outstanding += sale.amountDue;
  } else {
    aggregates.customerMap.set(custKey, {
      total: sale.total,
      paid: sale.amountPaid,
      outstanding: sale.amountDue,
    });
  }

  aggregates.timelineMap.set(
    sale.issueDate,
    (aggregates.timelineMap.get(sale.issueDate) ?? 0) + sale.total,
  );
}

export async function getSalesReportData(filters: SalesReportFilters): Promise<SalesReportData> {
  const companyId = await requireActiveCompanyId();
  let invQ = supabase
    .from("invoices")
    .select(
      `
      id, number, issue_date, due_date, status, currency, bill_to_snapshot,
      discount_type, discount_amount, payment_method, amount_paid, amount_due,
      created_from_sales_order_id,
      invoice_items ( item, quantity, unit_price, tax_percent )
    `
    )
    .eq("company_id", companyId)
    .neq("status", "cancelled")
    .gte("issue_date", filters.startDate)
    .lte("issue_date", filters.endDate)
    .order("issue_date", { ascending: true });

  if (filters.status && filters.status !== "all") {
    invQ = invQ.eq("status", filters.status);
  }
  if (filters.customerId) {
    invQ = invQ.eq("customer_id", filters.customerId);
  }
  if (filters.paymentMethod && filters.paymentMethod !== "all") {
    invQ = invQ.eq("payment_method", filters.paymentMethod);
  }

  let soQ = supabase
    .from("sales_orders")
    .select(
      `
      id, number, issue_date, valid_until, status, currency, bill_to_snapshot,
      discount_type, discount_amount, shipping_amount, payment_status,
      subtotal, tax_total, total, customer_id,
      sales_order_items ( item, quantity, unit_price, tax_percent )
    `
    )
    .eq("company_id", companyId)
    .neq("status", "expired")
    .gte("issue_date", filters.startDate)
    .lte("issue_date", filters.endDate)
    .order("issue_date", { ascending: true });

  if (filters.customerId) {
    soQ = soQ.eq("customer_id", filters.customerId);
  }

  const [invResult, soResult, linkedInvResult] = await Promise.all([
    invQ,
    filters.paymentMethod && filters.paymentMethod !== "all" ? Promise.resolve({ data: [], error: null }) : soQ,
    supabase
      .from("invoices")
      .select("created_from_sales_order_id")
      .eq("company_id", companyId)
      .not("created_from_sales_order_id", "is", null)
      .neq("status", "cancelled"),
  ]);

  if (invResult.error) throw invResult.error;
  if (soResult.error) throw soResult.error;
  if (linkedInvResult.error) throw linkedInvResult.error;

  const rows = invResult.data ?? [];
  const soRows = soResult.data ?? [];
  const invoicedSoIds = new Set(
    (linkedInvResult.data ?? [])
      .map((r) => r.created_from_sales_order_id as string | null)
      .filter((id): id is string => !!id),
  );

  const invoices: SalesReportInvoice[] = [];
  const productMap = new Map<string, { qty: number; unitPrice: number; total: number }>();
  const customerMap = new Map<string, { total: number; paid: number; outstanding: number }>();
  const timelineMap = new Map<string, number>();
  const breakdown: SalesBreakdown = { cash: 0, credit: 0, bankJuice: 0, due: 0 };

  let totalSalesGross = 0;
  let totalDiscounts = 0;
  let totalTaxCollected = 0;
  let totalPaid = 0;

  const aggregates = {
    invoices,
    productMap,
    customerMap,
    timelineMap,
    breakdown,
    totalSalesGross,
    totalDiscounts,
    totalTaxCollected,
    totalPaid,
  };

  for (const r of rows) {
    const items = (r.invoice_items ?? []) as LineItemRow[];
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
      source: "invoice",
      items: items.map((it) => ({
        item: it.item ?? "",
        quantity: Number(it.quantity ?? 0),
        unitPrice: Number(it.unit_price ?? 0),
        total: Number(it.quantity ?? 0) * Number(it.unit_price ?? 0),
      })),
    };

    addSaleToAggregates(inv, items, aggregates);
  }

  for (const r of soRows) {
    if (invoicedSoIds.has(r.id as string)) continue;
    if (filters.status === "paid" && r.payment_status !== "paid") continue;
    if (filters.status === "unpaid" && r.payment_status === "paid") continue;

    const items = (r.sales_order_items ?? []) as LineItemRow[];
    const ship = Number(r.shipping_amount ?? 0);
    const computed = computeInvoiceTotals(
      items,
      r.discount_type ?? "value",
      r.discount_amount ?? 0,
    );
    const subtotal = Number(r.subtotal ?? computed.subtotal);
    const taxTotal = Number(r.tax_total ?? computed.taxTotal);
    const discount = computed.discount;
    const total = Number(r.total ?? computed.total + ship);
    const amountPaid = r.payment_status === "paid" ? total : 0;
    const amountDue = Math.max(0, total - amountPaid);
    const clientName = nameFromBillTo(r.bill_to_snapshot);
    const status: InvoiceStatus = r.payment_status === "paid" ? "paid" : "unpaid";

    const inv: SalesReportInvoice = {
      id: r.id as string,
      number: r.number as string,
      issueDate: r.issue_date as string,
      dueDate: (r.valid_until as string) ?? (r.issue_date as string),
      status,
      currency: r.currency as string,
      clientName,
      paymentMethod: null,
      total,
      amountPaid,
      amountDue,
      subtotal,
      taxTotal,
      discount,
      source: "sales_order",
      items: items.map((it) => ({
        item: it.item ?? "",
        quantity: Number(it.quantity ?? 0),
        unitPrice: Number(it.unit_price ?? 0),
        total: Number(it.quantity ?? 0) * Number(it.unit_price ?? 0),
      })),
    };

    addSaleToAggregates(inv, items, aggregates);
  }

  totalSalesGross = aggregates.totalSalesGross;
  totalDiscounts = aggregates.totalDiscounts;
  totalTaxCollected = aggregates.totalTaxCollected;
  totalPaid = aggregates.totalPaid;

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

  invoices.sort(
    (a, b) =>
      a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number),
  );

  const currency =
    invoices[0]?.currency ??
    ((soRows[0]?.currency as string | undefined) ?? "MUR");

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
