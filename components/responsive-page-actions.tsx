"use client";

import type React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ResponsivePageActionsProps = {
  /** Always-visible actions (e.g. primary create button). */
  primary?: React.ReactNode;
  /** Collapsed into overflow menu below `sm`. */
  overflow?: React.ReactNode;
  /** Full action row on `sm+`; on mobile shows primary + overflow menu. */
  children?: React.ReactNode;
  className?: string;
};

/**
 * Compact page actions for the top bar / mobile toolbar.
 * On small screens: primary actions stay visible; overflow items move to a menu.
 */
export function ResponsivePageActions({
  primary,
  overflow,
  children,
  className,
}: ResponsivePageActionsProps) {
  if (children) {
    return (
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:gap-2",
          "[&_button]:h-8 [&_button]:gap-1.5 [&_button]:px-2.5 [&_button]:text-xs sm:[&_button]:h-9 sm:[&_button]:px-3 sm:[&_button]:text-sm",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center justify-end gap-1.5 sm:gap-2",
        className,
      )}
    >
      {primary ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:flex-none sm:gap-2">
          {primary}
        </div>
      ) : null}
      {overflow ? (
        <>
          <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            {overflow}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 sm:hidden"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {overflow}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
    </div>
  );
}

/** Wrap dropdown menu items for use inside ResponsivePageActions overflow. */
export function ResponsivePageActionItem({
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
  return <DropdownMenuItem {...props}>{children}</DropdownMenuItem>;
}
