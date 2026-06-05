'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch, API_BASE_URL } from '@/lib/api';

export function LoginForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [errorDetails, setErrorDetails] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [isInviteFlow, setIsInviteFlow] = React.useState(false);
  
  // MFA State
  const [mfaStep, setMfaStep] = React.useState<boolean>(false);
  const [mfaCode, setMfaCode] = React.useState('');
  const [factorId, setFactorId] = React.useState<string | null>(null);
  
  const router = useRouter();

  const isManualLogin = React.useRef(false);

  React.useEffect(() => {
    const initialHash = typeof window !== 'undefined' ? window.location.hash : '';
    const hasHashParams = initialHash.includes('type=recovery') || initialHash.includes('type=invite');
    const hasAccessToken = initialHash.includes('access_token=');
    const isRecoveryOrInviteViaUrl = hasHashParams && hasAccessToken;

    // Check if the user is already authenticated
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (isRecoveryOrInviteViaUrl) {
          setIsInviteFlow(true);
          setEmail(session.user.email || '');
          // Clean up the URL to prevent subsequent accidental redirects
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } else {
          // If already logged in normally, skip login block and go straight to dashboard
          router.push('/dashboard');
        }
      }
    };
    checkSession();

    // Listen for auth state changes (Supabase processing the #access_token from the URL)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (event === 'PASSWORD_RECOVERY') {
          setIsInviteFlow(true);
          setEmail(session.user.email || '');
        } else if (event === 'SIGNED_IN' && isRecoveryOrInviteViaUrl && !isManualLogin.current) {
          setIsInviteFlow(true);
          setEmail(session.user.email || '');
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } else if (event === 'SIGNED_IN' && isManualLogin.current) {
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
    setError('');

    try {
      const { data, error: sbError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (sbError || !data.user) {
        throw new Error(sbError?.message || 'Failed to login');
      }

      // Check if MFA is required
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aalError && aalData && aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
        const factors = data.user.factors || [];
        const totp = factors.find((f: any) => f.factor_type === 'totp' && f.status === 'verified');
        if (totp) {
          setFactorId(totp.id);
          setMfaStep(true);
          setLoading(false);
          return; // Stop here, wait for MFA code
        }
      }

      // If no MFA required, proceed normally
      await apiFetch('/api/auth/sync', {
        method: 'POST',
      });

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An unexpected error occurred');
      if (err.details) {
        setErrorDetails(typeof err.details === 'string' ? err.details : JSON.stringify(err.details));
      }
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !mfaCode || mfaCode.length !== 6) return;
    
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: mfaCode,
      });

      if (error) {
        throw new Error(error.message || 'Invalid code');
      }

      // Sync with Prisma backend
      await apiFetch('/api/auth/sync', {
        method: 'POST',
      });

      router.push('/dashboard');
    } catch (err: any) {
      console.error('MFA error:', err);
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // They are already authenticated via the magic link, so we just update their user profile
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw new Error(updateError.message || 'Failed to set password');
      }

      // Sync with Prisma backend
      await apiFetch('/api/auth/sync', {
        method: 'POST',
      });

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Password setup error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      setError('Confirmation email sent! Please check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend confirmation');
    } finally {
      setResending(false);
    }
  };

  if (isInviteFlow) {
    return (
      <form onSubmit={handleSetPassword} className="space-y-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl text-sm mb-6">
          <p className="font-bold">Email Verified Successfully! 🎉</p>
          <p className="mt-1 opacity-90">Please set a permanent password for your account to complete your setup.</p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md border border-red-500/20 space-y-2">
            <p className="font-bold">{error}</p>
          </div>
        )}
        
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Email Address</label>
          <input
            type="email"
            value={email}
            disabled
            className="flex h-10 w-full rounded-md border border-input bg-zinc-100/50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-500 cursor-not-allowed"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">Create a Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:bg-zinc-50/50 dark:disabled:bg-zinc-900/50 disabled:text-zinc-500 transition-all duration-200"
              placeholder="Minimum 6 characters"
              required
              minLength={6}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={loading || password.length < 6}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 w-full mt-4"
        >
          {loading ? 'Setting Password...' : 'Save Password & Continue'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={mfaStep ? handleMfaSubmit : handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md border border-red-500/20 space-y-2">
          <p className="font-bold">{error}</p>
          {errorDetails && <p className="text-xs opacity-80 font-mono mt-1 pt-1 border-tl border-red-500/20">{errorDetails}</p>}
          {!mfaStep && (
            <div className="pt-2 border-t border-red-500/10">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="text-xs font-bold underline hover:no-underline block text-zinc-600 dark:text-zinc-400"
              >
                {resending ? 'Sending...' : "Didn't receive a confirmation email? Resend"}
              </button>
            </div>
          )}
        </div>
      )}
      
      {mfaStep ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-4">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Two-Factor Authentication</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Open your authenticator app and enter the 6-digit code to verify your identity.
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Authentication Code</label>
            <input
              type="text"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xl text-center font-mono tracking-[0.5em] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-50/50 dark:disabled:bg-zinc-900/50 disabled:text-zinc-400/70 transition-all duration-200"
              placeholder="000000"
              required
              disabled={loading}
              autoComplete="one-time-code"
            />
          </div>

          <button
            type="submit"
            disabled={loading || mfaCode.length !== 6}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 w-full mt-4 shadow-sm active:scale-[0.98]"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
          
          <button
            type="button"
            onClick={() => { setMfaStep(false); setMfaCode(''); }}
            disabled={loading}
            className="w-full text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium"
          >
            Cancel and go back
          </button>
        </div>
      ) : (
        <>
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
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-bold text-primary hover:underline transition-colors">
                Forgot password?
              </Link>
            </div>
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
          
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 w-full mt-4 shadow-sm active:scale-[0.98]"
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>

          <div className="text-center text-sm text-zinc-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:underline underline-offset-4 font-medium transition-colors">
              Sign up
            </Link>
          </div>
        </>
      )}
    </form>
  );
}
