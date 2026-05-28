"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AccountMenuPopover } from "@/components/account-menu-popover";
import { useHydrated } from "@/hooks/use-hydrated";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { resolveCurrentNavLabel } from "@/lib/app-nav";
import { useAppFeatures } from "@/contexts/app-features-context";
import { useAppAccount } from "@/contexts/app-account-context";
import { useAppPageActions } from "@/contexts/app-page-actions-context";

export function AppTopbar() {
  const pathname = usePathname() ?? "/app";
  const { featureName } = useAppFeatures();
  const { actions: pageActions, titleBefore, trailingBeforeTheme } =
    useAppPageActions();
  const { companyName } = useAppAccount();
  const hydrated = useHydrated();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle = useMemo(
    () => resolveCurrentNavLabel(pathname, featureName),
    [pathname, featureName]
  );

  return (
    <header className="print:hidden sticky top-0 z-40 flex min-h-16 w-full shrink-0 items-center gap-2 border-b border-border bg-card/95 py-2 text-sm backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
        {hydrated ? (
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden shrink-0">
              <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            {mobileMenuOpen ? (
              <SheetContent side="left" className="w-64 p-0">
                <AppSidebar
                  className="flex h-full md:hidden"
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </SheetContent>
            ) : null}
          </Sheet>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            aria-label="Open navigation menu"
            disabled
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-4 md:gap-x-6">
          {titleBefore ? (
            <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-border bg-muted/40 shadow-sm [&_button]:shadow-none [&_a]:rounded-md [&_button]:rounded-md">
              {titleBefore}
            </div>
          ) : null}
          <h1 className="min-w-0 max-w-[min(52vw,14rem)] shrink truncate text-lg font-semibold leading-snug tracking-tight text-foreground sm:max-w-xs md:max-w-md lg:max-w-lg">
            {pageTitle}
          </h1>
          {pageActions ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2 [&_a]:rounded [&_button]:rounded">
              {pageActions}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pr-1 sm:gap-1 sm:pr-2">
        {companyName ? (
          <span
            className="hidden max-w-[8rem] truncate text-xs font-bold text-foreground sm:inline md:max-w-[12rem] md:text-sm"
            title={companyName}
          >
            {companyName}
          </span>
        ) : null}
        {trailingBeforeTheme ? (
          <div className="flex shrink-0 items-center [&_button]:rounded-md">
            {trailingBeforeTheme}
          </div>
        ) : null}
        <ThemeToggle />
        <AccountMenuPopover anchor="topbar" variant="topbar" />
      </div>
    </header>
  );
}
