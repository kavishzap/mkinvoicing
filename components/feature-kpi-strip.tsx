"use client";

import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type FeatureKpiItem = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Screen-reader hint, e.g. same as label */
  valueLabel?: string;
};

type FeatureKpiStripProps = {
  items: FeatureKpiItem[];
  className?: string;
  /** When true, show three placeholder cards instead of values */
  loading?: boolean;
};

export function FeatureKpiStrip({
  items,
  className,
  loading = false,
}: FeatureKpiStripProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <Card
            key={`${item.label}-${index}`}
            className="border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-none text-muted-foreground">
                {item.label}
              </p>
              {Icon ? (
                <Icon
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
            </div>
            {loading ? (
              <Skeleton className="mt-3 h-8 w-16 rounded-md" />
            ) : (
              <p
                className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground"
                aria-label={
                  item.valueLabel
                    ? `${item.label}: ${item.valueLabel}`
                    : undefined
                }
              >
                {item.value}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
