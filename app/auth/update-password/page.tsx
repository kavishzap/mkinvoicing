"use cexport const dynamic = "force-dynamic";
export const revalidate = 0;
import type React from "react";
import Image from "next/image";
import Logo from  "../../../assets/logo.png";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";

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

export default function UpdatePasswordPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Ensure we have a recovery session from Supabase
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session) {
        setErrors({ general: "Recovery link is invalid or expired. Please request a new reset email." });
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
    else if (password.length < 8) next.password = "Password must be at least 8 characters";
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
        description: "Your password has been reset successfully. Please sign in.",
      });

      router.replace("/auth/login");
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, general: err?.message ?? "Something went wrong." }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-border/50 max-w-md mx-auto">
      {/* Logo / Header */}
      <CardHeader className="space-y-2">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="relative inline-flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-background ring-1 ring-border shadow-sm overflow-hidden">
              <Image
                src={Logo}
                alt="MK INVOICING Logo"
                width={80}
                height={80}
                className="object-contain w-24 h-24 md:w-24 md:h-24"
                priority
              />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Set a new password</CardTitle>
          <CardDescription>Enter and confirm your new password to continue</CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          {!ready ? (
            <p className="text-sm text-muted-foreground">Checking recovery session…</p>
          ) : errors.general ? (
            <div className="text-sm text-destructive">{errors.general}</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? "border-destructive pr-10" : "pr-10"}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-2 flex items-center px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPwd((s) => !s)}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={errors.confirm ? "border-destructive pr-10" : "pr-10"}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-2 flex items-center px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm((s) => !s)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 mt-3">
          <Button type="submit" className="w-full" disabled={isLoading || !!errors.general || !ready}>
            {isLoading ? "Updating..." : "Update password"}
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
    </Card>
  );
}