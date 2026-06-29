"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";
import { apiFetch, API_BASE_URL } from "@/lib/api";

/**
 * Utility function to merge tailwind classes
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function RegisterForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [_errorDetails] = React.useState("");
  const [success, setSuccess] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [consent, setConsent] = React.useState(false);
  const router = useRouter();

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid =
    hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get("email");
      if (urlEmail) {
        setEmail(urlEmail);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      setError("Please ensure your password meets all requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!consent) {
      setError("You must agree to the Terms and Privacy Policy");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: sbError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (sbError || !data.user) {
        throw new Error(sbError?.message || "Failed to register");
      }

      // Sync with Prisma backend
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // Email confirmation is likely required
        setSuccess(true);
        return;
      }

      await apiFetch(`${API_BASE_URL}/api/auth/sync`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      router.push("/dashboard");
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Registration error:", errorObj);
      setError(errorObj.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-500/10 rounded-sm border-l-4 border-red-500 space-y-1">
          <p className="font-bold tracking-tight">{error}</p>
          {_errorDetails && (
            <p className="text-xs opacity-80 font-mono mt-1 pt-2 border-t border-red-500/20">
              {_errorDetails}
            </p>
          )}
        </div>
      )}

      {success && (
        <div className="p-5 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 rounded-sm border-l-4 border-emerald-500 text-center space-y-3">
          <p className="font-bold text-base tracking-tight">
            Registration Successful!
          </p>
          <p>
            Please check your email to confirm your account before logging in.
          </p>
          <Link
            href="/login"
            className="block text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline font-bold pt-2 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      )}

      {!success && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              placeholder="John Doe"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Company Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              placeholder="Use a company email for this process"
              required
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  required
                  disabled={loading}
                  placeholder={loading ? "••••••••" : ""}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
                    password && confirmPassword && password !== confirmPassword
                      ? "border-red-500 focus-visible:ring-red-500"
                      : "",
                  )}
                  required
                  disabled={loading}
                  placeholder={loading ? "••••••••" : ""}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-secondary/30 rounded-lg border border-border space-y-2.5 mt-2">
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2
                className={cn(
                  "w-4 h-4",
                  hasMinLength
                    ? "text-emerald-500"
                    : "text-muted-foreground/40",
                )}
              />
              <span
                className={cn(
                  hasMinLength
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                8 characters minimum
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2
                className={cn(
                  "w-4 h-4",
                  hasUppercase
                    ? "text-emerald-500"
                    : "text-muted-foreground/40",
                )}
              />
              <span
                className={cn(
                  hasUppercase
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                One uppercase letter
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2
                className={cn(
                  "w-4 h-4",
                  hasLowercase
                    ? "text-emerald-500"
                    : "text-muted-foreground/40",
                )}
              />
              <span
                className={cn(
                  hasLowercase
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                One lowercase letter
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2
                className={cn(
                  "w-4 h-4",
                  hasNumber ? "text-emerald-500" : "text-muted-foreground/40",
                )}
              />
              <span
                className={cn(
                  hasNumber
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                One number
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2
                className={cn(
                  "w-4 h-4",
                  hasSpecial ? "text-emerald-500" : "text-muted-foreground/40",
                )}
              />
              <span
                className={cn(
                  hasSpecial
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                One special character
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 mt-4 pt-2">
            <div className="flex items-center h-5 mt-0.5">
              <input
                id="consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-4 h-4 border border-input rounded bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
              />
            </div>
            <label
              htmlFor="consent"
              className="text-sm text-muted-foreground leading-snug cursor-pointer"
            >
              By submitting this form, you consent to PropertyStack&apos;s{" "}
              <Link
                href="#"
                className="text-primary hover:underline font-medium"
              >
                Terms
              </Link>{" "}
              and the use of your contact information in accordance with our{" "}
              <Link
                href="#"
                className="text-primary hover:underline font-medium"
              >
                Privacy Policy
              </Link>
              .
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !consent}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 w-full mt-6 shadow-sm"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <div className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary hover:underline font-medium transition-colors"
            >
              Sign In
            </Link>
          </div>
        </>
      )}
    </form>
  );
}
