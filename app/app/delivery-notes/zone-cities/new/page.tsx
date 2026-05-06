"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Layers, Save, Truck, type LucideIcon } from "lucide-react";
import { AppPageShell } from "@/components/app-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getActiveCompanyId } from "@/lib/active-company";
import { listTeamMembers, type TeamMemberRow } from "@/lib/company-team-service";
import { createDeliveryZone } from "@/lib/delivery-zones-service";

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

function ReqLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className={fieldLabelClass}>
      {children}
      <span className="text-destructive" aria-hidden>
        {" "}
        *
      </span>
    </Label>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-lg py-0 shadow-sm">
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="field-controls flex min-h-0 flex-1 flex-col space-y-4 px-4 py-5 [&_input]:h-8 [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs">
        {children}
      </CardContent>
    </Card>
  );
}

function teamDriverMembers(team: TeamMemberRow[]): TeamMemberRow[] {
  return team.filter((m) => m.roleName.toLowerCase().includes("driver"));
}

export default function NewDeliveryZonePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [companyReady, setCompanyReady] = useState<boolean | null>(null);
  const [drivers, setDrivers] = useState<TeamMemberRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [driverId, setDriverId] = useState("__none__");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getActiveCompanyId();
      if (cancelled) return;
      setCompanyReady(!!id);
      if (!id) return;
      try {
        const team = await listTeamMembers();
        if (!cancelled) setDrivers(teamDriverMembers(team));
      } catch {
        if (!cancelled) setDrivers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    const clean = name.trim();
    if (!clean) {
      toast({
        title: "Zone name required",
        description: "Enter a name for this zone.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const zoneId = await createDeliveryZone({
        name: clean,
        description: description.trim() || undefined,
        driverUserId:
          driverId && driverId !== "__none__" ? driverId : undefined,
      });
      toast({ title: "Zone created" });
      router.replace(`/app/delivery-notes/zone-cities/${zoneId}`);
    } catch (e: unknown) {
      toast({
        title: "Could not create zone",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to zone cities">
          <Link href="/app/delivery-notes/zone-cities">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <Button
          type="button"
          className="gap-2 font-semibold shadow-sm"
          disabled={saving || companyReady !== true}
          onClick={() => void handleSave()}
        >
          <Save className="size-3.5 shrink-0" aria-hidden />
          {saving ? "Saving…" : "Create zone"}
        </Button>
      }
    >
      {companyReady === false ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-100">
            No active company is linked to this account yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="border-b border-border/60 pb-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              New delivery zone
            </h2>
            <p className="text-xs text-muted-foreground">
              After saving, open the zone to add cities in delivery order.
            </p>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            <SectionCard icon={Layers} title="Zone basics">
              <div className="space-y-2">
                <ReqLabel htmlFor="zone-name">Zone name</ReqLabel>
                <Input
                  id="zone-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. North route"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone-desc" className={fieldLabelClass}>
                  Description
                </Label>
                <Textarea
                  id="zone-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes"
                  rows={4}
                  className="min-h-[96px] resize-y rounded-sm py-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone-driver" className={fieldLabelClass}>
                  Default driver
                </Label>
                <Select value={driverId} onValueChange={setDriverId}>
                  <SelectTrigger id="zone-driver" className="h-8 w-full rounded-sm">
                    <SelectValue placeholder="Assign driver (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No driver</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.userId} value={d.userId}>
                        {d.profile?.full_name?.trim() ||
                          d.profile?.email?.trim() ||
                          d.userId.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SectionCard>
            <SectionCard icon={Truck} title="Next steps">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Save this zone, then use{" "}
                <span className="font-medium text-foreground">
                  Assigned cities
                </span>{" "}
                on the zone page to pick cities and set route order (stop 1, 2,
                …). Drivers with the Driver role appear in the list above.
              </p>
            </SectionCard>
          </div>
        </div>
      )}
    </AppPageShell>
  );
}
