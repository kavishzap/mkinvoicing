"use client";

import { SettingsTwoColumnSkeleton, FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
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
import { runActionProgress } from "@/lib/action-progress-bridge";
import { useActionProgress } from "@/contexts/action-progress-context";
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
  const { isRunning } = useActionProgress();
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
    await runActionProgress("Creating role…", async () => {
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
      }
    });
  };

  if (waitingOnPermissions) {
    return (
      <AppPageShell
        fillHeight
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <FormTwoColumnPageSkeleton withLineItems={false} />
        </div>
      </AppPageShell>
    );
  }

  if (appFeatStatus === "error" || appFeatStatus === "no-company") {
    return (
      <AppPageShell
        fillHeight
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      >
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <p className="text-sm text-muted-foreground">
            {appFeatStatus === "no-company"
              ? "Select a company before creating roles."
              : "Could not load your permissions. Refresh the page or try again."}
          </p>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      subtitle="Define the role name, optional description, and which plan features it includes."
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to roles">
          <Link href="/app/settings?tab=roles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="rounded-md" asChild>
            <Link href="/app/settings?tab=roles">Cancel</Link>
          </Button>
          <Button
            size="sm"
            className="gap-2 rounded-md font-semibold shadow-sm"
            onClick={() => void handleSave()}
            disabled={isRunning}
          >
            "Save role"
          </Button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <Card className="gap-0 border-0 py-0 shadow-none">
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
      </div>
    </AppPageShell>
  );
}
