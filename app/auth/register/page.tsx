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
  authInputClass,
  authLabelClass,
  authMutedLinkClass,
  authPanelClass,
  authPrimaryButtonClass,
} from "@/lib/auth-ui";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";

    if (!formData.email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Please enter a valid email";

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";

    if (!formData.confirmPassword)
      newErrors.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsLoading(true);

      const { email, password, firstName, lastName } = formData;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
          emailRedirectTo: `${window.location.origin}/auth/login`,
        },
      });

      if (error) {
        throw error;
      }

      const emailConfirmOn = true;

      toast({
        title: "Account created!",
        description: emailConfirmOn
          ? "Check your email to confirm your account, then sign in."
          : "Your account has been created successfully. Please sign in.",
      });

      router.push("/auth/login");
    } catch (err: unknown) {
      toast({
        title: "Registration failed",
        description:
          err instanceof Error
            ? err.message
            : "Something went wrong while creating your account.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
        <h1 className="text-2xl font-bold tracking-tight">Register</h1>
        <p className="mt-2 text-sm text-white/60">
          Create an account to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" className={authLabelClass}>
              First name
            </Label>
            <Input
              id="firstName"
              placeholder="John"
              value={formData.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              onBlur={validateForm}
              className={`${authInputClass} ${errors.firstName ? "border-red-500" : ""}`}
            />
            {errors.firstName && (
              <p className="text-sm text-red-400">{errors.firstName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className={authLabelClass}>
              Last name
            </Label>
            <Input
              id="lastName"
              placeholder="Doe"
              value={formData.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              onBlur={validateForm}
              className={`${authInputClass} ${errors.lastName ? "border-red-500" : ""}`}
            />
            {errors.lastName && (
              <p className="text-sm text-red-400">{errors.lastName}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className={authLabelClass}>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
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
              placeholder="Create a password (min. 8 characters)"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              onBlur={validateForm}
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
          <Label htmlFor="confirmPassword" className={authLabelClass}>
            Confirm password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPwd ? "text" : "password"}
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) =>
                handleChange("confirmPassword", e.target.value)
              }
              onBlur={validateForm}
              className={`${authInputClass} pr-10 ${errors.confirmPassword ? "border-red-500" : ""}`}
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={showConfirmPwd ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-2 flex items-center px-2 text-white/50 hover:text-white"
              onClick={() => setShowConfirmPwd((s) => !s)}
            >
              {showConfirmPwd ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-400">{errors.confirmPassword}</p>
          )}
        </div>

        <Button
          type="submit"
          className={authPrimaryButtonClass}
          disabled={isLoading}
        >
          {isLoading ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-sm text-white/55">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-[#00f2ff] underline-offset-2 hover:underline"
          >
            Sign in
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
