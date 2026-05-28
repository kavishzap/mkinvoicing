"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
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
};

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
          "min-h-0 overflow-x-auto bg-card [&_[data-slot=table-container]]:overflow-visible",
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
                        "h-11 px-4 py-3 text-left align-middle text-xs leading-none",
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
                          "border-0 px-4 align-middle text-sm text-foreground",
                          isMinimal ? "py-4" : "py-3.5",
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
