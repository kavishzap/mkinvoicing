"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DataTablePaginationFooterProps = {
  total: number;
  /** 1-based */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  /** Stronger current-page accent (list screens). */
  variant?: "default" | "minimal";
};

export function DataTablePaginationFooter({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  className,
  variant = "default",
}: DataTablePaginationFooterProps) {
  const isMinimal = variant === "minimal";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p
          className={cn(
            "tabular-nums text-muted-foreground",
            isMinimal ? "text-sm" : "text-xs",
          )}
        >
          {total === 0 ? (
            <>0–0 of 0</>
          ) : (
            <>
              {from}–{to} of {total}
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "whitespace-nowrap text-muted-foreground max-sm:sr-only",
              isMinimal ? "text-sm" : "text-xs",
            )}
          >
            Items per page
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-[4.25rem] rounded-md border-border/70 bg-background text-xs shadow-none max-sm:w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-md border-border/70 bg-background shadow-none"
          aria-label="Previous page"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span
          className={cn(
            "min-w-[2.25rem] rounded-md px-2 py-1 text-center text-sm font-semibold tabular-nums",
            isMinimal
              ? "bg-primary text-primary-foreground shadow-none"
              : "bg-muted/80 font-medium text-foreground",
          )}
          aria-current="page"
        >
          {safePage}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-md border-border/70 bg-background shadow-none"
          aria-label="Next page"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
