"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DashboardPageSkeleton,
  DirectoryListPageSkeleton,
} from "@/components/page-skeletons";
import { useAppFeatures } from "@/contexts/app-features-context";
import {
  APP_NAV_ITEMS,
  requiredFeatureForPath,
  type AppNavItem,
} from "@/lib/app-nav";

/**
 * Picks the first sidebar entry the user can access; used as a fallback
 * landing when they try to open a page outside their role permissions.
 */
function pickFallbackHref(
  allowedItems: AppNavItem[]
): string | null {
  return allowedItems[0]?.href ?? null;
}

export function AppFeatureRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/app";
  const { status, has, error } = useAppFeatures();
  /** After first `ready`, never swap `<main>` for the full-page loader again (avoids losing client form state). */
  const hasEverBeenReady = useRef(false);

  const allowed = useMemo(
    () => APP_NAV_ITEMS.filter((item) => has(item.requires)),
    [has]
  );

  const requiredCode = useMemo(
    () => requiredFeatureForPath(pathname),
    [pathname]
  );

  const hasAccess = useMemo(() => {
    if (!requiredCode) return true; // unknown path – allow by default
    return has(requiredCode);
  }, [has, requiredCode]);

  useEffect(() => {
    if (status === "ready") {
      hasEverBeenReady.current = true;
    }
    if (status === "unauthenticated") {
      hasEverBeenReady.current = false;
    }
  }, [status]);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    const returnTo = encodeURIComponent(pathname);
    router.replace(`/auth/login?returnTo=${returnTo}`);
  }, [status, pathname, router]);

  useEffect(() => {
    if (status !== "ready") return;
    if (hasAccess) return;
    const fallback = pickFallbackHref(allowed);
    if (fallback && fallback !== pathname) {
      router.replace(fallback);
    }
  }, [status, hasAccess, allowed, pathname, router]);

  if (status === "loading" && !hasEverBeenReady.current) {
    const isDashboard =
      pathname === "/app" || pathname === "/app/";
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col px-4 py-6">
        {isDashboard ? (
          <DashboardPageSkeleton />
        ) : (
          <DirectoryListPageSkeleton
            className="min-h-[360px] flex-1"
            showFilterPanel={false}
          />
        )}
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  if (status === "no-company" || status === "error") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-sm font-semibold">We couldn&apos;t load your workspace</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {status === "no-company"
              ? "Your account is not yet assigned to an active company. Please contact your administrator."
              : error ?? "Unexpected error while loading your permissions."}
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    const fallback = pickFallbackHref(allowed);
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-sm font-semibold">
            {fallback ? "Redirecting…" : "No access"}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {fallback
              ? "You don't have access to this page. Sending you to the first module you can open."
              : "You don't have access to any modules yet. Please contact your administrator."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
