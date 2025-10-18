import type { InvoiceStatus } from "@/lib/invoice-store";
import { Badge } from "@/components/ui/badge";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const variants: Record<InvoiceStatus, { label: string; className: string }> =
    {
      draft: {
        label: "Draft",
        className: "bg-muted text-muted-foreground hover:bg-muted",
      },
      sent: {
        label: "Sent",
        className:
          "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300",
      },
      paid: {
        label: "Paid",
        className:
          "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300",
      },
      overdue: {
        label: "Overdue",
        className:
          "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
      },
      unpaid: {
        label: "Overdue",
        className:
          "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
      },
    };

  const variant = variants[status];

  return <Badge className={variant.className}>{variant.label}</Badge>;
}
