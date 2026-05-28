import { supabase } from "@/lib/supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";

/** Postgres enum label `public.location_type` (values come from `fetchLocationTypeEnumValues`). */
export type LocationType = string;

/** Display label derived from the enum label (e.g. `driver_location` → Driver location). */
export function formatLocationTypeLabel(enumLabel: string): string {
  if (!enumLabel.trim()) return "";
  return enumLabel
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Ordered labels for `public.location_type` from Postgres (`pg_enum`).
 * Requires RPC `location_type_enum_values` — see `sql/patch_location_type_enum_rpc.sql`.
 */
let cachedLocationTypeEnumLabels: string[] | null = null;
let cachedLocationTypeEnumAt = 0;
const LOCATION_TYPE_ENUM_CACHE_MS = 5 * 60 * 1000;

export async function fetchLocationTypeEnumValues(): Promise<string[]> {
  if (
    cachedLocationTypeEnumLabels &&
    Date.now() - cachedLocationTypeEnumAt < LOCATION_TYPE_ENUM_CACHE_MS
  ) {
    return cachedLocationTypeEnumLabels;
  }

  const { data, error } = await supabase.rpc("location_type_enum_values");
  if (error) throw error;
  if (!data || !Array.isArray(data)) return [];
  const labels = data.filter((x): x is string => typeof x === "string");
  cachedLocationTypeEnumLabels = labels;
  cachedLocationTypeEnumAt = Date.now();
  return labels;
}

/**
 * Keeps Postgres enum order, appends `currentValue` if missing (e.g. RPC failed or stale row).
 */
export function mergeLocationTypeEnumOptions(
  orderedLabels: string[],
  currentValue?: string
): string[] {
  const cur = currentValue?.trim();
  if (!cur) return orderedLabels;
  if (orderedLabels.includes(cur)) return orderedLabels;
  return [...orderedLabels, cur];
}

async function resolveLocationTypeForInsert(
  requested: string | undefined
): Promise<string> {
  const values = await fetchLocationTypeEnumValues();
  if (values.length === 0) {
    throw new Error(
      "Could not load location types. Apply sql/patch_location_type_enum_rpc.sql in Supabase and ensure enum public.location_type exists."
    );
  }
  if (requested !== undefined && requested !== "") {
    if (!values.includes(requested)) {
      throw new Error("Invalid location type.");
    }
    return requested;
  }
  return values[0];
}

export type LocationPayload = {
  name: string;
  code?: string | null;
  description?: string | null;
  map_link?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postal?: string | null;
  country?: string | null;
  /** Postgres `location_type`; defaults to first enum label when omitted on insert. */
  location_type?: LocationType;
  is_active?: boolean;
  is_default?: boolean;
  /** Only valid for `warehouse`; DB enforces one active primary per company. */
  is_primary_warehouse?: boolean;
};

export type LocationRow = {
  id: string;
  company_id: string;
  user_id: string;
  name: string;
  code: string;
  description: string;
  map_link: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postal: string;
  country: string;
  isActive: boolean;
  isDefault: boolean;
  /** Stock source for delivery transfers when this warehouse is the company primary. */
  isPrimaryWarehouse: boolean;
  locationType: LocationType;
  /** Active drivers from `location_drivers`, primary first; empty when none. */
  assignedDrivers: LocationAssignedDriver[];
  /** Comma-separated names for search / export. */
  assignedDriversDisplay: string;
  created_at: string;
  updated_at: string;
};

export type LocationAssignedDriver = {
  driverUserId: string;
  name: string;
  membershipId: string | null;
};

const COLUMNS =
  "id,company_id,user_id,name,code,description,map_link,address_line_1,address_line_2,city,postal,country,location_type,is_active,is_default,is_primary_warehouse,created_at,updated_at";

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not authenticated");
  return data.user.id;
}

async function requireCompanyId(): Promise<string> {
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    throw new Error(
      "No company found for this account. Complete company setup before managing locations."
    );
  }
  return companyId;
}

async function clearDefaultForCompany(companyId: string, exceptId?: string) {
  let q = supabase
    .from("locations")
    .update({ is_default: false })
    .eq("company_id", companyId)
    .eq("is_default", true);
  if (exceptId) q = q.neq("id", exceptId);
  const { error } = await q;
  if (error) throw error;
}

