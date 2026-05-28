"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ReportPeriodOption<T extends string> = {
  value: T;
  label: string;
};

type ReportPeriodTabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly ReportPeriodOption<T>[];
  className?: string;
};

export function ReportPeriodTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: ReportPeriodTabsProps<T>) {
  const cols = options.length;
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className={className}
    >
      <TabsList
        className="grid h-auto w-full shrink-0 gap-1 p-1 sm:inline-flex sm:w-auto"
        style={
          cols <= 4
            ? ({ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } as const)
            : undefined
        }
      >
        {options.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            className="text-xs sm:text-sm"
          >
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
