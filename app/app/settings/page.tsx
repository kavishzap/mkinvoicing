"use client";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
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

type CompanyFieldErrors = Partial<
  Record<keyof ActiveCompanySettings, string>
>;

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

  // validation errors
  const [errors, setErrors] = useState<CompanyFieldErrors>({});

  const [settingsTab, setSettingsTab] = useState("profile");

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

  const requiredCompanyFields = useMemo(
    () =>
      [
        "name",
        "brn",
        "email",
        "phone",
        "address_line_1",
      ] as const satisfies readonly (keyof ActiveCompanySettings)[],
    []
  );

  const validateCompany = (): boolean => {
    const next: CompanyFieldErrors = {};
    const isEmpty = (v?: string) => !v || v.trim() === "";

    for (const field of requiredCompanyFields) {
      if (isEmpty(company[field])) {
        next[field] = "Required";
      }
    }

    if (company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) {
      next.email = "Invalid email";
    }
    if (
      company.billing_contact_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.billing_contact_email)
    ) {
      next.billing_contact_email = "Invalid email";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
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
    if (!validateCompany()) {
      toast({
        title: "Missing fields",
        description: "Please fill all required fields.",
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

  const err = (k: keyof ActiveCompanySettings) =>
    errors[k] ? "border-destructive" : "";

  return (
    <AppPageShell
      compact
      className="max-w-5xl"
      subtitle="Update how your business shows on documents, default invoice behaviour, and who can do what."
      actions={
        settingsTab === "profile" ? (
          <Button
            onClick={handleSaveCompany}
            size="sm"
            disabled={savingProfile || noActiveCompany}
          >
            {savingProfile ? "Saving..." : "Save company"}
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
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
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
            <>
              {subscription ? (
                <Card className="gap-4 py-4">
                  <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>
                      Plan and billing window from your company and linked
                      plan (read-only).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Company code
                      </p>
                      <p className="font-mono text-sm">{subscription.company_code}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Company status
                      </p>
                      <p className="text-sm">
                        {subscription.company_is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Trial
                      </p>
                      <p className="text-sm">
                        {subscription.is_trial === null
                          ? "—"
                          : subscription.is_trial
                            ? "Yes"
                            : "No"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        User seats (effective)
                      </p>
                      <p className="text-sm">
                        {subscription.max_users_override != null
                          ? subscription.max_users_override
                          : subscription.plan_max_users}{" "}
                        <span className="text-muted-foreground">
                          {subscription.max_users_override != null
                            ? "(override)"
                            : "(plan limit)"}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Plan
                      </p>
                      <p className="text-sm font-medium">{subscription.plan_name}</p>
                      {subscription.plan_description ? (
                        <p className="text-xs text-muted-foreground">
                          {subscription.plan_description}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Plan ID:{" "}
                        <span className="font-mono">{subscription.plan_id}</span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Billing cycle
                      </p>
                      <p className="text-sm capitalize">
                        {subscription.plan_billing_cycle}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Plan price
                      </p>
                      <p className="text-sm">
                        {formatPlanPrice(
                          subscription.plan_price,
                          subscription.plan_currency
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Subscription start
                      </p>
                      <p className="text-sm">
                        {formatSubscriptionDate(
                          subscription.subscription_start_date
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Subscription end
                      </p>
                      <p className="text-sm">
                        {formatSubscriptionDate(
                          subscription.subscription_end_date
                        )}
                      </p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Plan catalog
                      </p>
                      <p className="text-sm">
                        {subscription.plan_catalog_active
                          ? "This plan is currently offered"
                          : "This plan is not active in the catalog"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="gap-4 py-4">
                <CardHeader>
                  <CardTitle>Company</CardTitle>
                  <CardDescription>
                    Fields map to the active company record (shown on
                    invoices).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="co-name">Company name *</Label>
                    <Input
                      id="co-name"
                      value={company.name}
                      onChange={(e) =>
                        setCompany({ ...company, name: e.target.value })
                      }
                      placeholder="Acme Corporation"
                      className={err("name")}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="co-logo-file">Company logo</Label>
                    <p className="text-xs text-muted-foreground">
                      Upload replaces the public URL stored in{" "}
                      <span className="font-mono text-foreground">
                        company_logo_url
                      </span>{" "}
                      on save.
                    </p>
                    <div className="flex items-start gap-4">
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
                      <div className="flex-1 space-y-2">
                        <Input
                          ref={fileInputRef}
                          id="co-logo-file"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            setLogoFile(f);
                            if (f) setLogoPreview(URL.createObjectURL(f));
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Max ~5MB recommended. Current URL is saved on the
                          company after you click Save company.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="co-brn">Registration (BRN) *</Label>
                    <Input
                      id="co-brn"
                      value={company.brn}
                      onChange={(e) =>
                        setCompany({ ...company, brn: e.target.value })
                      }
                      placeholder="123456789"
                      className={err("brn")}
                    />
                    {errors.brn && (
                      <p className="text-xs text-destructive">{errors.brn}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="co-vat">VAT number</Label>
                    <Input
                      id="co-vat"
                      value={company.vat_number}
                      onChange={(e) =>
                        setCompany({ ...company, vat_number: e.target.value })
                      }
                      placeholder="VAT123456789"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-4 py-4">
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
                      onChange={(e) =>
                        setCompany({
                          ...company,
                          billing_contact_name: e.target.value,
                        })
                      }
                      placeholder="Contact name"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="co-bill-email">Email</Label>
                      <Input
                        id="co-bill-email"
                        type="email"
                        value={company.billing_contact_email}
                        onChange={(e) =>
                          setCompany({
                            ...company,
                            billing_contact_email: e.target.value,
                          })
                        }
                        placeholder="billing@example.com"
                        className={err("billing_contact_email")}
                      />
                      {errors.billing_contact_email && (
                        <p className="text-xs text-destructive">
                          {errors.billing_contact_email}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="co-bill-phone">Phone</Label>
                      <Input
                        id="co-bill-phone"
                        value={company.billing_contact_phone}
                        onChange={(e) =>
                          setCompany({
                            ...company,
                            billing_contact_phone: e.target.value,
                          })
                        }
                        placeholder="+230 …"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-4 py-4">
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
                        onChange={(e) =>
                          setCompany({ ...company, email: e.target.value })
                        }
                        placeholder="hello@example.com"
                        className={err("email")}
                      />
                      {errors.email && (
                        <p className="text-xs text-destructive">
                          {errors.email}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="co-phone">Phone *</Label>
                      <Input
                        id="co-phone"
                        value={company.phone}
                        onChange={(e) =>
                          setCompany({ ...company, phone: e.target.value })
                        }
                        placeholder="+230 5xx xx xx"
                        className={err("phone")}
                      />
                      {errors.phone && (
                        <p className="text-xs text-destructive">
                          {errors.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-4 py-4">
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
                      onChange={(e) =>
                        setCompany({
                          ...company,
                          address_line_1: e.target.value,
                        })
                      }
                      placeholder="e.g. 123 Business Street, Port Louis"
                      className={err("address_line_1")}
                    />
                    {errors.address_line_1 && (
                      <p className="text-xs text-destructive">
                        {errors.address_line_1}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="co-addr2">Address line 2 (optional)</Label>
                    <Input
                      id="co-addr2"
                      value={company.address_line_2}
                      onChange={(e) =>
                        setCompany({
                          ...company,
                          address_line_2: e.target.value,
                        })
                      }
                      placeholder="Suite, building, etc."
                      className={err("address_line_2")}
                    />
                    {errors.address_line_2 && (
                      <p className="text-xs text-destructive">
                        {errors.address_line_2}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="co-city">City</Label>
                      <Input
                        id="co-city"
                        value={company.city}
                        onChange={(e) =>
                          setCompany({ ...company, city: e.target.value })
                        }
                        placeholder="City"
                        className={err("city")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="co-country">Country</Label>
                      <Input
                        id="co-country"
                        value={company.country}
                        onChange={(e) =>
                          setCompany({ ...company, country: e.target.value })
                        }
                        placeholder="Country"
                        className={err("country")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ========= PREFERENCES TAB ========= */}
        <TabsContent value="preferences" className="space-y-4">
          <Card className="gap-4 py-4">
            <CardHeader>
              <CardTitle>Currency & Format</CardTitle>
              <CardDescription>
                Set your default currency and date format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={preferences.currency}
                    onValueChange={(v) =>
                      setPreferences({ ...preferences, currency: v })
                    }
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="MUR">MUR - Mauritian Rupee</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="AUD">
                        AUD - Australian Dollar
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Numbering - Commented out for later use */}
          {/* <Card>
            <CardHeader>
              <CardTitle>Invoice Numbering</CardTitle>
              <CardDescription>
                Configure how your invoices are numbered
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numberPrefix">Prefix</Label>
                  <Input
                    id="numberPrefix"
                    value={preferences.numberPrefix}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        numberPrefix: e.target.value,
                      })
                    }
                    placeholder="INV"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberPadding">Padding</Label>
                  <Select
                    value={preferences.numberPadding.toString()}
                    onValueChange={(v) =>
                      setPreferences({
                        ...preferences,
                        numberPadding: Number(v),
                      })
                    }
                  >
                    <SelectTrigger id="numberPadding">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 digits (001)</SelectItem>
                      <SelectItem value="4">4 digits (0001)</SelectItem>
                      <SelectItem value="5">5 digits (00001)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Preview:</p>
                <p className="text-base font-semibold mt-1">
                  {preferences.numberPrefix}-
                  {preferences.nextNumber
                    .toString()
                    .padStart(preferences.numberPadding, "0")}
                </p>
              </div>
            </CardContent>
          </Card> */}

          <Card className="gap-4 py-4">
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
              <CardDescription>
                Default payment terms for new invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Default Payment Terms</Label>
                <Select
                  value={preferences.paymentTerms.toString()}
                  onValueChange={(v) =>
                    setPreferences({ ...preferences, paymentTerms: Number(v) })
                  }
                >
                  <SelectTrigger id="paymentTerms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Net 7 (Due in 7 days)</SelectItem>
                    <SelectItem value="14">Net 14 (Due in 14 days)</SelectItem>
                    <SelectItem value="30">Net 30 (Due in 30 days)</SelectItem>
                    <SelectItem value="60">Net 60 (Due in 60 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

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
