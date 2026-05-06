"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useAppFeatures } from "@/contexts/app-features-context";
import { requireActiveCompanyId } from "@/lib/active-company";
import { clearRoleFeaturesCache } from "@/lib/role-features-service";
import {
  type CompanyRole,
  type PlanAllowedFeature,
  deleteCompanyRole,
  getPlanAllowedFeatures,
  listCompanyRoles,
  updateCompanyRole,
} from "@/lib/company-roles-service";

function isOwnerRoleName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === "owner";
}

export function CompanyRolesSettings() {
  const { toast } = useToast();
  const { reload: reloadAppFeatures } = useAppFeatures();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planFeatures, setPlanFeatures] = useState<PlanAllowedFeature[]>([]);
  const [roles, setRoles] = useState<CompanyRole[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<CompanyRole | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = await requireActiveCompanyId();
      const [pf, rs] = await Promise.all([
        getPlanAllowedFeatures(companyId),
        listCompanyRoles(),
      ]);
      setPlanFeatures(pf);
      setRoles(rs);
    } catch (err) {
      toast({
        title: "Failed to load roles",
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteCompanyRole(deleteTarget.id);
      toast({ title: "Role deleted", description: "The role was removed." });
      setDeleteTarget(null);
      clearRoleFeaturesCache();
      await reloadAppFeatures();
      await load();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRowActiveToggle = async (role: CompanyRole, next: boolean) => {
    setTogglingId(role.id);
    try {
      await updateCompanyRole(role.id, { is_active: next });
      setRoles((prev) =>
        prev.map((r) => (r.id === role.id ? { ...r, is_active: next } : r))
      );
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="h-5 w-48 max-w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
          </div>
          <div className="h-9 w-36 shrink-0 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-44 animate-pulse rounded-lg border border-border/60 bg-muted/40" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Roles & permissions
          </h3>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Create roles and assign features. Only features included in your
            subscription plan are available.
          </p>
        </div>
        <Button type="button" className="shrink-0 gap-2" asChild>
          <Link href="/app/settings/roles/new">
            <Plus className="h-4 w-4" />
            Create role
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        {planFeatures.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No plan features are available. Check your subscription or contact
            support.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your plan allows {planFeatures.length} feature
            {planFeatures.length === 1 ? "" : "s"} to be assigned to roles.
          </p>
        )}

        <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead className="w-[100px]">Active</TableHead>
                  <TableHead className="w-[100px] text-center">Features</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No roles yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {role.name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell max-w-[240px] truncate text-muted-foreground">
                        {role.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={role.is_active}
                          disabled={togglingId === role.id || isOwnerRoleName(role.name)}
                          onCheckedChange={(v) => handleRowActiveToggle(role, v)}
                          aria-label={`Toggle ${role.name} active`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {role.featureIds.length}
                      </TableCell>
                      <TableCell>
                        {role.is_system ? (
                          <Badge variant="secondary">System</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isOwnerRoleName(role.name) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <Link
                              href={`/app/settings/roles/${role.id}/edit`}
                              aria-label={`Edit ${role.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        {!role.is_system && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(role)}
                            aria-label={`Delete ${role.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Permanently delete “${deleteTarget.name}”? This cannot be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
