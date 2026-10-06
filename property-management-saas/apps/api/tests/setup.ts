/**
 * Vitest global setup file.
 * Runs before all test suites.
 *
 * Use this to:
 * - Set environment variables for tests
 * - Initialize mock databases or services
 * - Configure global test utilities
 */

import "dotenv/config";
import dns from "dns/promises";

// Ensure we're in test environment
process.env.NODE_ENV = "test";

// Suppress noisy logs during testing
process.env.LOG_LEVEL = "silent";

// Apply the DNS IPv4 resolution fix for Supabase pooler
const host = "aws-1-eu-north-1.pooler.supabase.com";
try {
  const ips = await dns.resolve4(host);
  if (ips && ips.length > 0) {
    const isPoolerPort = process.env.DATABASE_URL?.includes(":6543");
    const dbIp = isPoolerPort
      ? (ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0])
      : (ips.includes("51.21.189.77") ? "51.21.189.77" : (ips.length > 1 ? ips[1] : ips[0]));
    const directIp = ips.includes("51.21.189.77") ? "51.21.189.77" : ips[0];

    if (process.env.DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, dbIp);
    }
    if (process.env.DIRECT_URL) {
      process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, directIp);
    }
  }
} catch (err) {
  // Ignore or log
}
