"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Eye,
  Loader2,
  MoreVertical,
  Pencil,
  Receipt,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  listTeamMembers,
  removeTeamMember,
  updateDriverRate,
  type TeamMemberRow,
} from "@/lib/company-team-service";
import { AppPageShell } from "@/components/app-page-shell";

export default function CompanyTeamPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TeamMemberRow[]>([]);
  const [deleteRow, setDeleteRow] = useState<TeamMemberRow | null>(null);
  const [rateRow, setRateRow] = useState<TeamMemberRow | null>(null);
  const [rateValue, setRateValue] = useState("");
  const [savingRate, setSavingRate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [memberList] = await Promise.all([listTeamMembers()]);
      setRows(memberList);
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
                  <DropdownMenuItem asChild>
                    <Link href={`/app/company-team/${r.membershipId}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/app/company-team/${r.membershipId}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  {r.roleName.toLowerCase().includes("driver") ? (
                    <DropdownMenuItem
                      onClick={() => {
                        setRateRow(r);
                        setRateValue(
                          r.driverRate != null ? String(r.driverRate) : ""
                        );
                      }}
                    >
                      <Receipt className="mr-2 h-4 w-4" />
                      Set rate
                    </DropdownMenuItem>
                  ) : null}
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
    [],
  );

  const confirmDelete = async () => {
    if (!deleteRow) return;
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
    }
  };

  const saveRate = async () => {
    if (!rateRow) return;
    const numericRate = Number(rateValue);
    if (!Number.isFinite(numericRate) || numericRate < 0) {
      toast({
        title: "Invalid rate",
        description: "Enter a valid number greater than or equal to 0.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSavingRate(true);
      await updateDriverRate(rateRow.membershipId, numericRate);
      toast({
        title: "Rate saved",
        description: "Driver rate has been updated.",
      });
      setRateRow(null);
      setRateValue("");
      await load();
    } catch (err) {
      toast({
        title: "Could not save rate",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSavingRate(false);
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
        <Button type="button" asChild className="shrink-0">
          <Link href="/app/company-team/new">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite team member
          </Link>
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
            onRowClick={(r) => router.push(`/app/company-team/${r.membershipId}`)}
            emptyMessage="No team members yet."
          />
        </CardContent>
      </Card>

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

      <Dialog
        open={!!rateRow}
        onOpenChange={(open) => {
          if (!open) {
            setRateRow(null);
            setRateValue("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set rate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="driver-rate">Rate</Label>
            <Input
              id="driver-rate"
              type="number"
              min="0"
              step="0.01"
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRateRow(null);
                setRateValue("");
              }}
              disabled={savingRate}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveRate()} disabled={savingRate}>
              {savingRate ? "Saving..." : "Save rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
