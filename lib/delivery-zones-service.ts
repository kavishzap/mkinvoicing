import { supabase } from "@/lib/supabaseClient";
import { requireActiveCompanyId } from "@/lib/active-company";
import { getCurrentUserId } from "@/lib/settings-service";
import { listTeamMembers } from "@/lib/company-team-service";

export type DeliveryCityRow = {
  id: string;
  name: string;
  isActive: boolean;
};

export type DeliveryZoneRow = {
  id: string;
  name: string;
  description: string | null;
  driverUserId: string | null;
  driverDisplay: string;
  isActive: boolean;
};

export type DeliveryZoneCityRow = {
  id: string;
  zoneId: string;
  cityId: string;
  cityName: string;
  sortOrder: number;
};

export async function listDeliveryCities(): Promise<DeliveryCityRow[]> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("cities")
    .select("id, name, is_active")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    isActive: Boolean(r.is_active),
  }));
}

export async function createDeliveryCity(name: string): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const clean = name.trim();
  if (!clean) throw new Error("City name is required.");
  const { error } = await supabase.from("cities").insert({
    company_id: companyId,
    name: clean,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never);
  if (error) throw new Error(error.message);
}

export async function listDeliveryZones(): Promise<DeliveryZoneRow[]> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("zones")
    .select("id, name, description, driver_user_id, is_active")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);

  const drivers = await listTeamMembers();
  const profileByUserId = new Map(
    drivers.map((m) => [
      m.userId,
      m.profile?.full_name?.trim() ||
        m.profile?.email?.trim() ||
        m.userId.slice(0, 8),
    ])
  );

  return (data ?? []).map((r) => {
    const driverUserId = (r.driver_user_id as string | null) ?? null;
    return {
      id: String(r.id),
      name: String(r.name ?? ""),
      description: (r.description as string | null) ?? null,
      driverUserId,
      driverDisplay: driverUserId
        ? profileByUserId.get(driverUserId) ?? driverUserId.slice(0, 8)
        : "—",
      isActive: Boolean(r.is_active),
    };
  });
}

