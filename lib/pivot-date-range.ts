export type PivotPeriod = "today" | "week" | "month" | "year" | "custom";

export const PIVOT_PERIOD_OPTIONS = [
  { value: "today" as const, label: "Today" },
  { value: "week" as const, label: "This week" },
  { value: "month" as const, label: "This month" },
  { value: "year" as const, label: "This year" },
  { value: "custom" as const, label: "Custom" },
];

/** Local calendar date as `YYYY-MM-DD` (no timezone shift). */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse `YYYY-MM-DD` as local midnight — avoids UTC off-by-one in labels. */
export function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(y, mo - 1, d);
}

export function getPivotDateRange(
  period: PivotPeriod,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string } {
  const today = new Date();
  const end = toLocalDateStr(today);

  if (period === "today") {
    return { start: end, end };
  }
  if (period === "week") {
    const startDate = new Date(today);
    const weekday = startDate.getDay();
    const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
    startDate.setDate(startDate.getDate() - daysFromMonday);
    return { start: toLocalDateStr(startDate), end };
  }
  if (period === "month") {
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: toLocalDateStr(startDate), end };
  }
  if (period === "year") {
    const startDate = new Date(today.getFullYear(), 0, 1);
    return { start: toLocalDateStr(startDate), end };
  }

  const start = customStart?.trim() || end;
  const endDate = customEnd?.trim() || end;
  return { start, end: endDate };
}

export function isPivotCustomRangeInvalid(start: string, end: string): boolean {
  const s = start.trim();
  const e = end.trim();
  if (!s || !e) return false;
  return s > e;
}

export function formatPivotPeriodLabel(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = parseLocalDate(iso);
    if (!d) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };
  if (start === end) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

export function defaultPivotCustomStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return toLocalDateStr(d);
}

export function defaultPivotCustomEnd(): string {
  return toLocalDateStr(new Date());
}
