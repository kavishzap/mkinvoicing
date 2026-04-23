"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  MapPin,
  Lock,
  Unlock,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { getActiveCompanyId } from "@/lib/active-company";
import { AppPageShell } from "@/components/app-page-shell";
import {
  deleteLocation,
  listLocations,
  setLocationActive,
  type LocationRow,
} from "@/lib/locations-service";

export default function InventoryLocationsPage() {
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);

  const [rows, setRows] = useState<LocationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const id = await getActiveCompanyId();
      if (cancelled) return;
      setCompanyReady(!!id);
      if (!id) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      try {
        const res = await listLocations({
          search: searchQuery,
          includeInactive,
          page,
          pageSize,
        });
        if (!cancelled) {
          setRows(res.rows);
          setTotal(res.total);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Please try again.";
          toast({
            title: "Failed to load locations",
            description: msg,
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
  }, [toast, searchQuery, includeInactive, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, includeInactive, pageSize]);

  async function reload() {
    if (companyReady !== true) return;
    const res = await listLocations({
      search: searchQuery,
      includeInactive,
      page,
      pageSize,
    });
    setRows(res.rows);
    setTotal(res.total);
  }

  async function handleToggleActive(loc: LocationRow) {
    try {
      await setLocationActive(loc.id, !loc.isActive);
      toast({
        title: loc.isActive ? "Location deactivated" : "Location activated",
        description: loc.isActive
          ? "It will be hidden from default lists."
          : "It is visible in lists again.",
      });
      await reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Update failed",
        description: msg,
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLocation(id);
      toast({
        title: "Location deleted",
        description: "The location has been removed.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Delete failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else await reload();
      setConfirmDeleteId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <AppPageShell
      leading={
        <Link href="/app/inventory">
          <Button variant="ghost" size="icon" aria-label="Back to inventory">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Maintain warehouses and sites where you hold stock—each location belongs to your active company."
      actions={
        <Button className="shrink-0 gap-2" disabled={companyReady !== true} asChild>
          <Link href="/app/inventory/locations/new">
            <Plus className="h-4 w-4" />
            Add location
          </Link>
        </Button>
      }
    >
      {companyReady === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company is linked to this account yet. Create or join a
            company in Supabase (company_users / companies) so locations can be
            saved against <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/60">company_id</code>.
          </CardContent>
        </Card>
      )}

      {loading ? (
        <SkeletonFilters />
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, or city…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={companyReady !== true}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={includeInactive}
                    onCheckedChange={(v) => setIncludeInactive(v === true)}
                    disabled={companyReady !== true}
                  />
                  Include inactive
                </label>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  disabled={companyReady !== true}
                >
                  <option value={5}>5 / page</option>
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <SkeletonTable rows={Math.min(pageSize, 6)} />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">City</th>
                <th className="p-3 text-left">Country</th>
                <th className="p-3 text-left">Primary</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((loc) => (
                <tr key={loc.id} className="border-t">
                  <td className="p-3 font-medium">{loc.name}</td>
                  <td className="p-3 text-muted-foreground">
                    {loc.code || "—"}
                  </td>
                  <td className="p-3">{loc.city || "—"}</td>
                  <td className="p-3">{loc.country || "—"}</td>
                  <td className="p-3">
                    {loc.isDefault ? (
                      <span className="inline-flex items-center text-emerald-600">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {loc.isActive ? (
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/app/inventory/locations/${loc.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(loc)}>
                          {loc.isActive ? (
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
                          onClick={() => setConfirmDeleteId(loc.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <MapPin className="h-10 w-10 opacity-50" />
                      {companyReady === false
                        ? "Link a company to manage locations."
                        : searchQuery
                          ? "No matches. Try a different search."
                          : "No locations yet. Add your first warehouse."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && companyReady === true && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing{" "}
            <span className="font-medium text-foreground">{start || 0}</span>–
            <span className="font-medium text-foreground">{end || 0}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span>
              Page <span className="font-medium text-foreground">{page}</span> /{" "}
              {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete location</DialogTitle>
            <DialogDescription>
              This cannot be undone. Ensure no stock records depend on this
              location.
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

function SkeletonFilters() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="h-9 w-full animate-pulse rounded-md bg-muted sm:flex-1" />
          <div className="flex items-center gap-3">
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Code</th>
            <th className="p-3 text-left">City</th>
            <th className="p-3 text-left">Country</th>
            <th className="p-3 text-left">Primary</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-t">
              {Array.from({ length: 7 }).map((__, j) => (
                <td key={j} className="p-3">
                  <div className="h-5 animate-pulse rounded bg-muted" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
