"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Building2,
  User,
  Truck,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  listSuppliers,
  setSupplierActive,
  type SupplierRow,
} from "@/lib/suppliers-service";

export default function SuppliersPage() {
  const { toast } = useToast();

  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { rows: r, total: t } = await listSuppliers({
      search: searchQuery,
      includeInactive,
      page,
      pageSize,
    });
    setRows(r);
    setTotal(t);
  }, [searchQuery, includeInactive, page, pageSize]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await reload();
      } catch (e: unknown) {
        toast({
          title: "Failed to load suppliers",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast, reload]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, includeInactive, pageSize]);

  async function handleToggleActive(s: SupplierRow) {
    try {
      await setSupplierActive(s.id, !s.isActive);
      toast({
        title: s.isActive ? "Supplier set inactive" : "Supplier activated",
      });
      await reload();
    } catch (e: unknown) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  const displayName = (s: SupplierRow) =>
    s.type === "company" ? s.companyName || "—" : s.fullName || "—";

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground mt-1">
            Vendors you buy from — add and edit on dedicated pages
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/app/suppliers/new">
            <Plus className="h-4 w-4" />
            Add supplier
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="h-24 rounded-md border bg-muted/30 animate-pulse" />
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                  />
                  Include inactive
                </label>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
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
        <div className="h-64 rounded-md border bg-muted/30 animate-pulse" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                      {s.type === "company" ? (
                        <Building2 className="h-3.5 w-3.5" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                      {s.type}
                    </span>
                  </td>
                  <td className="p-3 font-medium">{displayName(s)}</td>
                  <td className="p-3 text-muted-foreground">
                    {s.supplierCode || "—"}
                  </td>
                  <td className="p-3">{s.email || "—"}</td>
                  <td className="p-3">{s.phone || "—"}</td>
                  <td className="p-3">
                    {s.isActive ? (
                      <span className="inline-flex px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
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
                          <Link href={`/app/suppliers/${s.id}/edit`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(s)}>
                          {s.isActive ? (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              Set inactive
                            </>
                          ) : (
                            <>
                              <Unlock className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="h-10 w-10 opacity-50" />
                      {searchQuery
                        ? "No matches. Try a different search."
                        : "No suppliers yet. Add your first one!"}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
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
    </div>
  );
}
