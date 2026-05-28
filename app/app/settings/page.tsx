"use client";
import { SettingsTwoColumnSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  BadgePercent,
  Building2,
  Mail,
  MapPinned,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
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
import {
  assertCompanyLogoFileSize,
  fileToImageDataUrl,
  MAX_COMPANY_LOGO_BYTES,
} from "@/lib/company-logo-data-url";
import { CompanyRolesSettings } from "@/components/company-roles-settings";
import { AppPageShell } from "@/components/app-page-shell";
import { useAppAccount } from "@/contexts/app-account-context";
import { cn } from "@/lib/utils";

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";
const readOnlyInputClass =
  "h-8 bg-muted/40 text-xs text-foreground disabled:cursor-default disabled:opacity-100";

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col gap-0 rounded-lg border bg-card py-0 shadow-sm",
        className,
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="field-controls flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 [&_input]:h-8 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs">
        {children}
      </CardContent>
    </Card>
  );
}

function CompanyLogoField({
  logoPreview,
  isLogoDragOver,
  fileInputRef,
  hasSavedLogo,
  hasPendingLogo,
  maxKb,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  onChooseClick,
}: {
  logoPreview: string | null;
  isLogoDragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  hasSavedLogo: boolean;
  hasPendingLogo: boolean;
  maxKb: number;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChooseClick: () => void;
}) {
  const hint = hasSavedLogo
    ? hasPendingLogo
      ? "New file selected — save to update."
      : "Replace by dropping an image or browsing."
    : hasPendingLogo
      ? "Save to add this logo to your company."
      : "PNG, JPG, or WebP · max " + maxKb + " KB";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Label className={fieldLabelClass}>Company logo</Label>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose company logo file"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChooseClick();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onChooseClick}
        className={cn(
          "flex min-h-[26rem] flex-1 cursor-pointer flex-col items-center justify-between gap-8 rounded-xl border border-dashed px-5 py-10 transition-colors sm:min-h-[28rem] sm:px-8 sm:py-12",
          isLogoDragOver
            ? "border-primary bg-primary/5"
            : "border-neutral-300 bg-neutral-50/60 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900/40 dark:hover:border-neutral-500",
        )}
      >
        <div className="flex w-full flex-1 flex-col items-center justify-center px-2">
          <div className="relative flex aspect-square w-full max-w-[min(100%,16rem)] items-center justify-center rounded-xl border border-neutral-200 bg-background shadow-sm sm:max-w-[min(100%,20rem)] md:max-w-[min(100%,22rem)] dark:border-neutral-700">
            {logoPreview ? (
              <Image
                src={logoPreview}
                alt="Company logo preview"
                width={352}
                height={352}
                className="max-h-[92%] max-w-[92%] object-contain"
              />
            ) : (
              <Upload
                className="h-14 w-14 text-muted-foreground sm:h-16 sm:w-16"
                aria-hidden
              />
            )}
          </div>
        </div>
        <div className="w-full max-w-md shrink-0 space-y-2 px-2 text-center">
          <p className="text-sm font-medium text-foreground">
            Drop your logo here
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        </div>
      </div>
      <p className="shrink-0 text-xs leading-relaxed text-muted-foreground">
        Saves when you use <span className="font-medium text-foreground">Add logo</span>{" "}
        or <span className="font-medium text-foreground">Update logo</span> in the header
        (max {maxKb}&nbsp;KB). The sidebar updates after a successful save.
      </p>
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onFileChange}
        onClick={(e) => {
          (e.target as HTMLInputElement).value = "";
        }}
      />
    </div>
  );
}

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
  const router = useRouter();
  const { refreshAccount } = useAppAccount();

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
  /** Revoked when replaced, after save, or on unmount (object URLs from file pick). */
  const logoObjectUrlRef = useRef<string | null>(null);

  const revokeLogoObjectUrl = () => {
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }
  };

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
    let cancelled = false;
    (async () => {
      try {
        const [prefsResult, companyResult, subResult] = await Promise.allSettled([
          fetchPreferences(),
          fetchActiveCompanySettings(),
          fetchCompanySubscriptionDetails(),
        ]);
        if (cancelled) return;

        if (prefsResult.status === "fulfilled") {
          setPreferences(prefsResult.value);
        } else {
          const msg =
            prefsResult.reason instanceof Error
              ? prefsResult.reason.message
              : "Please try again.";
          toast({
            title: "Failed to load preferences",
            description: msg,
            variant: "destructive",
          });
        }

        if (companyResult.status === "fulfilled") {
          const co = companyResult.value;
          setCompany(co);
          setLogoPreview(co.company_logo_url || null);
          setNoActiveCompany(false);
        } else {
          setNoActiveCompany(true);
          setCompany(emptyActiveCompanySettings());
          setLogoPreview(null);
        }

        if (subResult.status === "fulfilled") {
          setSubscription(subResult.value);
        } else {
          setSubscription(null);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Please try again.";
        toast({
          title: "Failed to load settings",
          description: msg,
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => () => revokeLogoObjectUrl(), []);

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
    try {
      assertCompanyLogoFileSize(f);
    } catch (e) {
      toast({
        title: "Image too large",
        description:
          e instanceof Error
            ? e.message
            : `Use an image up to ${MAX_COMPANY_LOGO_BYTES / 1024} KB.`,
        variant: "destructive",
      });
      return;
    }
    revokeLogoObjectUrl();
    const next = URL.createObjectURL(f);
    logoObjectUrlRef.current = next;
    setLogoFile(f);
    setLogoPreview(next);
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

      assertCompanyLogoFileSize(logoFile);
      const company_logo_url = await fileToImageDataUrl(logoFile);
      revokeLogoObjectUrl();
      setLogoPreview(company_logo_url);

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

      await refreshAccount();

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

  function handleSettingsTabChange(next: string) {
    setSettingsTab(next);
    router.replace(`/app/settings?tab=${next}`, { scroll: false });
  }

  // simple skeletons
  if (loading) {
    return (
      <AppPageShell
        fillHeight
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      >
        <SettingsTwoColumnSkeleton className="flex-1" />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      subtitle="Update how your business shows on documents, default invoice behaviour, and who can do what."
      actions={
        settingsTab === "profile" ? (
          <Button
            onClick={handleSaveCompany}
            disabled={savingProfile || noActiveCompany || !logoFile}
            className="gap-2 rounded-md font-semibold shadow-sm"
          >
            {savingProfile ? "Saving..." : logoActionLabel}
          </Button>
        ) : settingsTab === "preferences" ? (
          <Button
            onClick={handleSavePreferences}
            disabled={savingPrefs || noActiveCompany}
            className="gap-2 rounded-md font-semibold shadow-sm"
          >
            {savingPrefs ? "Saving..." : "Save preferences"}
          </Button>
        ) : null
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <Tabs
          value={settingsTab}
          onValueChange={handleSettingsTabChange}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
        >
          <TabsList className={cn("w-full justify-start sm:w-auto")}>
            <TabsTrigger value="profile">Company</TabsTrigger>
            <TabsTrigger value="preferences">Invoice preferences</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
          </TabsList>

        {/* ========= PROFILE TAB (active `companies` row only) ========= */}
        <TabsContent
          value="profile"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain data-[state=inactive]:hidden"
        >
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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10">
              <SectionCard icon={Building2} title="Company details">
                <div className="flex min-h-0 flex-1 flex-col gap-5">
                  <CompanyLogoField
                    logoPreview={logoPreview}
                    isLogoDragOver={isLogoDragOver}
                    fileInputRef={fileInputRef}
                    hasSavedLogo={hasSavedLogo}
                    hasPendingLogo={hasPendingLogo}
                    maxKb={MAX_COMPANY_LOGO_BYTES / 1024}
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
                    onFileChange={(e) => {
                      handleLogoSelected(e.target.files?.[0] ?? null);
                    }}
                    onChooseClick={() => fileInputRef.current?.click()}
                  />

                  <div className="shrink-0 space-y-4 border-t border-border/60 pt-5">
                    <div className="space-y-2">
                      <Label htmlFor="co-name" className={fieldLabelClass}>
                        Company name
                        <span className="text-destructive" aria-hidden>
                          {" "}
                          *
                        </span>
                      </Label>
                      <Input
                        id="co-name"
                        value={company.name}
                        placeholder="—"
                        disabled
                        className={readOnlyInputClass}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4">
                      <div className="min-w-0 space-y-2">
                        <Label htmlFor="co-brn" className={fieldLabelClass}>
                          Registration (BRN)
                          <span className="text-destructive" aria-hidden>
                            {" "}
                            *
                          </span>
                        </Label>
                        <Input
                          id="co-brn"
                          value={company.brn}
                          placeholder="—"
                          disabled
                          className={readOnlyInputClass}
                        />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <Label htmlFor="co-vat" className={fieldLabelClass}>
                          VAT number
                        </Label>
                        <Input
                          id="co-vat"
                          value={company.vat_number}
                          placeholder="—"
                          disabled
                          className={readOnlyInputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {subscription ? (
                <SectionCard icon={BadgePercent} title="Subscription">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Plan and billing (read-only).
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0 space-y-2 sm:col-span-2">
                      <Label className={fieldLabelClass}>Company code</Label>
                      <Input
                        disabled
                        value={subscription.company_code}
                        className={cn(readOnlyInputClass, "font-mono")}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label className={fieldLabelClass}>Account status</Label>
                      <Input
                        disabled
                        value={
                          subscription.company_is_active ? "Active" : "Inactive"
                        }
                        className={readOnlyInputClass}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label className={fieldLabelClass}>Trial</Label>
                      <Input
                        disabled
                        value={
                          subscription.is_trial === null
                            ? "—"
                            : subscription.is_trial
                              ? "Yes"
                              : "No"
                        }
                        className={readOnlyInputClass}
                      />
                    </div>
                    <div className="min-w-0 space-y-2 sm:col-span-2">
                      <Label className={fieldLabelClass}>User seats</Label>
                      <Input
                        disabled
                        value={`${subscription.max_users_override != null ? subscription.max_users_override : subscription.plan_max_users} (${subscription.max_users_override != null ? "override" : "plan limit"})`}
                        className={readOnlyInputClass}
                      />
                    </div>
                    <div className="min-w-0 space-y-2 sm:col-span-2">
                      <Label className={fieldLabelClass}>Plan</Label>
                      <Input
                        disabled
                        value={subscription.plan_name}
                        className={readOnlyInputClass}
                      />
                      {subscription.plan_description ? (
                        <p className="break-words rounded-md border border-input bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                          {subscription.plan_description}
                        </p>
                      ) : null}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label className={fieldLabelClass}>Billing cycle</Label>
                      <Input
                        disabled
                        value={subscription.plan_billing_cycle}
                        className={cn(readOnlyInputClass, "capitalize")}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label className={fieldLabelClass}>Plan price</Label>
                      <Input
                        disabled
                        value={formatPlanPrice(
                          subscription.plan_price,
                          subscription.plan_currency,
                        )}
                        className={readOnlyInputClass}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label className={fieldLabelClass}>Start</Label>
                      <Input
                        disabled
                        value={formatSubscriptionDate(
                          subscription.subscription_start_date,
                        )}
                        className={readOnlyInputClass}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label className={fieldLabelClass}>End</Label>
                      <Input
                        disabled
                        value={formatSubscriptionDate(
                          subscription.subscription_end_date,
                        )}
                        className={readOnlyInputClass}
                      />
                    </div>
                    <div className="min-w-0 space-y-2 sm:col-span-2">
                      <Label className={fieldLabelClass}>Catalog</Label>
                      <Input
                        disabled
                        value={
                          subscription.plan_catalog_active
                            ? "Offered in catalog"
                            : "Not in active catalog"
                        }
                        className={readOnlyInputClass}
                      />
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard icon={UserRound} title="Billing contact">
                <div className="flex flex-col gap-4">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="co-bill-name" className={fieldLabelClass}>
                      Name
                    </Label>
                    <Input
                      id="co-bill-name"
                      value={company.billing_contact_name}
                      placeholder="—"
                      disabled
                      className={readOnlyInputClass}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4">
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="co-bill-email" className={fieldLabelClass}>
                        Email
                      </Label>
                      <Input
                        id="co-bill-email"
                        type="email"
                        value={company.billing_contact_email}
                        placeholder="—"
                        disabled
                        className={readOnlyInputClass}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="co-bill-phone" className={fieldLabelClass}>
                        Phone
                      </Label>
                      <Input
                        id="co-bill-phone"
                        value={company.billing_contact_phone}
                        placeholder="—"
                        disabled
                        className={readOnlyInputClass}
                      />
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon={Mail} title="Contact">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="co-email" className={fieldLabelClass}>
                      Email
                      <span className="text-destructive" aria-hidden>
                        {" "}
                        *
                      </span>
                    </Label>
                    <Input
                      id="co-email"
                      type="email"
                      value={company.email}
                      placeholder="—"
                      disabled
                      className={readOnlyInputClass}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="co-phone" className={fieldLabelClass}>
                      Phone
                      <span className="text-destructive" aria-hidden>
                        {" "}
                        *
                      </span>
                    </Label>
                    <Input
                      id="co-phone"
                      value={company.phone}
                      placeholder="—"
                      disabled
                      className={readOnlyInputClass}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={MapPinned}
                title="Address"
                className="lg:col-span-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="co-addr1" className={fieldLabelClass}>
                    Address line 1
                    <span className="text-destructive" aria-hidden>
                      {" "}
                      *
                    </span>
                  </Label>
                  <Input
                    id="co-addr1"
                    value={company.address_line_1}
                    placeholder="—"
                    disabled
                    className={readOnlyInputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="co-addr2" className={fieldLabelClass}>
                    Address line 2
                  </Label>
                  <Input
                    id="co-addr2"
                    value={company.address_line_2}
                    placeholder="—"
                    disabled
                    className={readOnlyInputClass}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="co-city" className={fieldLabelClass}>
                      City
                    </Label>
                    <Input
                      id="co-city"
                      value={company.city}
                      placeholder="—"
                      disabled
                      className={readOnlyInputClass}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="co-country" className={fieldLabelClass}>
                      Country
                    </Label>
                    <Input
                      id="co-country"
                      value={company.country}
                      placeholder="—"
                      disabled
                      className={readOnlyInputClass}
                    />
                  </div>
                </div>
              </SectionCard>
            </div>
          )}
        </TabsContent>

        {/* ========= PREFERENCES TAB ========= */}
        <TabsContent
          value="preferences"
          className="mt-0 flex min-h-0 flex-1 flex-col space-y-4 focus-visible:outline-none data-[state=inactive]:hidden"
        >
          <Card className="gap-4 py-4 shadow-none">
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

        <TabsContent
          value="roles"
          className="mt-0 flex min-h-0 flex-1 flex-col space-y-4 focus-visible:outline-none data-[state=inactive]:hidden"
        >
          {settingsTab === "roles" ? <CompanyRolesSettings /> : null}
        </TabsContent>
      </Tabs>
      </div>
    </AppPageShell>
  );
}
