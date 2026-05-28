"use client";

import { DirectoryListPageSkeleton } from "@/components/page-skeletons";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Briefcase,
  Check,
  Eye,
  MoreVertical,
  Pencil,
  Receipt,
  Search,
  Shield,
  ShoppingBag,
  SlidersVertical,
  Trash2,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { DataTablePaginationFooter } from "@/components/data-table-pagination-footer";
import { FeatureEmptyState } from "@/components/feature-empty-state";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
  getActiveCompanyId,
} from "@/lib/active-company";
import {
  getCompanyTeamSeatUsage,
  listTeamMembers,
  removeTeamMember,
  updateDriverRate,
  type CompanyTeamSeatUsage,
  type TeamMemberRow,
} from "@/lib/company-team-service";
import { AppPageShell } from "@/components/app-page-shell";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "inactive";

function iconForCompanyRole(roleName: string): LucideIcon {
  const x = roleName.toLowerCase();
  if (x.includes("driver")) return Truck;
  if (x.includes("admin")) return Shield;
  if (x.includes("manager")) return Briefcase;
  if (x.includes("sales")) return ShoppingBag;
  return Shield;
}

function roleChipClasses(roleName: string): string {
  const x = roleName.toLowerCase();
  if (x.includes("driver"))
    return "border-violet-500/25 bg-violet-500/12 text-violet-900 dark:bg-violet-500/14 dark:text-violet-200";
  if (x.includes("admin"))
    return "border-rose-500/25 bg-rose-500/12 text-rose-900 dark:bg-rose-500/14 dark:text-rose-200";
  if (x.includes("manager"))
    return "border-amber-500/25 bg-amber-500/12 text-amber-900 dark:bg-amber-500/14 dark:text-amber-200";
  if (x.includes("sales"))
    return "border-emerald-500/25 bg-emerald-500/12 text-emerald-900 dark:bg-emerald-500/14 dark:text-emerald-200";
  return "border-border/70 bg-muted/45 text-foreground dark:border-border dark:bg-muted/35";
}

