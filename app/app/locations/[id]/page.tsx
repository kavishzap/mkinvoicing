"use client";

import { SettingsTwoColumnSkeleton, FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  MapPinned,
  Package,
  Pencil,
  Save,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  getLocation,
  updateLocation,
  fetchLocationTypeEnumValues,
  formatLocationTypeLabel,
  mergeLocationTypeEnumOptions,
  type LocationPayload,
  type LocationRow,
} from "@/lib/locations-service";
import { AppPageShell } from "@/components/app-page-shell";
import { cn } from "@/lib/utils";
import { LocationRoutingTab } from "./location-routing-tab";
import { LocationProductsLineTab } from "./location-products-line-tab";
import { runActionProgress } from "@/lib/action-progress-bridge";
import { useActionProgress } from "@/contexts/action-progress-context";

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

type FormState = {
  name: string;
  code: string;
  location_type: string;
  description: string;
  map_link: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postal: string;
  country: string;
};

function formToPayload(form: FormState): LocationPayload {
  return {
    name: form.name,
    code: form.code.trim() || null,
    description: form.description.trim() || null,
    map_link: form.map_link.trim() || null,
    address_line_1: form.address_line_1.trim() || null,
    address_line_2: form.address_line_2.trim() || null,
    city: form.city.trim() || null,
    postal: form.postal.trim() || null,
    country: form.country.trim() || null,
    location_type: form.location_type,
  };
}

function ReqLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className={fieldLabelClass}>
      {children}
      <span className="text-destructive" aria-hidden>
        {" "}
        *
      </span>
    </Label>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="field-controls flex min-w-0 flex-col space-y-4 px-4 py-5 [&_input]:h-8 [&_input]:min-w-0 [&_input]:w-full [&_input]:text-xs [&_select]:text-xs [&_textarea]:min-w-0 [&_textarea]:w-full [&_textarea]:text-xs">
        {children}
      </CardContent>
    </Card>
  );
}

const primaryCardShellClass =
  "flex w-full min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6";

