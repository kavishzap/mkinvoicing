/**
 * Sanitizes `returnTo` query values so post-save redirects stay inside this app.
 */
export function safeAppReturnTo(
  raw: string | null | undefined,
  fallback = "/app/customers",
): string {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    const v = decodeURIComponent(raw.trim());
    if (v.startsWith("/app/") && !v.startsWith("//") && !v.includes("://")) {
      return v;
    }
  } catch {
    /* ignore malformed encoding */
  }
  return fallback;
}
