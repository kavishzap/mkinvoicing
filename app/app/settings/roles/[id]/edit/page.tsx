"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  getCompanyRoleById,
  getPlanAllowedFeatures,
  updateCompanyRole,
  type CompanyRole,
  type PlanAllowedFeature,
} from "@/lib/company-roles-service";

function isOwnerRoleName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "owner";
}

export default function EditCompanyRolePage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const roleId = params?.id;
  const {
    reload: reloadAppFeatures,
    features: myFeatures,
    status: appFeatStatus,
  } = useAppFeatures();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<CompanyRole | null>(null);
  const [planFeatures, setPlanFeatures] = useState<PlanAllowedFeature[]>([]);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(
    () => new Set()
  );
  const isOwnerRole = isOwnerRoleName(role?.name);

  const load = useCallback(async () => {
    if (!roleId) return;
    setLoading(true);
    try {
      const companyId = await requireActiveCompanyId();
      const [pf, r] = await Promise.all([
        getPlanAllowedFeatures(companyId),
        getCompanyRoleById(roleId),
      ]);
      setPlanFeatures(pf);
      setRole(r);
      setFormName(r.name);
      setFormDescription(r.description ?? "");
      setFormActive(r.is_active);
      setSelectedFeatureIds(new Set(r.featureIds));
    } catch (err) {
      toast({
        title: "Failed to load role",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [roleId, toast]);

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
    if (isOwnerRole) return;
    setSelectedFeatureIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!role || !roleId) return;
    if (isOwnerRole) {
      toast({
        title: "Role locked",
        description: "The Owner role cannot be edited.",
        variant: "destructive",
      });
      return;
    }
    const name = formName.trim();
    if (!name) {
      toast({
        title: "Name required",
        description: "Enter a role name.",
        variant: "destructive",
      });
      return;
    }

    const payload: Parameters<typeof updateCompanyRole>[1] = {
      featureIds: Array.from(selectedFeatureIds),
      is_active: formActive,
    };
    if (!role.is_system) {
      payload.name = name;
      payload.description = formDescription.trim() || null;
    }

    setSaving(true);
    try {
      await updateCompanyRole(roleId, payload);
      clearRoleFeaturesCache();
      await reloadAppFeatures();
      toast({ title: "Role updated", description: "Changes saved." });
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
            ? "Select a company before editing roles."
            : "Could not load your permissions. Refresh the page or try again."}
        </p>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      compact
      subtitle="Update role access and status for your company."
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
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || isOwnerRole}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Edit role</CardTitle>
          <CardDescription>
            Features your plan allows and your own role includes — you can only
            change permissions within that set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {role ? (
            <CompanyRoleFormFields
              name={formName}
              onNameChange={setFormName}
              description={formDescription}
              onDescriptionChange={setFormDescription}
              nameDisabled={!!role.is_system || isOwnerRole}
              descriptionDisabled={!!role.is_system || isOwnerRole}
              nameHint={
                isOwnerRole
                  ? "Owner role name cannot be changed."
                  : role.is_system
                  ? "System role names cannot be changed."
                  : undefined
              }
              showActive
              isActive={formActive}
              onActiveChange={setFormActive}
              activeDisabled={isOwnerRole}
              planFeatures={assignableFeatures}
              selectedFeatureIds={selectedFeatureIds}
              onToggleFeature={toggleFeature}
              featuresDisabled={isOwnerRole}
              featureHint={
                isOwnerRole
                  ? "Owner role permissions cannot be edited."
                  : undefined
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Role not found for this company.
            </p>
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
