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

// Apply the DNS resolution fix for tests running on WSL 2
const host = "aws-1-eu-north-1.pooler.supabase.com";
try {
  const ips = await dns.resolve4(host);
  if (ips && ips.length > 0) {
    let ip = ips[0];
    if (ips.includes("51.21.189.77")) {
      ip = "51.21.189.77";
    } else if (ip === "51.21.18.29" && ips.length > 1) {
      ip = ips[1];
    }
    if (process.env.DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, ip);
    }
    if (process.env.DIRECT_URL) {
      process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, ip);
    }
  }
} catch (err) {
  // Ignore or log
}
