"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
    <header className="print:hidden sticky top-0 z-40 flex min-h-14 w-full shrink-0 flex-col border-b border-border bg-card/95 text-sm backdrop-blur supports-[backdrop-filter]:bg-card/60 sm:min-h-16">
      <div className="flex min-h-14 w-full items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {hydrated ? (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden shrink-0">
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              {mobileMenuOpen ? (
                <SheetContent side="left" className="w-64 p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation menu</SheetTitle>
                  </SheetHeader>
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

          {titleBefore ? (
            <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-border bg-muted/40 shadow-sm [&_button]:shadow-none [&_a]:rounded-md [&_button]:rounded-md">
              {titleBefore}
            </div>
          ) : null}
          <h1 className="min-w-0 max-w-[12rem] truncate text-base font-semibold leading-snug tracking-tight text-foreground sm:max-w-xs sm:text-lg md:max-w-sm lg:max-w-md">
            {pageTitle}
          </h1>
          {pageActions ? (
            <div className="hidden shrink-0 items-center gap-2 md:flex [&_>div]:w-auto [&_>div]:justify-start [&_a]:rounded [&_button]:rounded">
              {pageActions}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1" aria-hidden />

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {companyName ? (
            <span
              className="hidden max-w-[8rem] truncate text-xs font-bold text-foreground lg:inline xl:max-w-[12rem] xl:text-sm"
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
      </div>

      {pageActions ? (
        <div className="border-t border-border/60 bg-muted/20 px-2 py-2 md:hidden">
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 [&_>div]:w-full [&_>div]:justify-end [&_a]:rounded [&_button]:h-8 [&_button]:rounded [&_button]:px-2.5 [&_button]:text-xs [&_button]:gap-1.5">
            {pageActions}
          </div>
        </div>
      ) : null}
    </header>
  );
}
