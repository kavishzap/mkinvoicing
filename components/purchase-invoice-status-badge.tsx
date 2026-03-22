import { Badge } from "@/components/ui/badge";
import type { PurchaseInvoiceStatus } from "@/lib/purchase-invoices-service";
import { cn } from "@/lib/utils";

const styles: Record<PurchaseInvoiceStatus, string> = {
  unpaid: "bg-slate-100 text-slate-900 border-slate-200",
  partially_paid: "bg-sky-100 text-sky-900 border-sky-200",
  paid: "bg-emerald-100 text-emerald-900 border-emerald-200",
  overdue: "bg-red-100 text-red-900 border-red-200",
  cancelled: "bg-gray-100 text-gray-700 border-gray-200",
};

const labels: Record<PurchaseInvoiceStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export function PurchaseInvoiceStatusBadge({
  status,
  className,
}: {
  status: PurchaseInvoiceStatus;
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
