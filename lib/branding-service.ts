import { fetchProfile } from "@/lib/settings-service";

/** Branding fields used by PDF exports and document print views. */
export type DocumentBranding = {
  logoUrl?: string;
  brandColor?: string;
  companyName?: string;
  address1?: string;
  address2?: string;
  website?: string;
  phone?: string;
  email?: string;
};

const DEFAULT_BRAND_COLOR = "#0F172A";

/** Loads branding from the active company profile (no extra HTTP round-trip). */
export async function fetchDocumentBranding(): Promise<
  DocumentBranding | undefined
> {
  try {
    const profile = await fetchProfile();
    return {
      logoUrl: profile.logoUrl || undefined,
      brandColor: DEFAULT_BRAND_COLOR,
      companyName: profile.companyName || profile.fullName || undefined,
      address1: profile.address_line_1 || profile.street || undefined,
      address2: profile.address_line_2 || undefined,
      phone: profile.phone || undefined,
      email: profile.email || undefined,
      website: undefined,
    };
  } catch {
    return undefined;
  }
}
