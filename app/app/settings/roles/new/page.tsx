"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAppFeatures } from "@/contexts/app-features-context";
import { AppPageShell } from "@/components/app-page-shell";
import { CompanyRoleFormFields } from "@/components/company-role-form-fields";
import { clearRoleFeaturesCache } from "@/lib/role-features-service";
import { requireActiveCompanyId } from "@/lib/active-company";
import {
  createCompanyRole,
  getPlanAllowedFeatures,
  type PlanAllowedFeature,
} from "@/lib/company-roles-service";

export default function NewCompanyRolePage() {
  const { toast } = useToast();
  const router = useRouter();
  const {
    reload: reloadAppFeatures,
    features: myFeatures,
    status: appFeatStatus,
  } = useAppFeatures();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planFeatures, setPlanFeatures] = useState<PlanAllowedFeature[]>([]);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(
    () => new Set()
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = await requireActiveCompanyId();
      const pf = await getPlanAllowedFeatures(companyId);
      setPlanFeatures(pf);
    } catch (err) {
      toast({
        title: "Failed to load",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const myFeatureIds = useMemo(
    () => new Set(myFeatures.map((f) => f.id)),
    [myFeatures]
  );

  const assignableFeatures = useMemo(
    () => planFeatures.filter((p) => myFeatureIds.has(p.id)),
    [planFeatures, myFeatureIds]
  );

  const waitingOnPermissions =
    loading ||
    (appFeatStatus !== "ready" &&
      appFeatStatus !== "error" &&
      appFeatStatus !== "no-company");

  const toggleFeature = (id: string, checked: boolean) => {
    setSelectedFeatureIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSave = async () => {
    const name = formName.trim();
    if (!name) {
      toast({
        title: "Name required",
        description: "Enter a role name.",
        variant: "destructive",
      });
      return;
    }

    const featureIds = Array.from(selectedFeatureIds);
    setSaving(true);
    try {
      await createCompanyRole({
        name,
        description: formDescription.trim() || null,
        featureIds,
      });
      toast({ title: "Role created", description: "The new role is ready." });
      clearRoleFeaturesCache();
      await reloadAppFeatures();
      router.push("/app/settings?tab=roles");
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (waitingOnPermissions) {
    return (
      <AppPageShell compact>
        <div className="h-6 w-48 max-w-full bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse mt-4" />
      </AppPageShell>
    );
  }

  if (appFeatStatus === "error" || appFeatStatus === "no-company") {
    return (
      <AppPageShell compact>
        <p className="text-sm text-muted-foreground">
          {appFeatStatus === "no-company"
            ? "Select a company before creating roles."
            : "Could not load your permissions. Refresh the page or try again."}
        </p>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      compact
      subtitle="Define the role name, optional description, and which plan features it includes."
      leading={
        <Button variant="ghost" size="icon" asChild aria-label="Back to roles">
          <Link href="/app/settings?tab=roles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/settings?tab=roles">Cancel</Link>
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save role"}
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Role details</CardTitle>
          <CardDescription>
            Choose from features your plan allows and that your own role already
            includes — you can only grant access you have.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {planFeatures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No plan features are available. Check your subscription or contact
              support.
            </p>
          ) : assignableFeatures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your role does not include any plan features to assign. Ask an
              administrator to update your access, or use an account with broader
              permissions.
            </p>
          ) : (
            <CompanyRoleFormFields
              name={formName}
              onNameChange={setFormName}
              description={formDescription}
              onDescriptionChange={setFormDescription}
              planFeatures={assignableFeatures}
              selectedFeatureIds={selectedFeatureIds}
              onToggleFeature={toggleFeature}
            />
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
