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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import {
  authInputClass,
  authLabelClass,
  authPanelClass,
  authPrimaryButtonClass,
} from "@/lib/auth-ui";

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
    <div className={authPanelClass}>
          <div className="mb-6 flex flex-col items-center text-center">
            <Link
              href="/main"
              className="mb-5 inline-flex flex-col items-center gap-2 transition-opacity hover:opacity-90"
            >
              <Image
                src="/logo2.png"
                alt="MoLedger"
                width={160}
                height={160}
                className="h-11 w-auto object-contain sm:h-12"
                priority
              />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Accept your invite</h1>
            <p className="mt-2 text-sm text-white/60">
              Choose a password to finish setting up your account
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {!ready ? (
              <p className="text-center text-sm text-white/50">Loading invite…</p>
            ) : blocked ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {errors.general}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password" className={authLabelClass}>
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${authInputClass} pr-10 ${errors.password ? "border-red-500" : ""}`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      aria-label={showPwd ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-2 flex items-center px-2 text-white/50 hover:text-white"
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
                    <p className="text-sm text-red-400">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm" className={authLabelClass}>
                    Confirm password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={`${authInputClass} pr-10 ${errors.confirm ? "border-red-500" : ""}`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      aria-label={
                        showConfirm ? "Hide password" : "Show password"
                      }
                      className="absolute inset-y-0 right-2 flex items-center px-2 text-white/50 hover:text-white"
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
                    <p className="text-sm text-red-400">{errors.confirm}</p>
                  )}
                </div>

                {errors.general ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {errors.general}
                  </div>
                ) : null}
              </>
            )}

            <Button
              type="submit"
              className={`mt-2 ${authPrimaryButtonClass}`}
              disabled={isLoading || blocked || !session || !ready}
            >
              {isLoading ? "Saving…" : "Activate account"}
            </Button>

            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </form>
    </div>
  );
}
