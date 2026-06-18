"use client";
import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Save,
  Shield,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { listCompanyRoles, type CompanyRole } from "@/lib/company-roles-service";
import { getTeamMember, updateTeamMember, type TeamMemberRow } from "@/lib/company-team-service";
import {
  listDriverLocationAssignments,
  type DriverLocationAssignmentRow,
} from "@/lib/location-zones-drivers-service";
import { formatLocationTypeLabel } from "@/lib/locations-service";
import { cn } from "@/lib/utils";
import { runActionProgress } from "@/lib/action-progress-bridge";
import { useActionProgress } from "@/contexts/action-progress-context";

const fieldLabelClass =
  "text-xs font-medium text-neutral-600 dark:text-neutral-400";
const sectionTitleClass =
  "text-sm font-semibold leading-snug text-neutral-700 dark:text-neutral-300";
const sectionIconBoxClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100/80 dark:border-neutral-700 dark:bg-neutral-800/50";
const sectionIconClass = "h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400";

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
      <CardContent className="field-controls flex min-h-0 flex-1 flex-col space-y-4 px-4 py-5 [&_input]:h-8 [&_input]:text-xs [&_select]:text-xs">
        {children}
      </CardContent>
    </Card>
  );
}

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

export default function CompanyTeamEditMemberPage() {
  const params = useParams();
  const membershipId = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<TeamMemberRow | null>(null);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [active, setActive] = useState(true);
  const [driverRateInput, setDriverRateInput] = useState("");
  const [driverAssignments, setDriverAssignments] = useState<
    DriverLocationAssignmentRow[]
  >([]);
  const { isRunning } = useActionProgress();

  const load = useCallback(async () => {
    if (!membershipId) return;
    setLoading(true);
    try {
      const [m, roleList] = await Promise.all([
        getTeamMember(membershipId),
        listCompanyRoles(),
      ]);
      setMember(m);
      setRoles(roleList.filter((r) => r.is_active));
      if (m) {
        setFullName(m.profile?.full_name ?? "");
        setEmail(m.profile?.email ?? "");
        setPhone(m.profile?.phone ?? "");
        setRoleId(m.roleId);
        setActive(m.isActive);
        setDriverRateInput(
          m.driverRate != null && Number.isFinite(m.driverRate)
            ? String(m.driverRate)
            : "",
        );
        try {
          const assigns = await listDriverLocationAssignments(m.userId);
          setDriverAssignments(assigns);
        } catch (assignErr) {
          setDriverAssignments([]);
          toast({
            title: "Could not load assigned locations",
            description:
              assignErr instanceof Error ? assignErr.message : "Try again.",
            variant: "destructive",
          });
        }
      } else {
        setDriverAssignments([]);
        setDriverRateInput("");
      }
    } catch (err) {
      toast({
        title: "Failed to load",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [membershipId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    if (!fullName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const selectedRole = roles.find((r) => r.id === roleId);
    const selectedIsDriver =
      selectedRole?.name.toLowerCase().includes("driver") ?? false;

    let driverRatePayload: number | null | undefined = undefined;
    if (!member.isOwner && selectedIsDriver) {
      const raw = driverRateInput.trim();
      if (raw === "") {
        driverRatePayload = null;
      } else {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          toast({
            title: "Invalid rate",
            description: "Enter a number greater than or equal to 0, or leave blank.",
            variant: "destructive",
          });
          return;
        }
        driverRatePayload = n;
      }
    }

    await runActionProgress("Saving changes…", async () => {
      try {
      await updateTeamMember(member.membershipId, {
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        roleId: member.isOwner ? undefined : roleId,
        membershipActive: member.isOwner ? undefined : active,
        driverRate: driverRatePayload,
      });
      toast({ title: "Saved", description: "Team member updated." });
      router.push("/app/company-team");
      } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
      }
    });
  }

  return (
    <AppPageShell
      fillHeight
      className="max-w-none px-3 sm:px-4 md:px-5 lg:px-6"
      titleBefore={
        <Button variant="ghost" size="icon" asChild aria-label="Back to team">
          <Link href="/app/company-team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      subtitle={
        member?.isOwner
          ? "Owner — name is editable; company role is managed separately."
          : "Update profile and company access."
      }
      actions={
        member && !loading ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button variant="outline" type="button" asChild>
              <Link href={`/app/company-team/${member.membershipId}`}>
                Cancel
              </Link>
            </Button>
            <Button
              type="submit"
              form="company-team-edit-form"
              disabled={isRunning}
              className="gap-2 rounded-md font-semibold shadow-sm"
            >
              {isRunning ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Save className="size-3.5 shrink-0" aria-hidden />
              )}
              "Save"
            </Button>
          </div>
        ) : null
      }
    >
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        {loading ? (
          <FormTwoColumnPageSkeleton withLineItems={false} />
        ) : !member ? (
          <p className="text-sm text-muted-foreground">Member not found.</p>
        ) : (
          <form
            id="company-team-edit-form"
            onSubmit={(e) => void handleSubmit(e)}
            className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8 xl:gap-10"
          >
            <SectionCard icon={UserRound} title="Profile">
              <div className="space-y-2">
                <ReqLabel htmlFor="edit-name">Full name</ReqLabel>
                <Input
                  id="edit-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email" className={fieldLabelClass}>
                  Email
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone" className={fieldLabelClass}>
                  Phone
                </Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </SectionCard>

            <SectionCard icon={Shield} title="Company access">
              {!member.isOwner ? (
                <>
                  <div className="space-y-2">
                    <ReqLabel htmlFor="edit-role">Company role</ReqLabel>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger
                        id="edit-role"
                        className="h-8 w-full rounded-sm text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                    <span className="text-xs font-medium text-foreground">
                      Active in company
                    </span>
                    <Switch checked={active} onCheckedChange={setActive} />
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Owner role and activation are managed separately from this form.
                </p>
              )}
            </SectionCard>

            {(() => {
              const selectedRole = roles.find((r) => r.id === roleId);
              const selectedIsDriver =
                selectedRole?.name.toLowerCase().includes("driver") ?? false;
              if (!selectedIsDriver || member.isOwner) return null;
              return (
                <div className="lg:col-span-2">
                  <SectionCard icon={MapPin} title="Driver">
                  <div className="space-y-2">
                    <Label htmlFor="edit-driver-rate" className={fieldLabelClass}>
                      Rate
                    </Label>
                    <Input
                      id="edit-driver-rate"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={driverRateInput}
                      onChange={(e) => setDriverRateInput(e.target.value)}
                      placeholder="0"
                      className="max-w-[16rem]"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className={fieldLabelClass}>Assigned locations</p>
                    {driverAssignments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        None yet. Assign this driver from{" "}
                        <Link
                          href="/app/locations"
                          className="font-medium text-primary underline underline-offset-2"
                        >
                          Locations
                        </Link>{" "}
                        → open a location → Drivers.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {driverAssignments.map((a) => (
                          <li key={a.linkId}>
                            <Link
                              href={`/app/locations/${a.locationId}`}
                              className={cn(
                                "inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium underline underline-offset-2 hover:opacity-90",
                                !a.linkActive || !a.locationActive
                                  ? "text-muted-foreground"
                                  : "text-primary",
                              )}
                            >
                              <span>{a.name}</span>
                              {a.locationType ? (
                                <span className="text-xs font-normal text-muted-foreground no-underline">
                                  ({formatLocationTypeLabel(a.locationType)})
                                </span>
                              ) : null}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              {a.isPrimary ? (
                                <span className="inline-flex rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-medium text-sky-900 dark:bg-sky-500/14 dark:text-sky-200">
                                  Primary
                                </span>
                              ) : null}
                              {!a.linkActive ? (
                                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  Link inactive
                                </span>
                              ) : null}
                              {!a.locationActive ? (
                                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  Location inactive
                                </span>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </SectionCard>
                </div>
              );
            })()}
          </form>
        )}
      </div>
    </AppPageShell>
  );
}
