import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type TeamMemberProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  system_role: string;
  created_at: string;
  updated_at: string;
};

export type TeamMemberRow = {
  membershipId: string;
  userId: string;
  companyId: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  isOwner: boolean;
  invitedAt: string | null;
  joinedAt: string | null;
  profile: TeamMemberProfile | null;
};

export async function listTeamMembers(): Promise<TeamMemberRow[]> {
  const companyId = await requireActiveCompanyId();

  const { data: rows, error } = await supabase
    .from("company_users")
    .select(
      `
      id,
      user_id,
      company_id,
      role_id,
      is_active,
      is_owner,
      invited_at,
      joined_at,
      company_roles ( name )
    `
    )
    .eq("company_id", companyId)
    .order("joined_at", { ascending: false });

  if (error) throw new Error(error.message);

  const members = rows ?? [];
  const userIds = members.map((m) => m.user_id as string).filter(Boolean);
  if (userIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from("user_profiles")
    .select(
      "id, full_name, email, phone, avatar_url, is_active, system_role, created_at, updated_at"
    )
    .in("id", userIds);

  if (pErr) throw new Error(pErr.message);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as Record<string, unknown>])
  );

  return members.map((m) => {
    const uid = m.user_id as string;
    const p = profileById.get(uid);
    const role = m.company_roles as unknown as { name: string } | null;
    const prof = p
      ? ({
          full_name: (p.full_name as string | null) ?? null,
          email: (p.email as string | null) ?? null,
          phone: (p.phone as string | null) ?? null,
          avatar_url: (p.avatar_url as string | null) ?? null,
          is_active: Boolean(p.is_active),
          system_role: String(p.system_role ?? "member"),
          created_at: String(p.created_at ?? ""),
          updated_at: String(p.updated_at ?? ""),
        } satisfies TeamMemberProfile)
      : null;

    return {
      membershipId: m.id as string,
      userId: uid,
      companyId: m.company_id as string,
      roleId: m.role_id as string,
      roleName: role?.name ?? "—",
      isActive: Boolean(m.is_active),
      isOwner: Boolean(m.is_owner),
      invitedAt: (m.invited_at as string | null) ?? null,
      joinedAt: (m.joined_at as string | null) ?? null,
      profile: prof,
    } satisfies TeamMemberRow;
  });
}

export async function getTeamMember(
  membershipId: string
): Promise<TeamMemberRow | null> {
  const companyId = await requireActiveCompanyId();
  const { data: m, error } = await supabase
    .from("company_users")
    .select(
      `
      id,
      user_id,
      company_id,
      role_id,
      is_active,
      is_owner,
      invited_at,
      joined_at,
      company_roles ( name )
    `
    )
    .eq("id", membershipId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !m) return null;

  const uid = m.user_id as string;
  const { data: p } = await supabase
    .from("user_profiles")
    .select(
      "id, full_name, email, phone, avatar_url, is_active, system_role, created_at, updated_at"
    )
    .eq("id", uid)
    .maybeSingle();

  const role = m.company_roles as unknown as { name: string } | null;
  const prof = p
    ? ({
        full_name: (p.full_name as string | null) ?? null,
        email: (p.email as string | null) ?? null,
        phone: (p.phone as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
        is_active: Boolean(p.is_active),
        system_role: String(p.system_role ?? "member"),
        created_at: String(p.created_at ?? ""),
        updated_at: String(p.updated_at ?? ""),
      } satisfies TeamMemberProfile)
    : null;

  return {
    membershipId: m.id as string,
    userId: uid,
    companyId: m.company_id as string,
    roleId: m.role_id as string,
    roleName: role?.name ?? "—",
    isActive: Boolean(m.is_active),
    isOwner: Boolean(m.is_owner),
    invitedAt: (m.invited_at as string | null) ?? null,
    joinedAt: (m.joined_at as string | null) ?? null,
    profile: prof,
  };
}

export type UpdateTeamMemberPayload = {
  roleId?: string;
  membershipActive?: boolean;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
};

export async function updateTeamMember(
  membershipId: string,
  payload: UpdateTeamMemberPayload
): Promise<void> {
  const companyId = await requireActiveCompanyId();

  const { data: row, error: fetchErr } = await supabase
    .from("company_users")
    .select("user_id, is_owner")
    .eq("id", membershipId)
    .eq("company_id", companyId)
    .single();

  if (fetchErr || !row) throw new Error("Member not found.");

  const targetUserId = row.user_id as string;

  const cuUpdate: Record<string, unknown> = {};
  if (payload.roleId !== undefined) cuUpdate.role_id = payload.roleId;
  if (payload.membershipActive !== undefined)
    cuUpdate.is_active = payload.membershipActive;

  if (Object.keys(cuUpdate).length > 0) {
    if (row.is_owner && payload.membershipActive === false) {
      throw new Error("Cannot deactivate a company owner.");
    }
    if (row.is_owner && payload.roleId !== undefined) {
      throw new Error("Cannot change the owner role.");
    }
    const { error: uErr } = await supabase
      .from("company_users")
      .update(cuUpdate)
      .eq("id", membershipId)
      .eq("company_id", companyId);
    if (uErr) throw new Error(uErr.message);
  }

  const profUpdate: Record<string, unknown> = {};
  if (payload.full_name !== undefined)
    profUpdate.full_name = payload.full_name.trim() || null;
  if (payload.email !== undefined) profUpdate.email = payload.email?.trim() || null;
  if (payload.phone !== undefined) profUpdate.phone = payload.phone?.trim() || null;
  if (Object.keys(profUpdate).length > 0) {
    profUpdate.updated_at = new Date().toISOString();
    const { error: pErr } = await supabase
      .from("user_profiles")
      .update(profUpdate)
      .eq("id", targetUserId);
    if (pErr) throw new Error(pErr.message);
  }
}

export async function removeTeamMember(membershipId: string): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) throw new Error("Not authenticated");

  const { data: row, error: fetchErr } = await supabase
    .from("company_users")
    .select("user_id, is_owner")
    .eq("id", membershipId)
    .eq("company_id", companyId)
    .single();

  if (fetchErr || !row) throw new Error("Member not found.");

  if (row.user_id === currentUser.id) {
    throw new Error("You cannot remove yourself from the company.");
  }
  if (row.is_owner) {
    throw new Error("Cannot remove a company owner from the team list.");
  }

  const { error: dErr } = await supabase
    .from("company_users")
    .delete()
    .eq("id", membershipId)
    .eq("company_id", companyId);

  if (dErr) throw new Error(dErr.message);
}

export type CreateTeamMemberPayload = {
  email: string;
  full_name: string;
  phone?: string | null;
  role_id: string;
};

export async function createTeamMember(
  payload: CreateTeamMemberPayload
): Promise<{ user_id: string }> {
  const companyId = await requireActiveCompanyId();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not signed in.");
  }

  const res = await fetch(
    typeof window !== "undefined"
      ? `${window.location.origin}/api/company-team`
      : "/api/company-team",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email: payload.email.trim(),
        full_name: payload.full_name.trim(),
        phone: payload.phone?.trim() || null,
        role_id: payload.role_id,
        company_id: companyId,
      }),
    }
  );

  const json = (await res.json()) as { error?: string; user_id?: string };
  if (!res.ok) {
    throw new Error(json.error ?? "Failed to create team member.");
  }
  if (!json.user_id) {
    throw new Error("Invalid response from server.");
  }
  return { user_id: json.user_id };
}
