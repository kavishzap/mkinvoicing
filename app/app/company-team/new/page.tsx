"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";
import { useToast } from "@/hooks/use-toast";
import { listCompanyRoles, type CompanyRole } from "@/lib/company-roles-service";
import { createTeamMember } from "@/lib/company-team-service";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      compact
      className="max-w-lg"
      leading={
        <Link href="/app/company-team">
          <Button variant="ghost" size="icon" aria-label="Back to team">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
      subtitle="Invite a colleague by email—they choose their own password."
    >
      <Card>
        <CardHeader>
          <CardTitle>Invite team member</CardTitle>
          <CardDescription>
            Supabase sends an email with a link to set their password (same flow as your invite
            page).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRoles ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading roles…
            </div>
          ) : roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add at least one company role under{" "}
              <Link href="/app/settings" className="text-primary underline underline-offset-2">
                Company Settings
              </Link>{" "}
              (Roles), then invite team members here.
            </p>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Full name</Label>
                <Input
                  id="invite-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-phone">Phone</Label>
                <Input
                  id="invite-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="E.164 e.g. +2301234567"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-2">
                <Label>Company role</Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger>
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
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="outline" asChild>
                  <Link href="/app/company-team">Cancel</Link>
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Send invite
                    </>
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
