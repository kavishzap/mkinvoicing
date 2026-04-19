"use client";

import type React from "react";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import {
  clearActiveCompanyCache,
  resolveCompanyIdForLogin,
  setActiveCompanyCache,
} from "@/lib/active-company";
import {
  clearRoleFeaturesCache,
  getRoleFeatures,
} from "@/lib/role-features-service";
import { logLoginSessionDebug } from "@/lib/login-session-debug-log";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    companyCode?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; companyCode?: string } = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Please enter a valid email";
    if (!password) newErrors.password = "Password is required";
    if (!companyCode.trim()) newErrors.companyCode = "Company code is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      clearActiveCompanyCache();
      clearRoleFeaturesCache();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const msg = error.message?.toLowerCase().includes("email not confirmed")
          ? "Please confirm your email before signing in."
          : error.message;
        throw new Error(msg);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        await supabase.auth.signOut();
        clearActiveCompanyCache();
        throw new Error("Could not load your session. Please try again.");
      }

      const companyResult = await resolveCompanyIdForLogin(user.id, companyCode);
      if ("error" in companyResult) {
        await supabase.auth.signOut();
        clearActiveCompanyCache();
        clearRoleFeaturesCache();
        throw new Error(companyResult.error);
      }

      setActiveCompanyCache(user.id, companyResult.companyId);

      // Warm the role features cache so the sidebar renders immediately.
      try {
        const roleFeatures = await getRoleFeatures(
          user.id,
          companyResult.companyId
        );
        await logLoginSessionDebug(user, companyResult.companyId, roleFeatures);
      } catch {
        /* non-fatal – provider will retry */
      }

      toast({ title: "Welcome back!", description: "You have successfully signed in." });
      onOpenChange(false);
      router.push("/app");
    } catch (err: unknown) {
      toast({
        title: "Sign-in failed",
        description: err instanceof Error ? err.message : "Invalid email or password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrors({ email: "Email is required" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: "Please enter a valid email" });
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/update-password`,
      });
      if (error) throw error;
      toast({ title: "Reset link sent", description: "If this email exists, we've sent a reset link to your inbox." });
      setMode("login");
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) setMode("login");
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-white/10 bg-[#0d0d12] text-white sm:max-w-md [&>button]:text-white/70 [&>button]:hover:text-white">
        {mode === "login" ? (
          <>
            <DialogHeader>
              <div className="flex flex-col items-center text-center">
                <Image
                  src="/logo2.png"
                  alt="MoLedger"
                  width={112}
                  height={112}
                  className="mb-3 h-11 w-auto object-contain sm:mb-4 sm:h-12 sm:w-auto"
                />
                <DialogTitle className="text-2xl font-bold">Sign in</DialogTitle>
                <DialogDescription className="text-white/60">
                  Enter your credentials to access your account
                </DialogDescription>
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-company-code" className="text-white/90">Company Code</Label>
                <Input
                  id="login-company-code"
                  type="text"
                  placeholder="Your organization code"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  onBlur={validateForm}
                  className={`border-white/20 bg-[#06060a] text-white placeholder:text-white/40 focus-visible:ring-[#00f2ff] ${errors.companyCode ? "border-red-500" : ""}`}
                  autoComplete="organization"
                  spellCheck={false}
                />
                {errors.companyCode && (
                  <p className="text-sm text-red-400">{errors.companyCode}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-white/90">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={validateForm}
                  className={`border-white/20 bg-[#06060a] text-white placeholder:text-white/40 focus-visible:ring-[#00f2ff] ${errors.email ? "border-red-500" : ""}`}
                  autoComplete="email"
                />
                {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-white/90">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPwd ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={validateForm}
                    className={`border-white/20 bg-[#06060a] text-white placeholder:text-white/40 focus-visible:ring-[#00f2ff] pr-10 ${errors.password ? "border-red-500" : ""}`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-2 flex items-center px-2 text-white/50 hover:text-white"
                    onClick={() => setShowPwd((s) => !s)}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => setMode("forgot")} className="text-sm hover:underline" style={{ color: "#00f2ff" }}>
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                className="w-full rounded-full bg-[#00f2ff] text-black hover:bg-[#00f2ff]/90"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-col items-center text-center">
                <Image
                  src="/logo2.png"
                  alt="MoLedger"
                  width={112}
                  height={112}
                  className="mb-3 h-11 w-auto object-contain sm:mb-4 sm:h-12 sm:w-auto"
                />
                <DialogTitle className="text-2xl font-bold">Forgot password?</DialogTitle>
                <DialogDescription className="text-white/60">
                  Enter your email and we&apos;ll send you a reset link
                </DialogDescription>
              </div>
            </DialogHeader>

            <form onSubmit={handleForgotSubmit} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-white/90">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`border-white/20 bg-[#06060a] text-white placeholder:text-white/40 focus-visible:ring-[#00f2ff] ${errors.email ? "border-red-500" : ""}`}
                  autoComplete="email"
                />
                {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
              </div>

              <Button
                type="submit"
                className="w-full rounded-full bg-[#00f2ff] text-black hover:bg-[#00f2ff]/90"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send reset link"}
              </Button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className="flex w-full items-center justify-center gap-2 text-sm text-white/60 hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
