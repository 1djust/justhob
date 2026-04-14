import { supabase } from './supabase';
import { toast } from 'sonner';

const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === 'justhob.vercel.app' || !window.location.hostname.includes('localhost'));

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (isProduction ? 'https://justhob.onrender.com' : 'http://localhost:3001');

export interface ApiOptions extends RequestInit {
  silent?: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch(url: string, options: ApiOptions = {}) {
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

  const response = await fetch(url.startsWith('http') ? url : `${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  let result: any;

  if (contentType?.includes('application/json')) {
    result = await response.json();
  } else {
    result = await response.text();
  }

  if (!response.ok) {
    const errorData = result?.error || {};
    const message = errorData.message || (typeof result === 'string' ? result : response.statusText);
    const code = errorData.code;
    const details = errorData.details;

    // Trigger automatic toast for mutations unless silent is requested
    if (!options.silent && (options.method && options.method !== 'GET')) {
      toast.error(message || 'Request failed');
    }

    throw new ApiError(message, response.status, code, details);
  }

  return result;
}
