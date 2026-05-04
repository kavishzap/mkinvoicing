"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FeatureEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary action (e.g. create first record) */
  action?: ReactNode;
  /** Secondary line (e.g. after filters) */
  secondaryAction?: ReactNode;
  className?: string;
};

/**
 * Empty / zero-data panel for list pages and tables (user-facing copy, not a blocking modal).
 */
export function FeatureEmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: FeatureEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/25 px-6 py-14 text-center sm:py-16",
        className,
      )}
    >
      {Icon ? (
        <Icon
          className="mb-4 h-11 w-11 text-muted-foreground/70"
          aria-hidden
        />
      ) : null}
      <h3 className="text-base font-semibold text-foreground sm:text-lg">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
      {secondaryAction ? (
        <div className="mt-3 flex justify-center">{secondaryAction}</div>
      ) : null}
    </div>
  );
}
