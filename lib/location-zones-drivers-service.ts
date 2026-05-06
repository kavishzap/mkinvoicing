import { supabase } from "@/lib/supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";
import { getCurrentUserId } from "@/lib/settings-service";
import {
  listTeamMembers,
  type TeamMemberRow,
  isDriverRoleTeamMember,
} from "@/lib/company-team-service";

async function requireCompanyId(): Promise<string> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No company found for this account. Complete company setup first.",
    );
  }
  return companyId;
}

/** Drivers with an active `location_drivers` row on any location except `excludeLocationId`. */
async function driverUserIdsAssignedElsewhere(
  companyId: string,
  excludeLocationId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("location_drivers")
    .select("driver_user_id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .neq("location_id", excludeLocationId);

  if (error) throw new Error(error.message);

  return new Set(
    (data ?? [])
      .map((r: { driver_user_id?: string }) =>
        String(r.driver_user_id ?? ""),
      )
      .filter(Boolean),
  );
}

/** Zones where `zones.driver_user_id` matches (delivery zone ↔ driver). */
export type ZoneForDriverRow = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  driverUserId: string;
};

export async function listZonesForDriverUserIds(
  driverUserIds: string[],
): Promise<Record<string, ZoneForDriverRow[]>> {
  const companyId = await requireCompanyId();
  const unique = [...new Set(driverUserIds.filter(Boolean))];
  const byDriver: Record<string, ZoneForDriverRow[]> = {};
  for (const id of unique) {
    byDriver[id] = [];
  }
  if (unique.length === 0) return byDriver;

  const { data, error } = await supabase
    .from("zones")
    .select("id, name, description, is_active, driver_user_id")
    .eq("company_id", companyId)
    .in("driver_user_id", unique)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  for (const r of data ?? []) {
    const driverUserId = (r.driver_user_id as string | null) ?? null;
    if (!driverUserId || !(driverUserId in byDriver)) continue;
    byDriver[driverUserId].push({
      id: String(r.id),
      name: String(r.name ?? ""),
      description: (r.description as string | null) ?? null,
      isActive: Boolean(r.is_active),
      driverUserId,
    });
  }

  return byDriver;
}

export type LocationDriverLinkRow = {
  id: string;
  driverUserId: string;
  displayName: string;
  isPrimary: boolean;
  isActive: boolean;
  assignedFrom: string;
  assignedUntil: string | null;
};

function memberLabel(m: TeamMemberRow): string {
  return (
    m.profile?.full_name?.trim() ||
    m.profile?.email?.trim() ||
    m.userId.slice(0, 8)
  );
}

/** Locations linked to a driver via `location_drivers` (any location type). */
export type DriverLocationAssignmentRow = {
  linkId: string;
  locationId: string;
  name: string;
  locationType: string;
  linkActive: boolean;
  locationActive: boolean;
  isPrimary: boolean;
};

export async function listDriverLocationAssignments(
  driverUserId: string,
): Promise<DriverLocationAssignmentRow[]> {
  const companyId = await requireCompanyId();
  const { data: links, error: le } = await supabase
    .from("location_drivers")
    .select("id, location_id, is_primary, is_active")
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId)
    .order("created_at", { ascending: true });

  if (le) throw new Error(le.message);
  const linkRows = links ?? [];
  if (linkRows.length === 0) return [];

  const locIds = [
    ...new Set(
      linkRows.map((r: { location_id?: string }) =>
        String(r.location_id ?? ""),
      ),
    ),
  ].filter(Boolean);

  const { data: locs, error: locErr } = await supabase
    .from("locations")
    .select("id, name, location_type, is_active")
    .eq("company_id", companyId)
    .in("id", locIds);

  if (locErr) throw new Error(locErr.message);

  const locById = new Map(
    (locs ?? []).map((l: Record<string, unknown>) => [
      String(l.id),
      {
        name: String(l.name ?? ""),
        locationType: String(l.location_type ?? ""),
        locationActive: Boolean(l.is_active),
      },
    ]),
  );

  return linkRows.map((r: Record<string, unknown>) => {
    const lid = String(r.location_id ?? "");
    const loc = locById.get(lid);
    return {
      linkId: String(r.id),
      locationId: lid,
      name: (loc?.name ?? "").trim() || lid.slice(0, 8),
      locationType: loc?.locationType ?? "",
      linkActive: Boolean(r.is_active),
      locationActive: loc?.locationActive ?? false,
      isPrimary: Boolean(r.is_primary),
    };
  });
}

function mapLocationDriverRows(
  rows: Record<string, unknown>[],
  labelByUserId: Map<string, string>,
): LocationDriverLinkRow[] {
  return rows.map((r) => ({
    id: String(r.id),
    driverUserId: String(r.driver_user_id),
    displayName:
      labelByUserId.get(String(r.driver_user_id)) ??
      String(r.driver_user_id).slice(0, 8),
    isPrimary: Boolean(r.is_primary),
    isActive: Boolean(r.is_active),
    assignedFrom: String(r.assigned_from ?? ""),
    assignedUntil: (r.assigned_until as string | null) ?? null,
  }));
}

export type LocationRoutingTabChoice = { userId: string; label: string };

