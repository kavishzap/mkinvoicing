"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
export function DeliveryBalanceCollapsibleSection({
  icon: Icon,
  title,
  subtitle,
  count,
  defaultOpen = true,
  children,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={className ?? undefined}>
      <Card className="flex min-w-0 flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="group cursor-pointer rounded-none border-b bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <div className="flex w-full min-w-0 flex-row items-start gap-2.5">
              <ChevronDown
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                aria-hidden
              />
              <Icon
                className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1 text-left">
                <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base leading-snug">
                  <span className="min-w-0 break-words">{title}</span>
                  {count !== undefined ? (
                    <span className="rounded-full bg-muted/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground dark:bg-muted/70">
                      {count}
                    </span>
                  ) : null}
                </CardTitle>
                {subtitle ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="min-w-0 px-4 py-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
