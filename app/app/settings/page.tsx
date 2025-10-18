"use client";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

import {
  fetchProfile,
  fetchPreferences,
  upsertProfile,
  upsertPreferences,
  type Profile,
  type Preferences,
} from "@/lib/settings-service";
import { supabase } from "@/lib/supabaseClient";

type FieldErrors = Partial<Record<
  | "companyName"
  | "registrationId"
  | "fullName"
  | "taxId"
  | "email"
  | "phone"
  | "street"
  | "city"
  | "postal"
  | "country"
, string>>;

export default function SettingsPage() {
  const { toast } = useToast();

  // flags
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // state (DB-backed)
  const [profile, setProfile] = useState<Profile>({
    accountType: "company",
    companyName: "",
    logoUrl: "",
    registrationId: "",
    fullName: "",
    taxId: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    postal: "",
    country: "",
  });

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
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    (async () => {
      try {
        const [p, prefs] = await Promise.all([fetchProfile(), fetchPreferences()]);
        setProfile(p);
        setPreferences(prefs);
        setLogoPreview(p.logoUrl || null);
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

  const requiredFields = useMemo(() => {
    return profile.accountType === "company"
      ? ["companyName", "registrationId", "email", "phone", "street", "city", "postal", "country"] as const
      : ["fullName", "taxId", "email", "phone", "street", "city", "postal", "country"] as const;
  }, [profile.accountType]);

  const validateProfile = (): boolean => {
    const next: FieldErrors = {};
    const isEmpty = (v?: string) => !v || v.trim() === "";

    for (const field of requiredFields) {
      if (isEmpty(profile[field])) {
        next[field] = "Required";
      }
    }

    // Basic email format check
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      next.email = "Invalid email";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const uploadLogoIfNeeded = async (): Promise<string | null> => {
    if (!logoFile) return null;
    // get user id
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error("Not authenticated");

    const userId = userData.user.id;
    const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
    const objectPath = `logos/${userId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("public-assets")
      .upload(objectPath, logoFile, { upsert: true, cacheControl: "3600" });

    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from("public-assets").getPublicUrl(objectPath);
    return urlData.publicUrl;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) {
      toast({
        title: "Missing fields",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingProfile(true);

      // upload logo if a file was chosen
      let logoUrlToSave = profile.logoUrl || null;
      if (logoFile) {
        const url = await uploadLogoIfNeeded();
        if (url) {
          logoUrlToSave = url;
          setLogoPreview(url);
        }
      }

      await upsertProfile({
        ...profile,
        logoUrl: logoUrlToSave || "",
      });

      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully.",
      });
      // clear file state after successful save
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
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <div className="h-7 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded mt-2 animate-pulse" />
        </div>
        <div className="grid gap-6">
          <div className="h-56 bg-muted rounded animate-pulse" />
          <div className="h-56 bg-muted rounded animate-pulse" />
          <div className="h-56 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const err = (k: keyof FieldErrors) => errors[k] ? "border-destructive" : "";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and invoice preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Invoice Preferences</TabsTrigger>
        </TabsList>

        {/* ========= PROFILE TAB ========= */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Type</CardTitle>
              <CardDescription>Choose whether you're invoicing as a company or individual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={profile.accountType === "company" ? "default" : "outline"}
                  onClick={() => setProfile({ ...profile, accountType: "company" })}
                  className="flex-1"
                >
                  Company
                </Button>
                <Button
                  variant={profile.accountType === "individual" ? "default" : "outline"}
                  onClick={() => setProfile({ ...profile, accountType: "individual" })}
                  className="flex-1"
                >
                  Individual
                </Button>
              </div>
            </CardContent>
          </Card>

          {profile.accountType === "company" ? (
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>This information will appear on your invoices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={profile.companyName}
                    onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                    placeholder="Acme Corporation"
                    className={err("companyName")}
                  />
                  {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Logo (PNG/JPG/SVG)</Label>
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded border bg-muted overflow-hidden flex items-center justify-center">
                      {logoPreview ? (
                        <Image src={logoPreview} alt="Logo preview" width={80} height={80} className="object-contain" />
                      ) : (
                        <span className="text-xs text-muted-foreground">No logo</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setLogoFile(f);
                          if (f) setLogoPreview(URL.createObjectURL(f));
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your file will upload on save. Max ~5MB recommended.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registrationId">Registration / Tax ID *</Label>
                  <Input
                    id="registrationId"
                    value={profile.registrationId}
                    onChange={(e) => setProfile({ ...profile, registrationId: e.target.value })}
                    placeholder="123456789"
                    className={err("registrationId")}
                  />
                  {errors.registrationId && <p className="text-xs text-destructive">{errors.registrationId}</p>}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>This information will appear on your invoices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    placeholder="John Doe"
                    className={err("fullName")}
                  />
                  {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxId">NIC *</Label>
                  <Input
                    id="taxId"
                    value={profile.taxId}
                    onChange={(e) => setProfile({ ...profile, taxId: e.target.value })}
                    placeholder="123456789"
                    className={err("taxId")}
                  />
                  {errors.taxId && <p className="text-xs text-destructive">{errors.taxId}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Logo (PNG/JPG/SVG)</Label>
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded border bg-muted overflow-hidden flex items-center justify-center">
                      {logoPreview ? (
                        <Image src={logoPreview} alt="Logo preview" width={80} height={80} className="object-contain" />
                      ) : (
                        <span className="text-xs text-muted-foreground">No logo</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setLogoFile(f);
                          if (f) setLogoPreview(URL.createObjectURL(f));
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your file will upload on save. Max ~5MB recommended.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>How clients can reach you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    placeholder="hello@example.com"
                    className={err("email")}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+230 5xx xx xx"
                    className={err("phone")}
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
              <CardDescription>Your business or personal address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="street">Street Address *</Label>
                <Input
                  id="street"
                  value={profile.street}
                  onChange={(e) => setProfile({ ...profile, street: e.target.value })}
                  placeholder="123 Business Street"
                  className={err("street")}
                />
                {errors.street && <p className="text-xs text-destructive">{errors.street}</p>}
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={profile.city}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    placeholder="Port Louis"
                    className={err("city")}
                  />
                  {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal">Postal Code *</Label>
                  <Input
                    id="postal"
                    value={profile.postal}
                    onChange={(e) => setProfile({ ...profile, postal: e.target.value })}
                    placeholder="742CU001"
                    className={err("postal")}
                  />
                  {errors.postal && <p className="text-xs text-destructive">{errors.postal}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    value={profile.country}
                    onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                    placeholder="Mauritius"
                    className={err("country")}
                  />
                  {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} size="lg" disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </TabsContent>

        {/* ========= PREFERENCES TAB ========= */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Currency & Format</CardTitle>
              <CardDescription>Set your default currency and date format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={preferences.currency}
                    onValueChange={(v) => setPreferences({ ...preferences, currency: v })}
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
                      <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice Numbering</CardTitle>
              <CardDescription>Configure how your invoices are numbered</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numberPrefix">Prefix</Label>
                  <Input
                    id="numberPrefix"
                    value={preferences.numberPrefix}
                    onChange={(e) => setPreferences({ ...preferences, numberPrefix: e.target.value })}
                    placeholder="INV"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberPadding">Padding</Label>
                  <Select
                    value={preferences.numberPadding.toString()}
                    onValueChange={(v) => setPreferences({ ...preferences, numberPadding: Number(v) })}
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
                <p className="text-lg font-semibold mt-1">
                  {preferences.numberPrefix}-{preferences.nextNumber.toString().padStart(preferences.numberPadding, "0")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
              <CardDescription>Default payment terms for new invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Default Payment Terms</Label>
                <Select
                  value={preferences.paymentTerms.toString()}
                  onValueChange={(v) => setPreferences({ ...preferences, paymentTerms: Number(v) })}
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

          <Card>
            <CardHeader>
              <CardTitle>Default Notes & Terms</CardTitle>
              <CardDescription>These will be pre-filled when creating new invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defaultNotes">Default Notes</Label>
                <Textarea
                  id="defaultNotes"
                  value={preferences.defaultNotes}
                  onChange={(e) => setPreferences({ ...preferences, defaultNotes: e.target.value })}
                  placeholder="Thank you for your business!"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultTerms">Default Terms & Conditions</Label>
                <Textarea
                  id="defaultTerms"
                  value={preferences.defaultTerms}
                  onChange={(e) => setPreferences({ ...preferences, defaultTerms: e.target.value })}
                  placeholder="Payment is due within 14 days..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSavePreferences} size="lg" disabled={savingPrefs}>
              {savingPrefs ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
