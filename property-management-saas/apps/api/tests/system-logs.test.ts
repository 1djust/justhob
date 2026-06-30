import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dns from "dns/promises";
import crypto from "crypto";

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
const { prisma } = await import("../src/lib/database");
const { authCache } = await import("../src/lib/middleware");

describe("Super Admin System Logs Flow & Telemetry Redaction", () => {
  let testAdminUserId: string;
  let createdLogIds: string[] = [];

  beforeAll(async () => {
    // 1. Create Super Admin User
    testAdminUserId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: testAdminUserId,
        email: `admin_${Date.now()}@logstest.com`,
        name: "Platform Admin",
        role: "SUPER_ADMIN",
      },
    });

    // 2. Populate Auth Cache
    authCache.set("mock-admin-token", {
      userId: testAdminUserId,
      globalUserRole: "SUPER_ADMIN",
      isAAL2: false,
      isAdminVerified: true,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    // 3. Create mock manager token (to test authorization boundary)
    authCache.set("mock-manager-token", {
      userId: crypto.randomUUID(),
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    // 4. Create dummy error log entries
    const log1 = await prisma.errorLog.create({
      data: {
        level: "info",
        message: "Startup initialized successfully",
        source: "SYSTEM_TEST",
      },
    });
    createdLogIds.push(log1.id);

    const log2 = await prisma.errorLog.create({
      data: {
        level: "error",
        message:
          "Failed to connect to database at postgresql://postgres:password123@aws-db-instance.pooler.supabase.com:5432/postgres",
        source: "DATABASE_TEST",
      },
    });
    createdLogIds.push(log2.id);

    const log3 = await prisma.errorLog.create({
      data: {
        level: "warn",
        message: "Suspicious API access detected",
        source: "SECURITY_TEST",
        context: {
          secretToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
          ip: "192.168.1.1",
          nested: {
            apiKey: "key-999234",
            info: "regular info text",
          },
        },
      },
    });
    createdLogIds.push(log3.id);
  });

  afterAll(async () => {
    // Clean up cache
    authCache.delete("mock-admin-token");
    authCache.delete("mock-manager-token");

    // Clean up database
    await prisma.errorLog.deleteMany({
      where: { id: { in: createdLogIds } },
    });
    await prisma.user.deleteMany({
      where: { id: testAdminUserId },
    });
  });

  it("GET /api/super-admin/errors should return paginated list of logs", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/super-admin/errors?limit=10&page=1",
      headers: {
        authorization: "Bearer mock-admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.errors).toBeDefined();
    expect(data.errors.length).toBeGreaterThanOrEqual(3);
    expect(data.totalPages).toBeDefined();
  });

  it("GET /api/super-admin/errors?level=error should filter by severity", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/super-admin/errors?level=error",
      headers: {
        authorization: "Bearer mock-admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.errors.every((err: any) => err.level === "error")).toBe(true);
  });

  it("GET /api/super-admin/errors should redact sensitive secrets from message text", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/super-admin/errors`,
      headers: {
        authorization: "Bearer mock-admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();

    const dbTestLog = data.errors.find(
      (err: any) => err.id === createdLogIds[1],
    );
    expect(dbTestLog).toBeDefined();

    // Ensure raw db credentials like password123 are redacted
    expect(dbTestLog.message).not.toContain("password123");
    expect(dbTestLog.message).toContain("[REDACTED]");
  });

  it("GET /api/super-admin/errors should recursively redact sensitive context parameters", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/super-admin/errors`,
      headers: {
        authorization: "Bearer mock-admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();

    const securityLog = data.errors.find(
      (err: any) => err.id === createdLogIds[2],
    );
    expect(securityLog).toBeDefined();

    // Check that top level secret token is redacted
    expect(securityLog.context.secretToken).toBe("[REDACTED]");
    // Check that nested API key is redacted
    expect(securityLog.context.nested.apiKey).toBe("[REDACTED]");
    // Regular info is preserved
    expect(securityLog.context.nested.info).toBe("regular info text");
  });

  it("GET /api/super-admin/errors should restrict unauthorized access", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/super-admin/errors`,
      headers: {
        authorization: "Bearer mock-manager-token",
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
