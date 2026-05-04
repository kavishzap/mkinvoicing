"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { getActiveCompanyId } from "@/lib/active-company";
import { listCustomersForCompany, type CustomerRow } from "@/lib/customers-service";
import {
  getWhatsAppGroup,
  listGroupMembers,
  setGroupMembers,
  updateWhatsAppGroup,
} from "@/lib/whatsapp-groups-service";

function customerLabel(c: CustomerRow): string {
  return c.type === "company"
    ? c.companyName || "Company"
    : c.fullName || "Individual";
}

export default function EditWhatsAppGroupPage() {
  const params = useParams();
  const groupId = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { toast } = useToast();

  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    (async () => {
      const id = await getActiveCompanyId();
      setCompanyReady(!!id);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!groupId || companyReady !== true) return;
    setLoading(true);
    try {
      const [g, customers, members] = await Promise.all([
        getWhatsAppGroup(groupId),
        listCustomersForCompany(),
        listGroupMembers(groupId),
      ]);
      setName(g.name);
      setDescription(g.description);
      setAllCustomers(customers);
      setSelectedCustomerIds(new Set(members.map((m) => m.customer_id)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Failed to load group", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [groupId, companyReady, toast]);

  useEffect(() => {
    if (companyReady !== true) {
      if (companyReady === false) setLoading(false);
      return;
    }
    void load();
  }, [companyReady, load]);

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
    const blob = [customerLabel(c), c.email, c.phone, c.companyName, c.fullName]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError("");
    try {
      setSaving(true);
      await updateWhatsAppGroup(groupId, {
        name: name.trim(),
        description: description.trim() || null,
      });
      await setGroupMembers(groupId, [...selectedCustomerIds]);
      toast({ title: "Group updated" });
      router.push("/app/whatsapp/groups");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPageShell
      leading={
        <Link href="/app/whatsapp/groups">
          <Button variant="ghost" size="icon" aria-label="Back to groups">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Update the group name, description, and customer membership."
    >
      {companyReady === false && (
        <Card className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company linked.
          </CardContent>
        </Card>
      )}

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Edit group</CardTitle>
          <CardDescription>Choose which customers belong to this group.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="g-name">Name *</Label>
                <Input
                  id="g-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={companyReady !== true}
                  className={nameError ? "border-destructive" : ""}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-desc">Description</Label>
                <Textarea
                  id="g-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={companyReady !== true}
                />
              </div>
              <div className="space-y-2">
                <Label>Customers</Label>
                <Input
                  placeholder="Filter customers…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  disabled={companyReady !== true}
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
                          disabled={companyReady !== true}
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
                <p className="text-xs text-muted-foreground">{selectedCustomerIds.size} selected</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="outline" asChild>
                  <Link href="/app/whatsapp/groups">Cancel</Link>
                </Button>
                <Button type="submit" disabled={saving || companyReady !== true}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
