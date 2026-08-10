import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Identify protected routes
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAdminRoute =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");

  // 2. Check for Supabase session cookie identifiers
  const hasAuthToken = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") ||
        cookie.name.includes("auth-token") ||
        cookie.name.includes("supabase"),
    );

  // 3. Redirect unauthenticated visitors attempting to access protected dashboards
  if (isDashboardRoute && !hasAuthToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && !hasAuthToken) {
    const adminLoginUrl = new URL("/admin/login", request.url);
    adminLoginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(adminLoginUrl);
  }

  // 4. Return response with defense-in-depth headers applied
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, icons)
     */
    "/((?!_next/static|_next/image|favicon.ico|downloads|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
