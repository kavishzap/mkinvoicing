"use client";

import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, MapPinned, Save, type LucideIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getActiveCompanyId } from "@/lib/active-company";
import {
  addLocation,
  fetchLocationTypeEnumValues,
  formatLocationTypeLabel,
  type LocationPayload,
} from "@/lib/locations-service";
import { AppPageShell } from "@/components/app-page-shell";
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

function emptyForm(): FormState {
  return {
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
  };
}

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

function ReqLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
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

export default function NewLocationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [locationTypeOptions, setLocationTypeOptions] = useState<string[]>([]);
  const [locationTypesLoading, setLocationTypesLoading] = useState(true);
  const [nameError, setNameError] = useState("");
  const { isRunning } = useActionProgress();
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [isPrimaryWarehouse, setIsPrimaryWarehouse] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLocationTypesLoading(true);
      try {
        const types = await fetchLocationTypeEnumValues();
        if (cancelled) return;
        setLocationTypeOptions(types);
        setForm((f) => ({
          ...f,
          location_type: f.location_type || types[0] || "",
        }));
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Please try again.";
          toast({
            title: "Could not load location types",
            description: msg,
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLocationTypesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  function validate(): boolean {
    if (!form.name.trim()) {
      setNameError("Please enter a name for this location.");
      return false;
    }
    setNameError("");
    if (!form.location_type.trim()) {
      toast({
        title: "Choose a location type",
        description: "Wait for types to load, then pick a type.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  }

  function requestSave() {
    if (!validate()) return;
    setSaveConfirmOpen(true);
  }

  async function performSave() {
    await runActionProgress("Creating location…", async () => {
      try {
      const companyId = await getActiveCompanyId();
      if (!companyId) {
        toast({
          title: "No active company",
          description: "Link a company before adding locations.",
          variant: "destructive",
        });
        return;
      }
      const created = await addLocation({
        ...formToPayload(form),
        is_active: true,
        is_primary_warehouse:
          form.location_type === "warehouse" ? isPrimaryWarehouse : false,
      });
      toast({
        title: "Location added",
        description: "Location saved.",
      });
      router.push(`/app/locations/${created.id}`);
      } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Save failed",
        description: msg,
        variant: "destructive",
      });
      }
    });
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
        <Button
          onClick={requestSave}
          disabled={isRunning || locationTypesLoading || locationTypeOptions.length === 0}
          className="gap-2 rounded font-semibold shadow-sm"
        >
          <Save className="size-3.5 shrink-0" aria-hidden />
          "Submit"
        </Button>
      }
    >
      {locationTypesLoading ? (
        <FormTwoColumnPageSkeleton withLineItems={false} />
      ) : (
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10">
          <SectionCard icon={Building2} title="Location basics">
            <div className="space-y-2">
              <ReqLabel htmlFor="loc-name">Display name</ReqLabel>
              <Input
                id="loc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Main warehouse"
                className={nameError ? "border-destructive" : ""}
                autoComplete="organization"
                aria-required
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
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. WH-01"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <ReqLabel htmlFor="loc-type">Location type</ReqLabel>
                <Select
                  value={form.location_type || undefined}
                  onValueChange={(v) => {
                    setForm({
                      ...form,
                      location_type: v,
                    });
                    if (v !== "warehouse") setIsPrimaryWarehouse(false);
                  }}
                  disabled={locationTypesLoading || locationTypeOptions.length === 0}
                >
                  <SelectTrigger id="loc-type" className="h-8 w-full rounded-sm text-xs">
                    <SelectValue
                      placeholder={
                        locationTypesLoading ? "Loading…" : "Select type"
                      }
                    />
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

            {form.location_type === "warehouse" ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="new-loc-primary-wh"
                  checked={isPrimaryWarehouse}
                  onCheckedChange={(v) => setIsPrimaryWarehouse(v === true)}
                  aria-label="Primary warehouse for stock transfers"
                />
                <Label htmlFor="new-loc-primary-wh" className={fieldLabelClass}>
                  Primary warehouse (one per company; used when handing stock to drivers)
                </Label>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="loc-desc" className={fieldLabelClass}>
                Notes
              </Label>
              <Textarea
                id="loc-desc"
                value={form.description}
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
                onChange={(e) => setForm({ ...form, map_link: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, postal: e.target.value })}
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
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="Country"
                autoComplete="country-name"
              />
            </div>
          </SectionCard>
        </div>
      </div>
      )}

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save location?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add {form.name.trim() || "this location"} as a{" "}
              {formatLocationTypeLabel(form.location_type).toLowerCase()}
              {form.location_type === "warehouse" && isPrimaryWarehouse
                ? " (primary warehouse)"
                : ""}
              . You will be taken to the location detail page.
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
              "Submit"
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
