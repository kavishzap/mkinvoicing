import { supabase } from "@/lib/supabaseClient";
import { isUserSystemAdmin } from "@/lib/user-system-role";
import type { Database } from "@/src/types/supabase";

/** One row from `public.features` (matches `SELECT f.*` on the role join). */
export type RoleFeature = Database["public"]["Tables"]["features"]["Row"];

export type RoleFeatureResult = {
  /**
   * True when this user’s `company_users` row has `is_owner` for the company.
   * System admins get the owner’s feature list but `isOwner` stays false here.
   */
  isOwner: boolean;
  features: RoleFeature[];
};

/** Bumped when cached payload shape or source query changes (avoids stale feature lists). */
const SESSION_KEY = "mkinv:role_features_v5";
const SESSION_USER_KEY = "mkinv:role_features_user_id";
const SESSION_COMPANY_KEY = "mkinv:role_features_company_id";

let cachedUserId: string | null = null;
let cachedCompanyId: string | null = null;
let cached: RoleFeatureResult | null = null;
let inFlight: Promise<RoleFeatureResult> | null = null;

function readSessionCache(
  userId: string,
  companyId: string
): RoleFeatureResult | null {
  if (typeof window === "undefined") return null;
  try {
    const storedUser = window.sessionStorage.getItem(SESSION_USER_KEY);
    const storedCompany = window.sessionStorage.getItem(SESSION_COMPANY_KEY);
    if (storedUser !== userId || storedCompany !== companyId) return null;
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoleFeatureResult;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(
  userId: string,
  companyId: string,
  result: RoleFeatureResult
) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
    window.sessionStorage.setItem(SESSION_USER_KEY, userId);
    window.sessionStorage.setItem(SESSION_COMPANY_KEY, companyId);
  } catch {
    /* ignore */
  }
}

/** Clears the role-features cache (call on login/logout/switch). */
export function clearRoleFeaturesCache(): void {
  cachedUserId = null;
  cachedCompanyId = null;
  cached = null;
  inFlight = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem("mkinv:role_features_v4");
    window.sessionStorage.removeItem("mkinv:role_features_v3");
    window.sessionStorage.removeItem("mkinv:role_features");
    window.sessionStorage.removeItem(SESSION_USER_KEY);
    window.sessionStorage.removeItem(SESSION_COMPANY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * `company_users` → `company_roles` (same `company_id` as the membership) →
 * `role_features` → `features`.
 * `company_roles!inner` + `.eq("company_roles.company_id", tenantId)` ensures the
 * role row belongs to this tenant, not another company’s role on a bad `role_id`.
 */
const MEMBERSHIP_ROLE_FEATURES_SELECT = `
  is_owner,
  company_roles!inner (
    id,
    company_id,
    role_features (
      features!inner ( id, code, name, description, is_active, created_at )
    )
  )
`;

type CompanyUserRoleFeaturesRow = {
  is_owner: boolean | null;
  company_roles: {
    id: string;
    company_id: string;
    role_features: Array<{
      features: {
        id: string;
        code: string | null;
        name: string | null;
        description: string | null;
        is_active: boolean | null;
        created_at: string;
      } | null;
    }>;
  } | null;
};

/**
 * Equivalent to:
 * `cu` JOIN `role_features` ON `cu.role_id` = `rf.role_id`
 * JOIN `features` ON `rf.feature_id` = `f.id` WHERE `cu.user_id` / `cu.company_id` / `cu.is_active`.
 */
function roleFeaturesFromCompanyUserRow(
  row: CompanyUserRoleFeaturesRow
): RoleFeatureResult {
  const isOwner = !!row.is_owner;
  const cr = row.company_roles;
  const role = cr == null ? null : Array.isArray(cr) ? cr[0] : cr;
  const pairs = role?.role_features;
  const features: RoleFeature[] = [];
  const seen = new Set<string>();
  if (Array.isArray(pairs)) {
    for (const rf of pairs) {
      const f = rf?.features;
      if (!f?.id || !f.code || !f.is_active) continue;
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      features.push({
        id: f.id,
        code: f.code,
        name: f.name ?? f.code,
        description: f.description,
        is_active: f.is_active,
        created_at: f.created_at,
      });
    }
  }
  return { isOwner, features };
}

/**
 * Features from the **company owner’s** role for this tenant (`company_id`).
 * Same join as members, with `company_roles.company_id` matching `companyId`.
 */
async function loadCompanyOwnerRoleFeatures(
  companyId: string
): Promise<RoleFeature[]> {
  const { data: row, error } = await supabase
    .from("company_users")
    .select(MEMBERSHIP_ROLE_FEATURES_SELECT)
    .eq("company_id", companyId)
    .eq("is_owner", true)
    .eq("is_active", true)
    .eq("company_roles.company_id", companyId)
    .limit(1)
    .maybeSingle<CompanyUserRoleFeaturesRow>();

  if (error) {
    throw new Error(
      error.message || "Could not load the company owner’s role features."
    );
  }
  if (!row) {
    return [];
  }
  return roleFeaturesFromCompanyUserRow(row).features;
}

async function resolveRoleFeatures(
  userId: string,
  companyId: string
): Promise<RoleFeatureResult> {
  if (await isUserSystemAdmin(userId)) {
    const features = await loadCompanyOwnerRoleFeatures(companyId);
    return { isOwner: false, features };
  }

  const { data: row, error: memErr } = await supabase
    .from("company_users")
    .select(MEMBERSHIP_ROLE_FEATURES_SELECT)
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("company_roles.company_id", companyId)
    .limit(1)
    .maybeSingle<CompanyUserRoleFeaturesRow>();

  if (memErr) {
    throw new Error(
      memErr.message || "Could not load your company membership and features."
    );
  }

  if (!row) {
    return { isOwner: false, features: [] };
  }

  return roleFeaturesFromCompanyUserRow(row);
}

/**
 * Loads the feature set for this user and tenant (`companyId` = active company).
 * System admins receive the **company owner’s** `role_features` set (not every catalog feature).
 * Uses an in-memory + sessionStorage cache keyed by (userId, companyId).
 */
export async function getRoleFeatures(
  userId: string,
  companyId: string
): Promise<RoleFeatureResult> {
  const tenantId = companyId?.trim() ?? "";
  if (!tenantId) {
    return { isOwner: false, features: [] };
  }

  if (cached && cachedUserId === userId && cachedCompanyId === tenantId) {
    return cached;
  }

  const session = readSessionCache(userId, tenantId);
  if (session) {
    cached = session;
    cachedUserId = userId;
    cachedCompanyId = tenantId;
    return session;
  }

  if (inFlight && cachedUserId === userId && cachedCompanyId === tenantId) {
    return inFlight;
  }

  cachedUserId = userId;
  cachedCompanyId = tenantId;
  inFlight = resolveRoleFeatures(userId, tenantId)
    .then((result) => {
      cached = result;
      writeSessionCache(userId, tenantId, result);
      return result;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
