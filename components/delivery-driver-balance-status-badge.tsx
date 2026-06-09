"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DriverSettlementStatus } from "@/lib/deliveries-service";

const collectionStyles = {
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  collected: "bg-emerald-100 text-emerald-900 border-emerald-200",
} as const;

const settlementStyles = {
  pending:
    "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/35 dark:text-amber-100 dark:border-amber-800",
  settled: "bg-emerald-100 text-emerald-900 border-emerald-200",
  due: "bg-red-100 text-red-900 border-red-200 dark:bg-red-950/35 dark:text-red-100 dark:border-red-800",
} as const;

const settlementLabels: Record<DriverSettlementStatus, string> = {
  pending: "Pending",
  settled: "Settled",
  due: "Due",
};

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
  status,
  settled,
  className,
}: {
  /** Preferred: explicit settlement status. */
  status?: DriverSettlementStatus;
  /** @deprecated Use status */
  settled?: boolean;
  className?: string;
}) {
  const resolved: DriverSettlementStatus =
    status ?? (settled ? "settled" : "pending");
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        settlementStyles[resolved],
        className
      )}
    >
      {settlementLabels[resolved]}
    </Badge>
  );
}
