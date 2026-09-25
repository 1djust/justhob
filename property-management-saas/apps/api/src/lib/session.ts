import crypto from "crypto";

export const SESSION_COOKIE_NAME = "session_token";
export const CSRF_COOKIE_NAME = "csrf_token";

/**
 * Session cookie options enforcing HttpOnly, Secure, and SameSite=Strict.
 */
export function getSessionCookieOptions(isProd: boolean) {
  return {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "strict" as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}

/**
 * CSRF cookie options readable by client-side JavaScript for Double-Submit pattern.
 */
export function getCsrfCookieOptions(isProd: boolean) {
  return {
    path: "/",
    httpOnly: false, // Must be readable by client JS to set X-CSRF-Token header
    secure: isProd,
    sameSite: "strict" as const,
    maxAge: 24 * 60 * 60, // 24 hours in seconds
  };
}

/**
 * Generate a cryptographically secure 256-bit hex token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
