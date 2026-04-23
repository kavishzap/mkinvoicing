import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import { ensureUserSettingsRow, type Profile } from "@/lib/settings-service";
import type { CustomerRow } from "@/lib/customers-service";

/** Only `active` (current) and `expired` (past valid_until or manual). */
export type QuotationStatus = "active" | "expired";

/** Map DB / legacy values to the two-status model (until migration is applied). */
export function normalizeQuotationStatus(raw: string): QuotationStatus {
  return raw === "expired" ? "expired" : "active";
}

export type QuotationLinePayload = {
  item: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  /** Display order (0-based). Omitted = sequence in array. */
  sort_order?: number;
};

export type CreateQuotationPayload = {
  issue_date: string;
  valid_until: string;
  status: QuotationStatus;
  currency: string;
  discount_type: "value" | "percent";
  discount_amount: number;
  shipping_amount?: number;
  notes?: string;
  terms?: string;
  customer_id: string | null;
  client_snapshot: Record<string, unknown> | null;
  from_snapshot: Record<string, unknown>;
  bill_to_snapshot: Record<string, unknown>;
  items: QuotationLinePayload[];
};

export type QuotationItemRow = {
  item: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  sort_order?: number;
};

export type QuotationDetail = {
  id: string;
  number: string;
  issue_date: string;
  valid_until: string;
  status: QuotationStatus;
  currency: string;
  customer_id: string | null;
  from_snapshot: Record<string, unknown>;
  bill_to_snapshot: Record<string, unknown>;
  client_snapshot: Record<string, unknown> | null;
  discount_type: "value" | "percent";
  discount_amount: number;
  shipping_amount: number;
  notes: string | null;
  terms: string | null;
  items: QuotationItemRow[];
};

export type QuotationListRow = {
  id: string;
  number: string;
  issueDate: string;
  validUntil: string;
  status: QuotationStatus;
  currency: string;
  clientName: string;
  total: number;
};

function nameFromBillTo(bill?: Record<string, unknown>) {
  if (!bill) return "";
  const t = bill.type as string | undefined;
  return t === "company"
    ? String(bill.company_name ?? "")
    : String(bill.full_name ?? "");
}

export type QuotationClientInfo = {
  type: "company" | "individual";
  companyName: string;
  contactName: string;
  fullName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  postal: string;
  country: string;
  address_line_1: string;
  address_line_2: string;
};

/** JSON stored in `from_snapshot` — mirrors invoice create flow */
export function buildFromSnapshotForQuotation(
  profile: Profile
): Record<string, unknown> {
  if (profile.accountType === "company") {
    return {
      type: "company",
      company_name: profile.companyName ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      street: profile.street ?? "",
      city: profile.city ?? "",
      postal: profile.postal ?? "",
      country: profile.country ?? "",
      address_line_1: profile.address_line_1 ?? "",
      address_line_2: profile.address_line_2 ?? "",
      registration_id: profile.registrationId ?? "",
      vat_number: profile.vatNumber ?? "",
    };
  }
  return {
    type: "individual",
    full_name: profile.fullName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    street: profile.street ?? "",
    city: profile.city ?? "",
    postal: profile.postal ?? "",
    country: profile.country ?? "",
    address_line_1: profile.address_line_1 ?? "",
    address_line_2: profile.address_line_2 ?? "",
  };
}

export function buildBillToSnapshot(
  c: QuotationClientInfo
): Record<string, unknown> {
  return {
    type: c.type,
    company_name: c.companyName || null,
    contact_name: c.contactName || null,
    full_name: c.fullName || null,
    email: c.email || null,
    phone: c.phone || null,
    street: c.street || null,
    city: c.city || null,
    postal: c.postal || null,
    country: c.country || null,
    address_line_1: c.address_line_1 || null,
    address_line_2: c.address_line_2 || null,
  };
}

/** Hydrate bill-to form state from stored JSON */
export function clientInfoFromBillSnapshot(
  bill: Record<string, unknown>
): QuotationClientInfo {
  const t = bill.type === "individual" ? "individual" : "company";
  return {
    type: t,
    companyName: String(bill.company_name ?? ""),
    contactName: String(bill.contact_name ?? ""),
    fullName: String(bill.full_name ?? ""),
    email: String(bill.email ?? ""),
    phone: String(bill.phone ?? ""),
    street: String(bill.street ?? ""),
    city: String(bill.city ?? ""),
    postal: String(bill.postal ?? ""),
    country: String(bill.country ?? ""),
    address_line_1: String(bill.address_line_1 ?? ""),
    address_line_2: String(bill.address_line_2 ?? ""),
  };
}

