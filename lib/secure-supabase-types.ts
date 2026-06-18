/** Request envelope sent inside the encrypted Supabase proxy body. */
export type SecureSupabaseRequest = {
  method: string;
  /** Path + query, e.g. /rest/v1/customers?select=* */
  path: string;
  headers: Record<string, string>;
  body: string | null;
};

/** Response envelope returned inside the encrypted proxy response. */
export type SecureSupabaseResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
};

export const SECURE_PROXY_PATH = "/api/secure/supabase-proxy";

/** Headers forwarded to Supabase (lowercase keys). */
export const FORWARDED_HEADER_NAMES = [
  "authorization",
  "apikey",
  "content-type",
  "accept",
  "accept-profile",
  "content-profile",
  "prefer",
  "range",
  "x-client-info",
] as const;

export function pickForwardHeaders(source: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of FORWARDED_HEADER_NAMES) {
    const value = source.get(name);
    if (value) out[name] = value;
  }
  return out;
}

export function isSecureApiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENCRYPT_API !== "false";
}
