import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Dashboard stat cards + chart — matches `app/app/page.tsx`. */
export function DashboardPageSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

/** List pages with filter sidebar + searchable table (invoices, customers, etc.). */
export function DirectoryListPageSkeleton({
  className,
  showFilterPanel = true,
  rowCount = 7,
}: {
  className?: string;
  showFilterPanel?: boolean;
  rowCount?: number;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-6",
        className,
      )}
      aria-hidden
    >
      {showFilterPanel ? (
        <Card className="hidden shrink-0 lg:flex lg:w-56 xl:w-[15rem]">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-border/50 bg-card shadow-none">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/50 bg-muted/45 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Skeleton className="h-10 w-full sm:max-w-xl" />
          <Skeleton className="h-4 w-24 shrink-0" />
        </div>
        <div className="flex min-h-[280px] flex-1 flex-col">
          {Array.from({ length: rowCount }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border/40 px-4 py-3.5 last:border-0 sm:px-5"
            >
              <Skeleton className="h-4 w-[16%] max-w-[7rem]" />
              <Skeleton className="h-4 min-w-0 flex-1" />
              <Skeleton className="hidden h-4 w-[12%] sm:block" />
              <Skeleton className="hidden h-4 w-[10%] md:block" />
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-border/50 px-4 py-3 sm:px-5">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-44" />
        </div>
      </div>
    </div>
  );
}

/** Simpler list/table inside a single card (quotations, purchase orders, suppliers). */
export function TableListPageSkeleton({
  className,
  rowCount = 6,
}: {
  className?: string;
  rowCount?: number;
}) {
  return (
    <Card className={cn("overflow-hidden", className)} aria-hidden>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 border-b border-border/50 pb-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-9 w-28 shrink-0" />
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: rowCount }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/40 px-6 py-3.5 last:border-0"
          >
            <Skeleton className="h-4 w-[14%]" />
            <Skeleton className="h-4 min-w-0 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
        <div className="flex items-center justify-between px-6 py-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Document view pages (invoice, sales order, quotation detail). */
export function DetailDocumentPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)} aria-hidden>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 border-b border-border/50 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-20 w-32 shrink-0 rounded-md" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[80%]" />
              <Skeleton className="h-4 w-[60%]" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[80%]" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
        <div className="mt-6 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Skeleton className="h-24 w-56" />
        </div>
      </div>
    </div>
  );
}

/** New/edit forms with two section columns + optional line-items block. */
export function FormTwoColumnPageSkeleton({
  className,
  withLineItems = true,
}: {
  className?: string;
  withLineItems?: boolean;
}) {
  return (
    <div
      className={cn(
        "h-auto w-full rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6",
        className,
      )}
      aria-hidden
    >
      <Skeleton className="h-10 w-48" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-[80%]" />
              <Skeleton className="h-9 w-[60%]" />
            </CardContent>
          </Card>
        ))}
      </div>
      {withLineItems ? (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-9 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** Settings / profile two-column layout. */
export function SettingsTwoColumnSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-2", className)} aria-hidden>
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Full-page placeholder while a client redirect runs. */
export function RedirectPageSkeleton() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col px-4 py-4 text-sm sm:px-5 sm:py-5">
      <DirectoryListPageSkeleton className="min-h-[420px] flex-1" />
    </div>
  );
}

/** Table body rows with configurable columns (list pages, dialogs). */
export function TableBodyRowsSkeleton({
  rowCount = 5,
  colCount = 5,
  className,
}: {
  rowCount?: number;
  colCount?: number;
  className?: string;
}) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, rowIdx) => (
        <tr key={rowIdx} className={cn("border-t", className)}>
          {Array.from({ length: colCount }, (_, colIdx) => (
            <td key={colIdx} className="p-3">
              <Skeleton
                className={cn(
                  "h-4",
                  colIdx === colCount - 1 ? "ml-auto w-28" : "w-full max-w-[10rem]",
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Compact table/list rows inside a card. */
export function InlineTableRowsSkeleton({
  className,
  rowCount = 5,
}: {
  className?: string;
  rowCount?: number;
}) {
  return (
    <div className={cn("space-y-2 py-2", className)} aria-hidden>
      {Array.from({ length: rowCount }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** Three summary cards in a row (e.g. related documents). */
export function ThreeCardStripSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-3", className)}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Report / ledger tab content (stat cards + table). */
export function ReportTabSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)} aria-hidden>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** Expense / similar detail with sidebar summary. */
export function DetailWithSidebarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6",
        className,
      )}
      aria-hidden
    >
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
}
