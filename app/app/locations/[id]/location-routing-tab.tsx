"use client";

import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, Trash2, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { TeamMemberRow } from "@/lib/company-team-service";
import {
  addLocationDriverLink,
  loadLocationRoutingTabData,
  removeLocationDriverLink,
  type LocationDriverLinkDisplayRow,
  type LocationRoutingTabChoice,
  type ZoneForDriverRow,
} from "@/lib/location-zones-drivers-service";

const linkClass =
  "font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

function DriverNameLink({
  displayName,
  membershipId,
}: {
  displayName: string;
  membershipId: string | null;
}) {
  if (!membershipId) {
    return <span className="text-sm font-medium">{displayName}</span>;
  }
  return (
    <Link
      href={`/app/company-team/${membershipId}`}
      className={cn(linkClass, "text-sm font-semibold")}
    >
      {displayName}
    </Link>
  );
}

const ZonesCell = memo(function ZonesCell({
  zones,
}: {
  zones: ZoneForDriverRow[];
}) {
  if (zones.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        None linked — assign this driver on a delivery zone.
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {zones.map((z) => (
        <Link
          key={z.id}
          href={`/app/delivery-notes/zone-cities/${z.id}`}
          className={cn(
            "inline-flex max-w-full rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
            z.isActive
              ? "border-border/70 bg-muted/40 text-primary hover:bg-muted/60"
              : "border-border/50 bg-muted/20 text-muted-foreground line-through hover:text-primary/80",
          )}
          title={z.description ?? undefined}
        >
          <span className="truncate underline-offset-2 hover:underline">
            {z.name}
          </span>
        </Link>
      ))}
    </div>
  );
});