export default function LocationDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id ?? "";

  const [loc, setLoc] = useState<LocationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const { isRunning } = useActionProgress();
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [nameError, setNameError] = useState("");
  const [tab, setTab] = useState(() => {
    const t = searchParams.get("tab");
    if (t === "products-line") return "products-line";
    if (t === "routing") return "routing";
    return "details";
  });
  const [isEditing, setIsEditing] = useState(false);

  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const [isPrimaryWarehouse, setIsPrimaryWarehouse] = useState(false);

  const [form, setForm] = useState<FormState>({
    name: "",
    code: "",
    location_type: "",
    description: "",
    map_link: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    postal: "",
    country: "",
  });

  const [locationTypeOptions, setLocationTypeOptions] = useState<string[]>(
    [],
  );
  const [locationTypesLoading, setLocationTypesLoading] = useState(true);

  const isDriverLocation =
    (form.location_type || loc?.locationType) === "driver_location";

  const isProductsLineTab = tab === "products-line";
  const isDetailsTab = tab === "details";

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "products-line") {
      setTab("products-line");
      setIsEditing(false);
    } else if (t === "routing") {
      if (isDriverLocation) setTab("routing");
      else setTab("details");
    } else if (!t) {
      setTab("details");
    }
  }, [searchParams, isDriverLocation]);

  function handleTabChange(next: string) {
    if (!id) return;
    setTab(next);
    if (next === "products-line") {
      setIsEditing(false);
      router.replace(`/app/locations/${id}?tab=products-line`, { scroll: false });
    } else if (next === "routing") {
      router.replace(`/app/locations/${id}?tab=routing`, { scroll: false });
    } else {
      router.replace(`/app/locations/${id}`, { scroll: false });
    }
  }

  const editFromUrl = searchParams.get("edit") === "1";

  useEffect(() => {
    if (!isDriverLocation && tab === "routing") setTab("details");
  }, [isDriverLocation, tab]);

  useEffect(() => {
    setIsEditing(editFromUrl);
  }, [id, editFromUrl]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [row, enumLabels] = await Promise.all([
          getLocation(id),
          fetchLocationTypeEnumValues().catch(() => [] as string[]),
        ]);
        if (cancelled) return;
        const options = mergeLocationTypeEnumOptions(
          enumLabels,
          row.locationType,
        );
        setLocationTypeOptions(options);
        setLoc(row);
        setForm({
          name: row.name,
          code: row.code,
          location_type: row.locationType || options[0] || "",
          description: row.description,
          map_link: row.map_link,
          address_line_1: row.address_line_1,
          address_line_2: row.address_line_2,
          city: row.city,
          postal: row.postal,
          country: row.country,
        });
        setIsActive(row.isActive);
        setIsDefault(row.isDefault);
        setIsPrimaryWarehouse(row.isPrimaryWarehouse);
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Failed to load location",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLocationTypesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable; errors only
  }, [id]);

  const resetFormFromLoc = useCallback((row: LocationRow, options: string[]) => {
    setForm({
      name: row.name,
      code: row.code,
      location_type: row.locationType || options[0] || "",
      description: row.description,
      map_link: row.map_link,
      address_line_1: row.address_line_1,
      address_line_2: row.address_line_2,
      city: row.city,
      postal: row.postal,
      country: row.country,
    });
    setIsActive(row.isActive);
    setIsDefault(row.isDefault);
    setIsPrimaryWarehouse(row.isPrimaryWarehouse);
    setNameError("");
  }, []);

  function handleCancelEdit() {
    if (!loc) return;
    resetFormFromLoc(loc, locationTypeOptions);
    setIsEditing(false);
    router.replace(`/app/locations/${id}`, { scroll: false });
  }

  function validate(): boolean {
    if (!form.name.trim()) {
      setNameError("Please enter a name for this location.");
      return false;
    }
    setNameError("");
    if (!form.location_type.trim()) {
      toast({
        title: "Choose a location type",
        description: "Pick a type after types load.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  }

  function requestSave() {
    if (!id || !validate()) return;
    setSaveConfirmOpen(true);
  }

  async function performSave() {
    if (!id) return;
    await runActionProgress("Saving changes…", async () => {
      try {
      const updated = await updateLocation(id, {
        ...formToPayload(form),
        is_active: isActive,
        is_default: isDefault,
        is_primary_warehouse:
          form.location_type === "warehouse" ? isPrimaryWarehouse : false,
      });
      setLoc(updated);
      setForm((f) => ({
        ...f,
        location_type: updated.locationType || f.location_type,
      }));
      toast({
        title: "Location saved",
        description: "Your changes have been saved.",
      });
      setIsPrimaryWarehouse(updated.isPrimaryWarehouse);
      setIsEditing(false);
      router.replace(`/app/locations/${id}`, { scroll: false });
      } catch (e: unknown) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      }
    });
  }

  if (loading || !loc) {
    return (
      <AppPageShell className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
        <div className={primaryCardShellClass}>
          <FormTwoColumnPageSkeleton withLineItems={false} />
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to locations">
          <Link href="/app/locations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        isProductsLineTab ? null : (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isRunning}
                className="rounded font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={requestSave}
                disabled={
                  isRunning ||
                  locationTypesLoading ||
                  locationTypeOptions.length === 0
                }
                className="gap-2 rounded font-semibold shadow-sm"
              >
                <Save className="size-3.5 shrink-0" aria-hidden />
                "Save changes"
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() => setIsEditing(true)}
              className="gap-2 rounded font-semibold shadow-sm"
            >
              <Pencil className="size-3.5 shrink-0" aria-hidden />
              Edit
            </Button>
          )}
        </div>
        )
      }
    >
      <div className={primaryCardShellClass}>
        <div className="flex min-w-0 flex-col gap-1 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {loc.name}
            </h2>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {formatLocationTypeLabel(loc.locationType)}
                {loc.code ? ` · ${loc.code}` : ""}
              </span>
              {loc.locationType === "warehouse" && loc.isPrimaryWarehouse ? (
                <span className="inline-flex rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-500/14 dark:text-amber-200">
                  Primary warehouse
                </span>
              ) : null}
            </p>
          </div>
          {isProductsLineTab ? (
            <p className="max-w-md pt-2 text-xs text-muted-foreground sm:pt-0 sm:text-right">
              Read-only inventory for this location. To change stock, use{" "}
              <Link
                href="/app/inventory"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Inventory
              </Link>{" "}
              in the sidebar.
            </p>
          ) : null}
        </div>

        <Tabs
          value={tab}
          onValueChange={handleTabChange}
          className="flex w-full min-w-0 flex-col gap-4"
        >
          <TabsList className={cn("w-full justify-start sm:w-auto")}>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="products-line" className="gap-1.5">
              <Package className="h-4 w-4 shrink-0" aria-hidden />
              Products line
            </TabsTrigger>
            {isDriverLocation ? (
              <TabsTrigger value="routing">Zones &amp; drivers</TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent
            value="details"
            className="mt-0 w-full min-w-0 data-[state=inactive]:hidden"
          >
            <div className="grid min-h-0 auto-rows-min grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8 xl:gap-10">
              <SectionCard icon={Building2} title="Location basics">
                <div className="space-y-2">
                  <ReqLabel htmlFor="loc-name">Display name</ReqLabel>
                  <Input
                    id="loc-name"
                    value={form.name}
                    readOnly={!isEditing}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Main warehouse"
                    className={nameError ? "border-destructive" : ""}
                    autoComplete="organization"
                  />
                  {nameError ? (
                    <p className="text-xs text-destructive">{nameError}</p>
                  ) : null}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="loc-code" className={fieldLabelClass}>
                      Internal code
                    </Label>
                    <Input
                      id="loc-code"
                      value={form.code}
                      readOnly={!isEditing}
                      onChange={(e) =>
                        setForm({ ...form, code: e.target.value })
                      }
                      placeholder="e.g. WH-01"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <ReqLabel htmlFor="loc-type">Location type</ReqLabel>
                    <Select
                      value={form.location_type || undefined}
                      onValueChange={(v) => {
                        setForm({ ...form, location_type: v });
                        if (v !== "warehouse") setIsPrimaryWarehouse(false);
                      }}
                      disabled={
                        !isEditing ||
                        locationTypesLoading ||
                        locationTypeOptions.length === 0
                      }
                    >
                      <SelectTrigger
                        id="loc-type"
                        className="h-8 w-full rounded-sm text-xs"
                      >
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationTypeOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {formatLocationTypeLabel(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loc-desc" className={fieldLabelClass}>
                    Notes
                  </Label>
                  <Textarea
                    id="loc-desc"
                    value={form.description}
                    readOnly={!isEditing}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Optional"
                    rows={5}
                    className="min-h-[120px] resize-y rounded-sm py-2"
                  />
                </div>

                {isDetailsTab ? (
                  <div className="space-y-3 border-t border-border/60 pt-4">
                    <p className={fieldLabelClass}>Location status</p>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="loc-active"
                          checked={isActive}
                          onCheckedChange={setIsActive}
                          disabled={!isEditing}
                          aria-label="Location active"
                        />
                        <Label htmlFor="loc-active" className="text-xs font-medium">
                          Active
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="loc-default"
                          checked={isDefault}
                          disabled={!isEditing}
                          onCheckedChange={(v) => setIsDefault(v === true)}
                          aria-label="Default location"
                        />
                        <Label htmlFor="loc-default" className="text-xs font-medium">
                          Default for company
                        </Label>
                      </div>
                      {form.location_type === "warehouse" ? (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="loc-primary-wh"
                            checked={isPrimaryWarehouse}
                            disabled={!isEditing}
                            onCheckedChange={(v) =>
                              setIsPrimaryWarehouse(v === true)
                            }
                            aria-label="Primary warehouse for stock transfers"
                          />
                          <Label
                            htmlFor="loc-primary-wh"
                            className="text-xs font-medium"
                          >
                            Primary warehouse
                          </Label>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard icon={MapPinned} title="Address & map">
                <div className="space-y-2">
                  <Label htmlFor="loc-map-link" className={fieldLabelClass}>
                    Map link
                  </Label>
                  <Input
                    id="loc-map-link"
                    type="url"
                    inputMode="url"
                    value={form.map_link}
                    readOnly={!isEditing}
                    onChange={(e) =>
                      setForm({ ...form, map_link: e.target.value })
                    }
                    placeholder="https://…"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loc-a1" className={fieldLabelClass}>
                    Address line 1
                  </Label>
                  <Input
                    id="loc-a1"
                    value={form.address_line_1}
                    readOnly={!isEditing}
                    onChange={(e) =>
                      setForm({ ...form, address_line_1: e.target.value })
                    }
                    placeholder="Street address"
                    autoComplete="address-line1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loc-a2" className={fieldLabelClass}>
                    Address line 2
                  </Label>
                  <Input
                    id="loc-a2"
                    value={form.address_line_2}
                    readOnly={!isEditing}
                    onChange={(e) =>
                      setForm({ ...form, address_line_2: e.target.value })
                    }
                    placeholder="Optional"
                    autoComplete="address-line2"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="loc-city" className={fieldLabelClass}>
                      City
                    </Label>
                    <Input
                      id="loc-city"
                      value={form.city}
                      readOnly={!isEditing}
                      onChange={(e) =>
                        setForm({ ...form, city: e.target.value })
                      }
                      placeholder="City"
                      autoComplete="address-level2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loc-postal" className={fieldLabelClass}>
                      Postal code
                    </Label>
                    <Input
                      id="loc-postal"
                      value={form.postal}
                      readOnly={!isEditing}
                      onChange={(e) =>
                        setForm({ ...form, postal: e.target.value })
                      }
                      placeholder="Postal code"
                      autoComplete="postal-code"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loc-country" className={fieldLabelClass}>
                    Country
                  </Label>
                  <Input
                    id="loc-country"
                    value={form.country}
                    readOnly={!isEditing}
                    onChange={(e) =>
                      setForm({ ...form, country: e.target.value })
                    }
                    placeholder="Country"
                    autoComplete="country-name"
                  />
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          {isDriverLocation ? (
            <TabsContent
              value="routing"
              className="mt-0 w-full min-w-0 data-[state=inactive]:hidden"
            >
              <LocationRoutingTab
                locationId={id}
                readOnly={false}
                enabled={tab === "routing"}
              />
            </TabsContent>
          ) : null}

          <TabsContent
            value="products-line"
            className="mt-0 w-full min-w-0 data-[state=inactive]:hidden"
          >
            <LocationProductsLineTab
              locationId={id}
              locationName={loc.name}
              locationCode={loc.code ?? ""}
              enabled={tab === "products-line"}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update {form.name.trim() || loc.name} in your locations
              list
              {!isActive ? " and mark it as inactive" : ""}
              {form.location_type === "warehouse" && isPrimaryWarehouse
                ? " as the primary warehouse"
                : ""}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning}
              onClick={(e) => {
                e.preventDefault();
                setSaveConfirmOpen(false);
                void performSave();
              }}
            >
              "Save changes"
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
