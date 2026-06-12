"use client";

import * as React from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Mail, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

      if (resetError) {
        // Supabase rate-limits password resets (e.g. 1 per 60 seconds)
        if (resetError.status === 429) {
          throw new Error(
            "Please wait a minute before requesting another reset link.",
          );
        }
        throw new Error(resetError.message);
      }

      setSuccess(true);
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Password reset error:", errorObj);
      setError(errorObj.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-8 rounded-3xl flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <p className="text-xl font-black text-emerald-900 dark:text-emerald-400 mb-2">
            Check your email
          </p>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-500/80 max-w-[280px] mx-auto">
            We&apos;ve sent a password reset link to{" "}
            <span className="font-bold text-emerald-900 dark:text-emerald-300">
              {email}
            </span>
            .
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
          Reset password
        </h1>
        <p className="text-sm font-medium text-zinc-500">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 animate-in fade-in zoom-in-95 duration-300">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-rose-900 dark:text-rose-100">
              {error}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium transition-all"
              placeholder="name@example.com"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full flex items-center justify-center py-3.5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          {loading ? "Sending link..." : "Send reset link"}
        </button>
      </form>

      <div className="text-center pt-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </div>
    </div>
  );
}
