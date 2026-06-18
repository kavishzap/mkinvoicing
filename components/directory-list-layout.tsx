"use client";

import type React from "react";
import { SlidersVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsLgUp } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export const DIRECTORY_LIST_PANEL_CLASS =
  "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-border/50 bg-card text-card-foreground shadow-none outline outline-1 -outline-offset-1 outline-border/40 dark:border-border/60 dark:outline-border/50";

type DirectoryListFrameProps = {
  filtersOpen: boolean;
  children: React.ReactNode;
  className?: string;
};

export function DirectoryListFrame({
  filtersOpen,
  children,
  className,
}: DirectoryListFrameProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0",
        filtersOpen ? "gap-0 lg:gap-0" : "gap-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

type DirectoryFilterPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelId: string;
  title?: string;
  children: React.ReactNode;
};

export function DirectoryFilterPanel({
  open,
  onOpenChange,
  panelId,
  title = "Filters",
  children,
}: DirectoryFilterPanelProps) {
  const isLgUp = useIsLgUp();
  const sheetOpen = open && isLgUp === false;

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          className="flex w-[min(100vw-1rem,20rem)] flex-col gap-0 p-0 lg:hidden"
          aria-describedby={undefined}
        >
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3 text-left">
            <SheetTitle className="text-base">{title}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </SheetContent>
      </Sheet>

      <div
        id={panelId}
        className={cn(
          "hidden shrink-0 overflow-hidden lg:block",
          "transition-[width,margin-inline-end,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "motion-reduce:transition-none motion-reduce:duration-0",
          open
            ? "pointer-events-auto opacity-100 lg:me-10 lg:w-56 xl:w-[15rem]"
            : "pointer-events-none w-0 opacity-100 lg:me-0 lg:w-0 xl:w-0",
        )}
        aria-hidden={!open}
      >
        <div className="h-full min-w-0 w-full lg:min-w-[14rem] xl:min-w-[15rem]">
          {children}
        </div>
      </div>
    </>
  );
}

type DirectoryFilterToggleButtonProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelId: string;
  label?: string;
  className?: string;
};

export function DirectoryFilterToggleButton({
  open,
  onOpenChange,
  panelId,
  label = "filters",
  className,
}: DirectoryFilterToggleButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-9 w-9 shrink-0 text-muted-foreground",
        open && "bg-primary/15 text-primary",
        className,
      )}
      aria-label={open ? `Hide ${label}` : `Show ${label}`}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => onOpenChange(!open)}
    >
      <SlidersVertical className="h-4 w-4" aria-hidden />
    </Button>
  );
}

type DirectoryListSearchHeaderProps = {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
};

export function DirectoryListSearchHeader({
  children,
  trailing,
  className,
}: DirectoryListSearchHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2 border-b border-border/50 bg-muted/45 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5 dark:bg-muted/25",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1 sm:max-w-xl lg:max-w-2xl">
        {children}
      </div>
      {trailing ? (
        <div className="shrink-0 text-xs text-muted-foreground sm:text-sm">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
