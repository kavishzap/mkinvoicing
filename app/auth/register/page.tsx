"use client";
export const dynamic = "force-dynamic";
import type React from "react";
import Image from "next/image";
import Logo from "../../../assets/logo.png";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient"; // ✅ add your supabase client

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

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";

    if (!formData.email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Please enter a valid email";

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";

    if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
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

      // 👇 Supabase registration
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
          emailRedirectTo: `${window.location.origin}/auth/login`, // where verification link lands (if enabled)
        },
      });

      if (error) {
        throw error;
      }

      // If email confirmations are enabled in Supabase, user must verify first.
      // If disabled, they can sign in immediately.
      const emailConfirmOn = true; // set this to match your Supabase Auth settings if you want to customize the message

      toast({
        title: "Account created!",
        description: emailConfirmOn
          ? "Check your email to confirm your account, then sign in."
          : "Your account has been created successfully. Please sign in.",
      });

      router.push("/auth/login");
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err?.message ?? "Something went wrong while creating your account.",
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
    <Card className="shadow-lg border-border/50 max-w-md mx-auto">
      {/* Brand Header */}
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
          <CardTitle className="text-2xl font-bold">Create account</CardTitle>
          <CardDescription className="max-w-sm">
            <span className="text-foreground/80 font-medium">MK INVOICING</span> : Modern invoicing made simple
          </CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                onBlur={validateForm}
                className={errors.firstName ? "border-destructive" : ""}
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                onBlur={validateForm}
                className={errors.lastName ? "border-destructive" : ""}
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={validateForm}
              className={errors.email ? "border-destructive" : ""}
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? "text" : "password"}
                placeholder="Create a password (min. 8 characters)"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={validateForm}
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
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2 mb-4">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPwd ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                onBlur={validateForm}
                className={errors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={showConfirmPwd ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-2 flex items-center px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPwd((s) => !s)}
              >
                {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
