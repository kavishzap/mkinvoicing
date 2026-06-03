"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const collectionStyles = {
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  collected: "bg-emerald-100 text-emerald-900 border-emerald-200",
} as const;

const settlementStyles = {
  pending:
    "bg-red-100 text-red-900 border-red-200 dark:bg-red-950/35 dark:text-red-100 dark:border-red-800",
  settled: "bg-emerald-100 text-emerald-900 border-emerald-200",
} as const;

export function DeliveryDriverCollectionBadge({
  collected,
  className,
}: {
  collected: boolean;
  className?: string;
}) {
  const key = collected ? "collected" : "pending";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        collectionStyles[key],
        className
      )}
    >
      {collected ? "Collected" : "Pending"}
    </Badge>
  );
}

export function DeliveryDriverSettlementBadge({
  settled,
  className,
}: {
  settled: boolean;
  className?: string;
}) {
  const key = settled ? "settled" : "pending";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        settlementStyles[key],
        className
      )}
    >
      {settled ? "Settled" : "Pending"}
    </Badge>
  );
}
