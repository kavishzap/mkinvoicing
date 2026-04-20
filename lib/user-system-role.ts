import { supabase } from "./supabaseClient";

/** Active `user_profiles.system_role` for the auth user, or null if missing/inactive. */
export async function getUserSystemRole(
  userId: string
): Promise<"admin" | "owner" | "member" | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("system_role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || !data.is_active) return null;
  const r = data.system_role as string;
  if (r === "admin" || r === "owner" || r === "member") return r;
  return null;
}

export async function isUserSystemAdmin(userId: string): Promise<boolean> {
  return (await getUserSystemRole(userId)) === "admin";
}
