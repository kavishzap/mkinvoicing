"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { listCompanyRoles, type CompanyRole } from "@/lib/company-roles-service";
import { getTeamMember, updateTeamMember, type TeamMemberRow } from "@/lib/company-team-service";

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
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!membershipId) return;
    setLoading(true);
    try {
      const [m, roleList] = await Promise.all([getTeamMember(membershipId), listCompanyRoles()]);
      setMember(m);
      setRoles(roleList.filter((r) => r.is_active));
      if (m) {
        setFullName(m.profile?.full_name ?? "");
        setEmail(m.profile?.email ?? "");
        setPhone(m.profile?.phone ?? "");
        setRoleId(m.roleId);
        setActive(m.isActive);
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
    setSaving(true);
    try {
      await updateTeamMember(member.membershipId, {
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        roleId: member.isOwner ? undefined : roleId,
        membershipActive: member.isOwner ? undefined : active,
      });
      toast({ title: "Saved", description: "Team member updated." });
      router.push("/app/company-team");
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPageShell
      compact
      className="max-w-lg"
      leading={
        <Link href="/app/company-team">
          <Button variant="ghost" size="icon" aria-label="Back to team">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Update profile and membership for this team member."
    >
      <Card>
        <CardHeader>
          <CardTitle>Edit team member</CardTitle>
          <CardDescription>
            {member?.isOwner
              ? "Owner name is editable; company role is managed separately."
              : "Change role, contact details, or deactivate access."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : !member ? (
            <p className="text-sm text-muted-foreground">Member not found.</p>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full name</Label>
                <Input
                  id="edit-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {!member.isOwner && (
                <>
                  <div className="space-y-2">
                    <Label>Company role</Label>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger>
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
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm">Active in company</span>
                    <Switch checked={active} onCheckedChange={setActive} />
                  </div>
                </>
              )}
              {member.isOwner && (
                <p className="text-xs text-muted-foreground">
                  Owner name and role are managed separately.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="outline" asChild>
                  <Link href="/app/company-team">Cancel</Link>
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </AppPageShell>
  );
}
