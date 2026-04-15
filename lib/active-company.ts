import { supabase } from "@/lib/supabaseClient";

/**
 * Resolves the current user's primary company for multi-tenant tables.
 * Prefers an active company_users membership, then an owned companies row.
 */
export async function getActiveCompanyId(): Promise<string | null> {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user?.id) return null;
  const userId = auth.user.id;

  const { data: membership } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membership?.company_id) return membership.company_id as string;

  const { data: owned } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return (owned?.id as string | undefined) ?? null;
}
