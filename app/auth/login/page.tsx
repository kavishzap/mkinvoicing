"use client";
export const dynamic = "force-dynamic";
import type React from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
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
import {
  authInputClass,
  authLabelClass,
  authLinkClass,
  authMutedLinkClass,
  authPanelClass,
  authPrimaryButtonClass,
} from "@/lib/auth-ui";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

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
    const newErrors: {
      email?: string;
      password?: string;
      companyCode?: string;
    } = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    if (!companyCode.trim()) {
      newErrors.companyCode = "Company code is required";
    }

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

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const msg = error.message?.toLowerCase().includes("email not confirmed")
          ? "Please confirm your email before signing in."
          : error.message;
        throw new Error(msg);
      }

      const userId = data.user?.id;
      if (!userId) {
        await supabase.auth.signOut();
        clearActiveCompanyCache();
        throw new Error("Could not load your session. Please try again.");
      }

      const companyResult = await resolveCompanyIdForLogin(userId, companyCode);
      if ("error" in companyResult) {
        await supabase.auth.signOut();
        clearActiveCompanyCache();
        clearRoleFeaturesCache();
        throw new Error(companyResult.error);
      }

      setActiveCompanyCache(userId, companyResult.companyId);

      try {
        const roleFeatures = await getRoleFeatures(
          userId,
          companyResult.companyId
        );
        if (data.user) {
          await logLoginSessionDebug(
            data.user,
            companyResult.companyId,
            roleFeatures
          );
        }
      } catch {
        /* non-fatal – provider will retry */
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });

      router.push("/app");
    } catch (err: unknown) {
      toast({
        title: "Sign-in failed",
        description:
          err instanceof Error ? err.message : "Invalid email or password.",
        variant: "destructive",
      });
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
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-white/60">
          Enter your credentials to access your account
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company-code" className={authLabelClass}>
            Company code
          </Label>
          <Input
            id="company-code"
            type="text"
            placeholder="Your organization code"
            value={companyCode}
            onChange={(e) => setCompanyCode(e.target.value)}
            onBlur={validateForm}
            className={`${authInputClass} ${errors.companyCode ? "border-red-500" : ""}`}
            autoComplete="organization"
            spellCheck={false}
          />
          {errors.companyCode && (
            <p className="text-sm text-red-400">{errors.companyCode}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className={authLabelClass}>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={validateForm}
            className={`${authInputClass} ${errors.email ? "border-red-500" : ""}`}
            autoComplete="email"
          />
          {errors.email && (
            <p className="text-sm text-red-400">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className={authLabelClass}>
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={validateForm}
              className={`${authInputClass} pr-10 ${errors.password ? "border-red-500" : ""}`}
              autoComplete="current-password"
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

        <div className="flex justify-end">
          <Link href="/auth/forgot-password" className={authLinkClass}>
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className={authPrimaryButtonClass}
          disabled={isLoading}
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-center text-sm text-white/55">
          Don&apos;t have an account?{" "}
          <Link
            href="https://mojhoa.com"
            className="font-medium text-[#00f2ff] underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact admin
          </Link>
        </p>

        <Link
          href="/main"
          className={`flex items-center justify-center gap-2 ${authMutedLinkClass}`}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Back to home
        </Link>
      </form>
    </div>
  );
}
