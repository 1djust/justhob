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

describe("Manager Operations Audit Trail Flow", () => {
  let testWorkspaceId: string;
  let testManagerUserId: string;
  let testAdminUserId: string;
  let createdOwnerId: string;

  beforeAll(async () => {
    // 1. Create Workspace
    const workspace = await prisma.workspace.create({
      data: { name: "Audit Trail Test Workspace", plan: "PRO" },
    });
    testWorkspaceId = workspace.id;

    // 2. Create Manager User
    testManagerUserId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: testManagerUserId,
        email: `manager_${Date.now()}@audittest.com`,
        name: "Test Manager",
        role: "PROPERTY_MANAGER",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: testManagerUserId,
        workspaceId: testWorkspaceId,
        role: "PROPERTY_MANAGER",
      },
    });

    // 3. Create Super Admin User
    testAdminUserId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: testAdminUserId,
        email: `admin_${Date.now()}@audittest.com`,
        name: "Super Admin",
        role: "SUPER_ADMIN",
      },
    });

    // 4. Register mock tokens in Auth Cache
    authCache.set("mock-manager-token", {
      userId: testManagerUserId,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    authCache.set("mock-admin-token", {
      userId: testAdminUserId,
      globalUserRole: "SUPER_ADMIN",
      isAAL2: false,
      isAdminVerified: true,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  });

  afterAll(async () => {
    // Clean up cache
    authCache.delete("mock-manager-token");
    authCache.delete("mock-admin-token");

    // Clean up database
    if (createdOwnerId) {
      await prisma.workspaceMember.deleteMany({
        where: { userId: createdOwnerId, workspaceId: testWorkspaceId },
      });
      await prisma.user.deleteMany({ where: { id: createdOwnerId } });
    }
    await prisma.auditLog.deleteMany({
      where: { workspaceId: testWorkspaceId },
    });
    await prisma.workspaceMember.deleteMany({
      where: { userId: testManagerUserId, workspaceId: testWorkspaceId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testManagerUserId, testAdminUserId] } },
    });
    await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } });
  });

  it("POST /api/workspaces/:workspaceId/owners should add landlord and log action", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/workspaces/${testWorkspaceId}/owners`,
      headers: {
        authorization: "Bearer mock-manager-token",
      },
      payload: {
        name: "Test Landlord",
        email: `landlord_${Date.now()}@audittest.com`,
      },
    });

    expect(response.statusCode).toBe(201);
    const data = response.json();
    expect(data.owner).toBeDefined();
    createdOwnerId = data.owner.id;

    // Assert that an AuditLog was recorded
    const auditLogs = await prisma.auditLog.findMany({
      where: { workspaceId: testWorkspaceId, action: "ADD_LANDLORD" },
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].actorName).toBe("Test Manager");
    expect(auditLogs[0].details).toContain("Test Landlord");
  });

  it("GET /api/super-admin/audit-logs should retrieve logs for SUPER_ADMIN", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/super-admin/audit-logs`,
      headers: {
        authorization: "Bearer mock-admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.logs).toBeDefined();

    // Check that our recorded log is present
    const testLog = data.logs.find(
      (l: any) =>
        l.workspaceId === testWorkspaceId && l.action === "ADD_LANDLORD",
    );
    expect(testLog).toBeDefined();
    expect(testLog.actorName).toBe("Test Manager");
  });

  it("GET /api/super-admin/audit-logs should restrict access for non-admin managers", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/super-admin/audit-logs`,
      headers: {
        authorization: "Bearer mock-manager-token",
      },
    });

    // Should return Forbidden (403)
    expect(response.statusCode).toBe(403);
  });

  it("GET /api/super-admin/audit-logs should restrict access for anonymous requests", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/super-admin/audit-logs`,
    });

    // Should return Unauthorized (401)
    expect(response.statusCode).toBe(401);
  });
});
