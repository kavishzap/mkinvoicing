import { supabase } from "@/lib/supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";
import { getCurrentUserId } from "@/lib/settings-service";
import {
  listDriverRoleTeamMembers,
  type TeamMemberRow,
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
  companyId?: string,
): Promise<Record<string, ZoneForDriverRow[]>> {
  const cid = companyId ?? (await requireCompanyId());
  const unique = [...new Set(driverUserIds.filter(Boolean))];
  const byDriver: Record<string, ZoneForDriverRow[]> = {};
  for (const id of unique) {
    byDriver[id] = [];
  }
  if (unique.length === 0) return byDriver;

  const { data, error } = await supabase
    .from("zones")
    .select("id, name, description, is_active, driver_user_id")
    .eq("company_id", cid)
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

/** UI list row — driver name + zones only (no active/primary toggles). */
export type LocationDriverLinkDisplayRow = {
  id: string;
  driverUserId: string;
  displayName: string;
  /** When set, links to `/app/company-team/[membershipId]`. */
  membershipId: string | null;
};

function memberLabel(m: TeamMemberRow): string {
  return (
    m.profile?.full_name?.trim() ||
    m.profile?.email?.trim() ||
    m.userId.slice(0, 8)
  );
}

async function fetchMembershipIdsByUserId(
  companyId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;

  const { data, error } = await supabase
    .from("company_users")
    .select("id, user_id")
    .eq("company_id", companyId)
    .in("user_id", uniq);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const uid = String((row as { user_id?: unknown }).user_id ?? "");
    const mid = String((row as { id?: unknown }).id ?? "");
    if (uid && mid) map.set(uid, mid);
  }

  return map;
}

async function fetchUserDisplayLabels(
  userIds: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email")
    .in("id", uniq);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const id = String((row as { id?: unknown }).id ?? "");
    const fullName = String(
      (row as { full_name?: unknown }).full_name ?? "",
    ).trim();
    const email = String((row as { email?: unknown }).email ?? "").trim();
    map.set(id, fullName || email || id.slice(0, 8));
  }

  return map;
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

function mapLocationDriverDisplayRows(
  rows: Record<string, unknown>[],
  labelByUserId: Map<string, string>,
  membershipByUserId: Map<string, string>,
): LocationDriverLinkDisplayRow[] {
  return rows.map((r) => {
    const driverUserId = String(r.driver_user_id);
    return {
      id: String(r.id),
      driverUserId,
      displayName:
        labelByUserId.get(driverUserId) ?? driverUserId.slice(0, 8),
      membershipId: membershipByUserId.get(driverUserId) ?? null,
    };
  });
}

export type LocationRoutingTabChoice = { userId: string; label: string };

/** One round-trip batch for the location routing UI (avoids duplicate team / link fetches). */
export async function loadLocationRoutingTabData(
  locationId: string,
  opts?: { driverMembers?: TeamMemberRow[] },
): Promise<{
  driverLinks: LocationDriverLinkDisplayRow[];
  zonesByDriverId: Record<string, ZoneForDriverRow[]>;
  driverChoices: LocationRoutingTabChoice[];
  /** Pass back into the next refresh to skip re-listing the driver team. */
  driverMembers: TeamMemberRow[];
}> {
  const companyId = await requireCompanyId();
  const driverMembers =
    opts?.driverMembers ?? (await listDriverRoleTeamMembers());

  const [linksResult, busyElsewhere] = await Promise.all([
    supabase
      .from("location_drivers")
      .select("id, driver_user_id, created_at")
      .eq("company_id", companyId)
      .eq("location_id", locationId)
      .order("created_at", { ascending: true }),
    driverUserIdsAssignedElsewhere(companyId, locationId),
  ]);

  if (linksResult.error) throw new Error(linksResult.error.message);

  const labelByUserId = new Map(
    driverMembers.map((m) => [m.userId, memberLabel(m)]),
  );
  const membershipByUserId = new Map(
    driverMembers.map((m) => [m.userId, m.membershipId]),
  );
  const rawLinks = (linksResult.data ?? []) as Record<string, unknown>[];
  const driverIds = [
    ...new Set(
      rawLinks
        .map((r) => String(r.driver_user_id ?? ""))
        .filter(Boolean),
    ),
  ];
  const missingIds = driverIds.filter((id) => !labelByUserId.has(id));

  const [extraLabels, extraMemberships, zonesByDriverId] = await Promise.all([
    missingIds.length > 0
      ? fetchUserDisplayLabels(missingIds)
      : Promise.resolve(new Map<string, string>()),
    missingIds.length > 0
      ? fetchMembershipIdsByUserId(companyId, missingIds)
      : Promise.resolve(new Map<string, string>()),
    listZonesForDriverUserIds(driverIds, companyId),
  ]);

  for (const [id, label] of extraLabels) {
    labelByUserId.set(id, label);
  }
  for (const [id, membershipId] of extraMemberships) {
    membershipByUserId.set(id, membershipId);
  }

  const driverLinks = mapLocationDriverDisplayRows(
    rawLinks,
    labelByUserId,
    membershipByUserId,
  );
  const assigned = new Set(driverIds);
  const driverChoices: LocationRoutingTabChoice[] = driverMembers
    .filter(
      (m) => !assigned.has(m.userId) && !busyElsewhere.has(m.userId),
    )
    .map((m) => ({ userId: m.userId, label: memberLabel(m) }));

  return { driverLinks, zonesByDriverId, driverChoices, driverMembers };
}

export async function listLocationDriverLinks(
  locationId: string,
): Promise<LocationDriverLinkRow[]> {
  const companyId = await requireCompanyId();
  const { data, error } = await supabase
    .from("location_drivers")
    .select(
      "id, driver_user_id, is_primary, is_active, assigned_from, assigned_until, created_at",
    )
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rawLinks = (data ?? []) as Record<string, unknown>[];
  const driverIds = [
    ...new Set(
      rawLinks.map((r) => String(r.driver_user_id ?? "")).filter(Boolean),
    ),
  ];
  const labelByUserId = await fetchUserDisplayLabels(driverIds);

  return mapLocationDriverRows(rawLinks, labelByUserId);
}

export async function addLocationDriverLink(
  locationId: string,
  driverUserId: string,
): Promise<void> {
  const companyId = await requireCompanyId();
  const createdBy = await getCurrentUserId();
  const { data: existingRows, error: existingErr } = await supabase
    .from("location_drivers")
    .select("id, driver_user_id")
    .eq("company_id", companyId)
    .eq("location_id", locationId);

  if (existingErr) throw new Error(existingErr.message);

  const existing = existingRows ?? [];
  if (
    existing.some(
      (r) => String((r as { driver_user_id?: unknown }).driver_user_id ?? "") === driverUserId,
    )
  ) {
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
  const [driverMembers, assignedResult, busyElsewhere] = await Promise.all([
    listDriverRoleTeamMembers(),
    supabase
      .from("location_drivers")
      .select("driver_user_id")
      .eq("company_id", companyId)
      .eq("location_id", locationId),
    driverUserIdsAssignedElsewhere(companyId, locationId),
  ]);

  if (assignedResult.error) throw new Error(assignedResult.error.message);

  const ids = new Set(
    (assignedResult.data ?? [])
      .map((r) => String((r as { driver_user_id?: unknown }).driver_user_id ?? ""))
      .filter(Boolean),
  );
  return driverMembers.filter(
    (m) => !ids.has(m.userId) && !busyElsewhere.has(m.userId),
  );
}
