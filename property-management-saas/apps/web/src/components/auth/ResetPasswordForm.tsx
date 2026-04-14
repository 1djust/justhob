'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apiFetch, API_BASE_URL } from '@/lib/api';

export function ResetPasswordForm() {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // The user is already authenticated via the hash token from the email link
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Sync with Prisma backend
      const res = await apiFetch(`${API_BASE_URL}/api/auth/sync`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to sync user data to backend');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-6 rounded-2xl">
          <p className="text-xl font-bold mb-2">Password Reset Successful! 🎉</p>
          <p className="text-sm opacity-90">Your password has been updated. You will be redirected to the login page in a moment.</p>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="text-primary hover:underline font-medium"
        >
          Click here if you are not redirected
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md border border-red-500/20">
          <p className="font-bold">{error}</p>
        </div>
      )}
      
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">New Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          placeholder="Minimum 6 characters"
          required
          minLength={6}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">Confirm New Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          placeholder="Repeat your new password"
          required
          minLength={6}
        />
      </div>
      
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 w-full mt-4"
      >
        {loading ? 'Updating Password...' : 'Reset Password'}
      </button>
    </form>
  );
}
