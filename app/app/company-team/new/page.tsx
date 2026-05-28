"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Loader2, Plus, UserRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormTwoColumnPageSkeleton } from "@/components/page-skeletons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { listCompanyRoles, type CompanyRole } from "@/lib/company-roles-service";
import {
  createTeamMember,
  getCompanyTeamSeatUsage,
  type CompanyTeamSeatUsage,
} from "@/lib/company-team-service";

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

export default function CompanyTeamInvitePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [seatUsage, setSeatUsage] = useState<CompanyTeamSeatUsage | null>(null);
  const [loadingSeats, setLoadingSeats] = useState(true);

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const roleList = await listCompanyRoles();
      const active = roleList.filter((r) => r.is_active);
      setRoles(active);
      setRoleId((prev) => {
        if (prev && active.some((r) => r.id === prev)) return prev;
        return active[0]?.id ?? "";
      });
    } catch (err) {
      toast({
        title: "Failed to load roles",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingRoles(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSeats(true);
      try {
        const seats = await getCompanyTeamSeatUsage();
        if (!cancelled) setSeatUsage(seats);
      } catch {
        if (!cancelled) setSeatUsage(null);
      } finally {
        if (!cancelled) setLoadingSeats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inviteBlocked = seatUsage?.canInvite === false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inviteBlocked) {
      toast({
        title: "Team limit reached",
        description: seatUsage
          ? `You are using ${seatUsage.currentCount} of ${seatUsage.effectiveLimit} seats.`
          : "Cannot invite more members on your current plan.",
        variant: "destructive",
      });
      return;
    }
    if (!fullName.trim() || !email.trim() || !roleId) {
      toast({
        title: "Missing fields",
        description: "Fill name, email, and role.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await createTeamMember({
        email: email.trim(),
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        role_id: roleId,
      });
      toast({
        title: "Invitation sent",
        description:
          "They will receive an email to set their password and activate their account.",
      });
      router.push("/app/company-team");
    } catch (err) {
      toast({
        title: "Could not send invite",
        description: err instanceof Error ? err.message : "Try again.",
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
        <Button variant="ghost" size="icon" asChild aria-label="Back to team">
          <Link href="/app/company-team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      }
      actions={
        <Button
          type="submit"
          form="company-team-invite-form"
          disabled={
            saving ||
            loadingRoles ||
            loadingSeats ||
            roles.length === 0 ||
            inviteBlocked
          }
          className="gap-2 rounded-md font-semibold shadow-sm"
        >
          {saving ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-3.5 shrink-0" aria-hidden />
          )}
          {saving ? "Sending…" : "Send invite"}
        </Button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6">
        {inviteBlocked && seatUsage ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Team member limit reached ({seatUsage.currentCount} of{" "}
            {seatUsage.effectiveLimit} seats). Remove a member from the team list
            or upgrade your plan before sending new invites.
          </p>
        ) : null}
        {loadingRoles ? (
          <FormTwoColumnPageSkeleton withLineItems={false} />
        ) : roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add at least one company role under{" "}
            <Link
              href="/app/settings"
              className="text-primary underline underline-offset-2"
            >
              Company Settings
            </Link>{" "}
            (Roles), then invite team members here.
          </p>
        ) : (
          <form
            id="company-team-invite-form"
            onSubmit={(e) => void handleSubmit(e)}
            className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:max-w-2xl"
          >
            <SectionCard icon={UserRound} title="Invitee">
              <div className="space-y-2">
                <ReqLabel htmlFor="invite-name">Full name</ReqLabel>
                <Input
                  id="invite-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <ReqLabel htmlFor="invite-email">Email</ReqLabel>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-phone" className={fieldLabelClass}>
                  Phone
                </Label>
                <Input
                  id="invite-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="E.g. +230 5xx xx xx"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-2">
                <ReqLabel htmlFor="invite-role">Company role</ReqLabel>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger id="invite-role" className="h-8 w-full rounded-sm text-xs">
                    <SelectValue placeholder="Select role" />
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
            </SectionCard>
          </form>
        )}
      </div>
    </AppPageShell>
  );
}
