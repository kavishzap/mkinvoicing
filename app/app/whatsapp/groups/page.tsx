"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
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
import { listCustomersForCompany, type CustomerRow } from "@/lib/customers-service";
import {
  addWhatsAppGroup,
  countMembersForGroups,
  deleteWhatsAppGroup,
  listGroupMembers,
  listWhatsAppGroups,
  setGroupMembers,
  updateWhatsAppGroup,
  type WhatsAppGroupRow,
} from "@/lib/whatsapp-groups-service";

type GroupListItem = WhatsAppGroupRow & { memberCount: number };

function customerLabel(c: CustomerRow): string {
  return c.type === "company"
    ? c.companyName || "Company"
    : c.fullName || "Individual";
}

export default function WhatsAppGroupsPage() {
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);

  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(
    new Set()
  );
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    if (companyReady !== true) return;
    setLoading(true);
    try {
      const res = await listWhatsAppGroups({
        search,
        includeInactive,
        page,
        pageSize,
      });
      const ids = res.rows.map((g) => g.id);
      const counts = await countMembersForGroups(ids);
      setGroups(
        res.rows.map((g) => ({
          ...g,
          memberCount: counts.get(g.id) ?? 0,
        }))
      );
      setTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Failed to load groups", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [companyReady, search, includeInactive, page, pageSize, toast]);

  useEffect(() => {
    (async () => {
      const id = await getActiveCompanyId();
      setCompanyReady(!!id);
    })();
  }, []);

  useEffect(() => {
    if (companyReady !== true) {
      if (companyReady === false) setLoading(false);
      return;
    }
    loadGroups();
  }, [companyReady, loadGroups]);

  useEffect(() => {
    setPage(1);
  }, [search, includeInactive, pageSize]);

  async function loadCustomersForDialog() {
    try {
      const rows = await listCustomersForCompany();
      setAllCustomers(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Could not load customers",
        description: msg,
        variant: "destructive",
      });
      setAllCustomers([]);
    }
  }

  function openCreate() {
    setEditingId(null);
    setName("");
    setDescription("");
    setCustomerSearch("");
    setSelectedCustomerIds(new Set());
    setNameError("");
    void loadCustomersForDialog();
    setDialogOpen(true);
  }

  async function openEdit(g: WhatsAppGroupRow) {
    setEditingId(g.id);
    setName(g.name);
    setDescription(g.description);
    setCustomerSearch("");
    setNameError("");
    void loadCustomersForDialog();
    try {
      const members = await listGroupMembers(g.id);
      setSelectedCustomerIds(new Set(members.map((m) => m.customer_id)));
    } catch {
      setSelectedCustomerIds(new Set());
    }
    setDialogOpen(true);
  }

  function toggleCustomer(id: string) {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredCustomers = allCustomers.filter((c) => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    const blob = [
      customerLabel(c),
      c.email,
      c.phone,
      c.companyName,
      c.fullName,
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });

  async function handleSave() {
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError("");
    try {
      setSaving(true);
      const ids = [...selectedCustomerIds];
      if (editingId) {
        await updateWhatsAppGroup(editingId, {
          name: name.trim(),
          description: description.trim() || null,
        });
        await setGroupMembers(editingId, ids);
        toast({ title: "Group updated" });
      } else {
        await addWhatsAppGroup({
          name: name.trim(),
          description: description.trim() || null,
          customerIds: ids,
        });
        toast({ title: "Group created" });
      }
      setDialogOpen(false);
      await loadGroups();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(g: WhatsAppGroupRow) {
    try {
      await updateWhatsAppGroup(g.id, { is_active: !g.isActive });
      toast({
        title: g.isActive ? "Group deactivated" : "Group activated",
      });
      await loadGroups();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWhatsAppGroup(id);
      toast({ title: "Group deleted" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    } finally {
      setDeleteId(null);
      if (groups.length === 1 && page > 1) setPage((p) => p - 1);
      else await loadGroups();
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit gap-1" asChild>
            <Link href="/app/whatsapp">
              <ArrowLeft className="h-4 w-4" />
              WhatsApp
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp groups</h1>
          <p className="text-muted-foreground">
            Name a group and choose which customers belong to it (company-scoped).
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="shrink-0 gap-2"
          disabled={companyReady !== true}
        >
          <Plus className="h-4 w-4" />
          New group
        </Button>
      </div>

      {companyReady === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company linked. Groups require <code className="rounded bg-amber-100/80 px-1 text-xs dark:bg-amber-900/60">company_id</code>{" "}
            and customers with the same company.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search groups…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={companyReady !== true}
              />
            </div>
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
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Members</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{g.name}</div>
                    {g.description ? (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {g.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 tabular-nums">{g.memberCount}</td>
                  <td className="p-3">
                    {g.isActive ? (
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
                        <DropdownMenuItem onClick={() => openEdit(g)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(g)}>
                          {g.isActive ? (
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
                          onClick={() => setDeleteId(g.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
            {!loading && groups.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-10 w-10 opacity-40" />
                    {companyReady === false
                      ? "Link a company and assign customers to that company."
                      : "No groups yet. Create one to use with catalogue sharing."}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && companyReady === true && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page <span className="font-medium text-foreground">{page}</span> / {pages}{" "}
            — {total} group(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit group" : "New group"}</DialogTitle>
            <DialogDescription>
              Choose a unique name and tick customers to include. They must belong to your
              company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="g-name">Name *</Label>
              <Input
                id="g-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={nameError ? "border-destructive" : ""}
              />
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-desc">Description</Label>
              <Textarea
                id="g-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Customers</Label>
              <Input
                placeholder="Filter customers…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                {filteredCustomers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No customers found. Add customers with this company in Customers.
                  </p>
                ) : (
                  filteredCustomers.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedCustomerIds.has(c.id)}
                        onCheckedChange={() => toggleCustomer(c.id)}
                      />
                      <span className="text-sm">
                        <span className="font-medium">{customerLabel(c)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {c.phone || "No phone"} · {c.email}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedCustomerIds.size} selected
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete group</DialogTitle>
            <DialogDescription>
              This removes the group and its customer links. Customers themselves are not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
