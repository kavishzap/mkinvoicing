"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveCompanyId } from "@/lib/active-company";
import {
  clearRoleFeaturesCache,
  getRoleFeatures,
  type RoleFeature,
} from "@/lib/role-features-service";

type Status = "loading" | "unauthenticated" | "no-company" | "ready" | "error";

type AppFeaturesContextValue = {
  status: Status;
  /** True when the current user owns the company – unlocks all features. */
  isOwner: boolean;
  /** Raw list of features the current user has access to. */
  features: RoleFeature[];
  /** Lookup by feature code → DB name / null when not granted. */
  featureName: (code: string) => string | null;
  /** True when the user has the feature (owner always has access). */
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

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setFeatures([]);
        setIsOwner(false);
        setStatus("unauthenticated");
        return;
      }
      const companyId = await getActiveCompanyId();
      if (!companyId) {
        setFeatures([]);
        setIsOwner(false);
        setStatus("no-company");
        return;
      }
      const result = await getRoleFeatures(user.id, companyId);
      setIsOwner(result.isOwner);
      setFeatures(result.features);
      setStatus("ready");
    } catch (err) {
      setFeatures([]);
      setIsOwner(false);
      setError(err instanceof Error ? err.message : "Could not load features.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearRoleFeaturesCache();
        setFeatures([]);
        setIsOwner(false);
        setStatus("unauthenticated");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void load();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [load]);

  const value = useMemo<AppFeaturesContextValue>(() => {
    const byCode = new Map(features.map((f) => [f.code, f] as const));
    return {
      status,
      isOwner,
      features,
      error,
      reload: load,
      featureName: (code: string) => byCode.get(code)?.name ?? null,
      has: (code: string) => isOwner || byCode.has(code),
    };
  }, [status, isOwner, features, error, load]);

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
