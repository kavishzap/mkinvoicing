"use client";

import type { LucideIcon } from "lucide-react";
import { Ban, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WhatsAppListFacets, WhatsAppListStatus } from "@/lib/whatsapp-groups-service";

type Props = {
  id?: string;
  facets: WhatsAppListFacets;
  statusFilter: WhatsAppListStatus;
  onStatusChange: (v: WhatsAppListStatus) => void;
  allLabel: string;
  allIcon: LucideIcon;
};

export function WhatsAppStatusFilterSidebar({
  id,
  facets,
  statusFilter,
  onStatusChange,
  allLabel,
  allIcon: AllIcon,
}: Props) {
  const statusRows: {
    id: WhatsAppListStatus;
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: allLabel,
      icon: AllIcon,
      count: facets.companyTotal,
    },
    {
      id: "active",
      label: "Active",
      icon: Check,
      count: facets.activeCount,
    },
    {
      id: "inactive",
      label: "Inactive",
      icon: Ban,
      count: facets.inactiveCount,
    },
  ];

  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  return (
    <aside id={id} className="w-full shrink-0 lg:self-stretch">
      <div className="space-y-7 py-1">
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By status
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by status">
            {statusRows.map((item) => {
              const Icon = item.icon;
              const selected = statusFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onStatusChange(item.id)}
                  aria-pressed={selected}
                  className={cn(
                    rowBtn,
                    selected
                      ? "bg-muted/90 font-semibold text-foreground shadow-none"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-75" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span
                    className={cn(
                      "inline-flex min-w-[1.625rem] shrink-0 items-center justify-center rounded-full",
                      "bg-muted/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-muted-foreground",
                      "dark:bg-muted/70",
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
