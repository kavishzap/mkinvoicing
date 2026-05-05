"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { AppPageShell } from "@/components/app-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { listTeamMembers, type TeamMemberRow } from "@/lib/company-team-service";
import {
  assignCityToZone,
  createDeliveryCity,
  createDeliveryZone,
  listDeliveryCities,
  listDeliveryZones,
  listZoneCities,
  updateDeliveryZoneDriver,
  updateZoneCityAssignment,
  type DeliveryCityRow,
  type DeliveryZoneCityRow,
  type DeliveryZoneRow,
} from "@/lib/delivery-zones-service";

function SearchableCitySelect({
  cities,
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  cities: DeliveryCityRow[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = cities.find((c) => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", compact ? "h-8" : "h-10")}
        >
          <span className="truncate">{selected?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search city..." />
          <CommandList>
            <CommandEmpty>No city found.</CommandEmpty>
            {cities.map((c) => (
              <CommandItem
                key={c.id}
                value={c.name}
                onSelect={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === c.id ? "opacity-100" : "opacity-0"
                  )}
                />
                {c.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function DeliveryZoneCitiesPage() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<TeamMemberRow[]>([]);
  const [cities, setCities] = useState<DeliveryCityRow[]>([]);
  const [zones, setZones] = useState<DeliveryZoneRow[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [zoneCities, setZoneCities] = useState<DeliveryZoneCityRow[]>([]);
  const [cityName, setCityName] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [zoneDescription, setZoneDescription] = useState("");
  const [zoneDriverId, setZoneDriverId] = useState("");
  const [assignCityId, setAssignCityId] = useState("");
  const [assignSortOrder, setAssignSortOrder] = useState("1");
  const [saving, setSaving] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingCityId, setEditingCityId] = useState("");
  const [editingSortOrder, setEditingSortOrder] = useState("");
  const [selectedZoneDriverId, setSelectedZoneDriverId] = useState("");

  const reloadZoneData = async () => {
    const [cityRows, zoneRows, team] = await Promise.all([
      listDeliveryCities(),
      listDeliveryZones(),
      listTeamMembers(),
    ]);
    setCities(cityRows);
    setZones(zoneRows);
    setDrivers(team.filter((m) => m.roleName.toLowerCase().includes("driver")));
    if (!selectedZoneId && zoneRows.length > 0) {
      setSelectedZoneId(zoneRows[0].id);
    } else if (
      selectedZoneId &&
      zoneRows.every((z) => z.id !== selectedZoneId)
    ) {
      setSelectedZoneId(zoneRows[0]?.id ?? "");
    }
  };

  useEffect(() => {
    if (!selectedZoneId) {
      setSelectedZoneDriverId("__none__");
      return;
    }
    const zone = zones.find((z) => z.id === selectedZoneId);
    setSelectedZoneDriverId(zone?.driverUserId ?? "__none__");
  }, [selectedZoneId, zones]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reloadZoneData();
      } catch (e: unknown) {
        if (!cancelled) {
          const err = e as { message?: string };
          toast({
            title: "Failed to load zone cities",
            description: err?.message ?? "Please try again.",
            variant: "destructive",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  useEffect(() => {
    if (!selectedZoneId) {
      setZoneCities([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listZoneCities(selectedZoneId);
        if (!cancelled) setZoneCities(rows);
      } catch (e: unknown) {
        if (!cancelled) {
          const err = e as { message?: string };
          toast({
            title: "Failed to load cities for zone",
            description: err?.message ?? "Please try again.",
            variant: "destructive",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedZoneId, toast]);

  async function handleCreateCity() {
    if (!cityName.trim()) return;
    try {
      setSaving(true);
      await createDeliveryCity(cityName);
      setCityName("");
      await reloadZoneData();
      toast({ title: "City created" });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Could not create city",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateZone() {
    if (!zoneName.trim()) return;
    try {
      setSaving(true);
      await createDeliveryZone({
        name: zoneName,
        description: zoneDescription,
        driverUserId: zoneDriverId || undefined,
      });
      setZoneName("");
      setZoneDescription("");
      setZoneDriverId("");
      await reloadZoneData();
      toast({ title: "Zone created" });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Could not create zone",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignCityToZone() {
    if (!selectedZoneId || !assignCityId) return;
    try {
      setSaving(true);
      await assignCityToZone({
        zoneId: selectedZoneId,
        cityId: assignCityId,
        sortOrder: Number(assignSortOrder || "0"),
      });
      setAssignCityId("");
      setAssignSortOrder(String(zoneCities.length + 1));
      const rows = await listZoneCities(selectedZoneId);
      setZoneCities(rows);
      toast({ title: "City assigned to zone" });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Could not assign city",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

  async function saveEdit() {
    if (!editingAssignmentId) return;
    try {
      setSaving(true);
      await updateZoneCityAssignment({
        assignmentId: editingAssignmentId,
        cityId: editingCityId,
        sortOrder: Number(editingSortOrder || "0"),
      });
      const rows = await listZoneCities(selectedZoneId);
      setZoneCities(rows);
      toast({ title: "Assignment updated" });
      cancelEdit();
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Could not update assignment",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateZoneDriver() {
    if (!selectedZoneId) return;
    try {
      setSaving(true);
      await updateDeliveryZoneDriver(
        selectedZoneId,
        !selectedZoneDriverId || selectedZoneDriverId === "__none__"
          ? null
          : selectedZoneDriverId
      );
      await reloadZoneData();
      toast({ title: "Zone driver updated" });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Could not update zone driver",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPageShell
      className="max-w-7xl"
      subtitle="Create cities, create zones, and assign city sequence for delivery routes."
      leading={
        <Button variant="ghost" size="icon" asChild aria-label="Back to delivery notes">
          <Link href="/app/delivery-notes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                placeholder="New city name"
              />
              <Button
                type="button"
                onClick={() => void handleCreateCity()}
                disabled={saving || !cityName.trim()}
              >
                Add city
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                        No cities yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cities.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.isActive ? "Active" : "Inactive"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Zone name"
              />
              <Input
                value={zoneDescription}
                onChange={(e) => setZoneDescription(e.target.value)}
                placeholder="Description (optional)"
              />
              <Select value={zoneDriverId} onValueChange={setZoneDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign driver (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.userId} value={d.userId}>
                      {d.profile?.full_name?.trim() ||
                        d.profile?.email?.trim() ||
                        d.userId.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={() => void handleCreateZone()}
                disabled={saving || !zoneName.trim()}
              >
                Add zone
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        No zones yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    zones.map((z) => (
                      <TableRow key={z.id}>
                        <TableCell>{z.name}</TableCell>
                        <TableCell>{z.driverDisplay}</TableCell>
                        <TableCell>{z.isActive ? "Active" : "Inactive"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Link Zone to Cities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-5">
            <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
              <SelectTrigger>
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name} ({z.driverDisplay})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedZoneDriverId} onValueChange={setSelectedZoneDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Assign / change driver" />
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
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleUpdateZoneDriver()}
              disabled={saving || !selectedZoneId}
            >
              Update driver
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <SearchableCitySelect
              cities={cities.filter((c) => c.isActive)}
              value={assignCityId}
              onChange={setAssignCityId}
              placeholder="Select city"
            />
            <Input
              type="number"
              min="1"
              value={assignSortOrder}
              onChange={(e) => setAssignSortOrder(e.target.value)}
              placeholder="Sort order"
            />
            <Button
              type="button"
              onClick={() => void handleAssignCityToZone()}
              disabled={saving || !selectedZoneId || !assignCityId || !assignSortOrder}
            >
              Assign city
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zoneCities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No links yet for this zone.
                    </TableCell>
                  </TableRow>
                ) : (
                  zoneCities.map((zc) => (
                    <TableRow key={zc.id}>
                      <TableCell>{zones.find((z) => z.id === zc.zoneId)?.name ?? "—"}</TableCell>
                      <TableCell>
                        {zones.find((z) => z.id === zc.zoneId)?.driverDisplay ?? "—"}
                      </TableCell>
                      <TableCell>
                        {editingAssignmentId === zc.id ? (
                          <SearchableCitySelect
                            cities={cities.filter((c) => c.isActive)}
                            value={editingCityId}
                            onChange={setEditingCityId}
                            placeholder="Select city"
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
                            min="1"
                            value={editingSortOrder}
                            onChange={(e) => setEditingSortOrder(e.target.value)}
                            className="h-8 w-24 ml-auto"
                          />
                        ) : (
                          zc.sortOrder
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingAssignmentId === zc.id ? (
                          <div className="inline-flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void saveEdit()}
                              disabled={saving || !editingCityId || !editingSortOrder}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={cancelEdit}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(zc)}
                          >
                            Edit
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
    </AppPageShell>
  );
}
