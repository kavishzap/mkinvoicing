"use client";
export const dynamic = "force-dynamic";
import type React from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = () => {
    if (!email) {
      setError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail()) return;

    setIsLoading(true);

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/update-password`,
        }
      );

      if (resetErr) {
        throw resetErr;
      }

      toast({
        title: "Reset link sent",
        description:
          "If this email exists, we've sent a reset link to your inbox.",
      });

      router.push("/auth/login");
    } catch (err: unknown) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Something went wrong.",
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
        <h1 className="text-2xl font-bold tracking-tight">Forgot password?</h1>
        <p className="mt-2 text-sm text-white/60">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
            onBlur={validateEmail}
            className={`${authInputClass} ${error ? "border-red-500" : ""}`}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <Button
          type="submit"
          className={authPrimaryButtonClass}
          disabled={isLoading}
        >
          {isLoading ? "Sending…" : "Send reset link"}
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
