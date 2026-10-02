import { NextResponse } from "next/server";

/**
 * Automated Reminders Cron Proxy Route (Vercel Cron)
 *
 * Triggered by Vercel Cron Jobs configured in vercel.json.
 * Forwards execution to the backend Fastify API at /api/cron/reminders.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Verify the request is from Vercel Cron (in production)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiUrl =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3002"
      : "https://propertystack.onrender.com");

  try {
    const headers: Record<string, string> = {};
    if (process.env.CRON_SECRET) {
      headers["Authorization"] = `Bearer ${process.env.CRON_SECRET}`;
    }

    const url = new URL(request.url);
    const search = url.search;

    const res = await fetch(`${apiUrl}/api/cron/reminders${search}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(60_000), // Allow time for cold-starts and email dispatching
    });

    const data = await res.json();

    return NextResponse.json({
      success: res.ok,
      api: apiUrl,
      status: res.status,
      results: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown reminder trigger failure";
    return NextResponse.json(
      {
        success: false,
        api: apiUrl,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