async function clearPrimaryWarehouseForCompany(
  companyId: string,
  exceptId?: string
) {
  let q = supabase
    .from("locations")
    .update({ is_primary_warehouse: false })
    .eq("company_id", companyId)
    .eq("is_primary_warehouse", true);
  if (exceptId) q = q.neq("id", exceptId);
  const { error } = await q;
  if (error) throw error;
}

export type LocationListFacets = {
  /** Total locations for company (no filters). */
  companyTotal: number;
  activeCount: number;
  inactiveCount: number;
  /** Per-type counts (active + inactive). */
  typeCounts: { type: string; count: number }[];
  enumTypes: string[];
};

/** Counts for the type sidebar (all statuses). */
export async function fetchLocationListFacets(): Promise<LocationListFacets> {
  const companyId = await requireCompanyId();
  const enumTypes = await fetchLocationTypeEnumValues();

  const head = () =>
    supabase
      .from("locations")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);

  const countOf = async (
    builder: ReturnType<typeof head>,
  ): Promise<number> => {
    const { count, error } = await builder;
    if (error) throw error;
    return count ?? 0;
  };

  const { count: companyTotalRaw } = await head();
  const companyTotal = companyTotalRaw ?? 0;

  const [activeCount, inactiveCount] = await Promise.all([
    countOf(head().eq("is_active", true)),
    countOf(head().eq("is_active", false)),
  ]);

  const typeCounts: { type: string; count: number }[] = await Promise.all(
    enumTypes.map(async (t) => ({
      type: t,
      count: await countOf(head().eq("location_type", t)),
    })),
  );

  return {
    companyTotal,
    activeCount,
    inactiveCount,
    typeCounts,
    enumTypes,
  };
}

