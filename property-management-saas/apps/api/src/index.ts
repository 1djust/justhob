import "dotenv/config";
import dns from "dns/promises";

const start = async () => {
  try {
    if (process.env.RENDER !== "true") {
      const host = "aws-1-eu-north-1.pooler.supabase.com";
      console.log(`[DNS] Resolving database host ${host} to IPv4...`);
      const ips = await dns.resolve4(host);
      if (ips && ips.length > 0) {
        let ip = ips[0];
        if (ips.includes("51.21.189.77")) {
          ip = "51.21.189.77";
        } else if (ip === "51.21.18.29" && ips.length > 1) {
          ip = ips[1];
        }
        console.log(`[DNS] Success: resolved to ${ip}`);
        if (process.env.DATABASE_URL) {
          process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, ip);
        }
        if (process.env.DIRECT_URL) {
          process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, ip);
        }
      }
    } else {
      console.log(
        `[DNS] Skipping manual hostname resolution on Render production`,
      );
    }
  } catch (err) {
    console.error(
      "[DNS] Hostname IPv4 resolution failed, falling back to default env URL:",
      err,
    );
  }

  // Dynamically import app and prisma after setting environment variables
  const { app } = await import("./app");
  const { prisma } = await import("./lib/database");

  try {
    // Warm up the database connection pool on startup
    console.log("Initializing database connection pool...");
    const startDb = Date.now();
    await prisma.$connect();
    console.log(`Database connection pool warmed in ${Date.now() - startDb}ms`);

    // Keep-alive ping to prevent the PgBouncer/Supabase pooled connections from closing
    setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        console.error("Database connection keep-alive ping failed:", err);
      }
    }, 50 * 1000).unref();

    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`API running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
