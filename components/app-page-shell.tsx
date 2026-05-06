import type React from "react";
import {
  RegisterPageActions,
  RegisterPageTitleBefore,
  RegisterTopbarTrailingBeforeTheme,
} from "@/components/register-page-actions";
import { cn } from "@/lib/utils";

/** Outer padding + width for all `/app/*` feature pages (topbar title is separate). */
export const APP_PAGE_SHELL_CLASS =
  "mx-auto w-full max-w-[1800px] px-4 py-5 text-sm sm:px-6 sm:py-6";

const APP_PAGE_SHELL_COMPACT_CLASS =
  "mx-auto w-full max-w-[1800px] px-4 py-4 text-sm sm:px-5 sm:py-5";

type AppPageShellProps = {
  /** Renders in the app top bar immediately before the page title (e.g. back icon). */
  titleBefore?: React.ReactNode;
  /** One line of context under the shell title — user-facing, no duplicate of the nav label. */
  subtitle?: string;
  /** Extra classes for the subtitle paragraph (defaults keep it readable width). */
  subtitleClassName?: string;
  /** e.g. back button — sits with the subtitle row */
  leading?: React.ReactNode;
  /** Primary actions — shown in the app top bar next to the page title. */
  actions?: React.ReactNode;
  /** Top bar: after company name, before theme toggle (e.g. filter toggle). */
  topbarTrailingBeforeTheme?: React.ReactNode;
  /** Renders directly under the subtitle row (e.g. document view toolbars). */
  belowSubtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Tighter padding and vertical rhythm (settings, long forms). */
  compact?: boolean;
  /** Grow to fill available height below the top bar (full-page forms). */
  fillHeight?: boolean;
};

export function AppPageShell({
  titleBefore,
  subtitle,
  subtitleClassName,
  leading,
  actions,
  topbarTrailingBeforeTheme,
  belowSubtitle,
  children,
  className,
  compact = false,
  fillHeight = false,
}: AppPageShellProps) {
  const showHeader = Boolean(leading || subtitle || belowSubtitle);

  return (
    <div
      className={cn(
        compact ? APP_PAGE_SHELL_COMPACT_CLASS : APP_PAGE_SHELL_CLASS,
        fillHeight && "flex min-h-0 w-full min-w-0 flex-1 flex-col",
        className,
      )}
    >
      {titleBefore ? (
        <RegisterPageTitleBefore>{titleBefore}</RegisterPageTitleBefore>
      ) : null}
      {actions ? <RegisterPageActions>{actions}</RegisterPageActions> : null}
      {topbarTrailingBeforeTheme ? (
        <RegisterTopbarTrailingBeforeTheme>
          {topbarTrailingBeforeTheme}
        </RegisterTopbarTrailingBeforeTheme>
      ) : null}
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
                <p
                  className={cn(
                    "max-w-3xl text-sm leading-relaxed text-muted-foreground",
                    subtitleClassName,
                  )}
                >
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
      <div
        className={cn(
          compact && !fillHeight ? "space-y-4" : !fillHeight ? "space-y-6" : "",
          fillHeight &&
            "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-6",
        )}
      >
        {children}
      </div>
    </div>
  );
}
