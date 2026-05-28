"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
  const [open, setOpen] = useState(false);
  const inList = Boolean(value && products.some((p) => p.id === value));
  const hasOrphan = Boolean(value && !inList);
  const selected = products.find((p) => p.id === value);

  const label = selected
    ? `${selected.name}${selected.sku ? ` · ${selected.sku}` : ""}`
    : hasOrphan && value
      ? "Saved item (not in current list)"
      : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn(
            "h-9 w-full min-w-[8rem] max-w-[16rem] justify-between font-normal text-xs",
            invalid && "border-destructive",
            className,
          )}
        >
          <span className="truncate text-left">
            {label ?? "Select item"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-0"
        align="start"
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Search by name or SKU…"
            className="text-xs"
          />
          <CommandList className="max-h-[min(50vh,320px)] scroll-py-1 overflow-y-auto">
            <CommandEmpty>No items found.</CommandEmpty>
            {hasOrphan && value ? (
              <CommandItem
                value="saved-orphan-product"
                className="text-xs"
                onSelect={() => {
                  onValueChange(value);
                  setOpen(false);
                }}
              >
                <Check className="mr-2 h-4 w-4 opacity-100" />
                Saved item (not in current list)
              </CommandItem>
            ) : null}
            {products.map((p) => (
              <CommandItem
                key={p.id}
                value={`${p.name} ${p.sku ?? ""} ${p.id}`}
                className="text-xs"
                onSelect={() => {
                  onValueChange(p.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === p.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 truncate">
                  {p.name}
                  {p.sku ? (
                    <span className="text-muted-foreground"> · {p.sku}</span>
                  ) : null}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