/**
 * Marks active quotations as expired when valid_until is before today (server date).
 * Safe to call on list/view load; RLS limits to current user.
 */
export async function expireStaleQuotations(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const companyId = await requireActiveCompanyId();
  const { error } = await supabase
    .from("quotations")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .lt("valid_until", today)
    .eq("status", "active")
    .eq("company_id", companyId);

  if (error) {
    // eslint-disable-next-line no-console
    console.warn("expireStaleQuotations:", error.message);
  }
}

export function billToFromCustomer(c: CustomerRow): QuotationClientInfo {
  return {
    type: c.type,
    companyName: c.companyName ?? "",
    contactName: c.contactName ?? "",
    fullName: c.fullName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    street: c.street ?? "",
    city: c.city ?? "",
    postal: c.postal ?? "",
    country: c.country ?? "",
    address_line_1: c.address_line_1 ?? "",
    address_line_2: c.address_line_2 ?? "",
  };
}

export function computeQuotationTotals(q: QuotationDetail) {
  const items = q.items ?? [];
  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const taxTotal = items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
  const discount =
    q.discount_type === "percent"
      ? (subtotal * Number(q.discount_amount || 0)) / 100
      : Number(q.discount_amount || 0);
  const ship = Number(q.shipping_amount ?? 0);
  const total = subtotal + taxTotal - discount + ship;
  return { subtotal, taxTotal, discount, shipping: ship, total };
}

export async function createQuotation(
  params: CreateQuotationPayload
): Promise<string> {
  const { items, ...inv } = params;
  const companyId = await requireActiveCompanyId();
  await ensureUserSettingsRow();
  const { data, error } = await supabase.rpc("create_quotation", {
    p_quotation: {
      company_id: companyId,
      issue_date: inv.issue_date,
      valid_until: inv.valid_until,
      status: inv.status,
      currency: inv.currency,
      discount_type: inv.discount_type,
      discount_amount: inv.discount_amount,
      shipping_amount: inv.shipping_amount ?? 0,
      notes: inv.notes ?? null,
      terms: inv.terms ?? null,
      customer_id: inv.customer_id,
      client_snapshot: inv.client_snapshot,
      from_snapshot: inv.from_snapshot,
      bill_to_snapshot: inv.bill_to_snapshot,
    } as Record<string, unknown>,
    p_items: items.map((li, i) => ({
      item: li.item,
      description: li.description ?? null,
      quantity: li.quantity,
      unit_price: li.unit_price,
      tax_percent: li.tax_percent,
      sort_order: li.sort_order ?? i,
    })),
  });

  if (error) throw error;

  let quotationId: string;
  if (typeof data === "string") {
    quotationId = data;
  } else if (data && typeof data === "object" && "quotation_id" in (data as object)) {
    quotationId = (data as { quotation_id: string }).quotation_id;
  } else {
    quotationId = String(data);
  }
  return quotationId;
}

export async function listQuotations(opts?: {
  search?: string;
  status?: QuotationStatus | "all";
  page?: number;
  pageSize?: number;
}): Promise<{ rows: QuotationListRow[]; total: number }> {
  await expireStaleQuotations();
  const companyId = await requireActiveCompanyId();

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("quotations")
    .select(
      "id, number, issue_date, valid_until, status, currency, bill_to_snapshot, total",
      { count: "exact" }
    )
    .eq("company_id", companyId)
    .order("issue_date", { ascending: false })
    .range(from, to);

  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  if (opts?.search?.trim()) {
    const s = `%${opts.search.trim()}%`;
    q = q.or(
      [`number.ilike.${s}`, `bill_to_snapshot->>company_name.ilike.${s}`, `bill_to_snapshot->>full_name.ilike.${s}`].join(
        ","
      )
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;

  const rows: QuotationListRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    number: r.number,
    issueDate: r.issue_date,
    validUntil: r.valid_until,
    status: normalizeQuotationStatus(String(r.status)),
    currency: r.currency,
    clientName: nameFromBillTo(r.bill_to_snapshot),
    total: Number(r.total ?? 0),
  }));

  return { rows, total: count ?? 0 };
}

