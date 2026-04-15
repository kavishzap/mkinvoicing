import { supabase } from "@/lib/supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";

export type WhatsAppGroupRow = {
  id: string;
  company_id: string;
  user_id: string;
  name: string;
  description: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
};

export type WhatsAppGroupMemberRow = {
  id: string;
  customer_id: string;
  displayName: string;
  phone: string;
  email: string;
};

const GROUP_COLUMNS =
  "id,company_id,user_id,name,description,is_active,created_at,updated_at";

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

async function requireCompanyId(): Promise<string> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No company found for this account. Complete company setup first."
    );
  }
  return companyId;
}

function mapGroup(r: Record<string, unknown>): WhatsAppGroupRow {
  return {
    id: String(r.id),
    company_id: String(r.company_id ?? ""),
    user_id: String(r.user_id ?? ""),
    name: String(r.name ?? ""),
    description: String(r.description ?? ""),
    isActive: !!r.is_active,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function listWhatsAppGroups(opts?: {
  search?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: WhatsAppGroupRow[]; total: number }> {
  const companyId = await requireCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("whatsapp_groups")
    .select(GROUP_COLUMNS, { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!opts?.includeInactive) {
    q = q.eq("is_active", true);
  }

  const term = opts?.search?.trim();
  if (term) {
    const s = `%${term}%`;
    q = q.or([`name.ilike.${s}`, `description.ilike.${s}`].join(","));
  }

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: (data ?? []).map((r) => mapGroup(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function getWhatsAppGroup(
  id: string
): Promise<WhatsAppGroupRow> {
  const companyId = await requireCompanyId();
  const { data, error } = await supabase
    .from("whatsapp_groups")
    .select(GROUP_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Group not found");
  return mapGroup(data as Record<string, unknown>);
}

export async function countGroupMembers(groupId: string): Promise<number> {
  const companyId = await requireCompanyId();
  const { count, error } = await supabase
    .from("whatsapp_group_customers")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp_group_id", groupId)
    .eq("company_id", companyId);

  if (error) throw error;
  return count ?? 0;
}

/** One query: member counts for many groups (for table view). */
export async function countMembersForGroups(
  groupIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (groupIds.length === 0) return map;
  const companyId = await requireCompanyId();

  const { data, error } = await supabase
    .from("whatsapp_group_customers")
    .select("whatsapp_group_id")
    .eq("company_id", companyId)
    .in("whatsapp_group_id", groupIds);

  if (error) throw error;
  for (const id of groupIds) map.set(id, 0);
  for (const row of data ?? []) {
    const gid = String((row as { whatsapp_group_id: string }).whatsapp_group_id);
    map.set(gid, (map.get(gid) ?? 0) + 1);
  }
  return map;
}

export async function listGroupMembers(
  groupId: string
): Promise<WhatsAppGroupMemberRow[]> {
  const companyId = await requireCompanyId();

  const { data: links, error } = await supabase
    .from("whatsapp_group_customers")
    .select("id, customer_id")
    .eq("whatsapp_group_id", groupId)
    .eq("company_id", companyId);

  if (error) throw error;
  const list = links ?? [];
  const ids = list.map((l) => l.customer_id as string);
  if (ids.length === 0) return [];

  const { data: customers, error: cErr } = await supabase
    .from("customers")
    .select(
      "id,type,company_name,full_name,email,phone"
    )
    .eq("company_id", companyId)
    .in("id", ids);

  if (cErr) throw cErr;

  const byId = new Map(
    (customers ?? []).map((c: Record<string, unknown>) => {
      const id = String(c.id);
      const type = c.type as string;
      const name =
        type === "company"
          ? String(c.company_name ?? "")
          : String(c.full_name ?? "");
      return [
        id,
        {
          displayName: name,
          phone: String(c.phone ?? ""),
          email: String(c.email ?? ""),
        },
      ];
    })
  );

  return list.map((l) => {
    const cid = String(l.customer_id);
    const meta = byId.get(cid);
    return {
      id: String(l.id),
      customer_id: cid,
      displayName: meta?.displayName ?? "—",
      phone: meta?.phone ?? "",
      email: meta?.email ?? "",
    };
  });
}

export async function addWhatsAppGroup(params: {
  name: string;
  description?: string | null;
  customerIds: string[];
}): Promise<WhatsAppGroupRow> {
  const userId = await getUserId();
  const companyId = await requireCompanyId();

  const { data: group, error } = await supabase
    .from("whatsapp_groups")
    .insert({
      company_id: companyId,
      user_id: userId,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      is_active: true,
    })
    .select(GROUP_COLUMNS)
    .single();

  if (error) throw error;
  const row = mapGroup(group as Record<string, unknown>);

  if (params.customerIds.length > 0) {
    await setGroupMembers(row.id, params.customerIds);
  }

  return row;
}

export async function updateWhatsAppGroup(
  id: string,
  params: {
    name?: string;
    description?: string | null;
    is_active?: boolean;
  }
): Promise<WhatsAppGroupRow> {
  const companyId = await requireCompanyId();
  const patch: Record<string, unknown> = {};
  if (params.name !== undefined) patch.name = params.name.trim();
  if (params.description !== undefined)
    patch.description = params.description?.trim() || null;
  if (params.is_active !== undefined) patch.is_active = params.is_active;

  const { data, error } = await supabase
    .from("whatsapp_groups")
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(GROUP_COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Group not found");
  return mapGroup(data as Record<string, unknown>);
}

export async function deleteWhatsAppGroup(id: string): Promise<void> {
  const companyId = await requireCompanyId();
  const { error } = await supabase
    .from("whatsapp_groups")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) throw error;
}

/** Replaces all members with the given customer id list. */
export async function setGroupMembers(
  groupId: string,
  customerIds: string[]
): Promise<void> {
  const companyId = await requireCompanyId();

  const { error: delErr } = await supabase
    .from("whatsapp_group_customers")
    .delete()
    .eq("whatsapp_group_id", groupId)
    .eq("company_id", companyId);

  if (delErr) throw delErr;

  const unique = [...new Set(customerIds.filter(Boolean))];
  if (unique.length === 0) return;

  const rows = unique.map((customer_id) => ({
    company_id: companyId,
    whatsapp_group_id: groupId,
    customer_id,
  }));

  const { error: insErr } = await supabase
    .from("whatsapp_group_customers")
    .insert(rows);

  if (insErr) throw insErr;
}

export async function removeGroupMember(
  groupId: string,
  membershipId: string
): Promise<void> {
  const companyId = await requireCompanyId();
  const { error } = await supabase
    .from("whatsapp_group_customers")
    .delete()
    .eq("id", membershipId)
    .eq("whatsapp_group_id", groupId)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function addGroupMember(
  groupId: string,
  customerId: string
): Promise<void> {
  const companyId = await requireCompanyId();
  const { error } = await supabase.from("whatsapp_group_customers").insert({
    company_id: companyId,
    whatsapp_group_id: groupId,
    customer_id: customerId,
  });

  if (error) throw error;
}
