'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_BASE_URL } from '@/lib/api';
import { AlertCircle } from 'lucide-react';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const COUNTDOWN_SECONDS = 60; // 1 minute warning

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showWarning, setShowWarning] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState(COUNTDOWN_SECONDS);
  const lastActivityRef = React.useRef(Date.now());
  const warningIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Function to gracefully log the user out
  const handleLogout = React.useCallback(async () => {
    try {
      await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Auto-logout failed', e);
    }
    router.push('/login');
  }, [router]);

  // Main listener logic
  React.useEffect(() => {
    // Determine if we should check activity
    const activityTypes = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];

    const handleActivity = () => {
      if (!showWarning) {
        lastActivityRef.current = Date.now();
      }
    };

    // Attach listeners
    activityTypes.forEach(type => window.addEventListener(type, handleActivity, { passive: true }));

    // Core checker loop
    const checker = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      if (timeSinceLastActivity >= IDLE_TIMEOUT_MS && !showWarning) {
        setShowWarning(true);
        setTimeLeft(COUNTDOWN_SECONDS);
      }
    }, 1000);

    return () => {
      activityTypes.forEach(type => window.removeEventListener(type, handleActivity));
      clearInterval(checker);
    };
  }, [showWarning]);

  // Countdown logic when warning is visible
  React.useEffect(() => {
    if (showWarning) {
      warningIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(warningIntervalRef.current!);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    };
  }, [showWarning, handleLogout]);

  const stayLoggedIn = () => {
    setShowWarning(false);
    lastActivityRef.current = Date.now();
  };

  return (
    <>
      {children}
      
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-4 text-amber-500">
              <AlertCircle className="w-8 h-8 flex-shrink-0" />
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Are you still there?</h3>
            </div>
            
            <p className="text-zinc-600 dark:text-zinc-400 font-medium mb-6">
              You have been inactive for quite some time. For your security, you will be automatically logged out in <span className="font-bold text-red-500 text-lg tabular-nums">{timeLeft}</span> seconds.
            </p>
            
            <div className="flex items-center justify-end gap-3 font-semibold">
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg transition-colors"
              >
                Log Out Now
              </button>
              <button 
                onClick={stayLoggedIn}
                className="px-6 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg transition-colors shadow-lg"
              >
                I'm still here
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
