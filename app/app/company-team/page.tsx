"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Eye,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
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
import { listCompanyRoles, type CompanyRole } from "@/lib/company-roles-service";
import {
  listTeamMembers,
  createTeamMember,
  updateTeamMember,
  removeTeamMember,
  type TeamMemberRow,
} from "@/lib/company-team-service";
import { AppPageShell } from "@/components/app-page-shell";

function formatDt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CompanyTeamPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TeamMemberRow[]>([]);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [saving, setSaving] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState<TeamMemberRow | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [cFullName, setCFullName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cRoleId, setCRoleId] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<TeamMemberRow | null>(null);
  const [eFullName, setEFullName] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eRoleId, setERoleId] = useState("");
  const [eActive, setEActive] = useState(true);

  const [deleteRow, setDeleteRow] = useState<TeamMemberRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [memberList, roleList] = await Promise.all([
        listTeamMembers(),
        listCompanyRoles(),
      ]);
      setRows(memberList);
      setRoles(roleList.filter((r) => r.is_active));
    } catch (err) {
      toast({
        title: "Failed to load team",
        description: err instanceof Error ? err.message : "Try again.",
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
    if (roles.length === 0) {
      toast({
        title: "Create a role first",
        description:
          "Add at least one company role under Company Settings → Roles, then invite team members here.",
        variant: "destructive",
      });
      return;
    }
    setCFullName("");
    setCEmail("");
    setCPhone("");
    setCRoleId(roles[0]?.id ?? "");
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!cFullName.trim() || !cEmail.trim() || !cRoleId) {
      toast({
        title: "Missing fields",
        description: "Fill name, email, and role.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await createTeamMember({
        email: cEmail.trim(),
        full_name: cFullName.trim(),
        phone: cPhone.trim() || null,
        role_id: cRoleId,
      });
      toast({
        title: "Invitation sent",
        description:
          "They will receive an email to set their password and activate their account.",
      });
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast({
        title: "Could not send invite",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (r: TeamMemberRow) => {
    setEditRow(r);
    setEFullName(r.profile?.full_name ?? "");
    setEEmail(r.profile?.email ?? "");
    setEPhone(r.profile?.phone ?? "");
    setERoleId(r.roleId);
    setEActive(r.isActive);
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editRow) return;
    if (!eFullName.trim()) {
      toast({
        title: "Name required",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await updateTeamMember(editRow.membershipId, {
        full_name: eFullName.trim(),
        email: eEmail.trim() || null,
        phone: ePhone.trim() || null,
        roleId: editRow.isOwner ? undefined : eRoleId,
        membershipActive: editRow.isOwner ? undefined : eActive,
      });
      toast({ title: "Saved", description: "Team member updated." });
      setEditOpen(false);
      setEditRow(null);
      await load();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<TeamMemberRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => r.profile?.full_name ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        meta: {
          searchValue: (row: TeamMemberRow) =>
            [
              row.profile?.full_name,
              row.isOwner ? "owner" : "",
            ]
              .filter(Boolean)
              .join(" "),
        },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="font-medium">
              {r.profile?.full_name ?? "—"}
              {r.isOwner ? (
                <Badge variant="secondary" className="ml-2">
                  Owner
                </Badge>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "email",
        accessorFn: (r) => r.profile?.email ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        meta: {
          searchValue: (row: TeamMemberRow) => row.profile?.email ?? "",
        },
        cell: ({ row }) => row.original.profile?.email ?? "—",
      },
      {
        id: "phone",
        accessorFn: (r) => r.profile?.phone ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Phone" />
        ),
        meta: {
          thClassName: "hidden md:table-cell",
          tdClassName: "hidden md:table-cell",
          searchValue: (row: TeamMemberRow) => row.profile?.phone ?? "",
        },
        cell: ({ row }) => row.original.profile?.phone ?? "—",
      },
      {
        id: "role",
        accessorFn: (r) => r.roleName,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        meta: {
          searchValue: (row: TeamMemberRow) => row.roleName,
        },
        cell: ({ row }) => row.original.roleName,
      },
      {
        id: "status",
        accessorFn: (r) => (r.isActive ? "active" : "inactive"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        meta: {
          searchValue: (row: TeamMemberRow) =>
            row.isActive ? "active" : "inactive",
        },
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="outline">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        meta: {
          searchable: false,
          thClassName: "w-[70px] text-right",
          tdClassName: "text-right",
        },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setViewRow(r);
                      setViewOpen(true);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openEdit(r)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  {!r.isOwner && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteRow(r)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove from company
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [openEdit],
  );

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setSaving(true);
    try {
      await removeTeamMember(deleteRow.membershipId);
      toast({ title: "Removed", description: "User removed from this company." });
      setDeleteRow(null);
      await load();
    } catch (err) {
      toast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppPageShell
        compact
        className="max-w-6xl"
        subtitle="Invite colleagues by email—they choose their own password. Assign a role so they only see what they should."
      >
        <div className="flex min-h-[32vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading team…
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      compact
      className="max-w-6xl"
      subtitle="Invite colleagues by email—they choose their own password. Assign a role so they only see what they should."
      actions={
        <Button type="button" onClick={openCreate} className="shrink-0">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite team member
        </Button>
      }
    >
      <Card className="gap-4 py-4">
        <CardHeader className="pb-4">
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Manage who can access this company and their roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            columns={columns}
            data={rows}
            searchPlaceholder="Search members…"
            getRowId={(r) => r.membershipId}
            emptyMessage="No team members yet."
          />
        </CardContent>
      </Card>

      {/* View */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Team member</DialogTitle>
          </DialogHeader>
          {viewRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground">Full name</span>
                <span className="col-span-2 font-medium">
                  {viewRow.profile?.full_name ?? "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground">Email</span>
                <span className="col-span-2">{viewRow.profile?.email ?? "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground">Phone</span>
                <span className="col-span-2">{viewRow.profile?.phone ?? "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground">Avatar</span>
                <span className="col-span-2 break-all">
                  {viewRow.profile?.avatar_url ?? "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground">System role</span>
                <span className="col-span-2">
                  {viewRow.profile?.system_role ?? "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground">Profile active</span>
                <span className="col-span-2">
                  {viewRow.profile?.is_active ? "Yes" : "No"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground">Company role</span>
                <span className="col-span-2">{viewRow.roleName}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground">Joined</span>
                <span className="col-span-2">{formatDt(viewRow.joinedAt)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground">Invited</span>
                <span className="col-span-2">{formatDt(viewRow.invitedAt)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground">Profile updated</span>
                <span className="col-span-2">
                  {viewRow.profile?.updated_at
                    ? formatDt(viewRow.profile.updated_at)
                    : "—"}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Supabase sends an email with a link to set their password (same flow as
            your invite page).
          </p>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">Full name</Label>
              <Input
                id="c-name"
                value={cFullName}
                onChange={(e) => setCFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">Phone</Label>
              <Input
                id="c-phone"
                type="tel"
                value={cPhone}
                onChange={(e) => setCPhone(e.target.value)}
                placeholder="E.164 e.g. +2301234567"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label>Company role</Label>
              <Select value={cRoleId} onValueChange={setCRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitCreate()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Send invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit team member</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="e-name">Full name</Label>
                <Input
                  id="e-name"
                  value={eFullName}
                  onChange={(e) => setEFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-email">Email</Label>
                <Input
                  id="e-email"
                  type="email"
                  value={eEmail}
                  onChange={(e) => setEEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-phone">Phone</Label>
                <Input
                  id="e-phone"
                  type="tel"
                  value={ePhone}
                  onChange={(e) => setEPhone(e.target.value)}
                />
              </div>
              {!editRow.isOwner && (
                <>
                  <div className="space-y-2">
                    <Label>Company role</Label>
                    <Select value={eRoleId} onValueChange={setERoleId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm">Active in company</span>
                    <Switch checked={eActive} onCheckedChange={setEActive} />
                  </div>
                </>
              )}
              {editRow.isOwner && (
                <p className="text-xs text-muted-foreground">
                  Owner name and role are managed separately.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitEdit()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteRow}
        onOpenChange={(o) => !o && setDeleteRow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from company?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRow
                ? `Remove ${deleteRow.profile?.full_name ?? deleteRow.profile?.email ?? "this user"} from the company? Their login account will remain, but they will lose access to this workspace.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
