"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createCompanyRole,
  deleteCompanyRole,
  getPlanAllowedFeatures,
  listCompanyRoles,
  updateCompanyRole,
} from "@/lib/company-roles-service";

export function CompanyRolesSettings() {
  const { toast } = useToast();
  const { reload: reloadAppFeatures } = useAppFeatures();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planFeatures, setPlanFeatures] = useState<PlanAllowedFeature[]>([]);
  const [roles, setRoles] = useState<CompanyRole[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyRole | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(
    () => new Set()
  );

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

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormDescription("");
    setFormActive(true);
    setSelectedFeatureIds(new Set());
    setDialogOpen(true);
  };

  const openEdit = (role: CompanyRole) => {
    setEditing(role);
    setFormName(role.name);
    setFormDescription(role.description ?? "");
    setFormActive(role.is_active);
    setSelectedFeatureIds(new Set(role.featureIds));
    setDialogOpen(true);
  };

  const toggleFeature = (id: string, checked: boolean) => {
    setSelectedFeatureIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSaveDialog = async () => {
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
      if (editing) {
        const payload: Parameters<typeof updateCompanyRole>[1] = {
          featureIds,
        };
        if (!editing.is_system) {
          payload.name = name;
          payload.description = formDescription.trim() || null;
        }
        payload.is_active = formActive;
        await updateCompanyRole(editing.id, payload);
        toast({ title: "Role updated", description: "Changes saved." });
      } else {
        await createCompanyRole({
          name,
          description: formDescription.trim() || null,
          featureIds,
        });
        toast({ title: "Role created", description: "The new role is ready." });
      }
      setDialogOpen(false);
      clearRoleFeaturesCache();
      await reloadAppFeatures();
      await load();
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
      <Card>
        <CardHeader>
          <div className="h-6 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded mt-2 animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-40 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Roles & permissions</CardTitle>
            <CardDescription>
              Create roles and assign features. Only features included in your
              subscription plan are available.
            </CardDescription>
          </div>
          <Button type="button" onClick={openCreate} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Create role
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="rounded-md border">
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
                          disabled={togglingId === role.id}
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(role)}
                          aria-label={`Edit ${role.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit role" : "Create role"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={!!editing?.is_system}
                placeholder="e.g. Sales, Accountant"
              />
              {editing?.is_system && (
                <p className="text-xs text-muted-foreground">
                  System role names cannot be changed.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                disabled={!!editing?.is_system}
                placeholder="Optional"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive roles cannot be assigned to new users.
                </p>
              </div>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
            <div className="space-y-2">
              <Label>Features (from your plan)</Label>
              <div className="max-h-56 overflow-y-auto rounded-md border p-3 space-y-3">
                {planFeatures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No features available for your plan.
                  </p>
                ) : (
                  planFeatures.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-start gap-3 space-y-0"
                    >
                      <Checkbox
                        id={`feat-${f.id}`}
                        checked={selectedFeatureIds.has(f.id)}
                        onCheckedChange={(c) =>
                          toggleFeature(f.id, c === true)
                        }
                        className="mt-0.5"
                      />
                      <label
                        htmlFor={`feat-${f.id}`}
                        className="flex flex-col gap-0.5 text-sm leading-snug cursor-pointer"
                      >
                        <span className="font-medium">{f.name}</span>
                        {f.description ? (
                          <span className="text-xs text-muted-foreground">
                            {f.description}
                          </span>
                        ) : null}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveDialog} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
