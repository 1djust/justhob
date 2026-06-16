"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

export function LoginForm() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [errorDetails, setErrorDetails] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [isInviteFlow, setIsInviteFlow] = React.useState(false);

  // MFA State
  const [mfaStep, setMfaStep] = React.useState<boolean>(false);
  const [mfaCode, setMfaCode] = React.useState("");
  const [factorId, setFactorId] = React.useState<string | null>(null);

  const [tempPassword, setTempPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showTempPassword, setShowTempPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const router = useRouter();

  const isManualLogin = React.useRef(false);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const strengthScore = password ? [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length : 0;

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get("email");
      if (urlEmail) {
        setEmail(urlEmail);
      }

      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorMsg = hashParams.get("error_description");
        if (errorMsg) {
          setError(errorMsg.replace(/\+/g, " "));
          // Clean hash to prevent showing it again on reload
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    }
  }, []);

  React.useEffect(() => {
    const initialHash =
      typeof window !== "undefined" ? window.location.hash : "";
    const hasHashParams =
      initialHash.includes("type=recovery") ||
      initialHash.includes("type=invite");
    const hasAccessToken = initialHash.includes("access_token=");
    const isRecoveryOrInviteViaUrl = hasHashParams && hasAccessToken;

    // Check if the user is already authenticated
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch fresh profile from sync/me to see if they must change password
        const meData = await apiFetch("/api/auth/me").catch(() => null) as { user?: { role?: string; mustChangePassword?: boolean } };
        if (meData?.user?.mustChangePassword && meData?.user?.role !== "PROPERTY_MANAGER") {
          setIsInviteFlow(true);
          setEmail(session.user.email || "");
          return;
        }

        if (isRecoveryOrInviteViaUrl) {
          setIsInviteFlow(true);
          setEmail(session.user.email || "");
          // Clean up the URL to prevent subsequent accidental redirects
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname);
          }
        } else {
          // If already logged in normally, skip login block and go straight to dashboard
          router.push("/dashboard");
        }
      }
    };
    checkSession();

    // Listen for auth state changes (Supabase processing the #access_token from the URL)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (event === "PASSWORD_RECOVERY") {
          setIsInviteFlow(true);
          setEmail(session.user.email || "");
        } else if (
          event === "SIGNED_IN" &&
          isRecoveryOrInviteViaUrl &&
          !isManualLogin.current
        ) {
          setIsInviteFlow(true);
          setEmail(session.user.email || "");
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname);
          }
        } else if (event === "SIGNED_IN" && isManualLogin.current) {
          // Manual login, do nothing here as handleSubmit handles redirect
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    isManualLogin.current = true;
    setLoading(true);
    setError("");

    try {
      const { data, error: sbError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (sbError || !data.user) {
        throw new Error(sbError?.message || "Failed to login");
      }

      // Check if MFA is required
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (
        !aalError &&
        aalData &&
        aalData.currentLevel === "aal1" &&
        aalData.nextLevel === "aal2"
      ) {
        const factors = data.user.factors || [];
        const totp = factors.find(
          (f: { factor_type: string; status: string; id: string }) => f.factor_type === "totp" && f.status === "verified",
        );
        if (totp) {
          setFactorId(totp.id);
          setMfaStep(true);
          setLoading(false);
          return; // Stop here, wait for MFA code
        }
      }

      // If no MFA required, proceed normally
      const syncData = await apiFetch("/api/auth/sync", {
        method: "POST",
      }) as { user?: { role?: string; globalRole?: string; mustChangePassword?: boolean } };

      if (syncData?.user?.globalRole === "SUPER_ADMIN") {
        await supabase.auth.signOut();
        throw new Error("Super Admin accounts must sign in through the Admin Portal.");
      }

      if (syncData?.user?.mustChangePassword === true && syncData?.user?.role !== "PROPERTY_MANAGER") {
        setTempPassword(password); // Pre-fill temporary password with the password they typed to log in
        setPassword(""); // Clear password field for new password entry
        setConfirmPassword("");
        setIsInviteFlow(true);
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const errorObj = err as Error & { details?: string | Record<string, unknown> };
      console.error("Login error:", errorObj);
      
      // Make sure we are signed out of Supabase local session on failure
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignore
      }

      setError(errorObj.message || "An unexpected error occurred");
      if (errorObj.details) {
        setErrorDetails(
          typeof errorObj.details === "string"
            ? errorObj.details
            : JSON.stringify(errorObj.details),
        );
      }
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !mfaCode || mfaCode.length !== 6) return;

    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: mfaCode,
      });

      if (error) {
        throw new Error(error.message || "Invalid code");
      }

      // Sync with Prisma backend
      const syncData = await apiFetch("/api/auth/sync", {
        method: "POST",
      }) as { user?: { role?: string; globalRole?: string; mustChangePassword?: boolean } };

      if (syncData?.user?.globalRole === "SUPER_ADMIN") {
        await supabase.auth.signOut();
        throw new Error("Super Admin accounts must sign in through the Admin Portal.");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("MFA error:", errorObj);
      
      // Make sure we are signed out of Supabase local session on failure
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignore
      }

      setError(errorObj.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!isPasswordValid) {
      setError("Please ensure your password meets all strength requirements.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("New passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      // 1. Verify the temporary password by attempting a sign in with it
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: tempPassword,
      });

      if (verifyError) {
        throw new Error("The temporary password you entered is incorrect.");
      }

      // 2. Set the permanent password and clear the mustChangePassword flag in user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: { mustChangePassword: false },
      });

      if (updateError) {
        throw new Error(updateError.message || "Failed to set password");
      }

      // 3. Sync with Prisma backend
      await apiFetch("/api/auth/sync", {
        method: "POST",
      });

      router.push("/dashboard");
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Password setup error:", errorObj);
      setError(errorObj.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInviteFlow = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setIsInviteFlow(false);
      setEmail("");
      setTempPassword("");
      setPassword("");
      setConfirmPassword("");
      setShowTempPassword(false);
      setShowConfirmPassword(false);
      setError("");
    } catch (err) {
      console.error("Logout failed during cancel flow:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) throw error;
      setError("Confirmation email sent! Please check your inbox.");
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(
        errorObj.message || "Failed to resend confirmation",
      );
    } finally {
      setResending(false);
    }
  };

  if (isInviteFlow) {
    return (
      <form onSubmit={handleSetPassword} className="space-y-5">
        <div className="bg-emerald-500/10 border-l-4 border-emerald-500 text-emerald-700 dark:text-emerald-400 p-4 rounded-r-sm text-sm mb-6">
          <p className="font-bold tracking-tight">Email Verified Successfully! 🎉</p>
          <p className="mt-1 opacity-90">
            Please verify your temporary password and set a new permanent password to complete your setup.
          </p>
        </div>

        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-500/10 rounded-sm border-l-4 border-red-500 space-y-2">
            <p className="font-bold">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="flex h-12 w-full rounded-sm border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-4 py-2 text-sm text-zinc-500 cursor-not-allowed"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">
            Temporary Password
          </label>
          <div className="relative">
            <input
              type={showTempPassword ? "text" : "password"}
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              placeholder="Enter the password assigned to you"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowTempPassword(!showTempPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-emerald-600 transition-colors"
            >
              {showTempPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">
            Create a New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              placeholder="Minimum 8 characters"
              required
              minLength={8}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-emerald-600 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {password && (
            <div className="space-y-2.5 mt-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-medium dark:text-zinc-400">Password Strength:</span>
                <span className={`font-bold ${
                  strengthScore <= 2 ? "text-red-500" :
                  strengthScore === 3 ? "text-amber-500" :
                  strengthScore === 4 ? "text-emerald-500/80" : "text-emerald-500"
                }`}>
                  {strengthScore <= 2 ? "Weak" :
                   strengthScore === 3 ? "Fair" :
                   strengthScore === 4 ? "Good" : "Strong"}
                </span>
              </div>
              
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index <= strengthScore
                        ? strengthScore <= 2
                          ? "bg-red-500"
                          : strengthScore === 3
                          ? "bg-amber-500"
                          : strengthScore === 4
                          ? "bg-emerald-500/80"
                          : "bg-emerald-500"
                        : "bg-zinc-200 dark:bg-zinc-800"
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1.5 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-900 mt-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-700"}`} />
                  <span className={hasMinLength ? "text-zinc-800 dark:text-zinc-200 font-medium" : ""}>8+ chars</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasUppercase ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-700"}`} />
                  <span className={hasUppercase ? "text-zinc-800 dark:text-zinc-200 font-medium" : ""}>1 Uppercase</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasLowercase ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-700"}`} />
                  <span className={hasLowercase ? "text-zinc-800 dark:text-zinc-200 font-medium" : ""}>1 Lowercase</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasNumber ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-700"}`} />
                  <span className={hasNumber ? "text-zinc-800 dark:text-zinc-200 font-medium" : ""}>1 Number</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasSpecial ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-700"}`} />
                  <span className={hasSpecial ? "text-zinc-800 dark:text-zinc-200 font-medium" : ""}>1 Special char</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              placeholder="Re-enter your new password"
              required
              minLength={8}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-emerald-600 transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !isPasswordValid || !tempPassword || !confirmPassword || password !== confirmPassword}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 w-full mt-6 shadow-sm"
        >
          {loading ? "Setting Password..." : "Save Password & Continue"}
        </button>

        <button
          type="button"
          onClick={handleCancelInviteFlow}
          disabled={loading}
          className="w-full text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium transition-colors mt-4 text-center block"
        >
          Sign Out / Use another account
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={mfaStep ? handleMfaSubmit : handleSubmit}
      className="space-y-5"
    >
      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-500/10 rounded-sm border-l-4 border-red-500 space-y-2">
          <p className="font-bold tracking-tight">{error}</p>
          {errorDetails && (
            <p className="text-xs opacity-80 font-mono mt-1 pt-2 border-t border-red-500/20">
              {errorDetails}
            </p>
          )}
          {!mfaStep && (error.toLowerCase().includes("email") || error.toLowerCase().includes("credential")) && (
            <div className="pt-3 mt-3 border-t border-red-500/10">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="text-xs font-bold underline hover:no-underline block text-zinc-700 dark:text-zinc-300"
              >
                {resending
                  ? "Sending..."
                  : "Didn't receive a confirmation email? Resend"}
              </button>
            </div>
          )}
        </div>
      )}

      {mfaStep ? (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          <div className="p-5 bg-zinc-100 dark:bg-zinc-900 border-l-4 border-emerald-500 rounded-sm mb-4">
            <h3 className="font-bold tracking-tight text-zinc-900 dark:text-white mb-1">
              Two-Factor Authentication
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Open your authenticator app and enter the 6-digit code.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">
              Authentication Code
            </label>
            <input
              type="text"
              value={mfaCode}
              onChange={(e) =>
                setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xl text-center font-mono tracking-[0.5em] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              placeholder="000000"
              required
              disabled={loading}
              autoComplete="one-time-code"
            />
          </div>

          <button
            type="submit"
            disabled={loading || mfaCode.length !== 6}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 w-full mt-6 shadow-sm"
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMfaStep(false);
              setMfaCode("");
            }}
            disabled={loading}
            className="w-full text-sm text-zinc-500 hover:text-emerald-700 dark:hover:text-emerald-400 font-bold transition-colors mt-2"
          >
            Cancel and go back
          </button>
        </div>
      ) : (
        <>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>
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

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 w-full mt-6 shadow-sm"
          >
            {loading ? "Logging in..." : "Sign In"}
          </button>

          <div className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-primary hover:underline font-medium transition-colors"
            >
              Sign up
            </Link>
          </div>
        </>
      )}
    </form>
  );
}
