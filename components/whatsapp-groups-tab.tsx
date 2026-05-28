"use client";

import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Lock,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  Unlock,
  Users,
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
import { WhatsAppStatusFilterSidebar } from "@/components/whatsapp-status-filter-sidebar";
import { useToast } from "@/hooks/use-toast";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import {
  deleteWhatsAppGroup,
  fetchWhatsAppGroupListFacets,
  listWhatsAppGroupsWithMemberCounts,
  updateWhatsAppGroup,
  type WhatsAppGroupListRow,
  type WhatsAppGroupRow,
  type WhatsAppListFacets,
  type WhatsAppListStatus,
} from "@/lib/whatsapp-groups-service";
import { cn } from "@/lib/utils";

type Props = {
  companyReady: boolean | null;
  filtersOpen: boolean;
};

export function WhatsAppGroupsTab({ companyReady, filtersOpen }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<WhatsAppGroupListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<WhatsAppListFacets | null>(null);

  const [statusFilter, setStatusFilter] = useState<WhatsAppListStatus>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [facetsLoading, setFacetsLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  const listRequestGen = useRef(0);
  const prevListDepsRef = useRef({
    debouncedSearch: "",
    statusFilter: "active" as WhatsAppListStatus,
    pageSize: 10,
    activeCompanyScope: 0,
  });

  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      220,
    );
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
    if (companyReady !== true) {
      if (companyReady === false) {
        setFacets(null);
        setFacetsLoading(false);
      }
      return;
    }

    let cancelled = false;
    (async () => {
      setFacetsLoading(true);
      try {
        const facetData = await fetchWhatsAppGroupListFacets();
        if (!cancelled) setFacets(facetData);
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Failed to load filters",
            description: e instanceof Error ? e.message : "Please try again.",
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
  }, [companyReady, activeCompanyScope, toast]);

  useEffect(() => {
    if (companyReady !== true) return;

    const prev = prevListDepsRef.current;
    const depsChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.statusFilter !== statusFilter ||
      prev.pageSize !== pageSize ||
      prev.activeCompanyScope !== activeCompanyScope;

    if (depsChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevListDepsRef.current = {
      debouncedSearch,
      statusFilter,
      pageSize,
      activeCompanyScope,
    };

    const gen = ++listRequestGen.current;
    let cancelled = false;

    (async () => {
      setListLoading(true);
      try {
        const listRes = await listWhatsAppGroupsWithMemberCounts({
          search: debouncedSearch || undefined,
          status: statusFilter,
          page,
          pageSize,
        });
        if (cancelled || gen !== listRequestGen.current) return;
        setRows(listRes.rows);
        setTotal(listRes.total);
      } catch (e: unknown) {
        if (cancelled || gen !== listRequestGen.current) return;
        toast({
          title: "Failed to load groups",
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
    page,
    pageSize,
    activeCompanyScope,
    toast,
  ]);

  async function handleToggleActive(g: WhatsAppGroupRow) {
    try {
      await updateWhatsAppGroup(g.id, { is_active: !g.isActive });
      toast({ title: g.isActive ? "Group deactivated" : "Group activated" });
      const facetData = await fetchWhatsAppGroupListFacets();
      setFacets(facetData);
      const listRes = await listWhatsAppGroupsWithMemberCounts({
        search: debouncedSearch || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setRows(listRes.rows);
      setTotal(listRes.total);
    } catch (e: unknown) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWhatsAppGroup(id);
      toast({ title: "Group deleted" });
    } catch (e: unknown) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
      if (rows.length === 1 && page > 1) setPage((p) => Math.max(1, p - 1));
      else {
        const facetData = await fetchWhatsAppGroupListFacets();
        setFacets(facetData);
        const listRes = await listWhatsAppGroupsWithMemberCounts({
          search: debouncedSearch || undefined,
          status: statusFilter,
          page,
          pageSize,
        });
        setRows(listRes.rows);
        setTotal(listRes.total);
      }
    }
  }

  const columns = useMemo<ColumnDef<WhatsAppGroupListRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => r.name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="font-semibold text-foreground">
              {row.original.name}
            </span>
            {row.original.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {row.original.description}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "members",
        accessorFn: (r) => r.memberCount,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Members" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.memberCount}</span>
        ),
        meta: { tdClassName: "text-right w-24" },
      },
      {
        id: "status",
        accessorFn: (r) => (r.isActive ? 1 : 0),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) =>
          row.original.isActive ? (
            <span className="inline-flex rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              Active
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-muted/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Inactive
            </span>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div
            className="flex justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/app/whatsapp/groups/${row.original.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void handleToggleActive(row.original)}
                >
                  {row.original.isActive ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Unlock className="mr-2 h-4 w-4" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteId(row.original.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        meta: { tdClassName: "w-14 text-right" },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers stable enough for menu
    [debouncedSearch, page, pageSize, statusFilter],
  );

  const hasActiveFilters = useMemo(
    () => debouncedSearch !== "" || statusFilter !== "active",
    [debouncedSearch, statusFilter],
  );

  const listRangeLabel = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, total);
    if (total === 0) return "0–0 of 0";
    return `${from}–${to} of ${total}`;
  }, [total, page, pageSize]);

  const showSkeleton =
    companyReady !== false &&
    rows.length === 0 &&
    facets === null &&
    (companyReady === null || facetsLoading);

  const showDirectory =
    companyReady === true && facets !== null && !showSkeleton;

  if (companyReady === false) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
        <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
          No active company linked. Groups require{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">
            company_id
          </code>{" "}
          and customers with the same company.
        </CardContent>
      </Card>
    );
  }

  if (showSkeleton) {
    return <DirectoryListPageSkeleton className="min-h-[420px]" />;
  }

  if (!showDirectory) return null;

  return (
    <>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0",
          filtersOpen ? "gap-6" : "gap-0",
        )}
      >
        <div
          id="whatsapp-groups-filter-panel"
          className={cn(
            "shrink-0 overflow-hidden",
            "transition-[width,margin-inline-end,max-height,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            "motion-reduce:transition-none motion-reduce:duration-0",
            filtersOpen
              ? "pointer-events-auto max-h-[2000px] opacity-100 lg:me-10 lg:w-56 xl:w-[15rem]"
              : "pointer-events-none max-h-0 opacity-0 lg:pointer-events-none lg:max-h-none lg:w-0 lg:opacity-100 xl:w-0 lg:me-0",
          )}
          aria-hidden={!filtersOpen}
        >
          <div className="h-full min-w-0 w-full lg:min-w-[14rem] xl:min-w-[15rem]">
            <WhatsAppStatusFilterSidebar
              facets={facets}
              statusFilter={statusFilter}
              onStatusChange={(v) => {
                setPage(1);
                setStatusFilter(v);
              }}
              allLabel="All groups"
              allIcon={Users}
            />
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-border/50 bg-card text-card-foreground shadow-none outline outline-1 -outline-offset-1 outline-border/40 dark:border-border/60 dark:outline-border/50">
          <div className="flex shrink-0 flex-col gap-3 border-b border-border/50 bg-muted/45 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 dark:bg-muted/25">
            <div className="relative min-w-0 flex-1 sm:max-w-xl lg:max-w-2xl">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or description…"
                className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                aria-label="Search groups"
                autoComplete="off"
              />
            </div>
            <p className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-right">
              {listRangeLabel}
            </p>
          </div>
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
              onRowClick={(r) =>
                router.push(`/app/whatsapp/groups/${r.id}/edit`)
              }
              getRowId={(r) => r.id}
              emptyMessage={
                hasActiveFilters ? (
                  <FeatureEmptyState
                    title="No groups match your filters"
                    description="Try clearing search or adjusting filters."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPage(1);
                          setSearchQuery("");
                          setStatusFilter("active");
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                    className="border-0 bg-transparent py-8"
                  />
                ) : facets.companyTotal === 0 ? (
                  <FeatureEmptyState
                    icon={Users}
                    title="No groups yet"
                    description="Create a group to share catalogue posts with customers."
                    className="border-0 bg-transparent py-8"
                  />
                ) : (
                  <FeatureEmptyState
                    title="No groups on this page"
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
                  pageSizeOptions={[10, 25, 50]}
                />
              }
            />
          </div>
        </div>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete group</DialogTitle>
            <DialogDescription>
              This removes the group and its customer links. Customers themselves are
              not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && void handleDelete(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
