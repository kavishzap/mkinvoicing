"use client";
import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  GripVertical,
  Layers,
  MapPinned,
  Pencil,
  Save,
  Trash2,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { AppPageShell } from "@/components/app-page-shell";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableDeliveryCitySelect } from "@/components/searchable-delivery-city-select";
import { useToast } from "@/hooks/use-toast";
import type { TeamMemberRow } from "@/lib/company-team-service";
import {
  assignCityToZone,
  loadDeliveryZoneDetailData,
  listZoneCities,
  removeZoneCityAssignment,
  updateDeliveryZone,
  updateZoneCityAssignment,
  type DeliveryCityRow,
  type DeliveryZoneCityRow,
  type DeliveryZoneRow,
} from "@/lib/delivery-zones-service";
import { cn } from "@/lib/utils";

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

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
      <CardContent
        className={cn(
          "field-controls flex min-h-0 flex-1 flex-col space-y-4 px-4 py-5",
          "[&_input]:h-8 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs",
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

function teamDriverMembers(team: TeamMemberRow[]): TeamMemberRow[] {
  return team.filter((m) => m.roleName.toLowerCase().includes("driver"));
}

function arrayMove<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= arr.length ||
    toIndex >= arr.length
  ) {
    return [...arr];
  }
  const next = [...arr];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function sameZoneCityOrder(
  a: DeliveryZoneCityRow[],
  b: DeliveryZoneCityRow[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => row.id === b[i]?.id);
}

function withSequentialSortOrder(
  rows: DeliveryZoneCityRow[],
): DeliveryZoneCityRow[] {
  return rows.map((r, idx) => ({ ...r, sortOrder: idx + 1 }));
}

export default function DeliveryZoneDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const id = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [zone, setZone] = useState<DeliveryZoneRow | null>(null);
  const [zoneCities, setZoneCities] = useState<DeliveryZoneCityRow[]>([]);
  const [cities, setCities] = useState<DeliveryCityRow[]>([]);
  const [drivers, setDrivers] = useState<TeamMemberRow[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingAssignmentEdit, setSavingAssignmentEdit] = useState(false);
  const [nameError, setNameError] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [form, setForm] = useState({
    name: "",
    description: "",
    driverUserId: "__none__",
  });

  const [assignCityId, setAssignCityId] = useState("");
  const [assignSortOrder, setAssignSortOrder] = useState("1");
  const [assignSaving, setAssignSaving] = useState(false);

  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(
    null,
  );
  const [editingCityId, setEditingCityId] = useState("");
  const [editingSortOrder, setEditingSortOrder] = useState("");

  const [removeTarget, setRemoveTarget] = useState<DeliveryZoneCityRow | null>(
    null,
  );
  const [removeSaving, setRemoveSaving] = useState(false);

  const [draggingAssignmentId, setDraggingAssignmentId] = useState<
    string | null
  >(null);
  const [pendingZoneCityOrder, setPendingZoneCityOrder] = useState<
    DeliveryZoneCityRow[] | null
  >(null);
  const [savingReorder, setSavingReorder] = useState(false);

  const displayedZoneCities = pendingZoneCityOrder ?? zoneCities;
  const hasUnsavedOrderChanges =
    pendingZoneCityOrder !== null &&
    !sameZoneCityOrder(pendingZoneCityOrder, zoneCities);

  const reload = useCallback(async () => {
    if (!id) return;
    const { zone: z, zoneCities: zc, cities: cityRows, teamMembers: teamRows } =
      await loadDeliveryZoneDetailData(id);
    if (!z) {
      setZone(null);
      return;
    }
    setZone(z);
    setZoneCities(zc);
    setPendingZoneCityOrder(null);
    setCities(cityRows);
    setDrivers(teamDriverMembers(teamRows));
    setForm({
      name: z.name,
      description: z.description ?? "",
      driverUserId: z.driverUserId ?? "__none__",
    });
    setIsActive(z.isActive);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await reload();
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Failed to load zone",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
          setZone(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reload, toast]);

  useEffect(() => {
    if (zoneCities.length === 0) {
      setAssignSortOrder("1");
      return;
    }
    const next =
      Math.max(...zoneCities.map((r) => r.sortOrder), 0) + 1;
    setAssignSortOrder(String(next));
  }, [zoneCities]);

  function resetFormFromZone(z: DeliveryZoneRow) {
    setForm({
      name: z.name,
      description: z.description ?? "",
      driverUserId: z.driverUserId ?? "__none__",
    });
    setIsActive(z.isActive);
    setNameError("");
  }

  function handleCancelEdit() {
    if (!zone) return;
    resetFormFromZone(zone);
    setIsEditing(false);
  }

  function validate(): boolean {
    if (!form.name.trim()) {
      setNameError("Please enter a zone name.");
      return false;
    }
    setNameError("");
    return true;
  }

  async function handleSaveDetails() {
    if (!id || !validate()) return;
    try {
      setSavingDetails(true);
      await updateDeliveryZone(id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        driverUserId:
          !form.driverUserId || form.driverUserId === "__none__"
            ? null
            : form.driverUserId,
        isActive,
      });
      await reload();
      toast({ title: "Zone saved" });
      setIsEditing(false);
    } catch (e: unknown) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleAssign() {
    if (!id || !assignCityId) return;
    try {
      setAssignSaving(true);
      await assignCityToZone({
        zoneId: id,
        cityId: assignCityId,
        sortOrder: Number(assignSortOrder || "0"),
      });
      setAssignCityId("");
      const rows = await listZoneCities(id);
      setZoneCities(rows);
      setPendingZoneCityOrder(null);
      toast({ title: "City assigned" });
    } catch (e: unknown) {
      toast({
        title: "Could not assign city",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAssignSaving(false);
    }
  }

  function startEdit(row: DeliveryZoneCityRow) {
    setEditingAssignmentId(row.id);
    setEditingCityId(row.cityId);
    setEditingSortOrder(String(row.sortOrder));
  }

  function cancelEdit() {
    setEditingAssignmentId(null);
    setEditingCityId("");
    setEditingSortOrder("");
  }

  async function saveAssignmentEdit() {
    if (!editingAssignmentId) return;
    try {
      setSavingAssignmentEdit(true);
      await updateZoneCityAssignment({
        assignmentId: editingAssignmentId,
        cityId: editingCityId,
        sortOrder: Number(editingSortOrder || "0"),
      });
      const rows = await listZoneCities(id);
      setZoneCities(rows);
      setPendingZoneCityOrder(null);
      toast({ title: "Assignment updated" });
      cancelEdit();
    } catch (e: unknown) {
      toast({
        title: "Could not update assignment",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingAssignmentEdit(false);
    }
  }

  function cancelPendingRouteOrder() {
    setPendingZoneCityOrder(null);
  }

  async function persistZoneCityOrder(ordered: DeliveryZoneCityRow[]) {
    const n = ordered.length;
    if (n === 0) return;
    const TEMP_BASE = 100_000;
    const sequential = withSequentialSortOrder(ordered);
    setZoneCities(sequential);
    setPendingZoneCityOrder(null);
    try {
      setSavingReorder(true);
      for (let i = 0; i < n; i++) {
        const row = sequential[i];
        await updateZoneCityAssignment({
          assignmentId: row.id,
          cityId: row.cityId,
          sortOrder: TEMP_BASE + i,
        });
      }
      for (let i = 0; i < n; i++) {
        const row = sequential[i];
        await updateZoneCityAssignment({
          assignmentId: row.id,
          cityId: row.cityId,
          sortOrder: i + 1,
        });
      }
      toast({ title: "Route order saved" });
    } catch (e: unknown) {
      toast({
        title: "Could not save route order",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      await reload();
    } finally {
      setSavingReorder(false);
    }
  }

  async function handleSaveRouteOrder() {
    if (!hasUnsavedOrderChanges || !pendingZoneCityOrder) return;
    await persistZoneCityOrder(pendingZoneCityOrder);
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    try {
      setRemoveSaving(true);
      await removeZoneCityAssignment(removeTarget.id);
      const rows = await listZoneCities(id);
      setZoneCities(rows);
      setPendingZoneCityOrder(null);
      toast({ title: "City removed from zone" });
      setRemoveTarget(null);
    } catch (e: unknown) {
      toast({
        title: "Could not remove city",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRemoveSaving(false);
    }
  }

  if (loading) {
    return (
      <AppPageShell fillHeight className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6">
        <FormTwoColumnPageSkeleton withLineItems={false} />
      </AppPageShell>
    );
  }

  if (!zone) {
    return (
      <AppPageShell
        fillHeight
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={
          <Button variant="ghost" size="icon" asChild aria-label="Back to zone cities">
            <Link href="/app/delivery-notes/zone-cities">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-sm text-muted-foreground">
            This zone could not be found. It may have been deleted or you may not
            have access.
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link href="/app/delivery-notes/zone-cities">Back to zones</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppPageShell>
    );
  }

  const activeCities = cities;

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to zone cities">
          <Link href="/app/delivery-notes/zone-cities">
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
                disabled={savingDetails}
                className="rounded font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveDetails()}
                disabled={savingDetails}
                className="gap-2 rounded font-semibold shadow-sm"
              >
                <Save className="size-3.5 shrink-0" aria-hidden />
                {savingDetails ? "Saving…" : "Save changes"}
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
              {zone.name}
            </h2>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 opacity-70" aria-hidden />
                {zone.driverUserId ? zone.driverDisplay : "No driver assigned"}
              </span>
              <span aria-hidden>·</span>
              <span>
                {zoneCities.length}{" "}
                {zoneCities.length === 1 ? "city" : "cities"} in route
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-2 sm:pt-0">
            <div className="flex items-center gap-2">
              <Switch
                id="zone-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={!isEditing}
                aria-label="Zone active"
              />
              <Label htmlFor="zone-active" className="text-xs font-medium">
                Active
              </Label>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10">
          <SectionCard icon={Layers} title="Zone details">
            <div className="space-y-2">
              <ReqLabel htmlFor="z-name">Zone name</ReqLabel>
              <Input
                id="z-name"
                value={form.name}
                readOnly={!isEditing}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Zone name"
                className={nameError ? "border-destructive" : ""}
              />
              {nameError ? (
                <p className="text-xs text-destructive">{nameError}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="z-desc" className={fieldLabelClass}>
                Description
              </Label>
              <Textarea
                id="z-desc"
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

            <div className="space-y-2">
              <Label htmlFor="z-driver" className={fieldLabelClass}>
                Driver
              </Label>
              <Select
                value={form.driverUserId}
                onValueChange={(v) =>
                  setForm({ ...form, driverUserId: v })
                }
                disabled={!isEditing}
              >
                <SelectTrigger id="z-driver" className="h-8 w-full rounded-sm">
                  <SelectValue placeholder="Assign driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No driver</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.userId} value={d.userId}>
                      {d.profile?.full_name?.trim() ||
                        d.profile?.email?.trim() ||
                        d.userId.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SectionCard>

          <SectionCard icon={MapPinned} title="Assigned cities">
            <p className="text-xs text-muted-foreground">
              Drag cities to set route order, then click Update order to save.
              Each city can only appear once per zone.
            </p>

            {hasUnsavedOrderChanges ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200/90 bg-amber-50/80 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/30">
                <p className="text-xs text-amber-950 dark:text-amber-100">
                  Route order changed — save when you are done reordering.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingReorder}
                    onClick={() => void handleSaveRouteOrder()}
                  >
                    {savingReorder ? "Saving…" : "Update order"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingReorder}
                    onClick={cancelPendingRouteOrder}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="space-y-2">
                <Label className={fieldLabelClass}>Add city</Label>
                <SearchableDeliveryCitySelect
                  cities={activeCities}
                  value={assignCityId}
                  onChange={setAssignCityId}
                  placeholder="Select city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="z-sort" className={fieldLabelClass}>
                  Order
                </Label>
                <Input
                  id="z-sort"
                  type="number"
                  min={1}
                  value={assignSortOrder}
                  onChange={(e) => setAssignSortOrder(e.target.value)}
                  className="tabular-nums sm:w-24"
                />
              </div>
              <Button
                type="button"
                className="sm:mb-0"
                disabled={
                  assignSaving ||
                  !assignCityId ||
                  !assignSortOrder ||
                  Number(assignSortOrder) < 1
                }
                onClick={() => void handleAssign()}
              >
                Assign
              </Button>
            </div>

            <div
              className={cn(
                "overflow-x-auto rounded-md border border-border/60",
                savingReorder && "pointer-events-none opacity-60",
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 px-2" aria-label="Reorder" />
                    <TableHead>City</TableHead>
                    <TableHead className="text-right">Order</TableHead>
                    <TableHead className="text-right w-[140px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedZoneCities.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No cities assigned yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedZoneCities.map((zc) => {
                      const canDrag =
                        editingAssignmentId === null && !savingReorder;
                      return (
                        <TableRow
                          key={zc.id}
                          className={cn(
                            draggingAssignmentId === zc.id &&
                              "bg-muted/50 opacity-80",
                          )}
                          onDragOver={(e) => {
                            if (!canDrag) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(e) => {
                            if (!canDrag) return;
                            e.preventDefault();
                            const dragId = e.dataTransfer.getData(
                              "application/x-zone-city-assignment",
                            );
                            if (!dragId || dragId === zc.id) return;
                            const fromIndex = displayedZoneCities.findIndex(
                              (r) => r.id === dragId,
                            );
                            const toIndex = displayedZoneCities.findIndex(
                              (r) => r.id === zc.id,
                            );
                            if (fromIndex < 0 || toIndex < 0) return;
                            if (fromIndex === toIndex) return;
                            const newOrder = withSequentialSortOrder(
                              arrayMove(
                                displayedZoneCities,
                                fromIndex,
                                toIndex,
                              ),
                            );
                            if (sameZoneCityOrder(newOrder, zoneCities)) {
                              setPendingZoneCityOrder(null);
                            } else {
                              setPendingZoneCityOrder(newOrder);
                            }
                          }}
                        >
                          <TableCell className="w-10 px-2 align-middle">
                            <div
                              draggable={canDrag}
                              aria-label={`Drag to reorder ${zc.cityName}`}
                              title="Drag to reorder"
                              className={cn(
                                "flex h-8 w-8 cursor-grab items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing",
                                !canDrag &&
                                  "cursor-not-allowed opacity-40 hover:bg-transparent",
                              )}
                              onDragStart={(e) => {
                                if (!canDrag) {
                                  e.preventDefault();
                                  return;
                                }
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData(
                                  "application/x-zone-city-assignment",
                                  zc.id,
                                );
                                setDraggingAssignmentId(zc.id);
                              }}
                              onDragEnd={() => {
                                setDraggingAssignmentId(null);
                              }}
                            >
                              <GripVertical className="h-4 w-4" aria-hidden />
                            </div>
                          </TableCell>
                          <TableCell>
                            {editingAssignmentId === zc.id ? (
                              <SearchableDeliveryCitySelect
                                cities={activeCities}
                                value={editingCityId}
                                onChange={setEditingCityId}
                                placeholder="City"
                                compact
                              />
                            ) : (
                              zc.cityName
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {editingAssignmentId === zc.id ? (
                              <Input
                                type="number"
                                min={1}
                                value={editingSortOrder}
                                onChange={(e) =>
                                  setEditingSortOrder(e.target.value)
                                }
                                className="ml-auto h-8 w-20"
                              />
                            ) : (
                              zc.sortOrder
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingAssignmentId === zc.id ? (
                              <div className="inline-flex flex-wrap justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void saveAssignmentEdit()}
                                  disabled={
                                    savingAssignmentEdit ||
                                    !editingCityId ||
                                    !editingSortOrder
                                  }
                                >
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEdit}
                                  disabled={savingAssignmentEdit}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="inline-flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEdit(zc)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  aria-label={`Remove ${zc.cityName} from zone`}
                                  onClick={() => setRemoveTarget(zc)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </div>
      </div>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove city from zone?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `"${removeTarget.cityName}" will no longer be on this route. You can assign it again later.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmRemove();
              }}
            >
              {removeSaving ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
