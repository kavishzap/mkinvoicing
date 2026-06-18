/** Allow empty or decimal numeric text while editing (avoids type="number" quirks). */
export function sanitizeDecimalInput(raw: string): string {
  const normalized = raw.replace(/,/g, ".");
  if (normalized === "") return "";

  const match = normalized.match(/^\d*\.?\d*/);
  if (!match) return "";

  let value = match[0];
  if (value.length > 1 && value.startsWith("0") && value[1] !== ".") {
    value = value.replace(/^0+/, "") || "0";
  }
  return value;
}

/** Display number in a text field; empty string when zero so the field can be cleared. */
export function formatNumericFieldValue(n: number): string {
  return n === 0 ? "" : String(n);
}

export function parseNumericFieldValue(raw: string, fallback = 0): number {
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}
