"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
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
  /** Left side of toolbar (filters, toggles). Search stays on the right. */
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
}: DataTableProps<TData>) {
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

  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    getRowId,
  });

  const rows = table.getRowModel().rows;

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center",
          toolbarLeft ? "sm:justify-between" : "sm:justify-end",
        )}
      >
        {toolbarLeft ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {toolbarLeft}
          </div>
        ) : null}
        <div className="relative w-full shrink-0 sm:ml-auto sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
            aria-label="Search table"
          />
        </div>
      </div>

      <div
        className={cn(
          "overflow-x-auto rounded-md border",
          tableContainerClassName,
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColMeta | undefined;
                  return (
                    <TableHead
                      key={header.id}
                      className={meta?.thClassName}
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
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as ColMeta | undefined;
                    return (
                      <TableCell key={cell.id} className={meta?.tdClassName}>
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
      {footer}
    </div>
  );
}
