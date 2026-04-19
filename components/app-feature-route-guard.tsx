"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
  const { status, isOwner, has, error } = useAppFeatures();

  const allowed = useMemo(
    () => APP_NAV_ITEMS.filter((item) => isOwner || has(item.requires)),
    [isOwner, has]
  );

  const requiredCode = useMemo(
    () => requiredFeatureForPath(pathname),
    [pathname]
  );

  const hasAccess = useMemo(() => {
    if (!requiredCode) return true; // unknown path – allow by default
    return isOwner || has(requiredCode);
  }, [isOwner, has, requiredCode]);

  useEffect(() => {
    if (status !== "ready") return;
    if (hasAccess) return;
    const fallback = pickFallbackHref(allowed);
    if (fallback && fallback !== pathname) {
      router.replace(fallback);
    }
  }, [status, hasAccess, allowed, pathname, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
        <span>Loading your workspace…</span>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // AuthRouteGuard elsewhere handles redirecting to login; render nothing.
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
              ? "You don't have access to this page. Sending you to your dashboard."
              : "You don't have access to any modules yet. Please contact your administrator."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