export async function listLocations(opts?: {
  search?: string;
  /** When set, filter by Postgres `location_type`. */
  locationType?: string | null;
  /** Narrow list by active flag; omit or `'all'` for both. */
  statusFilter?: "all" | "active" | "inactive";
  page?: number;
  pageSize?: number;
}): Promise<{ rows: LocationRow[]; total: number }> {
  const companyId = await requireCompanyId();
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("locations")
    .select(COLUMNS, { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  const lt = opts?.locationType?.trim();
  if (lt) {
    q = q.eq("location_type", lt);
  }

  const sf = opts?.statusFilter ?? "all";
  if (sf === "active") {
    q = q.eq("is_active", true);
  } else if (sf === "inactive") {
    q = q.eq("is_active", false);
  }

  const term = opts?.search?.trim();
  if (term) {
    const s = `%${term}%`;
    q = q.or(
      [`name.ilike.${s}`, `code.ilike.${s}`, `city.ilike.${s}`].join(",")
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;

  const rows = await attachAssignedDriversDisplay(
    companyId,
    (data ?? []).map(mapRow),
  );

  return {
    rows,
    total: count ?? 0,
  };
}

/**
 * Returns every location matching the current filters (no pagination).
 * Used by the locations page Export CSV / Print actions.
 */
export async function listAllLocationsForExport(opts?: {
  search?: string;
  locationType?: string | null;
  statusFilter?: "all" | "active" | "inactive";
}): Promise<LocationRow[]> {
  const companyId = await requireCompanyId();

  const BATCH = 1000;
  let from = 0;
  const out: LocationRow[] = [];

  for (;;) {
    let q = supabase
      .from("locations")
      .select(COLUMNS)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(from, from + BATCH - 1);

    const lt = opts?.locationType?.trim();
    if (lt) {
      q = q.eq("location_type", lt);
    }

    const sf = opts?.statusFilter ?? "all";
    if (sf === "active") {
      q = q.eq("is_active", true);
    } else if (sf === "inactive") {
      q = q.eq("is_active", false);
    }

    const term = opts?.search?.trim();
    if (term) {
      const s = `%${term}%`;
      q = q.or(
        [`name.ilike.${s}`, `code.ilike.${s}`, `city.ilike.${s}`].join(","),
      );
    }

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []).map(mapRow);
    out.push(...batch);
    if (batch.length < BATCH) break;
    from += BATCH;
  }

  return attachAssignedDriversDisplay(companyId, out);
}

export async function getLocation(id: string): Promise<LocationRow> {
  const companyId = await requireCompanyId();
  const { data, error } = await supabase
    .from("locations")
    .select(COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Location not found or not accessible");
  return mapRow(data);
}

export async function addLocation(
  payload: LocationPayload
): Promise<LocationRow> {
  const userId = await getUserId();
  const companyId = await requireCompanyId();

  if (payload.is_default) {
    await clearDefaultForCompany(companyId);
  }

  const location_type = await resolveLocationTypeForInsert(payload.location_type);

  const wantsPrimary = payload.is_primary_warehouse === true;
  if (wantsPrimary && location_type !== "warehouse") {
    throw new Error("Only a warehouse can be marked as the primary warehouse.");
  }
  if (wantsPrimary) {
    await clearPrimaryWarehouseForCompany(companyId);
  }

  const insert = {
    company_id: companyId,
    user_id: userId,
    name: payload.name.trim(),
    code: payload.code?.trim() || null,
    description: payload.description?.trim() || null,
    map_link: payload.map_link?.trim() || null,
    address_line_1: payload.address_line_1?.trim() || null,
    address_line_2: payload.address_line_2?.trim() || null,
    city: payload.city?.trim() || null,
    postal: payload.postal?.trim() || null,
    country: payload.country?.trim() || null,
    location_type,
    is_active: payload.is_active ?? true,
    is_default: payload.is_default ?? false,
    is_primary_warehouse: wantsPrimary,
  };

  const { data, error } = await supabase
    .from("locations")
    .insert(insert)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function updateLocation(
  id: string,
  payload: Partial<LocationPayload>
): Promise<LocationRow> {
  const companyId = await requireCompanyId();

  if (payload.is_default === true) {
    await clearDefaultForCompany(companyId, id);
  }

  const touchesTypeOrPrimary =
    ("location_type" in payload && payload.location_type !== undefined) ||
    ("is_primary_warehouse" in payload &&
      payload.is_primary_warehouse !== undefined);

  const existing = touchesTypeOrPrimary ? await getLocation(id) : null;

  const update: Record<string, unknown> = {};
  if ("name" in payload && payload.name !== undefined)
    update.name = payload.name.trim();
  if ("code" in payload) update.code = payload.code?.trim() || null;
  if ("description" in payload)
    update.description = payload.description?.trim() || null;
  if ("map_link" in payload) update.map_link = payload.map_link?.trim() || null;
  if ("address_line_1" in payload)
    update.address_line_1 = payload.address_line_1?.trim() || null;
  if ("address_line_2" in payload)
    update.address_line_2 = payload.address_line_2?.trim() || null;
  if ("city" in payload) update.city = payload.city?.trim() || null;
  if ("postal" in payload) update.postal = payload.postal?.trim() || null;
  if ("country" in payload) update.country = payload.country?.trim() || null;

  if ("location_type" in payload && payload.location_type !== undefined) {
    const values = await fetchLocationTypeEnumValues();
    if (!values.includes(payload.location_type)) {
      throw new Error("Invalid location type.");
    }
    update.location_type = payload.location_type;
    if (payload.location_type !== "warehouse") {
      update.is_primary_warehouse = false;
    }
  }

  if (
    "is_primary_warehouse" in payload &&
    payload.is_primary_warehouse !== undefined
  ) {
    const typeForPrimary =
      (update.location_type as string | undefined) ??
      existing?.locationType ??
      "";
    if (payload.is_primary_warehouse === true) {
      if (typeForPrimary !== "warehouse") {
        throw new Error(
          "Only a warehouse can be marked as the primary warehouse."
        );
      }
      await clearPrimaryWarehouseForCompany(companyId, id);
      update.is_primary_warehouse = true;
    } else {
      update.is_primary_warehouse = false;
    }
  }

  if ("is_active" in payload) update.is_active = payload.is_active;
  if ("is_default" in payload) update.is_default = payload.is_default;

  const { data, error } = await supabase
    .from("locations")
    .update(update)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Location not found or not accessible");
  return mapRow(data);
}

export async function setLocationActive(
  id: string,
  active: boolean
): Promise<LocationRow> {
  const companyId = await requireCompanyId();

  const { data, error } = await supabase
    .from("locations")
    .update({ is_active: active })
    .eq("id", id)
    .eq("company_id", companyId)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Location not found or not accessible");
  return mapRow(data);
}

export async function deleteLocation(id: string): Promise<void> {
  const companyId = await requireCompanyId();

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) throw error;
}

export type LocationOption = { id: string; name: string; code: string };

/** Active locations for the current company (dropdowns, no pagination). */
export async function listActiveLocationsForSelect(): Promise<LocationOption[]> {
  const companyId = await requireCompanyId();
  const { data, error } = await supabase
    .from("locations")
    .select("id,name,code")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((r: { id: string; name: string; code: string | null }) => ({
    id: r.id,
    name: r.name ?? "",
    code: r.code ?? "",
  }));
}

function parseLocationType(v: unknown): LocationType {
  return typeof v === "string" && v.length > 0 ? v : "";
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

  if (error) throw error;

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

  if (error) throw error;

  for (const row of data ?? []) {
    const uid = String((row as { user_id?: unknown }).user_id ?? "");
    const mid = String((row as { id?: unknown }).id ?? "");
    if (uid && mid) map.set(uid, mid);
  }

  return map;
}

async function attachAssignedDriversDisplay(
  companyId: string,
  rows: LocationRow[],
): Promise<LocationRow[]> {
  if (rows.length === 0) return rows;

  const locationIds = rows.map((r) => r.id);
  const { data, error } = await supabase
    .from("location_drivers")
    .select("location_id, driver_user_id, is_primary, is_active")
    .eq("company_id", companyId)
    .in("location_id", locationIds)
    .eq("is_active", true);

  if (error) throw error;

  const driverIds = [
    ...new Set(
      (data ?? [])
        .map((raw) =>
          String((raw as { driver_user_id?: unknown }).driver_user_id ?? ""),
        )
        .filter(Boolean),
    ),
  ];
  const [labelByUserId, membershipByUserId] = await Promise.all([
    fetchUserDisplayLabels(driverIds),
    fetchMembershipIdsByUserId(companyId, driverIds),
  ]);

  type DriverSlot = LocationAssignedDriver & { isPrimary: boolean };
  const byLocation = new Map<string, DriverSlot[]>();

  for (const raw of data ?? []) {
    const locationId = String(
      (raw as { location_id?: unknown }).location_id ?? "",
    );
    const driverUserId = String(
      (raw as { driver_user_id?: unknown }).driver_user_id ?? "",
    );
    if (!locationId || !driverUserId) continue;
    const name = labelByUserId.get(driverUserId) ?? driverUserId.slice(0, 8);
    const list = byLocation.get(locationId) ?? [];
    list.push({
      driverUserId,
      name,
      membershipId: membershipByUserId.get(driverUserId) ?? null,
      isPrimary: Boolean((raw as { is_primary?: unknown }).is_primary),
    });
    byLocation.set(locationId, list);
  }

  return rows.map((row) => {
    const drivers = [...(byLocation.get(row.id) ?? [])];
    drivers.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    const assignedDrivers: LocationAssignedDriver[] = drivers.map(
      ({ driverUserId, name, membershipId }) => ({
        driverUserId,
        name,
        membershipId,
      }),
    );
    return {
      ...row,
      assignedDrivers,
      assignedDriversDisplay: assignedDrivers.map((d) => d.name).join(", "),
    };
  });
}

function mapRow(r: Record<string, unknown>): LocationRow {
  return {
    id: String(r.id),
    company_id: String(r.company_id ?? ""),
    user_id: String(r.user_id ?? ""),
    name: String(r.name ?? ""),
    code: String(r.code ?? ""),
    description: String(r.description ?? ""),
    map_link: String(r.map_link ?? ""),
    address_line_1: String(r.address_line_1 ?? ""),
    address_line_2: String(r.address_line_2 ?? ""),
    city: String(r.city ?? ""),
    postal: String(r.postal ?? ""),
    country: String(r.country ?? ""),
    isActive: !!r.is_active,
    isDefault: !!r.is_default,
    isPrimaryWarehouse: !!r.is_primary_warehouse,
    locationType: parseLocationType(r.location_type),
    assignedDrivers: [],
    assignedDriversDisplay: "",
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}
