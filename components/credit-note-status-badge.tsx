import { Badge } from "@/components/ui/badge";
import type { CreditNoteStatus } from "@/lib/credit-notes-service";

interface CreditNoteStatusBadgeProps {
  status: CreditNoteStatus;
}

export function CreditNoteStatusBadge({ status }: CreditNoteStatusBadgeProps) {
  const variants: Record<
    CreditNoteStatus,
    { label: string; className: string }
  > = {
    draft: {
      label: "Draft",
      className:
        "bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200",
    },
    posted: {
      label: "Posted",
      className:
        "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300",
    },
    cancelled: {
      label: "Cancelled",
      className:
        "bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300",
    },
  };

  const variant = variants[status] ?? variants.draft;
  return <Badge className={variant.className}>{variant.label}</Badge>;
}
