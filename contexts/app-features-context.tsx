"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSessionUser, clearAuthSessionCache } from "@/lib/auth-session";
import {
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import {
  getDashboardData,
  peekDashboardCache,
} from "@/lib/dashboard-service";
import {
  clearRoleFeaturesCache,
  getRoleFeatures,
  type RoleFeature,
} from "@/lib/role-features-service";
import { supabase } from "@/lib/supabaseClient";

type Status = "loading" | "unauthenticated" | "no-company" | "ready" | "error";
const FEATURES_CACHE_KEY = "mkinv:app_features_cache:v1";
const SESSION_USER_KEY = "mkinv:active_company_user_id";

type FeaturesCacheSnapshot = {
  userId: string;
  companyId: string;
  isOwner: boolean;
  features: RoleFeature[];
  cachedAt: string;
};

function readFeaturesCache():
  | FeaturesCacheSnapshot
  | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(FEATURES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeaturesCacheSnapshot;
    if (
      !parsed ||
      typeof parsed.userId !== "string" ||
      typeof parsed.companyId !== "string" ||
      !Array.isArray(parsed.features)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeFeaturesCache(snapshot: FeaturesCacheSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage errors
  }
}

function clearFeaturesCache() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(FEATURES_CACHE_KEY);
  } catch {
    // ignore storage errors
  }
}

function readValidatedFeaturesCache(): FeaturesCacheSnapshot | null {
  const cached = readFeaturesCache();
  if (!cached) return null;
  try {
    const storedUserId = window.sessionStorage.getItem(SESSION_USER_KEY);
    const storedCompanyId = window.sessionStorage.getItem(
      ACTIVE_COMPANY_ID_STORAGE_KEY,
    );
    if (
      storedUserId !== cached.userId ||
      storedCompanyId !== cached.companyId
    ) {
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function prefetchDashboardIfNeeded() {
  if (typeof window === "undefined" || peekDashboardCache()) return;
  void getDashboardData().catch(() => {});
}

type AppFeaturesContextValue = {
  status: Status;
  /** True when the current user is the company owner (`company_users.is_owner`). */
  isOwner: boolean;
  /** Active `features` rows for this user’s role (`role_features` join), same columns as `f.*`. */
  features: RoleFeature[];
  /** Lookup by feature code → DB name / null when not granted. */
  featureName: (code: string) => string | null;
  /** True when the user's role grants this feature (active `features` via `role_features` only). */
  has: (code: string) => boolean;
  /** Error message when `status === "error"`. */
  error: string | null;
  /** Forces a reload (e.g. after a role change). */
  reload: () => Promise<void>;
};

const AppFeaturesContext = createContext<AppFeaturesContextValue | null>(null);

export function AppFeaturesProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [isOwner, setIsOwner] = useState(false);
  const [features, setFeatures] = useState<RoleFeature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  useLayoutEffect(() => {
    const cached = readValidatedFeaturesCache();
    if (!cached) return;
    setIsOwner(Boolean(cached.isOwner));
    setFeatures(cached.features);
    setStatus("ready");
    prefetchDashboardIfNeeded();
  }, []);

  const load = useCallback(async () => {
    setStatus((prev) => (prev === "ready" ? prev : "loading"));
    setError(null);
    try {
      const user = await getSessionUser();
      if (!user?.id) {
        setFeatures([]);
        setIsOwner(false);
        clearFeaturesCache();
        setStatus("unauthenticated");
        return;
      }
      const companyId = await getActiveCompanyId();
      if (!companyId) {
        setFeatures([]);
        setIsOwner(false);
        clearFeaturesCache();
        setStatus("no-company");
        return;
      }

      const cached = readFeaturesCache();
      if (
        cached &&
        cached.userId === user.id &&
        cached.companyId === companyId &&
        statusRef.current !== "ready"
      ) {
        setIsOwner(Boolean(cached.isOwner));
        setFeatures(cached.features);
        setStatus("ready");
        prefetchDashboardIfNeeded();
      }

      const result = await getRoleFeatures(user.id, companyId);
      setIsOwner(result.isOwner);
      setFeatures(result.features);
      writeFeaturesCache({
        userId: user.id,
        companyId,
        isOwner: result.isOwner,
        features: result.features,
        cachedAt: new Date().toISOString(),
      });
      setStatus("ready");
      prefetchDashboardIfNeeded();
    } catch (err) {
      if (statusRef.current !== "ready") {
        setFeatures([]);
        setIsOwner(false);
      }
      setError(err instanceof Error ? err.message : "Could not load features.");
      setStatus((prev) => (prev === "ready" ? prev : "error"));
    }
  }, []);

  useEffect(() => {
    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearRoleFeaturesCache();
        clearFeaturesCache();
        clearAuthSessionCache();
        setFeatures([]);
        setIsOwner(false);
        setStatus("unauthenticated");
      } else if (event === "SIGNED_IN") {
        void load();
      }
      // Intentionally ignore TOKEN_REFRESHED (tab focus / idle return). Re-loading
      // features would re-render the whole app tree and can wipe in-progress client
      // forms. Session stays valid via Supabase auto-refresh; call `reload()` after
      // role changes if needed.
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [load]);

  const featureByCode = useMemo(
    () => new Map(features.map((f) => [f.code, f] as const)),
    [features]
  );

  const featureName = useCallback(
    (code: string) => featureByCode.get(code)?.name ?? null,
    [featureByCode]
  );

  const has = useCallback(
    (code: string) => featureByCode.has(code),
    [featureByCode]
  );

  const value = useMemo<AppFeaturesContextValue>(
    () => ({
      status,
      isOwner,
      features,
      error,
      reload: load,
      featureName,
      has,
    }),
    [status, isOwner, features, error, load, featureName, has]
  );

  return (
    <AppFeaturesContext.Provider value={value}>
      {children}
    </AppFeaturesContext.Provider>
  );
}

export function useAppFeatures(): AppFeaturesContextValue {
  const ctx = useContext(AppFeaturesContext);
  if (!ctx) {
    throw new Error(
      "useAppFeatures must be used within <AppFeaturesProvider>"
    );
  }
  return ctx;
}
