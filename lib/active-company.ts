import { supabase } from "@/lib/supabaseClient";
import { isUserSystemAdmin } from "@/lib/user-system-role";

const SESSION_KEY = "mkinv:active_company_id";
const SESSION_USER_KEY = "mkinv:active_company_user_id";

let cachedCompanyId: string | null = null;
let cachedUserId: string | null = null;
let inFlight: Promise<string | null> | null = null;

function readSessionCache(): { companyId: string | null; userId: string | null } {
  if (typeof window === "undefined") return { companyId: null, userId: null };
  try {
    return {
      companyId: window.sessionStorage.getItem(SESSION_KEY),
      userId: window.sessionStorage.getItem(SESSION_USER_KEY),
    };
  } catch {
    return { companyId: null, userId: null };
  }
}

function writeSessionCache(userId: string, companyId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (companyId) {
      window.sessionStorage.setItem(SESSION_KEY, companyId);
      window.sessionStorage.setItem(SESSION_USER_KEY, userId);
    } else {
      window.sessionStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_USER_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function normalizeCompanyCode(code: string): string {
  return code.trim().toLowerCase();
}

/** Escape `%` / `_` / `\` so `ilike` is treated as exact match, not a pattern. */
function escapeIlikeExact(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * After password auth, resolves the company for this code:
 * - **System admins** (`user_profiles.system_role === "admin"`): any active
 *   company with a matching `company_code` (no `company_users` row required).
 * - **Everyone else**: active `company_users` membership for that code, or
 *   owns the company (`companies.owner_user_id`).
 */
export async function resolveCompanyIdForLogin(
  userId: string,
  companyCodeRaw: string
): Promise<{ companyId: string } | { error: string }> {
  const target = normalizeCompanyCode(companyCodeRaw);
  if (!target) {
    return { error: "Company code is required." };
  }

  if (await isUserSystemAdmin(userId)) {
    const trimmed = companyCodeRaw.trim();
    const { data: adminMatches, error: adminErr } = await supabase
      .from("companies")
      .select("id, company_code")
      .eq("is_active", true)
      .ilike("company_code", escapeIlikeExact(trimmed));

    if (adminErr) {
      return {
        error: adminErr.message || "Could not look up company for admin login.",
      };
    }
    const rows = adminMatches ?? [];
    const hits = rows.filter(
      (r) => normalizeCompanyCode(r.company_code as string) === target
    );
    if (hits.length === 1) {
      return { companyId: hits[0].id as string };
    }
    if (hits.length > 1) {
      return {
        error:
          "Multiple companies matched this code. Ask a database admin to fix duplicate company codes.",
      };
    }
    return {
      error:
        "Invalid company code, or that company is inactive. Check the code and try again.",
    };
  }

  const { data: memberships, error: memErr } = await supabase
    .from("company_users")
    .select(
      `
      company_id,
      companies!inner ( company_code, is_active )
    `
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (memErr) {
    return { error: memErr.message || "Could not verify company membership." };
  }

  for (const row of memberships ?? []) {
    const c = row.companies;
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const co = c as { company_code: string; is_active: boolean };
      if (co.is_active && normalizeCompanyCode(co.company_code) === target) {
        return { companyId: row.company_id as string };
      }
    }
  }

  const { data: owned, error: ownErr } = await supabase
    .from("companies")
    .select("id, company_code")
    .eq("owner_user_id", userId)
    .eq("is_active", true);

  if (ownErr) {
    return { error: ownErr.message || "Could not verify company." };
  }

  for (const row of owned ?? []) {
    if (normalizeCompanyCode(row.company_code) === target) {
      return { companyId: row.id as string };
    }
  }

  return {
    error:
      "Invalid company code or your account is not assigned to this company. Check with your administrator.",
  };
}

/** Sets the active company for this browser session (call after successful login validation). */
export function setActiveCompanyCache(userId: string, companyId: string): void {
  cachedUserId = userId;
  cachedCompanyId = companyId;
  writeSessionCache(userId, companyId);
}

/** Clears the cached active company (call on login/logout/switch). */
export function clearActiveCompanyCache(): void {
  cachedCompanyId = null;
  cachedUserId = null;
  inFlight = null;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_USER_KEY);
    } catch {
      // ignore storage errors
    }
  }
}

async function resolveActiveCompanyId(): Promise<string | null> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user?.id) return null;
  const userId = auth.user.id;

  // Cache invalidates if the logged-in user changed
  if (cachedUserId && cachedUserId !== userId) {
    cachedCompanyId = null;
  }
  const session = readSessionCache();
  if (session.userId === userId && session.companyId) {
    cachedCompanyId = session.companyId;
    cachedUserId = userId;
    return session.companyId;
  }

  const { data: membership } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  let companyId: string | null = (membership?.company_id as string | undefined) ?? null;

  if (!companyId) {
    const { data: owned } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    companyId = (owned?.id as string | undefined) ?? null;
  }

  cachedUserId = userId;
  cachedCompanyId = companyId;
  writeSessionCache(userId, companyId);
  return companyId;
}

/**
 * Resolves the current user's primary company for multi-tenant tables.
 * Uses session cache from login (`setActiveCompanyCache`), else first active
 * `company_users` row, else first owned `companies` row. System admins rely on
 * login with a company code so the session cache is set.
 */
export async function getActiveCompanyId(): Promise<string | null> {
  if (cachedCompanyId) return cachedCompanyId;
  if (inFlight) return inFlight;
  inFlight = resolveActiveCompanyId().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Like `getActiveCompanyId` but throws a friendly error when the user has no
 * accessible company. Use this in services that cannot operate without one.
 */
export async function requireActiveCompanyId(): Promise<string> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No company found for this account. Please contact your administrator to be assigned to a company."
    );
  }
  return companyId;
}
