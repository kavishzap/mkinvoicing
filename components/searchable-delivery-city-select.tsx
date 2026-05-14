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
import type { DeliveryCityRow } from "@/lib/delivery-zones-service";

export function SearchableDeliveryCitySelect({
  cities,
  value,
  onChange,
  placeholder,
  compact = false,
  id,
  "aria-invalid": ariaInvalid,
  className,
  listMaxHeightClassName = "max-h-[min(50vh,420px)]",
}: {
  cities: DeliveryCityRow[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  compact?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  className?: string;
  /** Scroll area for long city lists (default taller than base CommandList). */
  listMaxHeightClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = cities.find((c) => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          className={cn(
            "w-full justify-between font-normal",
            compact ? "h-8 text-xs" : "h-10",
            className,
          )}
        >
          <span className="truncate">{selected?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter>
          <CommandInput placeholder="Search cities by name…" className="text-xs" />
          <CommandList className={cn("scroll-py-1 overflow-y-auto", listMaxHeightClassName)}>
            <CommandEmpty>No city found.</CommandEmpty>
            {cities.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.name} ${c.id}`}
                className="text-xs"
                onSelect={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === c.id ? "opacity-100" : "opacity-0",
                  )}
                />
                {c.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
