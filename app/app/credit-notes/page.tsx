"use client";
import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  Copy,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  ScrollText,
  Search,
  Trash2,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { CreditNoteStatusBadge } from "@/components/credit-note-status-badge";
import { useToast } from "@/hooks/use-toast";
import {
  listCreditNotes,
  fetchCreditNoteListFacets,
  getCachedCreditNoteFacets,
  getCachedCreditNoteList,
  invalidateCreditNoteCaches,
  deleteCreditNote,
  type CreditNoteListRow,
  type CreditNoteListFacets,
  type CreditNoteStatus,
} from "@/lib/credit-notes-service";
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
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import { cn } from "@/lib/utils";
import { runConfirmDeleteAction } from "@/lib/confirm-delete-action";

type PeriodFilter = "all" | "month" | "quarter" | "year";

function formatListCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}

function formatListDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const CreditNotesFilterSidebar = memo(function CreditNotesFilterSidebar({
  facets,
  statusFilter,
  onStatusChange,
  periodFilter,
  onPeriodChange,
}: {
  facets: CreditNoteListFacets;
  statusFilter: CreditNoteStatus | "all";
  onStatusChange: (v: CreditNoteStatus | "all") => void;
  periodFilter: PeriodFilter;
  onPeriodChange: (v: PeriodFilter) => void;
}) {
  const statusRows: {
    id: CreditNoteStatus | "all";
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All credit notes",
      icon: ScrollText,
      count: facets.companyTotal,
    },
    {
      id: "draft",
      label: "Draft",
      icon: CalendarDays,
      count: facets.draftCount,
    },
    {
      id: "posted",
      label: "Posted",
      icon: Check,
      count: facets.postedCount,
    },
    {
      id: "cancelled",
      label: "Cancelled",
      icon: Ban,
      count: facets.cancelledCount,
    },
  ];

  const periodRows: {
    id: PeriodFilter;
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    { id: "all", label: "All time", icon: Calendar, count: facets.companyTotal },
    {
      id: "month",
      label: "This month",
      icon: CalendarDays,
      count: facets.thisMonthCount,
    },
    {
      id: "quarter",
      label: "This quarter",
      icon: CalendarRange,
      count: facets.thisQuarterCount,
    },
    {
      id: "year",
      label: "This year",
      icon: CalendarClock,
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
            By status
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by status">
            {statusRows.map((item) => {
              const Icon = item.icon;
              const selected = statusFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onStatusChange(item.id)}
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
                  <span className="inline-flex min-w-[1.625rem] shrink-0 items-center justify-center rounded-full bg-muted/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-muted-foreground dark:bg-muted/70">
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By issue period
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by issue period">
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
                  <span className="inline-flex min-w-[1.625rem] shrink-0 items-center justify-center rounded-full bg-muted/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-muted-foreground dark:bg-muted/70">
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
});

export default function CreditNotesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [rows, setRows] = useState<CreditNoteListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<CreditNoteListFacets | null>(null);

  const [statusFilter, setStatusFilter] = useState<CreditNoteStatus | "all">("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [facetsLoading, setFacetsLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<{
    id: string;
    number: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    number: string;
    status: CreditNoteStatus;
  } | null>(null);

  const listRequestGen = useRef(0);
  const prevListDepsRef = useRef({
    debouncedSearch: "",
    statusFilter: "all" as CreditNoteStatus | "all",
    periodFilter: "all" as PeriodFilter,
    pageSize: 10,
    activeCompanyScope: 0,
  });

  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [filtersOpen, setFiltersOpen] = useDirectoryFiltersOpen();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 220);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const bump = () => {
      invalidateCreditNoteCaches();
      setActiveCompanyScope((n) => n + 1);
    };
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
      const cached = getCachedCreditNoteFacets(id);
      if (cached) {
        setFacets(cached);
        setFacetsLoading(false);
      } else {
        setFacetsLoading(true);
      }
      try {
        const facetData = await fetchCreditNoteListFacets();
        if (!cancelled) setFacets(facetData);
      } catch (e: unknown) {
        if (!cancelled) {
          toastRef.current({
            title: "Failed to load filters",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
          if (!cached) setFacets(null);
        }
      } finally {
        if (!cancelled) setFacetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyScope]);

  useEffect(() => {
    if (companyReady !== true) return;

    const prev = prevListDepsRef.current;
    const depsChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.statusFilter !== statusFilter ||
      prev.periodFilter !== periodFilter ||
      prev.pageSize !== pageSize ||
      prev.activeCompanyScope !== activeCompanyScope;

    if (depsChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevListDepsRef.current = {
      debouncedSearch,
      statusFilter,
      periodFilter,
      pageSize,
      activeCompanyScope,
    };

    const gen = ++listRequestGen.current;
    let cancelled = false;

    (async () => {
      const companyId = await getActiveCompanyId();
      if (cancelled || gen !== listRequestGen.current) return;

      const listOpts = {
        search: debouncedSearch || undefined,
        status: statusFilter,
        period: periodFilter,
        page,
        pageSize,
        sortBy: "issueDate" as const,
        sort: "desc" as const,
      };

      const cached = companyId
        ? getCachedCreditNoteList(companyId, listOpts)
        : null;
      if (cached) {
        setRows(cached.rows);
        setTotal(cached.total);
        setListLoading(false);
      } else {
        setListLoading(true);
      }

      try {
        const listRes = await listCreditNotes(listOpts);
        if (cancelled || gen !== listRequestGen.current) return;
        setRows(listRes.rows);
        setTotal(listRes.total);
      } catch (e: unknown) {
        if (cancelled || gen !== listRequestGen.current) return;
        toastRef.current({
          title: "Failed to load credit notes",
          description: e instanceof Error ? e.message : "Please try again.",
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
  }, [
    companyReady,
    debouncedSearch,
    statusFilter,
    periodFilter,
    page,
    pageSize,
    activeCompanyScope,
  ]);

  const columns = useMemo<ColumnDef<CreditNoteListRow>[]>(
    () => [
      {
        id: "number",
        accessorFn: (r) => r.number,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Credit note #" />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">{row.original.number}</span>
        ),
      },
      {
        id: "customer",
        accessorFn: (r) => r.clientName,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        meta: { stopRowClick: true, tdClassName: "text-muted-foreground" },
        cell: ({ row }) => {
          const { customerId, clientName } = row.original;
          if (!customerId) return clientName || "—";
          return (
            <Link
              href={`/app/customers/${customerId}/edit`}
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={(e) => e.stopPropagation()}
            >
              {clientName || "View customer"}
            </Link>
          );
        },
      },
      {
        id: "invoice",
        accessorFn: (r) => r.relatedInvoiceNumber ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Invoice" />
        ),
        meta: { stopRowClick: true, tdClassName: "text-muted-foreground" },
        cell: ({ row }) => {
          const { relatedInvoiceId, relatedInvoiceNumber } = row.original;
          if (!relatedInvoiceId) return "—";
          return (
            <Link
              href={`/app/invoices/${relatedInvoiceId}`}
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={(e) => e.stopPropagation()}
            >
              {relatedInvoiceNumber || "View invoice"}
            </Link>
          );
        },
      },
      {
        id: "issueDate",
        accessorFn: (r) => new Date(r.issueDate).getTime(),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Issue date" />
        ),
        meta: { tdClassName: "text-muted-foreground" },
        cell: ({ row }) => formatListDate(row.original.issueDate),
      },
      {
        id: "reason",
        accessorFn: (r) => r.reason ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Reason" />
        ),
        meta: { tdClassName: "text-muted-foreground max-w-[200px] truncate" },
        cell: ({ row }) => row.original.reason || "—",
      },
      {
        id: "status",
        accessorFn: (r) => r.status,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <CreditNoteStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "total",
        accessorFn: (r) => Number(r.total),
        header: ({ column }) => (
          <div className="flex justify-end">
            <DataTableColumnHeader column={column} title="Credit total" />
          </div>
        ),
        meta: {
          thClassName: "text-right",
          tdClassName: "text-right font-medium tabular-nums",
        },
        cell: ({ row }) =>
          formatListCurrency(row.original.total, row.original.currency),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        meta: {
          searchable: false,
          stopRowClick: true,
          thClassName: "w-[52px] text-right",
          tdClassName: "text-right",
        },
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
                aria-label="Open menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={() => router.push(`/app/credit-notes/${row.original.id}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setDuplicateTarget({
                    id: row.original.id,
                    number: row.original.number,
                  })
                }
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() =>
                  setDeleteTarget({
                    id: row.original.id,
                    number: row.original.number,
                    status: row.original.status,
                  })
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [router],
  );

  const hasActiveFilters = useMemo(
    () =>
      debouncedSearch !== "" ||
      statusFilter !== "all" ||
      periodFilter !== "all",
    [debouncedSearch, statusFilter, periodFilter],
  );

  const listRangeLabel = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, total);
    if (total === 0) return "0–0 of 0";
    return `${from}–${to} of ${total}`;
  }, [total, page, pageSize]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    await runConfirmDeleteAction(
      "Deleting credit note…",
      () => setDeleteTarget(null),
      async () => {
        await deleteCreditNote(target.id);
        invalidateCreditNoteCaches();
        toastRef.current({ title: "Credit note deleted" });
        setRows((r) => r.filter((x) => x.id !== target.id));
        setTotal((t) => Math.max(0, t - 1));
        void fetchCreditNoteListFacets()
          .then(setFacets)
          .catch(() => undefined);
      },
    ).catch((e: unknown) => {
      toastRef.current({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    });
  };

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
          <Button className="shrink-0 gap-2" size="sm" disabled={companyReady !== true} asChild>
            <Link href="/app/credit-notes/new">
              <Plus className="h-4 w-4" />
              Create credit note
            </Link>
          </Button>
        </ResponsivePageActions>
      }
      topbarTrailingBeforeTheme={
        showDirectory ? (
          <DirectoryFilterToggleButton
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            panelId="credit-notes-filter-panel"
            label="credit note filters"
          />
        ) : null
      }
    >
      {companyReady === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company is linked to this account yet.
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
            panelId="credit-notes-filter-panel"
            title="Credit note filters"
          >
            <CreditNotesFilterSidebar
              facets={facets}
              statusFilter={statusFilter}
              onStatusChange={(v) => {
                setPage(1);
                setStatusFilter(v);
              }}
              periodFilter={periodFilter}
              onPeriodChange={(v) => {
                setPage(1);
                setPeriodFilter(v);
              }}
            />
          </DirectoryFilterPanel>
          <div className={DIRECTORY_LIST_PANEL_CLASS}>
            <DirectoryListSearchHeader trailing={listRangeLabel}>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by #, reason, or client…"
                className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                aria-label="Search credit notes"
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
                onRowClick={(r) => router.push(`/app/credit-notes/${r.id}`)}
                getRowId={(r) => r.id}
                emptyMessage={
                  hasActiveFilters ? (
                    <FeatureEmptyState
                      title="No credit notes match your filters"
                      description="Try clearing search or adjusting filters."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPage(1);
                            setSearchQuery("");
                            setStatusFilter("all");
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
                      icon={FileText}
                      title="No credit notes yet"
                      description="Issue a credit note to reduce what a customer owes."
                      action={
                        <Button className="gap-2" asChild>
                          <Link href="/app/credit-notes/new">
                            <Plus className="h-4 w-4" />
                            Create credit note
                          </Link>
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : (
                    <FeatureEmptyState
                      title="No credit notes on this page"
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

      <AlertDialog
        open={!!duplicateTarget}
        onOpenChange={(open) => {
          if (!open) setDuplicateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate credit note?</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateTarget
                ? `Create a new credit note prefilled from ${duplicateTarget.number}?`
                : "Create a new credit note from this one?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!duplicateTarget) return;
                router.push(
                  `/app/credit-notes/new?duplicateFrom=${encodeURIComponent(duplicateTarget.id)}`,
                );
                setDuplicateTarget(null);
              }}
            >
              Duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete credit note?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? deleteTarget.status === "posted"
                  ? `${deleteTarget.number} will be permanently removed and the linked invoice balance will be restored. This cannot be undone.`
                  : `${deleteTarget.number} will be permanently removed. This cannot be undone.`
                : "This credit note will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
