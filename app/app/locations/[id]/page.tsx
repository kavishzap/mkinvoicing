"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  MapPinned,
  Pencil,
  Save,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="field-controls flex min-h-0 flex-1 flex-col space-y-4 px-4 py-5 [&_input]:h-8 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs">
        {children}
      </CardContent>
    </Card>
  );
}

export default function LocationDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id ?? "";

  const [loc, setLoc] = useState<LocationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [tab, setTab] = useState("details");
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

  useEffect(() => {
    if (!isDriverLocation && tab === "routing") setTab("details");
  }, [isDriverLocation, tab]);

  const editFromUrl = searchParams.get("edit") === "1";

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
  }, [id, toast]);

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

  async function handleSave() {
    if (!id || !validate()) return;
    try {
      setSaving(true);
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
    } finally {
      setSaving(false);
    }
  }

  if (loading || !loc) {
    return (
      <AppPageShell
        fillHeight
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="h-10 w-48 animate-pulse rounded bg-muted" />
          <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to locations">
          <Link href="/app/locations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={saving}
                className="rounded font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={
                  saving ||
                  locationTypesLoading ||
                  locationTypeOptions.length === 0
                }
                className="gap-2 rounded font-semibold shadow-sm"
              >
                <Save className="size-3.5 shrink-0" aria-hidden />
                {saving ? "Saving…" : "Save changes"}
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
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
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
          <div className="flex flex-wrap items-center gap-4 pt-2 sm:pt-0">
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
                  onCheckedChange={(v) => setIsPrimaryWarehouse(v === true)}
                  aria-label="Primary warehouse for stock transfers"
                />
                <Label htmlFor="loc-primary-wh" className="text-xs font-medium">
                  Primary warehouse
                </Label>
              </div>
            ) : null}
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <TabsList className={cn("w-full justify-start sm:w-auto")}>
            <TabsTrigger value="details">Details</TabsTrigger>
            {isDriverLocation ? (
              <TabsTrigger value="routing">Zones &amp; drivers</TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent
            value="details"
            className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10">
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
              className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
            >
              <LocationRoutingTab
                locationId={id}
                readOnly={false}
                enabled={tab === "routing"}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </AppPageShell>
  );
}