export function LocationRoutingTab({
  locationId,
  readOnly = false,
  enabled = true,
}: {
  locationId: string;
  readOnly?: boolean;
  /** When false, data is not fetched (e.g. hidden tab). */
  enabled?: boolean;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  const [driverLinks, setDriverLinks] = useState<LocationDriverLinkDisplayRow[]>(
    [],
  );
  const [zonesByDriverId, setZonesByDriverId] = useState<
    Record<string, ZoneForDriverRow[]>
  >({});
  const [driverChoices, setDriverChoices] = useState<
    LocationRoutingTabChoice[]
  >([]);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] =
    useState<LocationDriverLinkDisplayRow | null>(null);
  const [removeSaving, setRemoveSaving] = useState(false);

  const loadGen = useRef(0);
  const driverMembersRef = useRef<TeamMemberRow[] | null>(null);

  const applyPayload = useCallback(
    (data: Awaited<ReturnType<typeof loadLocationRoutingTabData>>) => {
      driverMembersRef.current = data.driverMembers;
      setDriverLinks(data.driverLinks);
      setZonesByDriverId(data.zonesByDriverId);
      setDriverChoices(data.driverChoices);
    },
    [],
  );

  const filteredDriverChoices = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    if (!q) return driverChoices;
    return driverChoices.filter((d) => d.label.toLowerCase().includes(q));
  }, [driverChoices, driverSearch]);

  useEffect(() => {
    if (!enabled || !locationId) return;

    const gen = ++loadGen.current;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await loadLocationRoutingTabData(locationId, {
          driverMembers: driverMembersRef.current ?? undefined,
        });
        if (cancelled || gen !== loadGen.current) return;
        applyPayload(data);
      } catch (e: unknown) {
        if (cancelled || gen !== loadGen.current) return;
        toast({
          title: "Failed to load drivers",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled && gen === loadGen.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable; errors only
  }, [enabled, locationId, applyPayload]);

  const refreshLinks = useCallback(async () => {
    const data = await loadLocationRoutingTabData(locationId, {
      driverMembers: driverMembersRef.current ?? undefined,
    });
    applyPayload(data);
  }, [locationId, applyPayload]);

  async function handleAddDriver(userId: string) {
    try {
      setAddingUserId(userId);
      await addLocationDriverLink(locationId, userId);
      setAddDialogOpen(false);
      setDriverSearch("");
      await refreshLinks();
      const label =
        driverChoices.find((d) => d.userId === userId)?.label ?? "Driver";
      toast({
        title: "Driver added",
        description: `${label} is now assigned to this location.`,
      });
    } catch (e: unknown) {
      toast({
        title: "Could not add driver",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingUserId(null);
    }
  }

  async function confirmRemoveDriver() {
    if (!removeTarget) return;
    try {
      setRemoveSaving(true);
      await removeLocationDriverLink(removeTarget.id);
      setRemoveTarget(null);
      await refreshLinks();
      toast({
        title: "Driver removed",
        description: `${removeTarget.displayName} is no longer assigned to this location.`,
      });
    } catch (e: unknown) {
      toast({
        title: "Could not remove driver",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRemoveSaving(false);
    }
  }

  if (!enabled) {
    return null;
  }

  if (loading) {
    return <FormTwoColumnPageSkeleton withLineItems={false} className="border-0 p-0 shadow-none" />;
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-sm font-semibold text-foreground">Assigned drivers</h3>
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 shrink-0"
            disabled={removeSaving || Boolean(addingUserId)}
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add driver
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Driver</TableHead>
              <TableHead className="min-w-[200px] text-xs">
                Delivery zones
              </TableHead>
              {!readOnly ? (
                <TableHead className="w-[72px] text-right text-xs">
                  Actions
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {driverLinks.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={readOnly ? 2 : 3}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No drivers assigned yet.
                </TableCell>
              </TableRow>
            ) : (
              driverLinks.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top">
                    <DriverNameLink
                      displayName={row.displayName}
                      membershipId={row.membershipId}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <ZonesCell
                      zones={zonesByDriverId[row.driverUserId] ?? []}
                    />
                  </TableCell>
                  {!readOnly ? (
                    <TableCell className="align-top text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={removeSaving || Boolean(addingUserId)}
                        aria-label={`Remove ${row.displayName}`}
                        onClick={() => setRemoveTarget(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          if (!addingUserId) {
            setAddDialogOpen(open);
            if (!open) setDriverSearch("");
          }
        }}
      >
        <DialogContent className="flex max-h-[min(80vh,32rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 text-left">
            <DialogTitle>Add driver to location</DialogTitle>
            <DialogDescription>
              Choose a team member with the driver role. Drivers already
              assigned elsewhere cannot be added until removed from that
              location.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
            {driverChoices.length > 0 ? (
              <div className="relative shrink-0">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  placeholder="Search drivers…"
                  className="h-9 pl-9"
                  autoComplete="off"
                  aria-label="Search drivers"
                />
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {driverChoices.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <Truck className="h-9 w-9 opacity-35" aria-hidden />
                  <p className="font-medium text-foreground">
                    No drivers available
                  </p>
                  <p className="max-w-xs text-xs">
                    Every driver is already assigned to this location or
                    another. Remove a link elsewhere or add driver roles in
                    Company team.
                  </p>
                  <Button variant="outline" size="sm" className="mt-2" asChild>
                    <Link href="/app/company-team">Company team</Link>
                  </Button>
                </div>
              ) : filteredDriverChoices.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No drivers match your search.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5" role="listbox" aria-label="Drivers">
                  {filteredDriverChoices.map((d) => {
                    const isAdding = addingUserId === d.userId;
                    return (
                      <li key={d.userId}>
                        <button
                          type="button"
                          role="option"
                          disabled={Boolean(addingUserId)}
                          aria-selected={isAdding}
                          onClick={() => void handleAddDriver(d.userId)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-left text-sm transition-colors",
                            "hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isAdding && "border-primary/30 bg-primary/5",
                            addingUserId &&
                              !isAdding &&
                              "pointer-events-none opacity-50",
                          )}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
                            {isAdding ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <UserRound className="h-4 w-4" aria-hidden />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 font-medium text-foreground">
                            {d.label}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {isAdding ? "Adding…" : "Add"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removeSaving) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove driver from location?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `${removeTarget.displayName} will be unassigned from this location. Their delivery zone links are unchanged — only this location assignment is removed.`
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
                void confirmRemoveDriver();
              }}
            >
              {removeSaving ? "Removing…" : "Remove driver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
