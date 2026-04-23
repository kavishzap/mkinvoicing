"use client";

import { Badge } from "@/components/ui/badge";
import {
  SALES_ORDER_FULFILLMENT_LABELS,
  normalizeSalesOrderFulfillmentStatus,
  type SalesOrderFulfillmentStatus,
} from "@/lib/sales-orders-service";
import { cn } from "@/lib/utils";

const styles: Record<SalesOrderFulfillmentStatus, string> = {
  new: "bg-slate-100 text-slate-900 border-slate-200",
  "delivered to driver": "bg-sky-100 text-sky-900 border-sky-200",
  "delivered to customer": "bg-emerald-100 text-emerald-900 border-emerald-200",
  cancelled: "bg-red-100 text-red-900 border-red-200",
  Rescheduled: "bg-amber-100 text-amber-900 border-amber-200",
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
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        styles[s] ?? "bg-muted/60 text-foreground border-border",
        className
      )}
    >
      {SALES_ORDER_FULFILLMENT_LABELS[s] ?? s}
    </Badge>
  );
}
