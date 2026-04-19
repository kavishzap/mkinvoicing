import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { RoleFeatureResult } from "@/lib/role-features-service";

/**
 * Dev-only structured logs after a successful login (auth user, profile, company membership, role, features).
 * Does not log tokens or passwords.
 */
function shouldLogLoginDebug(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.NEXT_PUBLIC_DEBUG_LOGIN === "true";
}

export async function logLoginSessionDebug(
  user: User,
  companyId: string,
  roleFeatures: RoleFeatureResult
): Promise<void> {
  if (!shouldLogLoginDebug()) return;

  const authSummary = {
    id: user.id,
    email: user.email,
    phone: user.phone,
    aud: user.aud,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
  };

  console.log("[MoLedger login] auth user", authSummary);

  try {
    const { data: userProfile, error: upErr } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (upErr) {
      console.warn("[MoLedger login] user_profiles query", upErr.message);
    } else {
      console.log("[MoLedger login] user_profiles", userProfile);
    }
  } catch (e) {
    console.warn("[MoLedger login] user_profiles", e);
  }

  try {
    const { data: profileRow, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr) {
      console.warn("[MoLedger login] profiles query", pErr.message);
    } else {
      console.log("[MoLedger login] profiles (company profile / settings)", profileRow);
    }
  } catch (e) {
    console.warn("[MoLedger login] profiles", e);
  }

  try {
    const { data: cu, error: cuErr } = await supabase
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
        company_roles ( id, name, description, is_active, is_system, company_id ),
        companies ( id, name, company_code, is_active, owner_user_id )
      `
      )
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (cuErr) {
      console.warn("[MoLedger login] company_users query", cuErr.message);
    } else {
      console.log("[MoLedger login] company_users (+ role + company)", cu);
    }
  } catch (e) {
    console.warn("[MoLedger login] company_users", e);
  }

  console.log("[MoLedger login] role features (isOwner + feature list)", {
    isOwner: roleFeatures.isOwner,
    featureCount: roleFeatures.features.length,
    features: roleFeatures.features,
  });
}
