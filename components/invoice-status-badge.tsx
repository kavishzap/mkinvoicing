import type { InvoiceStatus } from "@/lib/invoice-store";
import { Badge } from "@/components/ui/badge";

type StatusWithCancelled = InvoiceStatus | "cancelled";

function localTodayYmd(): string {
  const n = new Date();
  return [
    n.getFullYear(),
    String(n.getMonth() + 1).padStart(2, "0"),
    String(n.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Compare calendar dates from `YYYY-MM-DD` (or ISO strings). */
function isPastDue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  const d = dueDate.slice(0, 10);
  return d < localTodayYmd();
}

interface InvoiceStatusBadgeProps {
  status: StatusWithCancelled;
  /**
   * When `status` is `unpaid`, pass the invoice due date so we only show "Overdue"
   * after that calendar day (not for future due dates).
   */
  dueDate?: string;
  /**
   * When set, overdue requires amount still due. Omit on list views that do not load this.
   */
  amountDue?: number;
}

export function InvoiceStatusBadge({
  status,
  dueDate,
  amountDue,
}: InvoiceStatusBadgeProps) {
  const variants: Record<StatusWithCancelled, { label: string; className: string }> =
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
        label: "Unpaid",
        className:
          "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200",
      },
      cancelled: {
        label: "Cancelled",
        className:
          "bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300",
      },
    };

  const stillOwes =
    amountDue === undefined ? true : Number(amountDue) > 0.005;

  const showOverdue =
    status === "unpaid" &&
    stillOwes &&
    isPastDue(dueDate);

  if (showOverdue) {
    const v = variants.overdue;
    return <Badge className={v.className}>{v.label}</Badge>;
  }

  const variant = variants[status];
  return <Badge className={variant.className}>{variant.label}</Badge>;
}
