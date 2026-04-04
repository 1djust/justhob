import { supabase } from './supabase';

const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === 'justhob.vercel.app' || !window.location.hostname.includes('localhost'));

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (isProduction ? 'https://justhob.onrender.com' : 'http://localhost:3001');

export async function apiFetch(url: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  
  const headers = new Headers(options.headers || {});
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  // Ensure Content-Type is set if body is present and not form data
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
