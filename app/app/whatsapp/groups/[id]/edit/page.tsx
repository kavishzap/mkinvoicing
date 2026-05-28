"use client";
import { SettingsTwoColumnSkeleton, FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

type InitialSnapshot = {
  name: string;
  description: string;
  customerIds: Set<string>;
};

const formGridClass =
  "grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10";

const cardShellClass =
  "flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-lg border bg-card py-0 shadow-sm";

const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";

const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";

function customerLabel(c: CustomerRow): string {
  return c.type === "company"
    ? c.companyName || "Company"
    : c.fullName || "Individual";
}

function customerSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

function GroupSectionCard({
  icon: Icon,
  title,
  children,
  contentClassName,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card className={cardShellClass}>
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent
        className={cn("flex min-h-0 flex-1 flex-col", contentClassName)}
      >
        {children}
      </CardContent>
    </Card>
  );
}

function BackButton() {
  return (
    <Button variant="ghost" size="icon" asChild aria-label="Back to groups">
      <Link href="/app/whatsapp?tab=groups">
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </Button>
  );
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
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(
    new Set(),
  );
  const [initial, setInitial] = useState<InitialSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedCustomerSearch(customerSearch.trim()),
      220,
    );
    return () => window.clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    (async () => {
      setCompanyReady(!!(await getActiveCompanyId()));
    })();
  }, []);

  const loadGroup = useCallback(async () => {
    if (!groupId || companyReady !== true) return;
    setLoading(true);
    try {
      const [g, members] = await Promise.all([
        getWhatsAppGroup(groupId),
        listGroupMembers(groupId),
      ]);
      const memberIds = new Set(members.map((m) => m.customer_id));
      const snapshot: InitialSnapshot = {
        name: g.name,
        description: g.description ?? "",
        customerIds: memberIds,
      };
      setInitial(snapshot);
      setName(snapshot.name);
      setDescription(snapshot.description);
      setSelectedCustomerIds(new Set(memberIds));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Failed to load group", description: msg, variant: "destructive" });
      router.replace("/app/whatsapp?tab=groups");
    } finally {
      setLoading(false);
    }
  }, [groupId, companyReady, router, toast]);

  useEffect(() => {
    if (companyReady !== true) {
      if (companyReady === false) setLoading(false);
      return;
    }
    void loadGroup();
  }, [companyReady, loadGroup]);

  const loadCustomers = useCallback(async () => {
    if (companyReady !== true) return;
    setCustomersLoading(true);
    try {
      const rows = await listCustomersForCompany({
        search: debouncedCustomerSearch || undefined,
        columns: "picker",
      });
      setCustomers(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({
        title: "Could not load customers",
        description: msg,
        variant: "destructive",
      });
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, [companyReady, debouncedCustomerSearch, toast]);

  useEffect(() => {
    if (companyReady !== true || loading) return;
    void loadCustomers();
  }, [companyReady, loading, loadCustomers]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    if (name.trim() !== initial.name.trim()) return true;
    if (description.trim() !== initial.description.trim()) return true;
    if (!customerSetsEqual(selectedCustomerIds, initial.customerIds)) return true;
    return false;
  }, [name, description, selectedCustomerIds, initial]);

  function toggleCustomer(id: string) {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleIds = useMemo(() => customers.map((c) => c.id), [customers]);

  const allVisibleSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    return visibleIds.every((id) => selectedCustomerIds.has(id));
  }, [visibleIds, selectedCustomerIds]);

  function selectAllVisible() {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }

  function clearVisibleSelection() {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.delete(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId || !isDirty) return;
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
      router.push("/app/whatsapp?tab=groups");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading || companyReady === null) {
    return (
      <AppPageShell
        fillHeight
        className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
        titleBefore={<BackButton />}
      >
        <div className={formGridClass}>
          <SettingsTwoColumnSkeleton />
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={<BackButton />}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button" asChild>
            <Link href="/app/whatsapp?tab=groups">Cancel</Link>
          </Button>
          <Button
            type="submit"
            form="wa-group-edit"
            disabled={saving || companyReady !== true || !isDirty}
            className="font-semibold shadow-sm"
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      {companyReady === false && (
        <Card className="mb-4 shrink-0 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company linked.
          </CardContent>
        </Card>
      )}

      <form
        id="wa-group-edit"
        onSubmit={(e) => void handleSubmit(e)}
        className={cn(formGridClass, "w-full")}
      >
        <GroupSectionCard
          icon={FileText}
          title="Details"
          contentClassName="field-controls gap-4 px-4 py-5"
        >
          <div className="space-y-2">
            <Label htmlFor="g-name">Name *</Label>
            <Input
              id="g-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              disabled={companyReady !== true}
              className={nameError ? "border-destructive" : ""}
            />
            {nameError ? (
              <p className="text-xs text-destructive">{nameError}</p>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <Label htmlFor="g-desc">Description</Label>
            <Textarea
              id="g-desc"
              rows={10}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={companyReady !== true}
              placeholder="Optional note about this group…"
              className="min-h-[12rem] flex-1 resize-y text-sm leading-relaxed"
            />
          </div>
        </GroupSectionCard>

        <GroupSectionCard
          icon={Users}
          title="Members"
          contentClassName="flex min-h-0 flex-1 flex-col gap-3 px-4 py-5"
        >
          <Input
            placeholder="Filter by name, email, or mobile phone…"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            disabled={companyReady !== true}
            aria-label="Filter customers"
            autoComplete="off"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                companyReady !== true ||
                customersLoading ||
                visibleIds.length === 0 ||
                allVisibleSelected
              }
              onClick={selectAllVisible}
            >
              Select all ({customers.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                companyReady !== true ||
                customersLoading ||
                visibleIds.length === 0 ||
                !visibleIds.some((id) => selectedCustomerIds.has(id))
              }
              onClick={clearVisibleSelection}
            >
              Clear list selection
            </Button>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto rounded-md border",
              customersLoading && "pointer-events-none opacity-60",
            )}
            aria-busy={customersLoading}
          >
            {customers.length === 0 && !customersLoading ? (
              <p className="p-4 text-sm text-muted-foreground">
                No customers match this filter. Try another search or clear the filter.
              </p>
            ) : (
              <ul className="divide-y">
                {customers.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/50">
                      <Checkbox
                        checked={selectedCustomerIds.has(c.id)}
                        onCheckedChange={() => toggleCustomer(c.id)}
                        disabled={companyReady !== true}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="font-medium">{customerLabel(c)}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          <span className="tabular-nums">{c.phone || "No phone"}</span>
                          {" · "}
                          {c.email || "—"}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">
            {selectedCustomerIds.size} selected in total (includes members hidden by
            the current filter).
          </p>
        </GroupSectionCard>
      </form>
    </AppPageShell>
  );
}
