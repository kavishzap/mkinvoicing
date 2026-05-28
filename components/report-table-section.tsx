"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ReportTone =
  | "sky"
  | "violet"
  | "indigo"
  | "amber"
  | "emerald"
  | "rose";

export const REPORT_TONE: Record<
  ReportTone,
  { card: string; pill: string; headerRow: string; icon: string }
> = {
  sky: {
    card: "border-sky-300/70 bg-sky-50/40 dark:border-sky-800/50 dark:bg-sky-950/15",
    pill: "border-sky-500/30 bg-sky-500/15 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    headerRow: "bg-sky-100/70 dark:bg-sky-900/30",
    icon: "text-sky-600 dark:text-sky-300",
  },
  violet: {
    card: "border-violet-300/70 bg-violet-50/40 dark:border-violet-800/50 dark:bg-violet-950/15",
    pill: "border-violet-500/30 bg-violet-500/15 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    headerRow: "bg-violet-100/70 dark:bg-violet-900/30",
    icon: "text-violet-600 dark:text-violet-300",
  },
  indigo: {
    card: "border-indigo-300/70 bg-indigo-50/40 dark:border-indigo-800/50 dark:bg-indigo-950/15",
    pill: "border-indigo-500/30 bg-indigo-500/15 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
    headerRow: "bg-indigo-100/70 dark:bg-indigo-900/30",
    icon: "text-indigo-600 dark:text-indigo-300",
  },
  amber: {
    card: "border-amber-300/80 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/15",
    pill: "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    headerRow: "bg-amber-100/70 dark:bg-amber-900/30",
    icon: "text-amber-600 dark:text-amber-300",
  },
  emerald: {
    card: "border-emerald-300/70 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/15",
    pill: "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    headerRow: "bg-emerald-100/70 dark:bg-emerald-900/30",
    icon: "text-emerald-600 dark:text-emerald-300",
  },
  rose: {
    card: "border-rose-300/70 bg-rose-50/40 dark:border-rose-800/50 dark:bg-rose-950/15",
    pill: "border-rose-500/30 bg-rose-500/15 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
    headerRow: "bg-rose-100/70 dark:bg-rose-900/30",
    icon: "text-rose-600 dark:text-rose-300",
  },
};

type ReportTableSectionProps = {
  title: string;
  icon: LucideIcon;
  tone: ReportTone;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function ReportTableSection({
  title,
  icon: Icon,
  tone,
  count,
  defaultOpen = true,
  children,
}: ReportTableSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const t = REPORT_TONE[tone];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section
        className={cn(
          "overflow-hidden rounded-xl border-2 shadow-sm",
          t.card,
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
          >
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
                t.pill,
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", t.icon)} aria-hidden />
              {title}
            </span>
            <span className="flex items-center gap-2">
              {typeof count === "number" ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {count} {count === 1 ? "row" : "rows"}
                </span>
              ) : null}
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t bg-card">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/** Two-column label / amount grid for P&amp;L-style line items. */
export function ReportLineGrid({
  lines,
  muted = false,
}: {
  lines: { label: string; value: string; emphasis?: boolean }[];
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-4 text-sm",
        muted && "text-muted-foreground",
      )}
    >
      {lines.map((line) => (
        <Fragment key={line.label}>
          <span
            className={cn(line.emphasis && "font-semibold text-foreground")}
          >
            {line.label}
          </span>
          <span
            className={cn(
              "text-right tabular-nums",
              line.emphasis && "font-semibold text-foreground",
            )}
          >
            {line.value}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
