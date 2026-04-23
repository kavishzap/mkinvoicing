"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type DiscountTypeValue = "value" | "percent";

type DiscountTypeToggleProps = {
  value: DiscountTypeValue;
  onChange: (type: DiscountTypeValue) => void;
  /** Shown for fixed-amount mode (e.g. `MUR`). Falls back to “Fixed” if empty. */
  currencyLabel: string;
  className?: string;
};

export function DiscountTypeToggle({
  value,
  onChange,
  currencyLabel,
  className,
}: DiscountTypeToggleProps) {
  const fixedLabel = currencyLabel.trim() || "Fixed";

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      className={cn("h-8 shrink-0", className)}
      value={value}
      onValueChange={(v) => {
        if (v === "value" || v === "percent") onChange(v);
      }}
    >
      <ToggleGroupItem
        value="value"
        aria-label="Fixed amount discount"
        className="px-2.5 text-xs tabular-nums"
      >
        {fixedLabel}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="percent"
        aria-label="Percent discount"
        className="px-2.5 text-xs"
      >
        %
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
