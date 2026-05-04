"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { getActiveCompanyId } from "@/lib/active-company";
import { addLocation, type LocationPayload } from "@/lib/locations-service";
import { AppPageShell } from "@/components/app-page-shell";

type FormState = {
  name: string;
  code: string;
  description: string;
  map_link: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postal: string;
  country: string;
  is_default: boolean;
};

function emptyForm(): FormState {
  return {
    name: "",
    code: "",
    description: "",
    map_link: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    postal: "",
    country: "",
    is_default: false,
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
    is_default: form.is_default,
  };
}

export default function NewLocationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmPrimaryOpen, setConfirmPrimaryOpen] = useState(false);

  function validate(): boolean {
    if (!form.name.trim()) {
      setNameError("Name is required");
      return false;
    }
    setNameError("");
    return true;
  }

  async function performSave(isSettingPrimary: boolean) {
    try {
      setSaving(true);
      const companyId = await getActiveCompanyId();
      if (!companyId) {
        toast({
          title: "No active company",
          description: "Link a company before adding locations.",
          variant: "destructive",
        });
        return;
      }
      await addLocation({ ...formToPayload(form), is_active: true });
      toast({
        title: "Location added",
        description: isSettingPrimary
          ? "The new location is available for stock and is now primary."
          : "The new location is available for stock.",
      });
      router.push("/app/inventory/locations");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Save failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!validate()) return;
    if (form.is_default) {
      setConfirmPrimaryOpen(true);
      return;
    }
    await performSave(false);
  }

  return (
    <AppPageShell
      subtitle="Create a warehouse or site for your active company."
      leading={
        <Button variant="ghost" size="icon" asChild aria-label="Back to locations">
          <Link href="/app/inventory/locations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/app/inventory/locations")}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Plus className="h-4 w-4" />
            {saving ? "Saving..." : "Add location"}
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Location details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loc-name">Name *</Label>
                <Input
                  id="loc-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Main warehouse"
                  className={nameError ? "border-destructive" : ""}
                />
                {nameError ? (
                  <p className="text-xs text-destructive">{nameError}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="loc-code">Code</Label>
                  <Input
                    id="loc-code"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="WH-01"
                  />
                </div>
                <div className="flex items-end gap-2 pb-0.5 sm:pb-0">
                  <Checkbox
                    id="loc-default"
                    checked={form.is_default}
                    onCheckedChange={(v) =>
                      setForm({ ...form, is_default: v === true })
                    }
                  />
                  <Label htmlFor="loc-default" className="text-sm font-normal leading-snug">
                    Primary location for this company
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loc-desc">Description</Label>
                <Textarea
                  id="loc-desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Optional notes"
                  rows={4}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loc-map-link">Map link</Label>
                <Input
                  id="loc-map-link"
                  value={form.map_link}
                  onChange={(e) => setForm({ ...form, map_link: e.target.value })}
                  placeholder="https://maps.google.com/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loc-a1">Address line 1</Label>
                <Input
                  id="loc-a1"
                  value={form.address_line_1}
                  onChange={(e) =>
                    setForm({ ...form, address_line_1: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loc-a2">Address line 2</Label>
                <Input
                  id="loc-a2"
                  value={form.address_line_2}
                  onChange={(e) =>
                    setForm({ ...form, address_line_2: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="loc-city">City</Label>
                  <Input
                    id="loc-city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-postal">Postal code</Label>
                  <Input
                    id="loc-postal"
                    value={form.postal}
                    onChange={(e) => setForm({ ...form, postal: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loc-country">Country</Label>
                <Input
                  id="loc-country"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={confirmPrimaryOpen} onOpenChange={setConfirmPrimaryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set as primary location?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unset any existing primary location for your company.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void performSave(true)}
              disabled={saving}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
