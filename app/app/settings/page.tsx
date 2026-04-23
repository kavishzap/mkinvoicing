"use client";
export const dynamic = "force-dynamic";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

import {
  emptyActiveCompanySettings,
  fetchActiveCompanySettings,
  fetchCompanySubscriptionDetails,
  updateActiveCompanySettings,
  fetchPreferences,
  upsertPreferences,
  type ActiveCompanySettings,
  type CompanySubscriptionDetails,
  type Preferences,
} from "@/lib/settings-service";
import { getActiveCompanyId } from "@/lib/active-company";
import { supabase } from "@/lib/supabaseClient";
import { CompanyRolesSettings } from "@/components/company-roles-settings";
import { AppPageShell } from "@/components/app-page-shell";

function formatSubscriptionDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatPlanPrice(amount: number, currency: string | null): string {
  const code = (currency || "USD").trim().toUpperCase();
  if (code.length === 3) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
      }).format(amount);
    } catch {
      // fall through
    }
  }
  return `${amount}${currency ? ` ${currency}` : ""}`;
}

export default function SettingsPage() {
  const { toast } = useToast();

  // flags
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [company, setCompany] = useState<ActiveCompanySettings>(
    emptyActiveCompanySettings()
  );
  const [subscription, setSubscription] =
    useState<CompanySubscriptionDetails | null>(null);
  const [noActiveCompany, setNoActiveCompany] = useState(false);

  const [preferences, setPreferences] = useState<Preferences>({
    currency: "MUR",
    numberPrefix: "INV",
    numberPadding: 4,
    nextNumber: 1,
    paymentTerms: 14,
    defaultNotes: "",
    defaultTerms: "",
  });

  // logo upload
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [settingsTab, setSettingsTab] = useState("profile");
  const [isLogoDragOver, setIsLogoDragOver] = useState(false);
  const hasSavedLogo = !!company.company_logo_url;
  const hasPendingLogo = !!logoFile;
  const logoActionLabel = hasSavedLogo ? "Update logo" : "Add logo";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "roles" || t === "profile" || t === "preferences") {
      setSettingsTab(t);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const prefs = await fetchPreferences();
        setPreferences(prefs);
        try {
          const co = await fetchActiveCompanySettings();
          setCompany(co);
          setLogoPreview(co.company_logo_url || null);
          setNoActiveCompany(false);
          try {
            setSubscription(await fetchCompanySubscriptionDetails());
          } catch {
            setSubscription(null);
          }
        } catch {
          setNoActiveCompany(true);
          setCompany(emptyActiveCompanySettings());
          setLogoPreview(null);
          setSubscription(null);
        }
      } catch (err: any) {
        toast({
          title: "Failed to load settings",
          description: err?.message ?? "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const handleLogoSelected = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please choose an image file for the company logo.",
        variant: "destructive",
      });
      return;
    }
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const uploadCompanyLogoIfNeeded = async (): Promise<string | null> => {
    if (!logoFile) return null;
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error("Not authenticated");

    const companyId = await getActiveCompanyId();
    if (!companyId) throw new Error("No active company");

    const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
    const objectPath = `logos/companies/${companyId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("public-assets")
      .upload(objectPath, logoFile, { upsert: true, cacheControl: "3600" });

    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage
      .from("public-assets")
      .getPublicUrl(objectPath);
    return urlData.publicUrl;
  };

  const handleSaveCompany = async () => {
    if (noActiveCompany) {
      toast({
        title: "No company selected",
        description: "Select an active company before saving.",
        variant: "destructive",
      });
      return;
    }
    if (!logoFile) {
      toast({
        title: "No logo selected",
        description: "Choose a logo file before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingProfile(true);

      let company_logo_url = company.company_logo_url;
      if (logoFile) {
        const url = await uploadCompanyLogoIfNeeded();
        if (url) {
          company_logo_url = url;
          setLogoPreview(url);
        }
      }

      await updateActiveCompanySettings({
        ...company,
        company_logo_url,
      });

      const [refreshed, sub] = await Promise.all([
        fetchActiveCompanySettings(),
        fetchCompanySubscriptionDetails().catch(() => null),
      ]);
      setCompany(refreshed);
      setLogoPreview(refreshed.company_logo_url || null);
      if (sub) setSubscription(sub);

      toast({
        title: "Company saved",
        description: "Your company record has been updated.",
      });
      setLogoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPrefs(true);
      await upsertPreferences(preferences);
      toast({
        title: "Preferences saved",
        description: "Your invoice preferences have been updated successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  // simple skeletons
  if (loading) {
    return (
      <AppPageShell compact className="max-w-5xl">
        <div>
          <div className="h-4 w-64 max-w-full bg-muted rounded animate-pulse" />
        </div>
        <div className="grid gap-4">
          <div className="h-56 bg-muted rounded animate-pulse" />
          <div className="h-56 bg-muted rounded animate-pulse" />
          <div className="h-56 bg-muted rounded animate-pulse" />
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      compact
      className="max-w-[1400px]"
      subtitle="Update how your business shows on documents, default invoice behaviour, and who can do what."
      actions={
        settingsTab === "profile" ? (
          <Button
            onClick={handleSaveCompany}
            size="sm"
            disabled={savingProfile || noActiveCompany || !logoFile}
          >
            {savingProfile ? "Saving..." : logoActionLabel}
          </Button>
        ) : settingsTab === "preferences" ? (
          <Button
            onClick={handleSavePreferences}
            size="sm"
            disabled={savingPrefs}
          >
            {savingPrefs ? "Saving..." : "Save Preferences"}
          </Button>
        ) : null
      }
    >
      <Tabs
        value={settingsTab}
        onValueChange={setSettingsTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full max-w-3xl grid-cols-3">
          <TabsTrigger value="profile">Company</TabsTrigger>
          <TabsTrigger value="preferences">Invoice Preferences</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        {/* ========= PROFILE TAB (active `companies` row only) ========= */}
        <TabsContent value="profile" className="space-y-4">
          {noActiveCompany ? (
            <Card className="gap-4 py-4">
              <CardHeader>
                <CardTitle>No active company</CardTitle>
                <CardDescription>
                  Sign in with your company code so an active company is set.
                  Company details on this tab are read and saved only on the
                  companies row.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {subscription ? (
                <Card className="gap-0 py-4 h-full flex flex-col min-h-0">
                  <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-base">Subscription</CardTitle>
                    <CardDescription className="text-xs leading-snug">
                      Plan and billing (read-only).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-0 flex-1">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Company code
                      </p>
                      <p className="font-mono text-xs break-all leading-snug">
                        {subscription.company_code}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Status
                      </p>
                      <p className="text-sm leading-snug">
                        {subscription.company_is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Trial
                      </p>
                      <p className="text-sm leading-snug">
                        {subscription.is_trial === null
                          ? "—"
                          : subscription.is_trial
                            ? "Yes"
                            : "No"}
                      </p>
                    </div>
                    <div className="space-y-0.5 sm:col-span-2 lg:col-span-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        User seats
                      </p>
                      <p className="text-sm leading-snug">
                        {subscription.max_users_override != null
                          ? subscription.max_users_override
                          : subscription.plan_max_users}{" "}
                        <span className="text-muted-foreground text-xs">
                          {subscription.max_users_override != null
                            ? "override"
                            : "plan limit"}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Plan
                      </p>
                      <p className="text-sm font-medium leading-snug">
                        {subscription.plan_name}
                      </p>
                      {subscription.plan_description ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                          {subscription.plan_description}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Billing cycle
                      </p>
                      <p className="text-sm capitalize leading-snug">
                        {subscription.plan_billing_cycle}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Plan price
                      </p>
                      <p className="text-sm leading-snug">
                        {formatPlanPrice(
                          subscription.plan_price,
                          subscription.plan_currency
                        )}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Start
                      </p>
                      <p className="text-sm leading-snug">
                        {formatSubscriptionDate(
                          subscription.subscription_start_date
                        )}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        End
                      </p>
                      <p className="text-sm leading-snug">
                        {formatSubscriptionDate(
                          subscription.subscription_end_date
                        )}
                      </p>
                    </div>
                    <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Catalog
                      </p>
                      <p className="text-sm leading-snug">
                        {subscription.plan_catalog_active
                          ? "Offered in catalog"
                          : "Not in active catalog"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card
                className={`gap-4 py-4 h-full ${subscription ? "" : "xl:col-span-2"}`}
              >
                <CardHeader>
                  <CardTitle>Company</CardTitle>
                  <CardDescription>
                    Company details are read-only here. Only the logo can be
                    updated.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="co-name">Company name *</Label>
                    <Input
                      id="co-name"
                      value={company.name}
                      placeholder="Acme Corporation"
                      disabled
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="co-logo-file">Company logo</Label>
                    <p className="text-xs text-muted-foreground">
                      Upload replaces the public URL stored in{" "}
                      <span className="font-mono text-foreground">
                        company_logo_url
                      </span>{" "}
                      on save.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {hasSavedLogo
                        ? hasPendingLogo
                          ? "New logo selected. Save to replace the current logo."
                          : "Current logo is shown below. Choose a file to replace it."
                        : hasPendingLogo
                          ? "Logo selected. Save to add it to your company profile."
                          : "No logo yet. Choose a file to add one."}
                    </p>
                    <div
                      className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
                        isLogoDragOver
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/30"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsLogoDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsLogoDragOver(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsLogoDragOver(false);
                        handleLogoSelected(e.dataTransfer.files?.[0] ?? null);
                      }}
                    >
                      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:text-left">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded border bg-muted">
                          {logoPreview ? (
                            <Image
                              src={logoPreview}
                              alt="Company logo preview"
                              width={80}
                              height={80}
                              className="object-contain"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No logo
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Drag and drop your logo here
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNG, JPG, or SVG recommended. Max ~5MB.
                          </p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {hasSavedLogo ? "Replace logo" : "Choose logo"}
                          </Button>
                        </div>
                      </div>
                      <Input
                        ref={fileInputRef}
                        id="co-logo-file"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          handleLogoSelected(e.target.files?.[0] ?? null);
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="co-brn">Registration (BRN) *</Label>
                    <Input
                      id="co-brn"
                      value={company.brn}
                      placeholder="123456789"
                      disabled
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="co-vat">VAT number</Label>
                    <Input
                      id="co-vat"
                      value={company.vat_number}
                      placeholder="VAT123456789"
                      disabled
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-4 py-4 h-full">
                <CardHeader>
                  <CardTitle>Billing contact</CardTitle>
                  <CardDescription>
                    Optional billing contact on the company record.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="co-bill-name">Name</Label>
                    <Input
                      id="co-bill-name"
                      value={company.billing_contact_name}
                      placeholder="Contact name"
                      disabled
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="co-bill-email">Email</Label>
                      <Input
                        id="co-bill-email"
                        type="email"
                        value={company.billing_contact_email}
                        placeholder="billing@example.com"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="co-bill-phone">Phone</Label>
                      <Input
                        id="co-bill-phone"
                        value={company.billing_contact_phone}
                        placeholder="+230 …"
                        disabled
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-4 py-4 h-full">
                <CardHeader>
                  <CardTitle>Contact</CardTitle>
                  <CardDescription>Company email and phone.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="co-email">Email *</Label>
                      <Input
                        id="co-email"
                        type="email"
                        value={company.email}
                        placeholder="hello@example.com"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="co-phone">Phone *</Label>
                      <Input
                        id="co-phone"
                        value={company.phone}
                        placeholder="+230 5xx xx xx"
                        disabled
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-4 py-4 xl:col-span-2">
                <CardHeader>
                  <CardTitle>Address</CardTitle>
                  <CardDescription>
                    Street lines, city, and country on the company record.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="co-addr1">Address line 1 *</Label>
                    <Input
                      id="co-addr1"
                      value={company.address_line_1}
                      placeholder="e.g. 123 Business Street, Port Louis"
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="co-addr2">Address line 2 (optional)</Label>
                    <Input
                      id="co-addr2"
                      value={company.address_line_2}
                      placeholder="Suite, building, etc."
                      disabled
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="co-city">City</Label>
                      <Input
                        id="co-city"
                        value={company.city}
                        placeholder="City"
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="co-country">Country</Label>
                      <Input
                        id="co-country"
                        value={company.country}
                        placeholder="Country"
                        disabled
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ========= PREFERENCES TAB ========= */}
        <TabsContent value="preferences" className="space-y-4">
          <Card className="gap-4 py-4">
            <CardHeader>
              <CardTitle>Default Notes & Terms</CardTitle>
              <CardDescription>
                These will be pre-filled when creating new invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defaultNotes">Default Notes</Label>
                <Textarea
                  id="defaultNotes"
                  value={preferences.defaultNotes}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      defaultNotes: e.target.value,
                    })
                  }
                  placeholder="Thank you for your business!"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultTerms">Default Terms & Conditions</Label>
                <Textarea
                  id="defaultTerms"
                  value={preferences.defaultTerms}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      defaultTerms: e.target.value,
                    })
                  }
                  placeholder="Payment is due within 14 days..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <CompanyRolesSettings />
        </TabsContent>
      </Tabs>
    </AppPageShell>
  );
}
