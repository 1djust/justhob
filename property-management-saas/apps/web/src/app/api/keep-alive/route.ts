import { NextResponse } from "next/server";

/**
 * Keep-Alive Cron Route
 *
 * Pings the Render backend every 10 minutes to prevent cold starts.
 * Triggered by Vercel Cron Jobs configured in vercel.json.
 *
 * This prevents the ~45s cold-start delay that causes "Failed to fetch"
 * errors on the live admin login page.
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
    process.env.NEXT_PUBLIC_API_URL || "https://propertystack.onrender.com";

  try {
    const start = Date.now();
    const res = await fetch(`${apiUrl}/health`, {
      signal: AbortSignal.timeout(55_000), // Render cold starts can take up to 50s
    });
    const elapsed = Date.now() - start;
    const data = await res.json();

    return NextResponse.json({
      success: true,
      api: apiUrl,
      status: data.status,
      responseTimeMs: elapsed,
      wasColdStart: elapsed > 5000,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown ping failure";
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
