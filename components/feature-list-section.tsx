"use client";

import type { ReactNode } from "react";
import type { FeatureKpiItem } from "@/components/feature-kpi-strip";
import { FeatureKpiStrip } from "@/components/feature-kpi-strip";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FeatureListSectionProps = {
  /** Up to three KPI cards; omit or pass empty to hide the strip */
  kpiItems?: FeatureKpiItem[];
  kpiLoading?: boolean;
  /** Section heading inside the main card (e.g. “Sales orders”) */
  listTitle: string;
  listDescription?: string;
  /** Optional node on the same row as the title (e.g. extra controls) */
  listHeaderTrailing?: ReactNode;
  children: ReactNode;
  className?: string;
  cardClassName?: string;
};

/**
 * Standard feature list layout: optional KPI row, then a bordered card with list title + body (usually `DataTable`).
 */
export function FeatureListSection({
  kpiItems,
  kpiLoading = false,
  listTitle,
  listDescription,
  listHeaderTrailing,
  children,
  className,
  cardClassName,
}: FeatureListSectionProps) {
  const showKpis = (kpiItems?.length ?? 0) > 0;

  return (
    <div className={cn("space-y-6", className)}>
      {showKpis ? (
        <FeatureKpiStrip items={kpiItems!} loading={kpiLoading} />
      ) : null}

      <Card className={cn("border bg-card p-5 shadow-sm sm:p-6", cardClassName)}>
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {listTitle}
            </h2>
            {listDescription ? (
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {listDescription}
              </p>
            ) : null}
          </div>
          {listHeaderTrailing ? (
            <div className="shrink-0 md:pt-0.5">{listHeaderTrailing}</div>
          ) : null}
        </div>
        {children}
      </Card>
    </div>
  );
}
