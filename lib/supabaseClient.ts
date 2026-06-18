import { createClient } from "@supabase/supabase-js";
import { createSecureSupabaseFetch } from "@/lib/secure-supabase-fetch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: createSecureSupabaseFetch(supabaseUrl, anonKey),
  },
});
