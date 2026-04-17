"use client";

export const dynamic = "force-dynamic";

import type React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import Logo from "@/lib/ChatGPT_Image_Mar_16__2026__10_42_30_PM-removebg-preview.png";

function hashParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = window.location.hash.replace(/^#/, "");
  return Object.fromEntries(new URLSearchParams(raw));
}

async function activateProfileRow(userId: string) {
  const now = new Date().toISOString();
  const { error: directErr } = await supabase
    .from("user_profiles")
    .update({ is_active: true, updated_at: now })
    .eq("id", userId);

  if (!directErr) return;

  const { error: rpcErr } = await supabase.rpc("complete_user_invite");
  if (!rpcErr) return;

  throw new Error(
    `Could not activate your profile (${directErr.message}). RPC: ${rpcErr.message ?? "complete_user_invite failed"}.`
  );
}

export default function InviteAcceptPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirm?: string;
    general?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  /** undefined = still resolving session from invite link */
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;

    const timeout = window.setTimeout(() => {
      if (!alive) return;
      setSession((s) => (s === undefined ? null : s));
    }, 4000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      if (event === "INITIAL_SESSION") {
        window.clearTimeout(timeout);
        setSession(next ?? null);
        return;
      }
      if (event === "SIGNED_IN" && next) {
        window.clearTimeout(timeout);
        setSession(next);
      }
    });

    return () => {
      alive = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session === undefined || session) return;
    const p = hashParams();
    if (p.access_token || p.type === "invite") {
      setErrors({
        general:
          "Invite link is invalid or expired. Ask an admin to send a new invite.",
      });
    } else {
      setErrors({
        general:
          "No invite session found. Open the link from your invite email.",
      });
    }
  }, [session]);

  const validate = () => {
    const next: typeof errors = {};
    if (!password) next.password = "Password is required";
    else if (password.length < 8)
      next.password = "Password must be at least 8 characters";
    if (!confirm) next.confirm = "Please confirm your password";
    else if (password !== confirm) next.confirm = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !session?.user?.id) return;

    try {
      setIsLoading(true);
      const { error: pwdErr } = await supabase.auth.updateUser({ password });
      if (pwdErr) throw pwdErr;

      await activateProfileRow(session.user.id);

      if (typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        );
      }

      toast({
        title: "Welcome",
        description: "Your password is set and your account is active. Sign in to continue.",
      });

      router.replace("/auth/login");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setErrors((prev) => ({ ...prev, general: message }));
    } finally {
      setIsLoading(false);
    }
  };

  const ready = session !== undefined;
  const blocked = !!errors.general && !session;

  return (
    <Card className="shadow-lg border-border/50 max-w-md mx-auto">
      <CardHeader className="space-y-2">
        <div className="flex flex-col items-center text-center">
          <div className="pt-6 pb-2">
            <div className="flex items-center gap-2">
              <Image
                src={Logo}
                alt="MoLedger logo"
                width={32}
                height={32}
                className="rounded-md shadow-sm"
                priority
              />
              <span className="text-3xl font-bold tracking-tight">MoLedger</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Accept your invite</CardTitle>
          <CardDescription>
            Choose a password to finish setting up your account
          </CardDescription>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          {!ready ? (
            <p className="text-sm text-muted-foreground">Loading invite…</p>
          ) : blocked ? (
            <div className="text-sm text-destructive">{errors.general}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={
                      errors.password ? "border-destructive pr-10" : "pr-10"
                    }
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-2 flex items-center px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPwd((s) => !s)}
                  >
                    {showPwd ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={
                      errors.confirm ? "border-destructive pr-10" : "pr-10"
                    }
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirm ? "Hide password" : "Show password"
                    }
                    className="absolute inset-y-0 right-2 flex items-center px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm((s) => !s)}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirm && (
                  <p className="text-sm text-destructive">{errors.confirm}</p>
                )}
              </div>

              {errors.general ? (
                <div className="text-sm text-destructive">{errors.general}</div>
              ) : null}
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 mt-3">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || blocked || !session || !ready}
          >
            {isLoading ? "Saving…" : "Activate account"}
          </Button>

          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </CardFooter>
      </form>
      <div className="flex flex-col items-center justify-center mt-4 mb-2">
        <span className="text-xs text-muted-foreground">MoLedger</span>
      </div>
    </Card>
  );
}
