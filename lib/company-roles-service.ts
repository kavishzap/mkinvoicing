import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";

export type PlanAllowedFeature = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type CompanyRole = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean | null;
  created_at: string | null;
  featureIds: string[];
};

function isOwnerRoleName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "owner";
}

/** Features enabled for the company's subscription plan (`plan_features` + `features`). */
export async function getPlanAllowedFeatures(
  companyId: string
): Promise<PlanAllowedFeature[]> {
  const { data: company, error: cErr } = await supabase
    .from("companies")
    .select("plan_id")
    .eq("id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (cErr || !company?.plan_id) {
    throw new Error(cErr?.message ?? "Could not load company plan.");
  }

  const { data: rows, error } = await supabase
    .from("plan_features")
    .select(
      `
      feature_id,
      is_enabled,
      features!inner ( id, code, name, description, is_active )
    `
    )
    .eq("plan_id", company.plan_id)
    .eq("is_enabled", true);

  if (error) throw new Error(error.message);

  const out: PlanAllowedFeature[] = [];
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    const f = row.features as unknown as {
      id: string;
      code: string;
      name: string;
      description: string | null;
      is_active: boolean;
    };
    if (!f?.id || !f.is_active || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push({
      id: f.id,
      code: f.code,
      name: f.name,
      description: f.description,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function listCompanyRoles(): Promise<CompanyRole[]> {
  const companyId = await requireActiveCompanyId();

  const { data: roles, error } = await supabase
    .from("company_roles")
    .select(
      `
      id,
      company_id,
      name,
      description,
      is_active,
      is_system,
      created_at,
      role_features ( feature_id )
    `
    )
    .eq("company_id", companyId)
    .order("name");

  if (error) throw new Error(error.message);

  return (roles ?? []).map((r) => {
    const rf = r.role_features as unknown;
    const pairs = Array.isArray(rf) ? rf : [];
    const featureIds = pairs
      .map((x: { feature_id?: string }) => x.feature_id)
      .filter(Boolean) as string[];
    return {
      id: r.id as string,
      company_id: r.company_id as string,
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      is_active: r.is_active as boolean,
      is_system: r.is_system as boolean | null,
      created_at: (r.created_at as string | null) ?? null,
      featureIds,
    };
  });
}

export async function getCompanyRoleById(roleId: string): Promise<CompanyRole> {
  const companyId = await requireActiveCompanyId();

  const { data: role, error } = await supabase
    .from("company_roles")
    .select(
      `
      id,
      company_id,
      name,
      description,
      is_active,
      is_system,
      created_at,
      role_features ( feature_id )
    `
    )
    .eq("id", roleId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!role) throw new Error("Role not found for this company.");

  const rf = role.role_features as unknown;
  const pairs = Array.isArray(rf) ? rf : [];
  const featureIds = pairs
    .map((x: { feature_id?: string }) => x.feature_id)
    .filter(Boolean) as string[];

  return {
    id: role.id as string,
    company_id: role.company_id as string,
    name: role.name as string,
    description: (role.description as string | null) ?? null,
    is_active: role.is_active as boolean,
    is_system: role.is_system as boolean | null,
    created_at: (role.created_at as string | null) ?? null,
    featureIds,
  };
}

async function assertRoleBelongsToCompany(
  roleId: string,
  companyId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("company_roles")
    .select("id")
    .eq("id", roleId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Role not found for this company.");
}

function validateFeatureIdsAgainstPlan(
  featureIds: string[],
  allowed: PlanAllowedFeature[]
): void {
  const allowedSet = new Set(allowed.map((f) => f.id));
  for (const id of featureIds) {
    if (!allowedSet.has(id)) {
      throw new Error(
        "One or more selected features are not included in your subscription plan."
      );
    }
  }
}

export async function createCompanyRole(payload: {
  name: string;
  description?: string | null;
  featureIds: string[];
}): Promise<{ id: string }> {
  const companyId = await requireActiveCompanyId();
  const name = payload.name.trim();
  if (!name) throw new Error("Role name is required.");

  const allowed = await getPlanAllowedFeatures(companyId);
  validateFeatureIdsAgainstPlan(payload.featureIds, allowed);

  const { data: inserted, error: insErr } = await supabase
    .from("company_roles")
    .insert({
      company_id: companyId,
      name,
      description: payload.description?.trim() || null,
      is_active: true,
      is_system: false,
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    throw new Error(insErr?.message ?? "Could not create role.");
  }

  const roleId = inserted.id as string;

  if (payload.featureIds.length > 0) {
    const rows = payload.featureIds.map((feature_id) => ({
      role_id: roleId,
      feature_id,
    }));
    const { error: rfErr } = await supabase.from("role_features").insert(rows);
    if (rfErr) {
      await supabase.from("company_roles").delete().eq("id", roleId);
      throw new Error(rfErr.message);
    }
  }

  return { id: roleId };
}

export async function updateCompanyRole(
  roleId: string,
  payload: {
    name?: string;
    description?: string | null;
    is_active?: boolean;
    featureIds?: string[];
  }
): Promise<void> {
  const companyId = await requireActiveCompanyId();
  await assertRoleBelongsToCompany(roleId, companyId);

  const { data: existing, error: exErr } = await supabase
    .from("company_roles")
    .select("is_system, name")
    .eq("id", roleId)
    .single();

  if (exErr || !existing) throw new Error(exErr?.message ?? "Role not found.");
  if (isOwnerRoleName(existing.name as string | undefined)) {
    throw new Error("The Owner role cannot be edited.");
  }

  if (payload.featureIds) {
    const allowed = await getPlanAllowedFeatures(companyId);
    validateFeatureIdsAgainstPlan(payload.featureIds, allowed);
  }

  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    const n = payload.name.trim();
    if (!n) throw new Error("Role name is required.");
    updates.name = n;
  }
  if (payload.description !== undefined) {
    updates.description = payload.description?.trim() || null;
  }
  if (payload.is_active !== undefined) {
    updates.is_active = payload.is_active;
  }

  if (Object.keys(updates).length > 0) {
    const { error: upErr } = await supabase
      .from("company_roles")
      .update(updates)
      .eq("id", roleId)
      .eq("company_id", companyId);

    if (upErr) throw new Error(upErr.message);
  }

  if (payload.featureIds) {
    const { error: delErr } = await supabase
      .from("role_features")
      .delete()
      .eq("role_id", roleId);

    if (delErr) throw new Error(delErr.message);

    if (payload.featureIds.length > 0) {
      const rows = payload.featureIds.map((feature_id) => ({
        role_id: roleId,
        feature_id,
      }));
      const { error: insErr } = await supabase.from("role_features").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
  }
}

export async function deleteCompanyRole(roleId: string): Promise<void> {
  const companyId = await requireActiveCompanyId();
  await assertRoleBelongsToCompany(roleId, companyId);

  const { data: role, error: rErr } = await supabase
    .from("company_roles")
    .select("is_system")
    .eq("id", roleId)
    .eq("company_id", companyId)
    .single();

  if (rErr || !role) throw new Error(rErr?.message ?? "Role not found.");
  if (role.is_system) {
    throw new Error("System roles cannot be deleted.");
  }

  const { count, error: cErr } = await supabase
    .from("company_users")
    .select("*", { count: "exact", head: true })
    .eq("role_id", roleId);

  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) > 0) {
    throw new Error(
      "This role is assigned to one or more users. Reassign them before deleting."
    );
  }

  const { error: rfErr } = await supabase
    .from("role_features")
    .delete()
    .eq("role_id", roleId);

  if (rfErr) throw new Error(rfErr.message);

  const { error: dErr } = await supabase
    .from("company_roles")
    .delete()
    .eq("id", roleId)
    .eq("company_id", companyId);

  if (dErr) throw new Error(dErr.message);
}
