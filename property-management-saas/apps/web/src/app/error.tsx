'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Global Error Recovery Component for Next.js App Router.
 * 
 * Automatically catches and reports client-side errors to the database.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to our custom Supabase monitoring
    logger.error('Client-side Application Error', error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        An unexpected error occurred. We've been notified and are looking into it.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}
