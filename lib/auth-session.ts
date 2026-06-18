import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

let cachedUser: User | null = null;
let cachedAt = 0;
let inFlight: Promise<User | null> | null = null;

const USER_CACHE_MS = 60_000;

/** Clears the in-memory auth user cache (call on sign-out). */
export function clearAuthSessionCache(): void {
  cachedUser = null;
  cachedAt = 0;
  inFlight = null;
}

/**
 * Returns the signed-in user, preferring the local session (no network) and
 * deduplicating concurrent callers. Falls back to `getUser()` when needed.
 */
export async function getSessionUser(options?: {
  force?: boolean;
}): Promise<User | null> {
  if (
    !options?.force &&
    cachedUser &&
    Date.now() - cachedAt < USER_CACHE_MS
  ) {
    return cachedUser;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      cachedUser = session.user;
      cachedAt = Date.now();
      return session.user;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      cachedUser = null;
      cachedAt = Date.now();
      return null;
    }

    cachedUser = user;
    cachedAt = Date.now();
    return user;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
