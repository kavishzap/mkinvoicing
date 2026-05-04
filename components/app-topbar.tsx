"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AccountPopoverPanel } from "@/components/account-popover-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { resolveCurrentNavLabel } from "@/lib/app-nav";
import { initialsFromDisplayName } from "@/lib/user-display";
import { useAppFeatures } from "@/contexts/app-features-context";
import { useAppAccount } from "@/contexts/app-account-context";
import { useAppPageActions } from "@/contexts/app-page-actions-context";

export function AppTopbar() {
  const pathname = usePathname() ?? "/app";
  const { featureName } = useAppFeatures();
  const { actions: pageActions } = useAppPageActions();
  const { userChip, companyName, accountAnchor, setAccountAnchor } =
    useAppAccount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle = useMemo(
    () => resolveCurrentNavLabel(pathname, featureName),
    [pathname, featureName]
  );

  return (
    <header className="print:hidden sticky top-0 z-40 flex h-14 w-full shrink-0 items-center gap-2 border-b border-border bg-card/95 text-sm backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden shrink-0">
            <Button variant="ghost" size="icon" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <AppSidebar
              className="flex h-full md:hidden"
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <h1 className="min-w-0 max-w-[min(52vw,18rem)] shrink truncate text-base font-semibold leading-tight tracking-tight text-foreground sm:max-w-xs md:max-w-md lg:max-w-lg">
            {pageTitle}
          </h1>
          {pageActions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 [&_a]:rounded-md [&_button]:rounded-md">
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
        <ThemeToggle />
        <Popover
          open={accountAnchor === "topbar"}
          onOpenChange={(open) =>
            setAccountAnchor(open ? "topbar" : "closed")
          }
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full"
              aria-label={
                userChip ? `${userChip.name}, open account menu` : "Account"
              }
              aria-expanded={accountAnchor === "topbar"}
            >
              <Avatar className="size-8 border border-border/60">
                {userChip?.avatarUrl ? (
                  <AvatarImage src={userChip.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                  {userChip ? initialsFromDisplayName(userChip.name) : "…"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="w-[min(20rem,calc(100vw-1.5rem))] p-4"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <AccountPopoverPanel />
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