export async function createDeliveryZone(input: {
  name: string;
  description?: string;
  driverUserId?: string;
}): Promise<void> {
  const companyId = await requireActiveCompanyId();
  const userId = await getCurrentUserId();
  const cleanName = input.name.trim();
  if (!cleanName) throw new Error("Zone name is required.");
  const { error } = await supabase.from("zones").insert({
    company_id: companyId,
    name: cleanName,
    description: input.description?.trim() || null,
    driver_user_id: input.driverUserId || null,
    is_active: true,
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never);
  if (error) throw new Error(error.message);
}

export async function updateDeliveryZoneDriver(
  zoneId: string,
  driverUserId: string | null
): Promise<void> {
  const companyId = await requireActiveCompanyId();
  if (!zoneId) throw new Error("Zone is required.");
  const { error } = await supabase
    .from("zones")
    .update({
      driver_user_id: driverUserId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", zoneId)
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);
}

export async function listZoneCities(
  zoneId: string
): Promise<DeliveryZoneCityRow[]> {
  const companyId = await requireActiveCompanyId();
  const { data, error } = await supabase
    .from("zone_cities")
    .select("id, zone_id, city_id, sort_order, cities(name)")
    .eq("company_id", companyId)
    .eq("zone_id", zoneId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const city = r.cities as { name?: string } | { name?: string }[] | null;
    const cityObj = Array.isArray(city) ? city[0] : city;
    return {
      id: String(r.id),
      zoneId: String(r.zone_id),
      cityId: String(r.city_id),
      cityName: String(cityObj?.name ?? ""),
      sortOrder: Number(r.sort_order ?? 0),
    };
  });
}

export async function assignCityToZone(input: {
  zoneId: string;
  cityId: string;
  sortOrder: number;
}): Promise<void> {
  const companyId = await requireActiveCompanyId();
  if (!input.zoneId) throw new Error("Zone is required.");
  if (!input.cityId) throw new Error("City is required.");
  if (!Number.isFinite(input.sortOrder) || input.sortOrder <= 0) {
    throw new Error("Sort order must be greater than 0.");
  }
  const { error } = await supabase.from("zone_cities").insert({
    company_id: companyId,
    zone_id: input.zoneId,
    city_id: input.cityId,
    sort_order: Math.trunc(input.sortOrder),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never);
  if (error) {
    const msg = String(error.message ?? "");
    if (
      msg.includes("zone_cities_zone_sort_order_unique") ||
      msg.includes("duplicate key value")
    ) {
      throw new Error(
        "This route order is already used in this zone. Choose a different order number."
      );
    }
    if (msg.includes("zone_cities_zone_city_unique")) {
      throw new Error("This city is already assigned to the selected zone.");
    }
    if (msg.includes("zone_cities_sort_order_positive")) {
      throw new Error("Route order must be greater than 0.");
    }
    if (
      msg.includes("zone_cities_city_id_fkey") ||
      msg.includes("zone_cities_zone_id_fkey")
    ) {
      throw new Error("Selected city or zone is invalid. Refresh and try again.");
    }
    throw new Error("Could not assign city to zone. Please try again.");
  }
}

export async function updateZoneCityAssignment(input: {
  assignmentId: string;
  cityId: string;
  sortOrder: number;
}): Promise<void> {
  const companyId = await requireActiveCompanyId();
  if (!input.assignmentId) throw new Error("Assignment is required.");
  if (!input.cityId) throw new Error("City is required.");
  if (!Number.isFinite(input.sortOrder) || input.sortOrder <= 0) {
    throw new Error("Route order must be greater than 0.");
  }

  const { error } = await supabase
    .from("zone_cities")
    .update({
      city_id: input.cityId,
      sort_order: Math.trunc(input.sortOrder),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.assignmentId)
    .eq("company_id", companyId);

  if (error) {
    const msg = String(error.message ?? "");
    if (
      msg.includes("zone_cities_zone_sort_order_unique") ||
      msg.includes("duplicate key value")
    ) {
      throw new Error(
        "This route order is already used in this zone. Choose a different order number."
      );
    }
    if (msg.includes("zone_cities_zone_city_unique")) {
      throw new Error("This city is already assigned to the selected zone.");
    }
    if (msg.includes("zone_cities_sort_order_positive")) {
      throw new Error("Route order must be greater than 0.");
    }
    throw new Error("Could not update assigned city order. Please try again.");
  }
}

export type DriverZoneCityFilter = {
  /** When false, the driver is not on any active zone — callers should not filter by zone. */
  hasZoneAssignment: boolean;
  cityIds: string[];
  /** Lowercased trimmed city names for all cities in those zone(s). */
  cityNamesLower: string[];
};

/**
 * Cities linked to active zone(s) where this user is assigned as driver.
 * Used to filter delivery-note sales order picks by route.
 */
export async function getDriverZoneCityFilter(
  driverUserId: string
): Promise<DriverZoneCityFilter> {
  if (!driverUserId?.trim()) {
    return { hasZoneAssignment: false, cityIds: [], cityNamesLower: [] };
  }
  const companyId = await requireActiveCompanyId();

  const { data: zones, error: zErr } = await supabase
    .from("zones")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("driver_user_id", driverUserId);

  if (zErr) throw new Error(zErr.message);

  const zoneIds = (zones ?? []).map((z) => String((z as { id: unknown }).id));
  if (zoneIds.length === 0) {
    return { hasZoneAssignment: false, cityIds: [], cityNamesLower: [] };
  }

  const { data: links, error: lErr } = await supabase
    .from("zone_cities")
    .select("city_id, cities(name)")
    .eq("company_id", companyId)
    .in("zone_id", zoneIds);

  if (lErr) throw new Error(lErr.message);

  const cityIds = new Set<string>();
  const nameSet = new Set<string>();

  for (const raw of links ?? []) {
    const r = raw as {
      city_id: unknown;
      cities: { name?: string } | { name?: string }[] | null;
    };
    const cid = String(r.city_id ?? "").trim();
    if (cid) cityIds.add(cid);
    const city = r.cities;
    const cityObj = Array.isArray(city) ? city[0] : city;
    const nm = String(cityObj?.name ?? "")
      .trim()
      .toLowerCase();
    if (nm) nameSet.add(nm);
  }

  return {
    hasZoneAssignment: true,
    cityIds: [...cityIds],
    cityNamesLower: [...nameSet],
  };
}
