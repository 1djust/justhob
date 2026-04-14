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

  if (!response.ok) {
    let errorMessage = 'API request failed';
    let errorCode = undefined;
    let errorDetails = undefined;

    try {
      const errorData = await response.json();
      
      // Handle new standard format: { error: { message, code, details } }
      if (errorData.error && typeof errorData.error === 'object') {
        errorMessage = errorData.error.message || errorMessage;
        errorCode = errorData.error.code;
        errorDetails = errorData.error.details;
      } 
      // Handle legacy format: { error: "message" }
      else if (typeof errorData.error === 'string') {
        errorMessage = errorData.error;
      }
      // Fallback or some other shape
      else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (e) {
      // Not JSON or empty body
    }

    // Trigger automatic toast for mutations unless silent is requested
    if (!options.silent && (options.method && options.method !== 'GET')) {
      toast.error(errorMessage);
    }

    throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
}
