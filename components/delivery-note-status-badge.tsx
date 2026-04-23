"use client";

import { Badge } from "@/components/ui/badge";
import {
  DELIVERY_NOTE_STATUS_LABELS,
  normalizeDeliveryNoteStatus,
  type DeliveryNoteStatus,
} from "@/lib/deliveries-service";
import { cn } from "@/lib/utils";

const styles: Record<DeliveryNoteStatus, string> = {
  new: "bg-violet-100 text-violet-900 border-violet-200",
  delivered_to_driver: "bg-sky-100 text-sky-900 border-sky-200",
  completed: "bg-emerald-100 text-emerald-900 border-emerald-200",
};

export function DeliveryNoteStatusBadge({
  status,
  className,
}: {
  status: DeliveryNoteStatus | string | null | undefined;
  className?: string;
}) {
  const s = normalizeDeliveryNoteStatus(
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
      {DELIVERY_NOTE_STATUS_LABELS[s] ?? s}
    </Badge>
  );
}
