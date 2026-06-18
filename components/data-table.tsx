"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type Column,
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ColMeta = {
  thClassName?: string;
  tdClassName?: string;
  searchValue?: (row: unknown) => string;
  searchable?: boolean;
  /** When `onRowClick` is set, clicks on this column do not trigger row navigation. */
  stopRowClick?: boolean;
  /** Human-readable label for mobile card rows. */
  label?: string;
  /** Column shown as the mobile card title. */
  mobilePrimary?: boolean;
  /** Badges/chips rendered inline under the title on mobile. */
  mobileInline?: boolean;
  /** Omit from the mobile card body. */
  mobileHidden?: boolean;
};

const PRIMARY_COLUMN_IDS = new Set([
  "number",
  "name",
  "title",
  "code",
  "reference",
  "orderNumber",
  "invoiceNumber",
]);

function humanizeColumnId(id: string): string {
  return id
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function getColumnLabel<TData>(column: Column<TData, unknown>): string {
  const meta = column.columnDef.meta as ColMeta | undefined;
  if (meta?.label) return meta.label;
  return humanizeColumnId(column.id);
}

function isInlineColumn<TData>(column: Column<TData, unknown>): boolean {
  const meta = column.columnDef.meta as ColMeta | undefined;
  if (meta?.mobileInline) return true;
  if (meta?.mobilePrimary || meta?.mobileHidden) return false;
  const id = column.id.toLowerCase();
  return (
    id.includes("status") ||
    id.includes("badge") ||
    id.includes("payment") ||
    id.includes("fulfillment") ||
    id.endsWith("state") ||
    id.endsWith("type")
  );
}

function isAccessoryColumn<TData>(column: Column<TData, unknown>): boolean {
  if (column.id === "notes") return true;
  const meta = column.columnDef.meta as ColMeta | undefined;
  return Boolean(meta?.stopRowClick && meta?.searchable === false && column.id !== "actions");
}

function categorizeRowCells<TData>(cells: Cell<TData, unknown>[]) {
  let actions: Cell<TData, unknown> | undefined;
  let accessory: Cell<TData, unknown> | undefined;
  const candidates: Cell<TData, unknown>[] = [];

  for (const cell of cells) {
    const meta = cell.column.columnDef.meta as ColMeta | undefined;
    if (cell.column.id === "actions") {
      actions = cell;
      continue;
    }
    if (isAccessoryColumn(cell.column)) {
      accessory = cell;
      continue;
    }
    if (meta?.mobileHidden) continue;
    candidates.push(cell);
  }

  let primary =
    candidates.find(
      (cell) => (cell.column.columnDef.meta as ColMeta | undefined)?.mobilePrimary,
    ) ??
    candidates.find((cell) => PRIMARY_COLUMN_IDS.has(cell.column.id)) ??
    candidates.find((cell) => !isInlineColumn(cell.column)) ??
    candidates[0];

  const inline: Cell<TData, unknown>[] = [];
  const fields: Cell<TData, unknown>[] = [];

  for (const cell of candidates) {
    if (cell === primary) continue;
    if (isInlineColumn(cell.column)) {
      inline.push(cell);
    } else {
      fields.push(cell);
    }
  }

  return { primary, actions, accessory, inline, fields };
}

function DataTableMobileCards<TData>({
  rows,
  onRowClick,
  emptyMessage,
}: {
  rows: Row<TData>[];
  onRowClick?: (row: TData) => void;
  emptyMessage: React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center px-4 py-10 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {rows.map((row) => {
        const { primary, actions, accessory, inline, fields } = categorizeRowCells(
          row.getVisibleCells(),
        );

        return (
          <div
            key={row.id}
            className={cn(
              "px-3 py-3 transition-colors sm:px-4",
              onRowClick && "cursor-pointer active:bg-muted/30",
            )}
            onClick={
              onRowClick
                ? () => {
                    onRowClick(row.original);
                  }
                : undefined
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
                {primary
                  ? flexRender(
                      primary.column.columnDef.cell,
                      primary.getContext(),
                    )
                  : null}
              </div>
              <div
                className="flex shrink-0 items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {accessory
                  ? flexRender(
                      accessory.column.columnDef.cell,
                      accessory.getContext(),
                    )
                  : null}
                {actions
                  ? flexRender(
                      actions.column.columnDef.cell,
                      actions.getContext(),
                    )
                  : null}
              </div>
            </div>

            {inline.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {inline.map((cell) => (
                  <div key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                ))}
              </div>
            ) : null}

            {fields.length > 0 ? (
              <dl className="mt-2 space-y-1.5">
                {fields.map((cell) => {
                  const meta = cell.column.columnDef.meta as ColMeta | undefined;
                  const stopRow =
                    Boolean(meta?.stopRowClick) || cell.column.id === "actions";
                  return (
                    <div
                      key={cell.id}
                      className="flex items-start justify-between gap-3 text-xs leading-snug"
                      onClick={stopRow ? (e) => e.stopPropagation() : undefined}
                    >
                      <dt className="shrink-0 text-muted-foreground">
                        {getColumnLabel(cell.column)}
                      </dt>
                      <dd className="min-w-0 text-right text-foreground">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function buildRowSearchString<TData>(
  row: TData,
  columns: ColumnDef<TData, unknown>[],
): string {
  const parts: string[] = [];
  for (const col of columns) {
    const meta = col.meta as ColMeta | undefined;
    if (meta?.searchable === false) continue;
    if (meta?.searchValue) {
      parts.push(meta.searchValue(row));
      continue;
    }
    if ("accessorKey" in col && typeof col.accessorKey === "string") {
      const v = (row as Record<string, unknown>)[col.accessorKey];
      if (v != null) parts.push(String(v));
    }
  }
  return parts.join(" ");
}

export type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Left side of toolbar (filters, toggles). Placed after search when search is shown. */
  toolbarLeft?: React.ReactNode;
  searchPlaceholder?: string;
  defaultSearch?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** When true, search only updates via `searchValue` / `onSearchChange` (no client row filter). */
  manualFiltering?: boolean;
  getRowSearchString?: (row: TData) => string;
  emptyMessage?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  tableContainerClassName?: string;
  getRowId?: (originalRow: TData, index: number) => string;
  /** Opens the record (e.g. view page). Clicks on the actions column do not fire this. */
  onRowClick?: (row: TData) => void;
  /** Hide the search field (toolbar shows only `toolbarLeft` when set). */
  hideSearch?: boolean;
  /** Parent sorts full dataset; table only reflects sort UI on the current page slice. */
  manualSorting?: boolean;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /**
   * `minimal` — flat header, hairline row rules, light footer (dense list / SLA-style).
   * `default` — card chrome with muted toolbar/header bands.
   */
  variant?: "default" | "minimal";
  /** Stack rows as cards below the `md` breakpoint (no horizontal scroll). */
  enableMobileCards?: boolean;
};

export function DataTable<TData>({
  columns,
  data,
  toolbarLeft,
  searchPlaceholder = "Search…",
  defaultSearch = "",
  searchValue: controlledSearch,
  onSearchChange,
  manualFiltering = false,
  getRowSearchString,
  emptyMessage = "No results.",
  footer,
  className,
  tableContainerClassName,
  getRowId,
  onRowClick,
  hideSearch = false,
  manualSorting = false,
  sorting: controlledSorting,
  onSortingChange,
  variant = "default",
  enableMobileCards = true,
}: DataTableProps<TData>) {
  const isMinimal = variant === "minimal";
  const [uncontrolledSearch, setUncontrolledSearch] =
    React.useState(defaultSearch);
  const isSearchControlled = controlledSearch !== undefined;
  const search = isSearchControlled ? controlledSearch : uncontrolledSearch;
  const setSearch = React.useCallback(
    (v: string) => {
      onSearchChange?.(v);
      if (!isSearchControlled) setUncontrolledSearch(v);
    },
    [onSearchChange, isSearchControlled],
  );

  const filteredData = React.useMemo(() => {
    if (manualFiltering) return data;
    const q = search.trim().toLowerCase();
    if (!q) return data;
    if (getRowSearchString) {
      return data.filter((row) =>
        getRowSearchString(row).toLowerCase().includes(q),
      );
    }
    return data.filter((row) =>
      buildRowSearchString(row, columns).toLowerCase().includes(q),
    );
  }, [data, search, manualFiltering, columns, getRowSearchString]);

  const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);
  const sorting = controlledSorting ?? internalSorting;
  const setSorting = onSortingChange ?? setInternalSorting;

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(manualSorting ? {} : { getSortedRowModel: getSortedRowModel() }),
    onSortingChange: setSorting,
    state: { sorting },
    manualSorting,
    getRowId,
  });

  const rows = table.getRowModel().rows;
  const showToolbar = Boolean(toolbarLeft) || !hideSearch;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground shadow-sm",
        isMinimal && "rounded-lg border-border/50 shadow-none",
        className,
      )}
    >
      {showToolbar ? (
        <div
          className={cn(
            "flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5",
            isMinimal
              ? "border-border/50 bg-card"
              : "border-border/60 bg-muted/20",
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {!hideSearch ? (
              <div className="relative w-full min-w-0 sm:max-w-md lg:max-w-lg">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                  aria-hidden
                />
                <Input
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    "h-10 w-full rounded-full border-border/70 bg-background pl-10 pr-4 text-sm shadow-none",
                    "placeholder:text-muted-foreground/65",
                    "focus-visible:border-border focus-visible:ring-1 focus-visible:ring-ring/40",
                  )}
                  aria-label="Search table"
                />
              </div>
            ) : null}
            {toolbarLeft ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                {toolbarLeft}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 bg-card",
          enableMobileCards ? "hidden md:block md:overflow-x-auto" : "overflow-x-auto",
          "[&_[data-slot=table-container]]:overflow-visible",
          tableContainerClassName,
        )}
      >
        <Table className="w-full border-collapse">
          <TableHeader
            className={cn(
              "[&_tr]:border-0 [&_tr]:hover:bg-transparent",
              isMinimal
                ? cn(
                    "border-b border-border/50 bg-transparent",
                    "[&_button:not([role=checkbox])]:-ml-2 [&_button:not([role=checkbox])]:h-8 [&_button:not([role=checkbox])]:px-2 [&_button:not([role=checkbox])]:text-xs [&_button:not([role=checkbox])]:font-semibold [&_button:not([role=checkbox])]:text-foreground/85",
                    "[&_button:not([role=checkbox])]:hover:bg-muted/50 [&_button:not([role=checkbox])]:hover:text-foreground",
                  )
                : cn(
                    "border-b border-border/60 bg-muted/15",
                    "[&_button:not([role=checkbox])]:-ml-2 [&_button:not([role=checkbox])]:h-8 [&_button:not([role=checkbox])]:px-2 [&_button:not([role=checkbox])]:text-xs [&_button:not([role=checkbox])]:font-normal [&_button:not([role=checkbox])]:text-muted-foreground",
                    "[&_button:not([role=checkbox])]:hover:bg-muted/60 [&_button:not([role=checkbox])]:hover:text-foreground",
                  ),
            )}
          >
            {table.getHeaderGroups().map((hg) => (
              <TableRow
                key={hg.id}
                className="border-0 hover:bg-transparent data-[state=selected]:bg-transparent"
              >
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | ColMeta
                    | undefined;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-11 whitespace-nowrap px-3 py-3 text-left align-middle text-xs leading-none sm:px-4",
                        isMinimal
                          ? "font-semibold text-foreground/85"
                          : "font-medium text-muted-foreground",
                        meta?.thClassName,
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-auto min-h-[14rem] border-0 p-0 align-middle text-center text-muted-foreground"
                >
                  <div className="flex justify-center px-4 py-10">
                    {emptyMessage}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "border-0 border-b transition-colors",
                    isMinimal
                      ? "border-border/45 bg-transparent last:border-b-0 hover:bg-muted/25 data-[state=selected]:bg-muted/30"
                      : "border-border/55 bg-card last:border-b-0 hover:bg-muted/35 data-[state=selected]:bg-muted/45",
                    onRowClick ? "cursor-pointer" : undefined,
                  )}
                  onClick={
                    onRowClick
                      ? () => {
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as
                      | ColMeta
                      | undefined;
                    const stopRow =
                      Boolean(meta?.stopRowClick) ||
                      cell.column.id === "actions";
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "border-0 px-3 align-middle text-sm text-foreground sm:px-4",
                          isMinimal ? "py-3 sm:py-4" : "py-3 sm:py-3.5",
                          meta?.tdClassName,
                        )}
                        onClick={stopRow ? (e) => e.stopPropagation() : undefined}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {enableMobileCards ? (
        <div
          className={cn(
            "min-h-0 overflow-y-auto md:hidden",
            tableContainerClassName,
          )}
        >
          <DataTableMobileCards
            rows={rows}
            onRowClick={onRowClick}
            emptyMessage={emptyMessage}
          />
        </div>
      ) : null}

      {footer ? (
        <div
          className={cn(
            "shrink-0 border-t px-4 py-3 sm:px-5",
            isMinimal
              ? "border-border/50 bg-card"
              : "border-border/60 bg-muted/15",
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
