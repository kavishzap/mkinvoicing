"use client";

import { Badge } from "@/components/ui/badge";
import {
  salesOrderFulfillmentDisplayLabel,
  normalizeSalesOrderFulfillmentStatus,
  type SalesOrderFulfillmentStatus,
} from "@/lib/sales-orders-service";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  new: "bg-slate-100 text-slate-900 border-slate-200",
  pending: "bg-blue-100 text-blue-950 border-blue-200 dark:bg-blue-950/35 dark:text-blue-100 dark:border-blue-800",
  "delivery note created": "bg-violet-100 text-violet-900 border-violet-200",
  "delivered to driver": "bg-sky-100 text-sky-900 border-sky-200",
  "delivered to customer": "bg-emerald-100 text-emerald-900 border-emerald-200",
  completed: "bg-green-100 text-green-900 border-green-200",
  cancelled: "bg-red-100 text-red-900 border-red-200",
  rescheduled: "bg-amber-100 text-amber-900 border-amber-200",
  upselling:
    "bg-purple-100 text-purple-950 border-purple-200 dark:bg-purple-950/40 dark:text-purple-100 dark:border-purple-800",
};

export function SalesOrderFulfillmentStatusBadge({
  status,
  className,
}: {
  /** Raw DB value or normalized enum — mapped to `sales_order_fulfillment_status`. */
  status: SalesOrderFulfillmentStatus | string | null | undefined;
  className?: string;
}) {
  const s = normalizeSalesOrderFulfillmentStatus(
    status === null || status === undefined ? undefined : String(status)
  );
  const label = salesOrderFulfillmentDisplayLabel(
    status === null || status === undefined ? "" : String(status),
  );
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        styles[s] ?? "bg-muted/60 text-foreground border-border",
        className
      )}
    >
      {label}
    </Badge>
  );
}