export async function getQuotation(id: string): Promise<QuotationDetail | null> {
  await expireStaleQuotations();
  const companyId = await requireActiveCompanyId();

  const { data, error } = await supabase
    .from("quotations")
    .select(
      `
      id, number, issue_date, valid_until, status, currency, customer_id,
      from_snapshot, bill_to_snapshot, client_snapshot,
      discount_type, discount_amount, shipping_amount, notes, terms,
      quotation_items ( item, description, quantity, unit_price, tax_percent, sort_order )
    `
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) return null;

  const raw = (data.quotation_items ?? []) as QuotationItemRow[];
  const items = [...raw].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );

  return {
    id: data.id,
    number: data.number,
    issue_date: data.issue_date,
    valid_until: data.valid_until,
    status: normalizeQuotationStatus(String(data.status)),
    currency: data.currency,
    customer_id: (data.customer_id as string) ?? null,
    from_snapshot: (data.from_snapshot ?? {}) as Record<string, unknown>,
    bill_to_snapshot: (data.bill_to_snapshot ?? {}) as Record<string, unknown>,
    client_snapshot: (data.client_snapshot ?? null) as Record<
      string,
      unknown
    > | null,
    discount_type: data.discount_type as "value" | "percent",
    discount_amount: Number(data.discount_amount ?? 0),
    shipping_amount: Number(data.shipping_amount ?? 0),
    notes: data.notes,
    terms: data.terms,
    items,
  };
}

export async function deleteQuotation(id: string): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const { count: soCount, error: soErr } = await supabase
    .from("sales_orders")
    .select("id", { count: "exact", head: true })
    .eq("created_from_quotation_id", id)
    .eq("company_id", companyId);

  if (soErr) throw soErr;

  const { count: invCount, error: invErr } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("created_from_quotation_id", id)
    .eq("company_id", companyId);

  if (invErr) throw invErr;

  const hasSo = (soCount ?? 0) > 0;
  const hasInv = (invCount ?? 0) > 0;

  if (hasSo && hasInv) {
    throw new Error(
      "Cannot delete this quotation: it was used to create a sales order and an invoice."
    );
  }
  if (hasSo) {
    throw new Error(
      "Cannot delete this quotation: it was converted to a sales order."
    );
  }
  if (hasInv) {
    throw new Error(
      "Cannot delete this quotation: it was converted to an invoice."
    );
  }

  const { error } = await supabase
    .from("quotations")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
}

export type UpdateQuotationPayload = Omit<
  CreateQuotationPayload,
  "items"
> & {
  items: QuotationLinePayload[];
};

export async function updateQuotation(
  id: string,
  params: UpdateQuotationPayload
): Promise<void> {
  const { items, ...inv } = params;
  const companyId = await requireActiveCompanyId();
  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity) * Number(it.unit_price),
    0
  );
  const taxTotal = items.reduce((s, it) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    return s + line * (Number(it.tax_percent) / 100);
  }, 0);
  const discount =
    inv.discount_type === "percent"
      ? (subtotal * Number(inv.discount_amount || 0)) / 100
      : Number(inv.discount_amount || 0);
  const ship = inv.shipping_amount ?? 0;
  const total = subtotal + taxTotal - discount + ship;

  const { error: upErr } = await supabase
    .from("quotations")
    .update({
      issue_date: inv.issue_date,
      valid_until: inv.valid_until,
      status: inv.status,
      currency: inv.currency,
      from_snapshot: inv.from_snapshot,
      bill_to_snapshot: inv.bill_to_snapshot,
      client_snapshot: inv.client_snapshot,
      customer_id: inv.customer_id,
      subtotal,
      tax_total: taxTotal,
      discount_type: inv.discount_type,
      discount_amount: inv.discount_amount,
      shipping_amount: ship,
      total,
      notes: inv.notes ?? null,
      terms: inv.terms ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", companyId);

  if (upErr) throw upErr;

  const { error: delErr } = await supabase
    .from("quotation_items")
    .delete()
    .eq("quotation_id", id);
  if (delErr) throw delErr;

  const rows = items.map((it, idx) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    const lineTax = line * (Number(it.tax_percent) / 100);
    const sortOrder = it.sort_order ?? idx;
    return {
      quotation_id: id,
      company_id: companyId,
      item: it.item,
      description: it.description ?? null,
      quantity: it.quantity,
      unit_price: it.unit_price,
      tax_percent: it.tax_percent,
      line_subtotal: line,
      line_tax: lineTax,
      line_total: line + lineTax,
      sort_order: sortOrder,
    };
  });

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("quotation_items")
      .insert(rows);
    if (insErr) throw insErr;
  }
}
