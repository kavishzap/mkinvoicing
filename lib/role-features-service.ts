import { supabase } from "@/lib/supabaseClient";

export type RoleFeature = {
  code: string;
  name: string;
  description: string | null;
};

export type RoleFeatureResult = {
  /** True when the user owns the company – grants access to every feature. */
  isOwner: boolean;
  features: RoleFeature[];
};

const SESSION_KEY = "mkinv:role_features";
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
    window.sessionStorage.removeItem(SESSION_USER_KEY);
    window.sessionStorage.removeItem(SESSION_COMPANY_KEY);
  } catch {
    /* ignore */
  }
}

type MembershipRow = {
  role_id: string | null;
  is_owner: boolean | null;
};

type RoleFeatureRow = {
  features: {
    code: string | null;
    name: string | null;
    description: string | null;
    is_active: boolean | null;
  } | null;
};

async function resolveRoleFeatures(
  userId: string,
  companyId: string
): Promise<RoleFeatureResult> {
  const { data: membership, error: memErr } = await supabase
    .from("company_users")
    .select("role_id, is_owner")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<MembershipRow>();

  if (memErr) {
    throw new Error(
      memErr.message || "Could not load your company membership."
    );
  }

  const isOwner = !!membership?.is_owner;

  if (isOwner) {
    const { data: allFeatures, error: allErr } = await supabase
      .from("features")
      .select("code, name, description")
      .eq("is_active", true);
    if (allErr) throw new Error(allErr.message);
    const features: RoleFeature[] = (allFeatures ?? []).map((f) => ({
      code: f.code,
      name: f.name,
      description: f.description,
    }));
    return { isOwner: true, features };
  }

  if (!membership?.role_id) {
    return { isOwner: false, features: [] };
  }

  const { data: rows, error } = await supabase
    .from("role_features")
    .select(
      `
      features!inner ( code, name, description, is_active )
    `
    )
    .eq("role_id", membership.role_id)
    .returns<RoleFeatureRow[]>();

  if (error) {
    throw new Error(error.message || "Could not load your role features.");
  }

  const features: RoleFeature[] = [];
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    const f = row.features;
    if (!f || !f.is_active || !f.code) continue;
    if (seen.has(f.code)) continue;
    seen.add(f.code);
    features.push({
      code: f.code,
      name: f.name ?? f.code,
      description: f.description,
    });
  }

  return { isOwner: false, features };
}

/**
 * Loads the feature set available to the user for this company.
 * Uses an in-memory + sessionStorage cache keyed by (userId, companyId).
 */
export async function getRoleFeatures(
  userId: string,
  companyId: string
): Promise<RoleFeatureResult> {
  if (
    cached &&
    cachedUserId === userId &&
    cachedCompanyId === companyId
  ) {
    return cached;
  }

  const session = readSessionCache(userId, companyId);
  if (session) {
    cached = session;
    cachedUserId = userId;
    cachedCompanyId = companyId;
    return session;
  }

  if (inFlight && cachedUserId === userId && cachedCompanyId === companyId) {
    return inFlight;
  }

  cachedUserId = userId;
  cachedCompanyId = companyId;
  inFlight = resolveRoleFeatures(userId, companyId)
    .then((result) => {
      cached = result;
      writeSessionCache(userId, companyId, result);
      return result;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
