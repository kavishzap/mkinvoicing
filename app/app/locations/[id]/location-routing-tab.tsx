"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import {
  addLocationDriverLink,
  loadLocationRoutingTabData,
  removeLocationDriverLink,
  setLocationDriverActive,
  setLocationDriverPrimary,
  type LocationDriverLinkRow,
  type ZoneForDriverRow,
} from "@/lib/location-zones-drivers-service";

function ZonesCell({ zones }: { zones: ZoneForDriverRow[] }) {
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
        <span
          key={z.id}
          className={cn(
            "inline-flex max-w-full rounded-md border px-2 py-0.5 text-xs font-medium",
            z.isActive
              ? "border-border/70 bg-muted/40 text-foreground"
              : "border-border/50 bg-muted/20 text-muted-foreground line-through",
          )}
          title={z.description ?? undefined}
        >
          <span className="truncate">{z.name}</span>
        </span>
      ))}
    </div>
  );
}

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
  const [busy, setBusy] = useState(false);

  const [driverLinks, setDriverLinks] = useState<LocationDriverLinkRow[]>([]);
  const [zonesByDriverId, setZonesByDriverId] = useState<
    Record<string, ZoneForDriverRow[]>
  >({});
  const [driverChoices, setDriverChoices] = useState<
    { userId: string; label: string }[]
  >([]);

  const [addDriverId, setAddDriverId] = useState<string>("");

  const reload = useCallback(async () => {
    const data = await loadLocationRoutingTabData(locationId);
    setDriverLinks(data.driverLinks);
    setZonesByDriverId(data.zonesByDriverId);
    setDriverChoices(data.driverChoices);
    setAddDriverId("");
  }, [locationId]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await loadLocationRoutingTabData(locationId);
        if (cancelled) return;
        setDriverLinks(data.driverLinks);
        setZonesByDriverId(data.zonesByDriverId);
        setDriverChoices(data.driverChoices);
        setAddDriverId("");
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Failed to load drivers",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, locationId, toast]);

  async function run(fn: () => Promise<void>): Promise<void> {
    try {
      setBusy(true);
      await fn();
      await reload();
    } catch (e: unknown) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
        Loading drivers and zones…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Assigned drivers
          </h3>
          <p className="text-xs text-muted-foreground">
            Link drivers to this location. Their delivery zones come from each
            zone&apos;s driver assignment (
            <span className="font-medium text-foreground/80">zones</span> table).
          </p>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={addDriverId || undefined}
              onValueChange={setAddDriverId}
              disabled={busy || driverChoices.length === 0}
            >
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue
                  placeholder={
                    driverChoices.length === 0
                      ? "No drivers to add"
                      : "Add driver…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {driverChoices.map((d) => (
                  <SelectItem key={d.userId} value={d.userId}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1"
              disabled={busy || !addDriverId}
              onClick={() =>
                void run(() =>
                  addLocationDriverLink(locationId, addDriverId),
                )
              }
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add driver
            </Button>
          </div>
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
              <TableHead className="w-[90px] text-xs">Active</TableHead>
              <TableHead className="w-[100px] text-xs">Primary</TableHead>
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
                  colSpan={readOnly ? 4 : 5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No drivers assigned yet.
                </TableCell>
              </TableRow>
            ) : (
              driverLinks.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top text-sm font-medium">
                    {row.displayName}
                  </TableCell>
                  <TableCell className="align-top">
                    <ZonesCell
                      zones={zonesByDriverId[row.driverUserId] ?? []}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Switch
                      checked={row.isActive}
                      disabled={busy || readOnly}
                      onCheckedChange={(v) =>
                        void run(() =>
                          setLocationDriverActive(row.id, Boolean(v)),
                        )
                      }
                      aria-label={`Active ${row.displayName}`}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`dp-${row.id}`}
                        checked={row.isPrimary}
                        disabled={busy || readOnly || !row.isActive}
                        onCheckedChange={(v) => {
                          if (v === true) {
                            void run(() =>
                              setLocationDriverPrimary(locationId, row.id),
                            );
                          }
                        }}
                        aria-label={`Primary driver ${row.displayName}`}
                      />
                      <label
                        htmlFor={`dp-${row.id}`}
                        className={cn(
                          "text-xs text-muted-foreground",
                          readOnly ? "" : "cursor-pointer",
                        )}
                      >
                        Primary
                      </label>
                    </div>
                  </TableCell>
                  {!readOnly ? (
                    <TableCell className="align-top text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        aria-label={`Remove ${row.displayName}`}
                        onClick={() =>
                          void run(() => removeLocationDriverLink(row.id))
                        }
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
    </div>
  );
}
