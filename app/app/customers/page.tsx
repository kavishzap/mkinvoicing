"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Building2,
  User,
  Users,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import type { FeatureKpiItem } from "@/components/feature-kpi-strip";
import { FeatureListSection } from "@/components/feature-list-section";
import { useToast } from "@/hooks/use-toast";
import {
  deleteCustomer,
  listCustomers,
  setCustomerActive,
  type CustomerRow,
} from "@/lib/customers-service";
import {
  ACTIVE_COMPANY_CHANGED_EVENT,
  ACTIVE_COMPANY_ID_STORAGE_KEY,
} from "@/lib/active-company";
import { AppPageShell } from "@/components/app-page-shell";

function formatAddress(c: CustomerRow): string {
  const parts = [c.address_line_1, c.address_line_2].filter(Boolean);
  return parts.join(", ") || "—";
}

export default function CustomersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [singleDeleting, setSingleDeleting] = useState(false);

  const [activeCompanyScope, setActiveCompanyScope] = useState(0);
  const [kpiRev, setKpiRev] = useState(0);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiTotal, setKpiTotal] = useState(0);
  const [kpiCompanies, setKpiCompanies] = useState(0);
  const [kpiIndividuals, setKpiIndividuals] = useState(0);

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
    setKpiLoading(true);
    (async () => {
      try {
        const [all, companies, individuals] = await Promise.all([
          listCustomers({ includeInactive: true, page: 1, pageSize: 1 }),
          listCustomers({ includeInactive: true, type: "company", page: 1, pageSize: 1 }),
          listCustomers({ includeInactive: true, type: "individual", page: 1, pageSize: 1 }),
        ]);
        if (cancelled) return;
        setKpiTotal(all.total);
        setKpiCompanies(companies.total);
        setKpiIndividuals(individuals.total);
      } catch {
        if (!cancelled) {
          setKpiTotal(0);
          setKpiCompanies(0);
          setKpiIndividuals(0);
        }
      } finally {
        if (!cancelled) setKpiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyScope, kpiRev]);

  const hasActiveFilters = useMemo(
    () => searchQuery.trim() !== "" || includeInactive,
    [searchQuery, includeInactive],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { rows, total: nextTotal } = await listCustomers({
          search: searchQuery,
          includeInactive,
          page,
          pageSize,
        });
        if (!cancelled) {
          setCustomers(rows);
          setTotal(nextTotal);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: "Failed to load customers",
            description: e instanceof Error ? e.message : "Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast, searchQuery, includeInactive, page, pageSize, activeCompanyScope]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, includeInactive, pageSize, activeCompanyScope]);

  const reload = useCallback(async () => {
    const { rows, total: nextTotal } = await listCustomers({
      search: searchQuery,
      includeInactive,
      page,
      pageSize,
    });
    setCustomers(rows);
    setTotal(nextTotal);
  }, [searchQuery, includeInactive, page, pageSize]);

  const handleToggleActive = useCallback(
    async (c: CustomerRow) => {
      try {
        await setCustomerActive(c.id, !c.isActive);
        toast({
          title: c.isActive ? "Customer set inactive" : "Customer activated",
          description: c.isActive
            ? "They will be hidden from default lists."
            : "They are visible in lists again.",
        });
        await reload();
        setKpiRev((n) => n + 1);
      } catch (e: unknown) {
        toast({
          title: "Update failed",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      }
    },
    [reload, toast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      let ok = false;
      try {
        setSingleDeleting(true);
        await deleteCustomer(id);
        ok = true;
        toast({
          title: "Customer deleted",
          description: "Customer has been removed successfully.",
        });
      } catch (e: unknown) {
        toast({
          title: "Delete failed",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setSingleDeleting(false);
        setConfirmDeleteId(null);
        if (ok) {
          if (customers.length === 1 && page > 1) setPage((p) => p - 1);
          else await reload();
          setKpiRev((n) => n + 1);
        }
      }
    },
    [customers.length, page, reload, toast],
  );

  const kpiItems = useMemo<FeatureKpiItem[]>(
    () => [
      {
        label: "Total customers",
        value: kpiTotal,
        icon: Users,
        valueLabel: String(kpiTotal),
      },
      {
        label: "Companies",
        value: kpiCompanies,
        icon: Building2,
        valueLabel: String(kpiCompanies),
      },
      {
        label: "Individuals",
        value: kpiIndividuals,
        icon: User,
        valueLabel: String(kpiIndividuals),
      },
    ],
    [kpiTotal, kpiCompanies, kpiIndividuals],
  );

  const columns = useMemo<ColumnDef<CustomerRow>[]>(
    () => [
      {
        id: "type",
        accessorFn: (r) => r.type,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        meta: {
          searchValue: (row: CustomerRow) => row.type,
        },
        cell: ({ row }) => {
          const c = row.original;
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
              {c.type === "company" ? (
                <Building2 className="h-3.5 w-3.5" />
              ) : (
                <User className="h-3.5 w-3.5" />
              )}
              {c.type}
            </span>
          );
        },
      },
      {
        id: "name",
        accessorFn: (r) => (r.type === "company" ? r.companyName : r.fullName) ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        meta: {
          searchValue: (row: CustomerRow) =>
            [row.companyName, row.fullName, row.email].filter(Boolean).join(" "),
        },
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.type === "company"
              ? row.original.companyName
              : row.original.fullName}
          </span>
        ),
      },
      {
        id: "email",
        accessorFn: (r) => r.email ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
        meta: { searchValue: (row: CustomerRow) => row.email ?? "" },
        cell: ({ row }) => row.original.email || "—",
      },
      {
        id: "phone",
        accessorFn: (r) => r.phone ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
        meta: {
          thClassName: "hidden md:table-cell",
          tdClassName: "hidden md:table-cell",
          searchValue: (row: CustomerRow) => row.phone ?? "",
        },
        cell: ({ row }) => row.original.phone || "—",
      },
      {
        id: "address",
        accessorFn: (r) => formatAddress(r),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Address" />,
        meta: {
          searchValue: (row: CustomerRow) => formatAddress(row),
        },
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[14rem] text-muted-foreground">
            {formatAddress(row.original)}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => (r.isActive ? "active" : "inactive"),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        meta: {
          searchValue: (row: CustomerRow) => (row.isActive ? "active" : "inactive"),
        },
        cell: ({ row }) =>
          row.original.isActive ? (
            <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600">
              Active
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
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
          thClassName: "w-[70px] text-right",
          tdClassName: "text-right",
        },
        cell: ({ row }) => {
          const c = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/app/customers/${c.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleToggleActive(c)}>
                  {c.isActive ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Set inactive
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
                  onClick={() => setConfirmDeleteId(c.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [handleToggleActive],
  );

  const listDescription =
    "Newest first. Click a row to open the customer editor, or use the row menu for activate / delete. KPIs reflect your full directory (not just this page).";

  return (
    <AppPageShell
      subtitle="Keep everyone you sell to in one place—use these records when you quote, invoice, or follow up."
      actions={
        <Button asChild className="gap-2">
          <Link href="/app/customers/new">
            <Plus className="h-4 w-4" />
            Add customer
          </Link>
        </Button>
      }
    >
      <FeatureListSection
        kpiItems={kpiItems}
        kpiLoading={kpiLoading}
        listTitle="Customers"
        listDescription={listDescription}
      >
        {loading && customers.length === 0 ? (
          <div className="h-56 animate-pulse rounded-md bg-muted/60" aria-hidden />
        ) : (
          <DataTable
            columns={columns}
            data={customers}
            manualFiltering
            onRowClick={(r) => router.push(`/app/customers/${r.id}/edit`)}
            searchPlaceholder="Search by name, email, or company…"
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            toolbarLeft={
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="customers-include-inactive"
                    checked={includeInactive}
                    onCheckedChange={(v) => setIncludeInactive(v === true)}
                  />
                  <Label
                    htmlFor="customers-include-inactive"
                    className="cursor-pointer text-sm font-normal text-muted-foreground"
                  >
                    Include inactive
                  </Label>
                </div>
              </div>
            }
            getRowId={(r) => r.id}
            emptyMessage={
              hasActiveFilters ? (
                <FeatureEmptyState
                  title="No customers match your filters"
                  description="Try another search or turn off “Include inactive” to match the default list."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setIncludeInactive(false);
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                  className="border-0 bg-transparent py-8"
                />
              ) : (
                <div className="flex max-w-md flex-col items-center gap-4 py-10 text-center">
                  <Users className="h-10 w-10 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="font-semibold text-foreground">No customers yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add your first customer to use them on quotations and invoices.
                    </p>
                  </div>
                  <Button asChild className="gap-2">
                    <Link href="/app/customers/new">
                      <Plus className="h-4 w-4" />
                      Add customer
                    </Link>
                  </Button>
                </div>
              )
            }
            footer={
              <DataTablePaginationFooter
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[5, 10, 20, 50]}
              />
            }
          />
        )}
      </FeatureListSection>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The customer record will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={singleDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={singleDeleting}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDeleteId) void handleDelete(confirmDeleteId);
              }}
            >
              {singleDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPageShell>
  );
}
