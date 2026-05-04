"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { getTeamMember, type TeamMemberRow } from "@/lib/company-team-service";

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

  const load = useCallback(async () => {
    if (!membershipId) return;
    setLoading(true);
    try {
      const m = await getTeamMember(membershipId);
      setMember(m);
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

  return (
    <AppPageShell
      compact
      className="max-w-2xl"
      leading={
        <Link href="/app/company-team">
          <Button variant="ghost" size="icon" aria-label="Back to team">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Team member details for this company."
      actions={
        member ? (
          <Button type="button" variant="default" className="gap-2 shrink-0" asChild>
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
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {member.profile?.full_name ?? "—"}
                {member.isOwner ? (
                  <Badge variant="secondary">Owner</Badge>
                ) : null}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">Email</span>
              <span className="col-span-2">{member.profile?.email ?? "—"}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">Phone</span>
              <span className="col-span-2">{member.profile?.phone ?? "—"}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">Avatar</span>
              <span className="col-span-2 break-all">
                {member.profile?.avatar_url ?? "—"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">System role</span>
              <span className="col-span-2">{member.profile?.system_role ?? "—"}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">Profile active</span>
              <span className="col-span-2">{member.profile?.is_active ? "Yes" : "No"}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">Company role</span>
              <span className="col-span-2">{member.roleName}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">Membership</span>
              <span className="col-span-2">
                {member.isActive ? (
                  <Badge variant="outline">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">Joined</span>
              <span className="col-span-2">{formatDt(member.joinedAt)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">Invited</span>
              <span className="col-span-2">{formatDt(member.invitedAt)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">Profile updated</span>
              <span className="col-span-2">
                {member.profile?.updated_at ? formatDt(member.profile.updated_at) : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </AppPageShell>
  );
}
