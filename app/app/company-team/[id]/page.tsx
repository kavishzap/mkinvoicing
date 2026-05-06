"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Pencil,
  Shield,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { getTeamMember, type TeamMemberRow } from "@/lib/company-team-service";
import {
  listDriverLocationAssignments,
  type DriverLocationAssignmentRow,
} from "@/lib/location-zones-drivers-service";
import { formatLocationTypeLabel } from "@/lib/locations-service";
import { cn } from "@/lib/utils";

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
    <Card className="flex h-full min-h-0 flex-col gap-0 rounded-lg py-0 shadow-sm">
      <CardHeader className="flex shrink-0 flex-row items-center gap-2.5 rounded-none border-b bg-muted/40 px-4 py-3">
        <div className={sectionIconBoxClass}>
          <Icon className={sectionIconClass} aria-hidden />
        </div>
        <CardTitle className={sectionTitleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 px-4 py-5 text-sm">
        {children}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className={fieldLabelClass}>{label}</p>
      <div className="break-words font-medium text-foreground">{children}</div>
    </div>
  );
}

function formatDt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CompanyTeamMemberViewPage() {
  const params = useParams();
  const membershipId = typeof params.id === "string" ? params.id : "";
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<TeamMemberRow | null>(null);
  const [driverAssignments, setDriverAssignments] = useState<
    DriverLocationAssignmentRow[]
  >([]);

  const load = useCallback(async () => {
    if (!membershipId) return;
    setLoading(true);
    try {
      const m = await getTeamMember(membershipId);
      setMember(m);
      if (m?.roleName.toLowerCase().includes("driver")) {
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
      }
    } catch (err) {
      toast({
        title: "Failed to load",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
      setMember(null);
      setDriverAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [membershipId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const memberIsDriver =
    member?.roleName.toLowerCase().includes("driver") ?? false;

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
      actions={
        member ? (
          <Button
            type="button"
            className="gap-2 rounded-md font-semibold shadow-sm"
            asChild
          >
            <Link href={`/app/company-team/${member.membershipId}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        ) : null
      }
    >
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : !member ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Member not found.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="flex min-w-0 flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {member.profile?.full_name ?? "—"}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{member.profile?.email ?? "—"}</span>
                {member.isOwner ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="inline-flex rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-medium text-sky-900 dark:bg-sky-500/14 dark:text-sky-200">
                      Owner
                    </span>
                  </>
                ) : null}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {member.isActive ? (
                  <span className="inline-flex rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-muted/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Inactive
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                    member.profile?.is_active
                      ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  Profile {member.profile?.is_active ? "active" : "inactive"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:gap-10">
            <SectionCard icon={UserRound} title="Profile">
              <InfoRow label="Email">
                {member.profile?.email ?? "—"}
              </InfoRow>
              <InfoRow label="Phone">
                {member.profile?.phone ?? "—"}
              </InfoRow>
              <InfoRow label="System role">
                {member.profile?.system_role ?? "—"}
              </InfoRow>
            </SectionCard>

            <SectionCard icon={Shield} title="Membership">
              <InfoRow label="Company role">{member.roleName}</InfoRow>
              <InfoRow label="Joined">{formatDt(member.joinedAt)}</InfoRow>
              <InfoRow label="Invited">{formatDt(member.invitedAt)}</InfoRow>
              <InfoRow label="Profile updated">
                {member.profile?.updated_at
                  ? formatDt(member.profile.updated_at)
                  : "—"}
              </InfoRow>
            </SectionCard>
          </div>

          {memberIsDriver ? (
            <SectionCard icon={MapPin} title="Driver">
              <InfoRow label="Rate">
                {member.driverRate != null && Number.isFinite(member.driverRate)
                  ? Number(member.driverRate).toLocaleString()
                  : "—"}
              </InfoRow>
              <div className="space-y-1">
                <p className={fieldLabelClass}>Assigned locations</p>
                {driverAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    None linked. Assign from{" "}
                    <Link
                      href="/app/locations"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      Locations
                    </Link>{" "}
                    → location → Drivers.
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
          ) : null}
        </div>
      )}
    </AppPageShell>
  );
}
