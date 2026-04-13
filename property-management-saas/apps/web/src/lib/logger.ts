/**
 * Client-side Logger Utility.
 * 
 * Reports errors and warnings to our custom Supabase-backed API ingestion route.
 */
export const logger = {
  async error(message: string, error?: any, context?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error(message, error, context);
    }

    try {
      await fetch('/api/public/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          message,
          stack: error instanceof Error ? error.stack : undefined,
          source: 'web',
          context: {
            ...context,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            localStorage: typeof window !== 'undefined' ? { ...window.localStorage } : undefined, // Useful but use with caution regarding PI
          },
        }),
      });
    } catch (reportError) {
      // If logging itself fails, just log to console so we don't crash
      console.error('Failed to report error to API:', reportError);
    }
  },

  async warn(message: string, context?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(message, context);
    }

    try {
      await fetch('/api/public/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'warn',
          message,
          source: 'web',
          context: {
            ...context,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
          },
        }),
      });
    } catch (reportError) {
      console.error('Failed to report warning to API:', reportError);
    }
  }
};
