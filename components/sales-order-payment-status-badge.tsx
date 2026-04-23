import { Badge } from "@/components/ui/badge";
import {
  type SalesOrderPaymentStatus,
  SALES_ORDER_PAYMENT_LABELS,
} from "@/lib/sales-orders-service";

export function SalesOrderPaymentStatusBadge({
  status,
}: {
  status: SalesOrderPaymentStatus;
}) {
  const variant =
    status === "paid"
      ? "default"
      : status === "partial"
        ? "outline"
        : "secondary";

  return (
    <Badge variant={variant}>{SALES_ORDER_PAYMENT_LABELS[status]}</Badge>
  );
}
