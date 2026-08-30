"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle2, Clock } from "lucide-react";
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
  const [otpCode, setOtpCode] = React.useState("");
  const [verifyingOtp, setVerifyingOtp] = React.useState(false);
  const [resendingOtp, setResendingOtp] = React.useState(false);
  const [otpError, setOtpError] = React.useState("");
  const [otpSuccessMessage, setOtpSuccessMessage] = React.useState("");
  const [timeLeft, setTimeLeft] = React.useState(600); // 10 minutes in seconds
  const [resendCooldown, setResendCooldown] = React.useState(60); // 60s cooldown
  const router = useRouter();

  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (success) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [success]);

  const formattedTimeLeft = React.useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [timeLeft]);

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) {
      setOtpError("Please enter the complete verification code.");
      return;
    }

    setVerifyingOtp(true);
    setOtpError("");
    setOtpSuccessMessage("");

    try {
      // 1. Verify OTP with Supabase client first
      const { data, error: supabaseError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpCode.trim(),
        type: "signup",
      });

      if (supabaseError) {
        // Fallback: Verify via Fastify backend endpoint
        const fetchRes = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            token: otpCode.trim(),
            type: "signup",
          }),
        });

        const fetchJson = (await fetchRes.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };

        if (!fetchRes.ok) {
          throw new Error(
            fetchJson.message ||
              fetchJson.error ||
              supabaseError.message ||
              "Invalid or expired verification code."
          );
        }
      }

      setOtpSuccessMessage("Email verified! Redirecting to login...");
      setTimeout(() => {
        router.push("/login?verified=true");
      }, 1200);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setOtpError(errorObj.message || "Failed to verify OTP.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    setResendingOtp(true);
    setOtpError("");
    setOtpSuccessMessage("");

    try {
      // 1. Resend via Supabase client
      const { error: supabaseError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
      });

      if (supabaseError) {
        // Fallback: Resend via Fastify API
        const fetchRes = await fetch(`${API_BASE_URL}/api/auth/resend-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            type: "signup",
          }),
        });

        const fetchJson = (await fetchRes.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };

        if (!fetchRes.ok) {
          throw new Error(
            fetchJson.message ||
              fetchJson.error ||
              supabaseError.message ||
              "Failed to resend OTP."
          );
        }
      }

      setTimeLeft(600);
      setResendCooldown(60);
      setOtpSuccessMessage("A fresh verification code has been sent to your email.");
    } catch (err: unknown) {
      const errorObj = err as Error;
      setOtpError(errorObj.message || "Failed to resend code.");
    } finally {
      setResendingOtp(false);
    }
  };

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
      const step = params.get("step");
      if (urlEmail) {
        setEmail(urlEmail);
      }
      if (step === "otp" || step === "verify") {
        setSuccess(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      setError("Please ensure your password meets all complexity requirements");
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
      // 1. Pre-validate name similarity with backend (80% - 100% duplicate protection)
      try {
        const checkData = (await apiFetch(
          `${API_BASE_URL}/api/auth/check-name`,
          {
            method: "POST",
            body: JSON.stringify({ name: name.trim() }),
            silent: true,
          }
        )) as { available?: boolean; matchPercent?: number };

        if (checkData && checkData.available === false) {
          setError(
            `The full name "${name}" is too similar to an existing account (${checkData.matchPercent}% match). For identity security, please use your distinct full name or include your middle initial.`
          );
          setLoading(false);
          return;
        }
      } catch {
        // Ignore pre-check failures and proceed
      }

      // 2. Pre-validate email similarity with backend (80% - 100% duplicate protection)
      try {
        const emailCheckData = (await apiFetch(
          `${API_BASE_URL}/api/auth/check-email-similarity`,
          {
            method: "POST",
            body: JSON.stringify({ email: email.trim() }),
            silent: true,
          }
        )) as { available?: boolean; matchPercent?: number };

        if (emailCheckData && emailCheckData.available === false) {
          setError(
            `The email "${email}" is too similar to an existing account (${emailCheckData.matchPercent}% match). If this is your account, please sign in. Otherwise, please use a distinct email address.`
          );
          setLoading(false);
          return;
        }
      } catch {
        // Ignore pre-check failures and proceed
      }

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
        <div className="p-6 text-sm text-foreground bg-card rounded-lg border border-border shadow-sm space-y-4">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="font-bold text-lg tracking-tight">
              Enter Verification Code
            </p>
            <p className="text-xs text-muted-foreground">
              We sent a verification code to <strong className="text-foreground">{email}</strong>. Enter it below to activate your account.
            </p>

            <div className="flex justify-center pt-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  timeLeft > 60
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                }`}
              >
                {timeLeft > 0 ? (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    Code expires in {formattedTimeLeft}
                  </>
                ) : (
                  <>⚠️ Code expired. Request a new one.</>
                )}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verification Code
            </label>
            <input
              type="text"
              maxLength={8}
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value.trim());
                if (otpError) setOtpError("");
              }}
              placeholder="12345678"
              className="flex h-12 w-full text-center text-xl tracking-[0.3em] font-mono rounded-md border border-input bg-transparent px-3 py-2 ring-offset-background placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={verifyingOtp}
              autoFocus
            />
          </div>

          {otpError && (
            <p className="text-xs text-red-600 font-medium text-center">{otpError}</p>
          )}

          {otpSuccessMessage && (
            <p className="text-xs text-emerald-600 font-medium text-center">{otpSuccessMessage}</p>
          )}

          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={verifyingOtp || otpCode.length < 6}
            className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center text-sm"
          >
            {verifyingOtp ? "Verifying Code..." : "Verify Code & Sign In"}
          </button>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            {resendCooldown > 0 ? (
              <span className="text-muted-foreground/70">
                Resend in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendingOtp}
                className="hover:text-foreground underline font-semibold text-primary transition-colors"
              >
                {resendingOtp ? "Sending..." : "Resend Code"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSuccess(false)}
              className="hover:text-foreground transition-colors"
            >
              Change Email
            </button>
          </div>
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