/** One round-trip batch for the location routing UI (avoids duplicate team / link fetches). */
export async function loadLocationRoutingTabData(
  locationId: string,
): Promise<{
  driverLinks: LocationDriverLinkRow[];
  zonesByDriverId: Record<string, ZoneForDriverRow[]>;
  driverChoices: LocationRoutingTabChoice[];
}> {
  const companyId = await requireCompanyId();

  const [members, linksResult, busyElsewhere] = await Promise.all([
    listTeamMembers(),
    supabase
      .from("location_drivers")
      .select(
        "id, driver_user_id, is_primary, is_active, assigned_from, assigned_until, created_at",
      )
      .eq("company_id", companyId)
      .eq("location_id", locationId)
      .order("created_at", { ascending: true }),
    driverUserIdsAssignedElsewhere(companyId, locationId),
  ]);

  if (linksResult.error) throw new Error(linksResult.error.message);

  const labelByUserId = new Map(members.map((m) => [m.userId, memberLabel(m)]));
  const rawLinks = (linksResult.data ?? []) as Record<string, unknown>[];
  const driverLinks = mapLocationDriverRows(rawLinks, labelByUserId);
  const driverIds = driverLinks.map((d) => d.driverUserId);

  const zonesByDriverId = await listZonesForDriverUserIds(driverIds);

  const assigned = new Set(driverIds);
  const driverChoices: LocationRoutingTabChoice[] = members
    .filter(
      (m) =>
        isDriverRoleTeamMember(m) &&
        !assigned.has(m.userId) &&
        !busyElsewhere.has(m.userId),
    )
    .map((m) => ({ userId: m.userId, label: memberLabel(m) }));

  return { driverLinks, zonesByDriverId, driverChoices };
}

export async function listLocationDriverLinks(
  locationId: string,
): Promise<LocationDriverLinkRow[]> {
  const companyId = await requireCompanyId();
  const [members, { data, error }] = await Promise.all([
    listTeamMembers(),
    supabase
      .from("location_drivers")
      .select(
        "id, driver_user_id, is_primary, is_active, assigned_from, assigned_until, created_at",
      )
      .eq("company_id", companyId)
      .eq("location_id", locationId)
      .order("created_at", { ascending: true }),
  ]);

  if (error) throw new Error(error.message);

  const labelByUserId = new Map(members.map((m) => [m.userId, memberLabel(m)]));

  return mapLocationDriverRows((data ?? []) as Record<string, unknown>[], labelByUserId);
}

export async function addLocationDriverLink(
  locationId: string,
  driverUserId: string,
): Promise<void> {
  const companyId = await requireCompanyId();
  const createdBy = await getCurrentUserId();
  const existing = await listLocationDriverLinks(locationId);
  if (existing.some((l) => l.driverUserId === driverUserId)) {
    throw new Error("This driver is already assigned to the location.");
  }

  const { data: otherActive, error: otherErr } = await supabase
    .from("location_drivers")
    .select("id")
    .eq("company_id", companyId)
    .eq("driver_user_id", driverUserId)
    .eq("is_active", true)
    .neq("location_id", locationId)
    .limit(1);

  if (otherErr) throw new Error(otherErr.message);
  if ((otherActive?.length ?? 0) > 0) {
    throw new Error(
      "This driver is already assigned to another location. Remove them there first.",
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("location_drivers").insert({
    company_id: companyId,
    location_id: locationId,
    driver_user_id: driverUserId,
    is_primary: existing.length === 0,
    is_active: true,
    assigned_from: today,
    created_by: createdBy,
  } as never);

  if (error) throw new Error(error.message);
}

export async function removeLocationDriverLink(linkId: string): Promise<void> {
  const companyId = await requireCompanyId();
  const { error } = await supabase
    .from("location_drivers")
    .delete()
    .eq("id", linkId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
}

export async function setLocationDriverPrimary(
  locationId: string,
  linkId: string,
): Promise<void> {
  const companyId = await requireCompanyId();
  const { error: e1 } = await supabase
    .from("location_drivers")
    .update({ is_primary: false })
    .eq("company_id", companyId)
    .eq("location_id", locationId);

  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase
    .from("location_drivers")
    .update({ is_primary: true })
    .eq("id", linkId)
    .eq("company_id", companyId)
    .eq("location_id", locationId);

  if (e2) throw new Error(e2.message);
}

export async function setLocationDriverActive(
  linkId: string,
  active: boolean,
): Promise<void> {
  const companyId = await requireCompanyId();
  const { error } = await supabase
    .from("location_drivers")
    .update({ is_active: active })
    .eq("id", linkId)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
}

/** Team members not yet assigned to this location. */
export async function listUnassignedDriversForLocation(
  locationId: string,
): Promise<TeamMemberRow[]> {
  const companyId = await requireCompanyId();
  const [members, assigned, busyElsewhere] = await Promise.all([
    listTeamMembers(),
    listLocationDriverLinks(locationId),
    driverUserIdsAssignedElsewhere(companyId, locationId),
  ]);
  const ids = new Set(assigned.map((a) => a.driverUserId));
  return members.filter(
    (m) =>
      isDriverRoleTeamMember(m) &&
      !ids.has(m.userId) &&
      !busyElsewhere.has(m.userId),
  );
}
