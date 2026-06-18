"use client";
import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CalendarRange,
  Download,
  MoreVertical,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { useToast } from "@/hooks/use-toast";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { AppPageShell } from "@/components/app-page-shell";
import {
  DIRECTORY_LIST_PANEL_CLASS,
  DirectoryFilterPanel,
  DirectoryFilterToggleButton,
  DirectoryListFrame,
  DirectoryListSearchHeader,
} from "@/components/directory-list-layout";
import { ResponsivePageActions } from "@/components/responsive-page-actions";
import { useDirectoryFiltersOpen } from "@/hooks/use-directory-filters-open";
import {
  deleteExpense,
  fetchExpenseListFacets,
  listAllExpensesForExport,
  listExpenses,
  type ExpenseListFacets,
  type ExpensePeriodFilter,
  type ExpenseRow,
} from "@/lib/expenses-service";
import { cn } from "@/lib/utils";

function ExpensesFilterSidebar({
  facets,
  periodFilter,
  onPeriodChange,
}: {
  facets: ExpenseListFacets;
  periodFilter: ExpensePeriodFilter;
  onPeriodChange: (v: ExpensePeriodFilter) => void;
}) {
  const periodRows: {
    id: ExpensePeriodFilter;
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All expenses",
      icon: Receipt,
      count: facets.companyTotal,
    },
    {
      id: "month",
      label: "This month",
      icon: CalendarDays,
      count: facets.thisMonthCount,
    },
    {
      id: "year",
      label: "This year",
      icon: CalendarRange,
      count: facets.thisYearCount,
    },
  ];

  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  return (
    <aside className="w-full shrink-0 lg:self-stretch">
      <div className="space-y-7 py-1">
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By period
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by period">
            {periodRows.map((item) => {
              const Icon = item.icon;
              const selected = periodFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPeriodChange(item.id)}
                  aria-pressed={selected}
                  className={cn(
                    rowBtn,
                    selected
                      ? "bg-muted/90 font-semibold text-foreground shadow-none"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-75" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span
                    className={cn(
                      "inline-flex min-w-[1.625rem] shrink-0 items-center justify-center rounded-full",
                      "bg-muted/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-muted-foreground",
                      "dark:bg-muted/70",
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}

export default function ExpensesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<ExpenseListFacets | null>(null);

  const [periodFilter, setPeriodFilter] = useState<ExpensePeriodFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [facetsLoading, setFacetsLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  const listRequestGen = useRef(0);
  const prevListDepsRef = useRef({
    debouncedSearch: "",
    periodFilter: "all" as ExpensePeriodFilter,
    pageSize: 10,
    activeCompanyScope: 0,
  });

  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [filtersOpen, setFiltersOpen] = useDirectoryFiltersOpen();
  const [exportingCsv, setExportingCsv] = useState(false);
  const [printing, setPrinting] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 220);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const bump = () => setActiveCompanyScope((n) => n + 1);
    window.addEventListener(ACTIVE_COMPANY_CHANGED_EVENT, bump);
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_COMPANY_ID_STORAGE_KEY) bump();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ACTIVE_COMPANY_CHANGED_EVENT, bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setFacetsLoading(true);
      const id = await getActiveCompanyId();
      if (cancelled) return;

      setCompanyReady(!!id);
      if (!id) {
        setRows([]);
        setTotal(0);
        setFacets(null);
        setFacetsLoading(false);
        return;
      }

      try {
        const facetData = await fetchExpenseListFacets();
        if (!cancelled) setFacets(facetData);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Please try again.";
          toast({
            title: "Failed to load filters",
            description: msg,
            variant: "destructive",
          });
          setFacets(null);
        }
      } finally {
        if (!cancelled) setFacetsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable; errors only
  }, [activeCompanyScope]);

  useEffect(() => {
    if (companyReady !== true) return;

    const prev = prevListDepsRef.current;
    const depsChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.periodFilter !== periodFilter ||
      prev.pageSize !== pageSize ||
      prev.activeCompanyScope !== activeCompanyScope;

    if (depsChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevListDepsRef.current = {
      debouncedSearch,
      periodFilter,
      pageSize,
      activeCompanyScope,
    };

    const gen = ++listRequestGen.current;
    let cancelled = false;

    (async () => {
      setListLoading(true);
      try {
        const listRes = await listExpenses({
          search: debouncedSearch || undefined,
          period: periodFilter,
          page,
          pageSize,
        });
        if (cancelled || gen !== listRequestGen.current) return;
        setRows(listRes.rows);
        setTotal(listRes.total);
      } catch (e: unknown) {
        if (cancelled || gen !== listRequestGen.current) return;
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Failed to load expenses",
          description: msg,
          variant: "destructive",
        });
      } finally {
        if (!cancelled && gen === listRequestGen.current) {
          setListLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast identity is unstable; errors only
  }, [
    companyReady,
    debouncedSearch,
    periodFilter,
    page,
    pageSize,
    activeCompanyScope,
  ]);

  const reload = useCallback(async () => {
    if (companyReady !== true) return;
    listRequestGen.current += 1;
    const gen = listRequestGen.current;
    setListLoading(true);
    try {
      const [facetData, listRes] = await Promise.all([
        fetchExpenseListFacets(),
        listExpenses({
          search: debouncedSearch || undefined,
          period: periodFilter,
          page,
          pageSize,
        }),
      ]);
      if (gen !== listRequestGen.current) return;
      setFacets(facetData);
      setRows(listRes.rows);
      setTotal(listRes.total);
      prevListDepsRef.current = {
        debouncedSearch,
        periodFilter,
        pageSize,
        activeCompanyScope,
      };
    } catch (e: unknown) {
      if (gen === listRequestGen.current) {
        const msg = e instanceof Error ? e.message : "Please try again.";
        toast({
          title: "Failed to refresh expenses",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      if (gen === listRequestGen.current) setListLoading(false);
    }
  }, [
    companyReady,
    periodFilter,
    debouncedSearch,
    page,
    pageSize,
    activeCompanyScope,
  ]);

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      toast({
        title: "Expense deleted",
        description: "Expense has been removed successfully.",
      });
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else await reload();
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({
        title: "Delete failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const fetchExportRows = useCallback(
    () =>
      listAllExpensesForExport({
        search: debouncedSearch || undefined,
        period: periodFilter,
      }),
    [debouncedSearch, periodFilter],
  );

  const exportFilenameStem = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `expenses-${yyyy}${mm}${dd}`;
  }, []);

  const formatExpenseDate = (iso?: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const formatAmount = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleExportCsv = useCallback(async () => {
    if (exportingCsv) return;
    try {
      setExportingCsv(true);
      const data = await fetchExportRows();
      if (data.length === 0) {
        toast({
          title: "Nothing to export",
          description: "No expenses match the current filters.",
        });
        return;
      }
      const headers = [
        "Date",
        "Description",
        "Currency",
        "Amount",
        "Notes",
        "Invoice ID",
        "Line items",
      ];
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines = [headers.map(esc).join(",")];
      for (const r of data) {
        const itemsLabel = (r.line_items ?? [])
          .map((li) => {
            const name = (li.item ?? "").trim() || "Item";
            const qty = Number(li.quantity ?? 0);
            const total = Number(li.line_total ?? 0);
            return `${name} (x${qty}) — ${formatAmount(total)}`;
          })
          .join(" | ");
        lines.push(
          [
            formatExpenseDate(r.expense_date),
            r.description ?? "",
            r.currency ?? "MUR",
            formatAmount(Number(r.amount ?? 0)),
            r.notes ?? "",
            r.invoice_id ?? "",
            itemsLabel,
          ]
            .map((v) => esc(String(v ?? "")))
            .join(","),
        );
      }
      const csv = `\uFEFF${lines.join("\r\n")}\r\n`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exportFilenameStem}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "CSV exported",
        description: `${data.length} expense${data.length === 1 ? "" : "s"} exported.`,
      });
    } catch (e: unknown) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingCsv(false);
    }
  }, [exportingCsv, fetchExportRows, exportFilenameStem, toast]);

  const handlePrint = useCallback(async () => {
    if (printing) return;
    try {
      setPrinting(true);
      const data = await fetchExportRows();
      if (data.length === 0) {
        toast({
          title: "Nothing to print",
          description: "No expenses match the current filters.",
        });
        return;
      }

      // Branded PDF (logo bar + company identity), consistent with other list exports.
      {
        const { buildExpensesListPdfDoc } = await import("@/lib/expenses-list-pdf");
        const doc = await buildExpensesListPdfDoc({
          rows: data,
          periodFilter,
          searchQuery: debouncedSearch,
        });

        const filename = `${exportFilenameStem}.pdf`;
        const pdfBlob = doc.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(pdfUrl, "_blank");
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => printWindow.print(), 250);
          };
        } else {
          doc.save(filename);
          toast({
            title: "Print blocked",
            description: "Allow popups to print. PDF downloaded instead.",
          });
        }
        return;
      }
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod.default;

      const doc = new jsPDF({
        unit: "pt",
        format: "a4",
        orientation: "landscape",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const M = 36;

      doc.setFont("helvetica", "bold").setFontSize(16);
      doc.text("Expenses", M, M + 6);
      doc.setFont("helvetica", "normal").setFontSize(10);

      const totalsByCurrency = new Map<string, number>();
      for (const r of data) {
        const cur = (r.currency || "MUR").toUpperCase();
        totalsByCurrency.set(
          cur,
          (totalsByCurrency.get(cur) ?? 0) + Number(r.amount ?? 0),
        );
      }
      const totalsLabel = [...totalsByCurrency.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([cur, sum]) => `${cur} ${formatAmount(sum)}`)
        .join(" · ");

      const filterBits: string[] = [];
      if (periodFilter === "month") filterBits.push("Period: This month");
      else if (periodFilter === "year") filterBits.push("Period: This year");
      if (debouncedSearch) filterBits.push(`Search: "${debouncedSearch}"`);

      const subtitle = [
        new Date().toLocaleString(),
        `${data.length} expense${data.length === 1 ? "" : "s"}`,
        ...filterBits,
      ].join("  •  ");
      doc.setTextColor(120);
      doc.text(subtitle, M, M + 24);
      if (totalsLabel) {
        doc.setFont("helvetica", "bold").setTextColor(20);
        doc.text(`Total: ${totalsLabel}`, M, M + 40);
      }
      doc.setFont("helvetica", "normal").setTextColor(0);

      const body = data.map((r) => {
        const notes = (r.notes ?? "").replace(/\s+/g, " ").trim();
        const notesShort =
          notes.length > 140 ? `${notes.slice(0, 137)}…` : notes;
        return [
          formatExpenseDate(r.expense_date),
          r.description ?? "",
          r.currency ?? "MUR",
          formatAmount(Number(r.amount ?? 0)),
          String((r.line_items ?? []).length),
          notesShort,
        ];
      });

      autoTable(doc, {
        startY: M + (totalsLabel ? 54 : 36),
        head: [["Date", "Description", "Currency", "Amount", "Items", "Notes"]],
        body,
        styles: { font: "helvetica", fontSize: 8, cellPadding: 3 },
        headStyles: {
          fillColor: [243, 244, 246],
          textColor: 20,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [250, 250, 251] },
        columnStyles: {
          0: { cellWidth: 72 },
          1: { cellWidth: 220 },
          2: { cellWidth: 48, halign: "center" },
          3: { cellWidth: 80, halign: "right" },
          4: { cellWidth: 40, halign: "right" },
          5: { cellWidth: 280 },
        },
        margin: { left: M, right: M },
        didDrawPage: () => {
          const pageH = doc.internal.pageSize.getHeight();
          const pageNumber = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(140);
          doc.text(`Page ${pageNumber}`, pageW - M, pageH - 14, {
            align: "right",
          });
          doc.setTextColor(0);
        },
      });

      const filename = `${exportFilenameStem}.pdf`;
      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => printWindow.print(), 250);
        };
      } else {
        doc.save(filename);
        toast({
          title: "Print blocked",
          description: "Allow popups to print. PDF downloaded instead.",
        });
      }
    } catch (e: unknown) {
      toast({
        title: "Print failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  }, [
    printing,
    fetchExportRows,
    periodFilter,
    debouncedSearch,
    exportFilenameStem,
    toast,
  ]);

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      {
        id: "expense_date",
        accessorFn: (r) => r.expense_date ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) =>
          row.original.expense_date
            ? new Date(row.original.expense_date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "—",
        meta: { tdClassName: "text-muted-foreground tabular-nums" },
      },
      {
        id: "description",
        accessorFn: (r) => r.description ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground line-clamp-2">
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        id: "amount",
        accessorFn: (r) => Number(r.amount ?? 0),
        header: ({ column }) => (
          <div className="flex w-full justify-end">
            <DataTableColumnHeader column={column} title="Amount" />
          </div>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {row.original.currency ?? "MUR"}{" "}
            {Number(row.original.amount ?? 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
        meta: { thClassName: "text-right", tdClassName: "text-right" },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Open actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/app/expenses/${row.original.id}`)}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmDeleteId(row.original.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        meta: { thClassName: "w-12 text-right", tdClassName: "text-right w-12" },
        enableSorting: false,
      },
    ],
    [router],
  );

  const hasActiveFilters = useMemo(
    () => debouncedSearch !== "" || periodFilter !== "all",
    [debouncedSearch, periodFilter],
  );

  const listRangeLabel = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, total);
    if (total === 0) return "0–0 of 0";
    return `${from}–${to} of ${total}`;
  }, [total, page, pageSize]);

  const pageAmountSum = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
    [rows],
  );
  const pageCurrencyLabel = rows[0]?.currency ?? "—";

  const showSkeleton =
    companyReady !== false &&
    rows.length === 0 &&
    facets === null &&
    (companyReady === null || facetsLoading);

  const showDirectory = companyReady === true && facets !== null && !showSkeleton;

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      actions={
        <ResponsivePageActions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={
              companyReady !== true ||
              exportingCsv ||
              listLoading ||
              facetsLoading
            }
            onClick={() => void handleExportCsv()}
          >
            <Download className="h-4 w-4" />
            {exportingCsv ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={
              companyReady !== true ||
              printing ||
              listLoading ||
              facetsLoading
            }
            onClick={() => void handlePrint()}
          >
            <Printer className="h-4 w-4" />
            {printing ? "Preparing…" : "Print"}
          </Button>
          <Button className="gap-2" size="sm" disabled={companyReady !== true} asChild>
            <Link href="/app/expenses/new">
              <Plus className="h-4 w-4" />
              Add expense
            </Link>
          </Button>
        </ResponsivePageActions>
      }
      topbarTrailingBeforeTheme={
        showDirectory ? (
          <DirectoryFilterToggleButton
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            panelId="expenses-filter-panel"
            label="expense filters"
          />
        ) : null
      }
    >
      {companyReady === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company is linked to this account yet. Link a company so expenses
            can be saved against{" "}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">
              company_id
            </code>
            .
          </CardContent>
        </Card>
      )}

      {showSkeleton ? (
        <DirectoryListPageSkeleton className="min-h-0 flex-1" />
      ) : null}

      {showDirectory ? (
        <DirectoryListFrame filtersOpen={filtersOpen}>
          <DirectoryFilterPanel
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            panelId="expenses-filter-panel"
            title="Expense filters"
          >
            <ExpensesFilterSidebar
              facets={facets}
              periodFilter={periodFilter}
              onPeriodChange={(v) => {
                setPage(1);
                setPeriodFilter(v);
              }}
            />
          </DirectoryFilterPanel>
          <div className={DIRECTORY_LIST_PANEL_CLASS}>
            <DirectoryListSearchHeader
              trailing={
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-sm sm:text-right">
                  <p className="tabular-nums text-muted-foreground">{listRangeLabel}</p>
                  {rows.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Page total:{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {pageCurrencyLabel}{" "}
                        {pageAmountSum.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </p>
                  ) : null}
                </div>
              }
            >
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description or notes…"
                className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                aria-label="Search expenses"
                autoComplete="off"
              />
            </DirectoryListSearchHeader>
            <div
              className={cn(
                "relative flex min-h-0 flex-1 flex-col transition-opacity duration-150 ease-out",
                listLoading &&
                  "pointer-events-none opacity-[0.58] motion-reduce:transition-none",
              )}
              aria-busy={listLoading}
            >
              <DataTable
                className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
                tableContainerClassName="min-h-0 flex-1 overflow-auto"
                variant="minimal"
                columns={columns}
                data={rows}
                manualFiltering
                hideSearch
                onRowClick={(r) => router.push(`/app/expenses/${r.id}`)}
                getRowId={(r) => r.id}
                emptyMessage={
                  hasActiveFilters ? (
                    <FeatureEmptyState
                      title="No expenses match your filters"
                      description="Try clearing search or adjusting filters."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPage(1);
                            setSearchQuery("");
                            setPeriodFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : facets.companyTotal === 0 ? (
                    <FeatureEmptyState
                      icon={Receipt}
                      title="No expenses yet"
                      description="Record spending with line items and download PDFs when you need them."
                      action={
                        <Button className="gap-2" asChild>
                          <Link href="/app/expenses/new">
                            <Plus className="h-4 w-4" />
                            Add expense
                          </Link>
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : (
                    <FeatureEmptyState
                      title="No expenses on this page"
                      description="Try another page."
                      className="border-0 bg-transparent py-8"
                    />
                  )
                }
                footer={
                  <DataTablePaginationFooter
                    variant="minimal"
                    total={total}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    pageSizeOptions={[10, 50, 100, 200]}
                  />
                }
              />
            </div>
          </div>
        </DirectoryListFrame>
      ) : null}

      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