function TeamFilterSidebar({
  id,
  facets,
  statusFilter,
  onStatusChange,
  roleFilter,
  onRoleChange,
}: {
  id?: string;
  facets: {
    total: number;
    activeCount: number;
    inactiveCount: number;
    roles: { name: string; count: number }[];
  };
  statusFilter: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  roleFilter: string;
  onRoleChange: (v: string) => void;
}) {
  const statusRows: {
    id: StatusFilter;
    label: string;
    icon: LucideIcon;
    count: number;
  }[] = [
    {
      id: "all",
      label: "All members",
      icon: Users,
      count: facets.total,
    },
    {
      id: "active",
      label: "Active",
      icon: Check,
      count: facets.activeCount,
    },
    {
      id: "inactive",
      label: "Inactive",
      icon: Ban,
      count: facets.inactiveCount,
    },
  ];

  const roleRows: { id: string; label: string; icon: LucideIcon; count: number }[] =
    [
      {
        id: "all",
        label: "All roles",
        icon: Shield,
        count: facets.total,
      },
      ...facets.roles.map((r) => ({
        id: r.name,
        label: r.name,
        icon: Shield,
        count: r.count,
      })),
    ];

  const rowBtn =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors leading-snug";

  return (
    <aside id={id} className="w-full shrink-0 lg:self-stretch">
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
        <div>
          <h3 className="mb-2.5 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground/90">
            By role
          </h3>
          <nav className="flex flex-col gap-px" aria-label="Filter by role">
            {roleRows.map((item) => {
              const Icon = item.icon;
              const selected = roleFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onRoleChange(item.id)}
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

export default function CompanyTeamPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [activeCompanyScope, setActiveCompanyScope] = useState(0);

  const [allRows, setAllRows] = useState<TeamMemberRow[]>([]);
  const [seatUsage, setSeatUsage] = useState<CompanyTeamSeatUsage | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [filtersOpen, setFiltersOpen] = useState(true);

  const [deleteRow, setDeleteRow] = useState<TeamMemberRow | null>(null);
  const [rateRow, setRateRow] = useState<TeamMemberRow | null>(null);
  const [rateValue, setRateValue] = useState("");
  const [savingRate, setSavingRate] = useState(false);

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

  const loadMembers = useCallback(async () => {
    const id = await getActiveCompanyId();
    setCompanyReady(!!id);
    if (!id) {
      setAllRows([]);
      setSeatUsage(null);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    try {
      const [memberList, seats] = await Promise.all([
        listTeamMembers(),
        getCompanyTeamSeatUsage(id),
      ]);
      setAllRows(memberList);
      setSeatUsage(seats);
    } catch (err) {
      toast({
        title: "Failed to load team",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
      setAllRows([]);
      setSeatUsage(null);
    } finally {
      setListLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers, activeCompanyScope]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, roleFilter, pageSize, activeCompanyScope]);

  const facets = useMemo(() => {
    const total = allRows.length;
    const activeCount = allRows.filter((r) => r.isActive).length;
    const inactiveCount = total - activeCount;
    const roleMap = new Map<string, number>();
    for (const r of allRows) {
      const name = r.roleName?.trim() || "—";
      roleMap.set(name, (roleMap.get(name) ?? 0) + 1);
    }
    const roles = [...roleMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { total, activeCount, inactiveCount, roles };
  }, [allRows]);

  const filteredRows = useMemo(() => {
    let out = allRows;
    if (statusFilter === "active") out = out.filter((r) => r.isActive);
    else if (statusFilter === "inactive") out = out.filter((r) => !r.isActive);
    if (roleFilter !== "all") {
      out = out.filter((r) => (r.roleName?.trim() || "—") === roleFilter);
    }
    const q = debouncedSearch.toLowerCase();
    if (q) {
      out = out.filter((r) =>
        [
          r.profile?.full_name,
          r.profile?.email,
          r.profile?.phone,
          r.roleName,
          r.isOwner ? "owner" : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return out;
  }, [allRows, statusFilter, roleFilter, debouncedSearch]);

  const totalFiltered = filteredRows.length;

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const reload = useCallback(async () => {
    await loadMembers();
  }, [loadMembers]);

  const columns = useMemo<ColumnDef<TeamMemberRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => r.profile?.full_name ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="font-semibold text-foreground">
              {r.profile?.full_name ?? "—"}
              {r.isOwner ? (
                <span className="ml-2 inline-flex rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-medium text-sky-900 dark:bg-sky-500/14 dark:text-sky-200">
                  Owner
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "email",
        accessorFn: (r) => r.profile?.email ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.profile?.email ?? "—"}
          </span>
        ),
      },
      {
        id: "phone",
        accessorFn: (r) => r.profile?.phone ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Phone" />
        ),
        meta: {
          thClassName: "hidden md:table-cell",
          tdClassName: "hidden md:table-cell text-muted-foreground",
        },
        cell: ({ row }) => row.original.profile?.phone ?? "—",
      },
      {
        id: "role",
        accessorFn: (r) => r.roleName,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const name = row.original.roleName?.trim() || "—";
          const Icon = iconForCompanyRole(name);
          return (
            <span
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-snug",
                roleChipClasses(name),
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="min-w-0 truncate">{name}</span>
            </span>
          );
        },
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
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        meta: {
          searchable: false,
          stopRowClick: true,
          thClassName: "w-[70px] text-right",
          tdClassName: "text-right",
        },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="text-right" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/app/company-team/${r.membershipId}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/app/company-team/${r.membershipId}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  {r.roleName.toLowerCase().includes("driver") ? (
                    <DropdownMenuItem
                      onClick={() => {
                        setRateRow(r);
                        setRateValue(
                          r.driverRate != null ? String(r.driverRate) : "",
                        );
                      }}
                    >
                      <Receipt className="mr-2 h-4 w-4" />
                      Set rate
                    </DropdownMenuItem>
                  ) : null}
                  {!r.isOwner && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteRow(r)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove from company
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [],
  );

  const confirmDelete = async () => {
    if (!deleteRow) return;
    try {
      await removeTeamMember(deleteRow.membershipId);
      toast({
        title: "Removed",
        description: "User removed from this company.",
      });
      setDeleteRow(null);
      await reload();
    } catch (err) {
      toast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const saveRate = async () => {
    if (!rateRow) return;
    const numericRate = Number(rateValue);
    if (!Number.isFinite(numericRate) || numericRate < 0) {
      toast({
        title: "Invalid rate",
        description: "Enter a valid number greater than or equal to 0.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSavingRate(true);
      await updateDriverRate(rateRow.membershipId, numericRate);
      toast({
        title: "Rate saved",
        description: "Driver rate has been updated.",
      });
      setRateRow(null);
      setRateValue("");
      await reload();
    } catch (err) {
      toast({
        title: "Could not save rate",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSavingRate(false);
    }
  };

  const hasActiveFilters = useMemo(
    () =>
      debouncedSearch !== "" ||
      statusFilter !== "all" ||
      roleFilter !== "all",
    [debouncedSearch, statusFilter, roleFilter],
  );

  const listRangeLabel = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const from = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, totalFiltered);
    if (totalFiltered === 0) return "0–0 of 0";
    return `${from}–${to} of ${totalFiltered}`;
  }, [totalFiltered, page, pageSize]);

  const showSkeleton =
    companyReady !== false &&
    listLoading &&
    allRows.length === 0 &&
    companyReady === true;

  /** Include zero-member companies: same shell as populated lists. */
  const showDirectory =
    companyReady === true && !(listLoading && allRows.length === 0);

  const showInitialCompanyPulse = companyReady === null;

  return (
    <AppPageShell
      fillHeight
      compact
      className="max-w-none w-full bg-muted/40 px-3 py-3 sm:bg-muted/35 sm:px-5 sm:py-4 md:px-6 dark:bg-background"
      actions={
        seatUsage?.canInvite === false ? (
          <Button
            className="shrink-0 gap-2"
            disabled
            title={`Team limit reached (${seatUsage.currentCount}/${seatUsage.effectiveLimit})`}
          >
            <UserPlus className="h-4 w-4" />
            Invite team member
          </Button>
        ) : (
          <Button className="shrink-0 gap-2" disabled={companyReady !== true} asChild>
            <Link href="/app/company-team/new">
              <UserPlus className="h-4 w-4" />
              Invite team member
            </Link>
          </Button>
        )
      }
      topbarTrailingBeforeTheme={
        showDirectory ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 text-muted-foreground",
              filtersOpen && "bg-primary/15 text-primary",
            )}
            aria-label={
              filtersOpen ? "Hide team filters" : "Show team filters"
            }
            aria-expanded={filtersOpen}
            aria-controls="company-team-filter-panel"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersVertical className="h-4 w-4" aria-hidden />
          </Button>
        ) : null
      }
    >
      {seatUsage?.atLimit ? (
        <Card className="mb-4 shrink-0 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            Team member limit reached ({seatUsage.currentCount} of{" "}
            {seatUsage.effectiveLimit} seats).{" "}
            {seatUsage.maxUsersOverride != null && seatUsage.maxUsersOverride > 0
              ? `Plan allows ${seatUsage.planMaxUsers} users plus ${seatUsage.maxUsersOverride} extra. `
              : `Plan allows ${seatUsage.effectiveLimit} user${seatUsage.effectiveLimit === 1 ? "" : "s"}. `}
            Remove an inactive member or upgrade your subscription to invite more.
          </CardContent>
        </Card>
      ) : null}

      {companyReady === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company is linked to this account yet. Create or join a
            company so team members can be managed for{" "}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">
              company_id
            </code>
            .
          </CardContent>
        </Card>
      )}

      {showInitialCompanyPulse || showSkeleton ? (
        <DirectoryListPageSkeleton className="min-h-0 flex-1" />
      ) : null}

      {showDirectory ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0",
            filtersOpen ? "gap-6" : "gap-0",
          )}
        >
          <div
            id="company-team-filter-panel"
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
              <TeamFilterSidebar
                facets={facets}
                statusFilter={statusFilter}
                onStatusChange={(v) => {
                  setPage(1);
                  setStatusFilter(v);
                }}
                roleFilter={roleFilter}
                onRoleChange={(v) => {
                  setPage(1);
                  setRoleFilter(v);
                }}
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
                  placeholder="Search by name, email, phone, or role…"
                  className="h-10 w-full rounded-md border border-border/75 bg-white pl-9 pr-3.5 text-sm shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-primary/45 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/15 dark:border-border dark:bg-background dark:focus-visible:bg-background"
                  aria-label="Search team members"
                  autoComplete="off"
                />
              </div>
              <p className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-right">
                {listRangeLabel}
                {seatUsage ? (
                  <span className="mt-0.5 block text-xs">
                    Seats: {seatUsage.currentCount}/{seatUsage.effectiveLimit}
                  </span>
                ) : null}
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
                data={paginatedRows}
                manualFiltering
                hideSearch
                onRowClick={(r) =>
                  router.push(`/app/company-team/${r.membershipId}`)
                }
                getRowId={(r) => r.membershipId}
                emptyMessage={
                  hasActiveFilters ? (
                    <FeatureEmptyState
                      title="No members match your filters"
                      description="Try clearing search or adjusting filters."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPage(1);
                            setSearchQuery("");
                            setStatusFilter("all");
                            setRoleFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : facets.total === 0 ? (
                    <FeatureEmptyState
                      icon={Users}
                      title="No team members yet"
                      description="Invite colleagues by email and assign a role so they only see what they should."
                      action={
                        seatUsage?.canInvite !== false ? (
                          <Button className="gap-2" asChild>
                            <Link href="/app/company-team/new">
                              <UserPlus className="h-4 w-4" />
                              Invite team member
                            </Link>
                          </Button>
                        ) : undefined
                      }
                      className="border-0 bg-transparent py-8"
                    />
                  ) : (
                    <FeatureEmptyState
                      title="No members on this page"
                      description="Try another page."
                      className="border-0 bg-transparent py-8"
                    />
                  )
                }
                footer={
                  <DataTablePaginationFooter
                    variant="minimal"
                    total={totalFiltered}
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
      ) : null}

      <AlertDialog
        open={!!deleteRow}
        onOpenChange={(o) => !o && setDeleteRow(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from company?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRow
                ? `Remove ${deleteRow.profile?.full_name ?? deleteRow.profile?.email ?? "this user"} from the company? Their login account will remain, but they will lose access to this workspace.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!rateRow}
        onOpenChange={(open) => {
          if (!open) {
            setRateRow(null);
            setRateValue("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set rate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="driver-rate">Rate</Label>
            <Input
              id="driver-rate"
              type="number"
              min="0"
              step="0.01"
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRateRow(null);
                setRateValue("");
              }}
              disabled={savingRate}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveRate()}
              disabled={savingRate}
            >
              {savingRate ? "Saving..." : "Save rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPageShell>
  );
}
