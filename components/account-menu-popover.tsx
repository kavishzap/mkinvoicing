"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AccountPopoverPanel } from "@/components/account-popover-panel";
import { useAppAccount, type AccountAnchor } from "@/contexts/app-account-context";
import { useHydrated } from "@/hooks/use-hydrated";
import { initialsFromDisplayName } from "@/lib/user-display";
import { cn } from "@/lib/utils";

type AccountMenuPopoverProps = {
  anchor: Exclude<AccountAnchor, "closed">;
  /** Sidebar: full-width row; topbar: icon button. */
  variant: "sidebar" | "topbar";
  narrow?: boolean;
};

export function AccountMenuPopover({
  anchor,
  variant,
  narrow = false,
}: AccountMenuPopoverProps) {
  const hydrated = useHydrated();
  const {
    userChip,
    systemRoleLabel,
    companyRoleLabel,
    accountAnchor,
    setAccountAnchor,
  } = useAppAccount();

  const open = accountAnchor === anchor;
  const label = userChip ? `${userChip.name}, open account menu` : "Account";

  const avatar = (
    <Avatar
      className={cn(
        "border border-border/60",
        variant === "topbar" ? "size-8" : "size-9 shrink-0"
      )}
    >
      {userChip?.avatarUrl ? <AvatarImage src={userChip.avatarUrl} alt="" /> : null}
      <AvatarFallback className="text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
        {userChip ? initialsFromDisplayName(userChip.name) : "…"}
      </AvatarFallback>
    </Avatar>
  );

  const trigger =
    variant === "topbar" ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full"
        aria-label={label}
        aria-expanded={open}
      >
        {avatar}
      </Button>
    ) : (
      <button
        type="button"
        className={cn(
          "flex w-full items-center rounded-lg outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
          narrow ? "justify-center p-1.5" : "gap-2.5 p-2 text-left"
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
      >
        {avatar}
        {!narrow && userChip && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {userChip.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[systemRoleLabel, companyRoleLabel].filter(Boolean).join(" · ") ||
                "—"}
            </p>
          </div>
        )}
        {!narrow && (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          />
        )}
      </button>
    );

  if (!hydrated) {
    return trigger;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => setAccountAnchor(next ? anchor : "closed")}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side={variant === "topbar" ? "bottom" : "right"}
        align="end"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-1.5rem))] p-4"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <AccountPopoverPanel />
      </PopoverContent>
    </Popover>
  );
}
