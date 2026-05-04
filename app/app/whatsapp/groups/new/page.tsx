"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
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
import { addWhatsAppGroup } from "@/lib/whatsapp-groups-service";

function customerLabel(c: CustomerRow): string {
  return c.type === "company"
    ? c.companyName || "Company"
    : c.fullName || "Individual";
}

export default function NewWhatsAppGroupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
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

  useEffect(() => {
    if (companyReady !== true) return;
    (async () => {
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
    })();
  }, [companyReady, toast]);

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
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError("");
    try {
      setSaving(true);
      await addWhatsAppGroup({
        name: name.trim(),
        description: description.trim() || null,
        customerIds: [...selectedCustomerIds],
      });
      toast({ title: "Group created" });
      router.push("/app/whatsapp/groups");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please try again.";
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
      subtitle="Choose a unique name and tick customers to include. They must belong to your company."
    >
      {companyReady === false && (
        <Card className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company linked. Groups require a company context.
          </CardContent>
        </Card>
      )}

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>New group</CardTitle>
          <CardDescription>
            Customers must belong to your active company.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                {saving ? "Saving…" : "Create group"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
