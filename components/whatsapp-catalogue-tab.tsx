"use client";

import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ExternalLink,
  ImageIcon,
  MessageCircle,
  Pencil,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { WhatsAppStatusFilterSidebar } from "@/components/whatsapp-status-filter-sidebar";
import { useToast } from "@/hooks/use-toast";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
} from "@/lib/active-company";
import {
  deleteCataloguePost,
  fetchWhatsAppCatalogueListFacets,
  getCataloguePost,
  listCataloguePosts,
  type CataloguePostRow,
  type WhatsAppListFacets,
  type WhatsAppListStatus,
} from "@/lib/whatsapp-catalogue-service";
import {
  listGroupMembers,
  listWhatsAppGroups,
  type WhatsAppGroupMemberRow,
  type WhatsAppGroupRow,
} from "@/lib/whatsapp-groups-service";
import { openWhatsAppChat, toWhatsAppDigits } from "@/lib/whatsapp-share";
import { cn } from "@/lib/utils";

const NONE = "__none__";

function defaultShareBody(description: string): string {
  return description.trim();
}

type Props = {
  companyReady: boolean | null;
  filtersOpen: boolean;
};

export function WhatsAppCatalogueTab({ companyReady, filtersOpen }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<CataloguePostRow[]>([]);
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

  const [shareOpen, setShareOpen] = useState(false);
  const [sharePost, setSharePost] = useState<CataloguePostRow | null>(null);
  const [shareGroups, setShareGroups] = useState<WhatsAppGroupRow[]>([]);
  const [shareGroupId, setShareGroupId] = useState("");
  const [shareMembers, setShareMembers] = useState<WhatsAppGroupMemberRow[]>([]);
  const [shareMessage, setShareMessage] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

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
        const facetData = await fetchWhatsAppCatalogueListFacets();
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
        const listRes = await listCataloguePosts({
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
          title: "Failed to load posts",
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

  const openShare = useCallback(
    async (row: CataloguePostRow) => {
      setShareLoading(true);
      setShareOpen(true);
      setShareGroupId("");
      setShareMembers([]);
      try {
        const full = await getCataloguePost(row.id);
        setSharePost(full);
        setShareMessage(defaultShareBody(full.description));
        const g = await listWhatsAppGroups({
          page: 1,
          pageSize: 200,
          status: "active",
        });
        setShareGroups(g.rows);
      } catch (e: unknown) {
        toast({
          title: "Could not prepare share",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
        setShareOpen(false);
        setSharePost(null);
      } finally {
        setShareLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!shareOpen || !shareGroupId) {
        setShareMembers([]);
        return;
      }
      try {
        const members = await listGroupMembers(shareGroupId);
        if (!cancelled) setShareMembers(members);
      } catch {
        if (!cancelled) setShareMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareOpen, shareGroupId]);

  function membersWithPhones() {
    return shareMembers.filter((m) => toWhatsAppDigits(m.phone));
  }

  function membersMissingPhone() {
    return shareMembers.filter((m) => !toWhatsAppDigits(m.phone));
  }

  function openOneChat(m: WhatsAppGroupMemberRow) {
    const d = toWhatsAppDigits(m.phone);
    if (!d) {
      toast({
        title: "Invalid phone",
        description: `No valid number for ${m.displayName}.`,
        variant: "destructive",
      });
      return;
    }
    openWhatsAppChat(d, shareMessage);
  }

  function openAllChatsSequentially() {
    const list = membersWithPhones();
    if (list.length === 0) {
      toast({
        title: "No valid numbers",
        description: "Add phone numbers to customers in this group.",
        variant: "destructive",
      });
      return;
    }
    list.forEach((m, i) => {
      const d = toWhatsAppDigits(m.phone)!;
      window.setTimeout(() => openWhatsAppChat(d, shareMessage), i * 550);
    });
    toast({
      title: `Opening ${list.length} chat(s)`,
      description:
        "If only one tab opened, allow pop-ups for this site and try again, or use each row’s button.",
    });
  }

  async function handleDeletePost(id: string) {
    try {
      await deleteCataloguePost(id);
      toast({ title: "Post deleted" });
    } catch (e: unknown) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
      const facetData = await fetchWhatsAppCatalogueListFacets();
      setFacets(facetData);
      const listRes = await listCataloguePosts({
        search: debouncedSearch || undefined,
        status: statusFilter,
        page: rows.length === 1 && page > 1 ? page - 1 : page,
        pageSize,
      });
      setRows(listRes.rows);
      setTotal(listRes.total);
      if (rows.length === 1 && page > 1) setPage((p) => Math.max(1, p - 1));
    }
  }

  const sharePreviewUrl =
    sharePost?.imageBase64 && sharePost.imageMimeType
      ? `data:${sharePost.imageMimeType};base64,${sharePost.imageBase64}`
      : null;

  const columns = useMemo<ColumnDef<CataloguePostRow>[]>(
    () => [
      {
        id: "image",
        header: () => <span className="text-left">Image</span>,
        cell: ({ row }) =>
          row.original.imageMimeType ? (
            <span className="inline-flex rounded border bg-muted p-1.5">
              <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        meta: { tdClassName: "w-20" },
      },
      {
        id: "description",
        accessorFn: (r) => r.description,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => (
          <p className="line-clamp-3 min-w-[12rem] text-foreground">
            {row.original.description?.trim() || "—"}
          </p>
        ),
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
            className="flex flex-wrap items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/40"
              onClick={() => void openShare(row.original)}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              asChild
            >
              <Link href={`/app/whatsapp/catalogue/${row.original.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => setDeleteId(row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
        meta: { tdClassName: "text-right whitespace-nowrap" },
      },
    ],
    [openShare],
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
          No active company linked. Catalogue posts require a company context.
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
          id="whatsapp-catalogue-filter-panel"
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
              allLabel="All posts"
              allIcon={ImageIcon}
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
                placeholder="Search by description…"
                className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                aria-label="Search catalogue posts"
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
                router.push(`/app/whatsapp/catalogue/${r.id}/edit`)
              }
              getRowId={(r) => r.id}
              emptyMessage={
                hasActiveFilters ? (
                  <FeatureEmptyState
                    title="No posts match your filters"
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
                    icon={ImageIcon}
                    title="No catalogue posts yet"
                    description="Create posts with an image and description to share on WhatsApp."
                    className="border-0 bg-transparent py-8"
                  />
                ) : (
                  <FeatureEmptyState
                    title="No posts on this page"
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

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Share to WhatsApp
            </DialogTitle>
            <DialogDescription>
              Pick a group, edit the message, then open WhatsApp per contact. Bulk open
              may require allowing pop-ups.
            </DialogDescription>
          </DialogHeader>

          {shareLoading || !sharePost ? (
            <DirectoryListPageSkeleton className="min-h-[280px]" showFilterPanel={false} rowCount={5} />
          ) : (
            <div className="space-y-4 py-2">
              {sharePreviewUrl && (
                <div className="flex justify-center">
                  <img
                    src={sharePreviewUrl}
                    alt=""
                    className="max-h-40 rounded-md border object-contain"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Group</Label>
                <Select
                  value={shareGroupId || NONE}
                  onValueChange={(v) => setShareGroupId(v === NONE ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Choose a group</SelectItem>
                    {shareGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Message (prefilled in WhatsApp)</Label>
                <Textarea
                  rows={6}
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={openAllChatsSequentially}
                  disabled={!shareGroupId || membersWithPhones().length === 0}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open all chats
                </Button>
              </div>

              {shareGroupId ? (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Contacts in group</p>
                  {membersMissingPhone().length > 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {membersMissingPhone().length} member(s) have no usable phone
                      number and are skipped.
                    </p>
                  ) : null}
                  <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                    {shareMembers.map((m) => {
                      const ok = !!toWhatsAppDigits(m.phone);
                      return (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-medium">{m.displayName}</span>
                            <span className="block text-xs text-muted-foreground">
                              {m.phone || "—"}
                            </span>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 gap-1 text-emerald-700"
                            disabled={!ok}
                            onClick={() => openOneChat(m)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WA
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && void handleDeletePost(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
