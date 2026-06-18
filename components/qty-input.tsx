"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatNumericFieldValue,
  parseNumericFieldValue,
  sanitizeDecimalInput,
} from "@/lib/numeric-field";

type QtyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** Text-based quantity field — allows clearing and avoids leading-zero coercion. */
export function QtyInput({
  value,
  onValueChange,
  className,
  inputMode = "decimal",
  ...props
}: QtyInputProps) {
  return (
    <Input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(e) => onValueChange(sanitizeDecimalInput(e.target.value))}
      className={cn("tabular-nums", className)}
      {...props}
    />
  );
}

type QtyNumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  value: number;
  onValueChange: (value: number) => void;
};

/** Quantity field backed by a number in form state. */
export function QtyNumberInput({
  value,
  onValueChange,
  className,
  inputMode = "decimal",
  ...props
}: QtyNumberInputProps) {
  return (
    <QtyInput
      value={formatNumericFieldValue(value)}
      onValueChange={(raw) => onValueChange(parseNumericFieldValue(raw))}
      className={className}
      inputMode={inputMode}
      {...props}
    />
  );
}
