'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '@/lib/supabase';
import { apiFetch, API_BASE_URL } from '@/lib/api';

/**
 * Utility function to merge tailwind classes
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function RegisterForm() {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [errorDetails, setErrorDetails] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: sbError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        }
      });

      if (sbError || !data.user) {
        throw new Error(sbError?.message || 'Failed to register');
      }

      // Sync with Prisma backend
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Email confirmation is likely required
        setSuccess(true);
        return;
      }

      await apiFetch(`${API_BASE_URL}/api/auth/sync`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      router.push('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md border border-red-500/20 space-y-1">
          <p className="font-bold">{error}</p>
          {errorDetails && <p className="text-xs opacity-80 font-mono mt-1 pt-1 border-t border-red-500/20">{errorDetails}</p>}
        </div>
      )}

      {success && (
        <div className="p-4 text-sm text-green-500 bg-green-500/10 rounded-md border border-green-500/20 text-center space-y-2">
          <p className="font-bold text-base">Registration Successful!</p>
          <p>Please check your email to confirm your account before logging in.</p>
          <Link href="/login" className="block text-primary hover:underline font-medium pt-2">
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
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-50/50 dark:disabled:bg-zinc-900/50 disabled:text-zinc-400/70 transition-all duration-200"
              placeholder="John Doe"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-50/50 dark:disabled:bg-zinc-900/50 disabled:text-zinc-400/70 transition-all duration-200"
              placeholder="m@example.com"
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
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-50/50 dark:disabled:bg-zinc-900/50 disabled:text-zinc-400/70 transition-all duration-200"
                  required
                  disabled={loading}
                  placeholder={loading ? "••••••••" : ""}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-50/50 dark:disabled:bg-zinc-900/50 disabled:text-zinc-400/70 transition-all duration-200",
                    password && confirmPassword && password !== confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""
                  )}
                  required
                  disabled={loading}
                  placeholder={loading ? "••••••••" : ""}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 w-full mt-4 shadow-sm active:scale-[0.98]"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="text-center text-sm text-zinc-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline underline-offset-4 font-medium transition-colors">
              Sign In
            </Link>
          </div>
        </>
      )}
    </form>
  );
}
