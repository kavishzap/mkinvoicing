"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { initialsFromDisplayName } from "@/lib/user-display";
import {
  APP_NAV_ITEMS,
  getNavDisplayLabel,
  NAV_SECTION_LABELS,
  NAV_SECTION_ORDER,
  type NavSectionId,
} from "@/lib/app-nav";
import { useAppFeatures } from "@/contexts/app-features-context";
import { useAppAccount } from "@/contexts/app-account-context";
import { useSidebarCollapse } from "@/contexts/sidebar-collapse-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AccountPopoverPanel } from "@/components/account-popover-panel";

/** Navbar brand (black on transparent — best on light sidebar `bg-card`). */
const NAVBAR_LOGO = "/moledger_black_transparent_hd.png";

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function AppSidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed } = useSidebarCollapse();
  const {
    userChip,
    companyRoleLabel,
    accountAnchor,
    setAccountAnchor,
  } = useAppAccount();
  const { status, isOwner, has, featureName } = useAppFeatures();

  /** Mobile sheet uses full labels; collapse is desktop-only. */
  const narrow = collapsed && !onNavigate;

  type NavRow = (typeof APP_NAV_ITEMS)[number] & { displayLabel: string };

  const groupedItems = useMemo(() => {
    const visible = APP_NAV_ITEMS.filter(
      (item) => isOwner || has(item.requires)
    ).map(
      (item): NavRow => ({
        ...item,
        displayLabel: getNavDisplayLabel(item, featureName),
      })
    );
    const bySection = new Map<NavSectionId, NavRow[]>();
    for (const id of NAV_SECTION_ORDER) {
      bySection.set(id, []);
    }
    for (const item of visible) {
      bySection.get(item.section)?.push(item);
    }
    return NAV_SECTION_ORDER.map((id) => ({
      id,
      label: NAV_SECTION_LABELS[id],
      items: bySection.get(id) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [isOwner, has, featureName]);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-card min-h-0 overflow-hidden transition-[width] duration-200 ease-out",
        narrow ? "w-16" : "w-64",
        className
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border bg-card",
          narrow && "justify-center px-2",
          onNavigate && "justify-center px-4",
          !narrow && !onNavigate && "justify-center px-3"
        )}
      >
        <Link
          href="/app"
          className={cn(
            "flex min-w-0 items-center justify-center",
            !narrow && !onNavigate && "w-full"
          )}
          onClick={onNavigate}
        >
          <Image
            src={NAVBAR_LOGO}
            alt="MoLedger"
            width={480}
            height={120}
            className={cn(
              "object-contain dark:invert",
              narrow
                ? "h-6 w-8 object-cover object-left"
                : "h-6 w-auto max-w-[7.5rem] sm:max-w-[8rem]"
            )}
            priority
            sizes={narrow ? "32px" : "(max-width: 768px) 128px, 136px"}
          />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col min-h-0 px-2 py-2">
        <div className="space-y-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {status === "loading" ? (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-muted-foreground",
                narrow && "justify-center px-0"
              )}
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              {!narrow && <span>Loading menu…</span>}
            </div>
          ) : groupedItems.length === 0 ? (
            <div
              className={cn(
                "px-2 py-2 text-xs text-muted-foreground",
                narrow && "text-center text-[11px] px-0"
              )}
            >
              {narrow ? "—" : "No modules assigned to your role yet."}
            </div>
          ) : (
            groupedItems.map((group, groupIndex) => (
              <section
                key={group.id}
                className={cn(
                  "space-y-1",
                  groupIndex > 0 &&
                    (narrow
                      ? "mt-2 border-t border-border/50 pt-2"
                      : "mt-3 border-t border-border/60 pt-3")
                )}
                aria-label={narrow ? group.label : undefined}
                aria-labelledby={!narrow ? `sidebar-section-${group.id}` : undefined}
              >
                {!narrow && (
                  <h2
                    id={`sidebar-section-${group.id}`}
                    className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {group.label}
                  </h2>
                )}
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/app"
                      ? pathname === "/app"
                      : pathname === item.href ||
                        pathname?.startsWith(item.href + "/");

                  const linkClass = cn(
                    "flex items-center rounded-lg py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground",
                    narrow ? "justify-center px-1.5" : "gap-2 px-2.5",
                    isActive
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-muted-foreground"
                  );

                  const link = (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-tour-id={item.displayLabel
                        .replace(/\s+/g, "-")
                        .toLowerCase()}
                      aria-current={isActive ? "page" : undefined}
                      onClick={onNavigate}
                      className={linkClass}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span
                        className={cn(!narrow && "truncate", narrow && "sr-only")}
                      >
                        {item.displayLabel}
                      </span>
                    </Link>
                  );

                  if (narrow) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={10}>
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {group.label}
                            </span>
                            <span className="text-[13px]">{item.displayLabel}</span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return link;
                })}
              </section>
            ))
          )}
        </div>
      </nav>

      <footer
        className={cn(
          "shrink-0 border-t border-border bg-card/80",
          narrow ? "px-1.5 py-2" : "px-2 pb-2 pt-1"
        )}
      >
        <Popover
          open={accountAnchor === "sidebar"}
          onOpenChange={(open) =>
            setAccountAnchor(open ? "sidebar" : "closed")
          }
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center rounded-lg outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                narrow ? "justify-center p-1.5" : "gap-2.5 p-2 text-left"
              )}
              aria-haspopup="dialog"
              aria-expanded={accountAnchor === "sidebar"}
              aria-label={
                userChip ? `${userChip.name}, open account menu` : "Account"
              }
            >
              <Avatar className="size-9 shrink-0 border border-border/60">
                {userChip?.avatarUrl ? (
                  <AvatarImage src={userChip.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback
                  className={cn(
                    "text-xs font-semibold",
                    "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
                  )}
                >
                  {userChip ? initialsFromDisplayName(userChip.name) : "…"}
                </AvatarFallback>
              </Avatar>
              {!narrow && userChip && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight text-foreground">
                    {userChip.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {companyRoleLabel ?? "—"}
                  </p>
                </div>
              )}
              {!narrow && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    accountAnchor === "sidebar" && "rotate-180"
                  )}
                  aria-hidden
                />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={8}
            className="w-[min(20rem,calc(100vw-1.5rem))] p-4"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <AccountPopoverPanel />
          </PopoverContent>
        </Popover>
      </footer>

    </aside>
  );
}
