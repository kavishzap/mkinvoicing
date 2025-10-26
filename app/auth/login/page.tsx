"use client";
export const dynamic = "force-dynamic";
import type React from "react";
import Image from "next/image";
import Logo from "../../../assets/semilogo.png";
import Logo1 from "../../../assets/finalogo.png";
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
import { supabase } from "@/lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react"; // ✅ added icons

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false); // ✅ added state
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsLoading(true);

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

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });

      router.push("/app/invoices");
    } catch (err: any) {
      toast({
        title: "Sign-in failed",
        description: err?.message ?? "Invalid email or password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-border/50 max-w-md mx-auto">
      {/* Brand Header */}
      <CardHeader className="space-y-2">
        <div className="flex flex-col items-center text-center">
          <div className="-mt-8">
            <Image
              src={Logo}
              alt="MK INVOICING Logo"
              width={80}
              height={80}
              className="object-contain w-24 h-24 md:w-48 md:h-48"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
          
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                type={showPwd ? "text" : "password"} // ✅ toggle type
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={validateForm}
                className={
                  errors.password ? "border-destructive pr-10" : "pr-10"
                }
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={showPwd ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-2 flex items-center px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPwd((s) => !s)} // ✅ toggle logic
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

          <div className="flex items-center justify-end mb-3">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="text-primary hover:underline font-medium"
            >
              Create account
            </Link>
          </p>
        </CardFooter>
      </form>
      <div className="flex flex-col items-center justify-center mt-4 mb-2">
        <span className="text-xs text-muted-foreground mb-1">Powered by</span>
        <Image
          src={Logo1} // replace if needed
          alt="Powered By Logo"
          width={80}
          height={80}
          className="object-contain"
        />
      </div>
    </Card>
  );
}
