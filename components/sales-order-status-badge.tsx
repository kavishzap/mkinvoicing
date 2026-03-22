import { Badge } from "@/components/ui/badge";
import type { SalesOrderStatus } from "@/lib/sales-orders-service";
import { cn } from "@/lib/utils";

const styles: Record<SalesOrderStatus, string> = {
  active: "bg-emerald-100 text-emerald-900 border-emerald-200",
  expired: "bg-amber-100 text-amber-900 border-amber-200",
};

const labels: Record<SalesOrderStatus, string> = {
  active: "Active",
  expired: "Expired",
};

export function SalesOrderStatusBadge({
  status,
  className,
}: {
  status: SalesOrderStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", styles[status], className)}
    >
      {labels[status]}
    </Badge>
  );
}
