"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductRow } from "@/lib/products-service";

type SalesOrderLineProductSelectProps = {
  products: ProductRow[];
  /** Selected `products.id`; undefined/`null` shows placeholder until user picks. */
  value: string | null;
  /** Always a real product id from the list (or orphan row id). */
  onValueChange: (productId: string) => void;
  className?: string;
  /** When set, trigger shows error styling. */
  invalid?: boolean;
};

export function SalesOrderLineProductSelect({
  products,
  value,
  onValueChange,
  className,
  invalid,
}: SalesOrderLineProductSelectProps) {
  const inList = Boolean(value && products.some((p) => p.id === value));
  const hasOrphan = Boolean(value && !inList);
  const selectValue =
    value && (inList || hasOrphan) ? value : undefined;

  return (
    <Select value={selectValue} onValueChange={onValueChange}>
      <SelectTrigger
        className={`h-9 w-full min-w-[11rem] max-w-[18rem] ${invalid ? "border-destructive" : ""} ${className ?? ""}`}
      >
        <SelectValue placeholder="Select product" />
      </SelectTrigger>
      <SelectContent className="max-h-[min(20rem,50vh)]">
        {hasOrphan && value ? (
          <SelectItem value={value}>
            Saved product (not in current list)
          </SelectItem>
        ) : null}
        {products.map((p) => (
          <SelectItem key={p.id} value={p.id} className="min-w-0">
            <span className="block truncate text-left">
              {p.name}
              {p.sku ? ` · ${p.sku}` : ""}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
