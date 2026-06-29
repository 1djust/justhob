"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

export function AdminLoginForm() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [securityKey, setSecurityKey] = React.useState("");
  const [mfaCode, setMfaCode] = React.useState("");
  const [factorId, setFactorId] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (step === 1) {
        // 1. Authenticate with Supabase first
        const { data, error: sbError } = await supabase.auth.signInWithPassword(
          {
            email,
            password,
          },
        );

        if (sbError || !data.user) {
          throw new Error(sbError?.message || "Invalid login credentials");
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
            (f: { factor_type: string; status: string; id: string }) =>
              f.factor_type === "totp" && f.status === "verified",
          );
          if (totp) {
            setFactorId(totp.id);
            setStep(2); // Go to MFA step
            setLoading(false);
            return;
          }
        }

        // If no MFA required, go to Security Key step
        setStep(3);
      } else if (step === 2) {
        // 2. Verify MFA code
        if (!factorId || !mfaCode || mfaCode.length !== 6) return;

        const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: mfaCode,
        });

        if (mfaError) {
          throw new Error(mfaError.message || "Invalid 2FA code");
        }

        // Go to Security Key step
        setStep(3);
      } else {
        // 3. Sync and Verify with Backend using the Security Key
        const verifyResponse = await apiFetch("/api/admin/verify", {
          method: "POST",
          body: JSON.stringify({ securityKey }),
        });

        if (!verifyResponse.success) {
          await supabase.auth.signOut();
          setStep(1);
          throw new Error("Verification failed. Invalid Security Key.");
        }

        // Final sync to ensure everything is set up
        await apiFetch("/api/auth/sync", { method: "POST" });

        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Admin login error:", errorObj);
      setError(errorObj.message || "An unexpected error occurred");

      // If verification failed in step 2 or 3, sign out and reset
      if (step === 2 || step === 3) {
        await supabase.auth.signOut();
        setStep(1);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-rose-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-rose-600/20">
          <ShieldCheck className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
          Admin Portal
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm font-medium">
          Authorised Access Only
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-4 text-sm text-rose-500 bg-rose-500/10 rounded-2xl border border-rose-500/20 font-bold animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            <div className="space-y-2 animate-in fade-in duration-300">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">
                Admin Identity
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-12 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                placeholder="admin@propertystack.com"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2 animate-in fade-in duration-300">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-12 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 px-4 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                  required
                  disabled={loading}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-rose-500 transition-colors"
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
              className="flex items-center justify-center gap-2 rounded-2xl text-sm font-black transition-all bg-primary text-white hover:bg-primary/90 hover:scale-[1.02] h-14 w-full mt-6 shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Authentication
                </>
              )}
            </button>
          </>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="text-center">
              <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                Two-Factor Authentication
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Enter the 6-digit verification code from your authenticator app.
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                className="flex h-14 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 px-4 py-2 text-center text-2xl font-mono font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="flex items-center justify-center gap-2 rounded-2xl text-sm font-black transition-all bg-primary text-white hover:bg-primary/90 hover:scale-[1.02] h-14 w-full shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                "Verify 2FA PIN"
              )}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                await supabase.auth.signOut();
                setStep(1);
                setError("");
                setMfaCode("");
              }}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 w-full mt-4 text-center font-semibold block"
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {step === 3 && (
          <>
            <div className="space-y-2 animate-in fade-in duration-300">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 ml-1">
                Security Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={securityKey}
                  onChange={(e) => setSecurityKey(e.target.value)}
                  className="flex h-12 w-full rounded-2xl border border-rose-200 dark:border-rose-900/30 bg-white/50 dark:bg-zinc-900/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-mono"
                  required
                  disabled={loading}
                  placeholder="JH-SAFE-XXXX-X"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-2xl text-sm font-black transition-all bg-rose-600 text-white hover:bg-rose-700 hover:scale-[1.02] h-14 w-full mt-6 shadow-lg shadow-rose-600/20 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Unlock System
                </>
              )}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                await supabase.auth.signOut();
                setStep(1);
                setError("");
                setSecurityKey("");
              }}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 w-full mt-4 text-center font-semibold block"
            >
              ← Back to Sign In
            </button>
          </>
        )}
      </form>

      <div className="mt-12 text-center">
        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-[0.2em]">
          Internal Access System v1.0
        </p>
      </div>
    </div>
  );
}
