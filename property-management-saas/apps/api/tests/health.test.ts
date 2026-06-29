import { describe, it, expect } from "vitest";
import dns from "dns/promises";

// Resolve DB hostname to IPv4 BEFORE importing app/prisma (mirrors index.ts logic)
const DB_HOST = "aws-1-eu-north-1.pooler.supabase.com";
try {
  const ips = await dns.resolve4(DB_HOST);
  if (ips && ips.length > 0) {
    let ip = ips[0];
    if (ips.includes("51.21.189.77")) {
      ip = "51.21.189.77";
    } else if (ip === "51.21.18.29" && ips.length > 1) {
      ip = ips[1];
    }
    if (process.env.DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace(DB_HOST, ip);
    }
    if (process.env.DIRECT_URL) {
      process.env.DIRECT_URL = process.env.DIRECT_URL.replace(DB_HOST, ip);
    }
  }
} catch {
  // Fall through to default env URL
}

const { app } = await import("../src/app");

describe("API Health Check", () => {
  it("GET /health should return status ok", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    const data = response.json();

    expect(response.statusCode).toBe(200);
    expect(data).toEqual({ status: "ok" });
  });
});

describe("API Auth Routes", () => {
  it("POST /api/auth/login without body should return 400 or 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {},
    });

    // Should reject empty credentials
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
  });

  it("GET /api/auth/me without token should return 401", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("API Protected Routes", () => {
  it("GET /api/workspaces without auth should return 401", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/workspaces",
    });

    expect(response.statusCode).toBe(401);
  });
});
