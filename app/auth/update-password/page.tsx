"use client";
export const dynamic = "force-dynamic";
import type React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import {
  authInputClass,
  authLabelClass,
  authMutedLinkClass,
  authPanelClass,
  authPrimaryButtonClass,
} from "@/lib/auth-ui";

export default function UpdatePasswordPage() {
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session) {
        setErrors({
          general:
            "Recovery link is invalid or expired. Please request a new reset email.",
        });
      }
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
    if (!validate()) return;

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      toast({
        title: "Password updated",
        description:
          "Your password has been reset successfully. Please sign in.",
      });

      router.replace("/auth/login");
    } catch (err: unknown) {
      setErrors((prev) => ({
        ...prev,
        general:
          err instanceof Error ? err.message : "Something went wrong.",
      }));
    } finally {
      setIsLoading(false);
    }
  };

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
        <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
        <p className="mt-2 text-sm text-white/60">
          Enter and confirm your new password to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {!ready ? (
          <p className="text-center text-sm text-white/50">
            Checking recovery session…
          </p>
        ) : errors.general ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {errors.general}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="password" className={authLabelClass}>
                New password
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
                Confirm new password
              </Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={`${authInputClass} pr-10 ${errors.confirm ? "border-red-500" : ""}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
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
          </>
        )}

        <Button
          type="submit"
          className={authPrimaryButtonClass}
          disabled={isLoading || !!errors.general || !ready}
        >
          {isLoading ? "Updating…" : "Update password"}
        </Button>

        <Link
          href="/auth/login"
          className={`flex items-center justify-center gap-2 ${authMutedLinkClass}`}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
