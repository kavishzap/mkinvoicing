import { Badge } from "@/components/ui/badge";
import type { QuotationStatus } from "@/lib/quotations-service";
import { cn } from "@/lib/utils";

const styles: Record<QuotationStatus, string> = {
  active: "bg-emerald-100 text-emerald-900 border-emerald-200",
  expired: "bg-amber-100 text-amber-900 border-amber-200",
};

const labels: Record<QuotationStatus, string> = {
  active: "Active",
  expired: "Expired",
};

export function QuotationStatusBadge({
  status,
  className,
}: {
  status: QuotationStatus;
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
