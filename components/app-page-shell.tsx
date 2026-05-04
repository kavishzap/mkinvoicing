import type React from "react";
import { RegisterPageActions } from "@/components/register-page-actions";
import { cn } from "@/lib/utils";

/** Outer padding + width for all `/app/*` feature pages (topbar title is separate). */
export const APP_PAGE_SHELL_CLASS =
  "mx-auto w-full max-w-[1800px] px-4 py-5 text-sm sm:px-6 sm:py-6";

const APP_PAGE_SHELL_COMPACT_CLASS =
  "mx-auto w-full max-w-[1800px] px-4 py-4 text-sm sm:px-5 sm:py-5";

type AppPageShellProps = {
  /** One line of context under the shell title — user-facing, no duplicate of the nav label. */
  subtitle?: string;
  /** e.g. back button — sits with the subtitle row */
  leading?: React.ReactNode;
  /** Primary actions — shown in the app top bar next to the page title. */
  actions?: React.ReactNode;
  /** Renders directly under the subtitle row (e.g. document view toolbars). */
  belowSubtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Tighter padding and vertical rhythm (settings, long forms). */
  compact?: boolean;
};

export function AppPageShell({
  subtitle,
  leading,
  actions,
  belowSubtitle,
  children,
  className,
  compact = false,
}: AppPageShellProps) {
  const showHeader = Boolean(leading || subtitle || belowSubtitle);

  return (
    <div
      className={cn(
        compact ? APP_PAGE_SHELL_COMPACT_CLASS : APP_PAGE_SHELL_CLASS,
        className,
      )}
    >
      {actions ? <RegisterPageActions>{actions}</RegisterPageActions> : null}
      {showHeader ? (
        <div
          className={cn(
            "flex flex-col print:hidden",
            compact ? "mb-4 gap-3" : "mb-6 gap-4",
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {leading}
              {subtitle ? (
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {belowSubtitle ? (
            <div className="print:hidden w-full min-w-0 rounded-lg border border-border bg-muted/40 p-3 sm:p-4">
              {belowSubtitle}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={compact ? "space-y-4" : "space-y-6"}>{children}</div>
    </div>
  );
}
