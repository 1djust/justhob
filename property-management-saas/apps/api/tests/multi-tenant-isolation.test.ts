import { describe, it, expect, beforeAll } from "vitest";
import dns from "dns/promises";
import crypto from "crypto";

// Resolve DB hostname to IPv4 BEFORE importing app/prisma (mirrors index.ts logic)
const DB_HOST = "aws-1-eu-north-1.pooler.supabase.com";
try {
  const ips = await dns.resolve4(DB_HOST);
  if (ips && ips.length > 0) {
    const dbIp = ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0];
    const directIp = ips.includes("51.21.189.77") ? "51.21.189.77" : ips[0];

    if (process.env.DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace(DB_HOST, dbIp);
    }
    if (process.env.DIRECT_URL) {
      process.env.DIRECT_URL = process.env.DIRECT_URL.replace(DB_HOST, directIp);
    }
  }
} catch (err) {
  // Fall through to default env URL
}

const { app } = await import("../src/app");
const { prisma } = await import("../src/lib/database");
const { authCache } = await import("../src/lib/middleware");

function hash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

describe("Priority 8: Multi-Tenant Workspace & RLS Boundary Isolation", () => {
  let ws1Id: string;
  let ws2Id: string;
  let user1Id: string;
  let user2Id: string;
  let ws1PropertyId: string;
  let ws2PropertyId: string;

  const user1Token = "token-user-1-workspace-a";
  const user2Token = "token-user-2-workspace-b";

  beforeAll(async () => {
    // 1. Create Workspace A & User 1 (Manager)
    const ws1 = await prisma.workspace.create({
      data: { name: "Workspace Alpha Security", plan: "PRO" },
    });
    ws1Id = ws1.id;

    user1Id = `sec-user-1-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: user1Id,
        email: `manager1_${Date.now()}@test.com`,
        role: "PROPERTY_MANAGER",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: user1Id,
        workspaceId: ws1Id,
        role: "PROPERTY_MANAGER",
      },
    });

    const prop1 = await prisma.property.create({
      data: {
        name: "Alpha Towers",
        address: "1 Alpha Blvd",
        workspaceId: ws1Id,
      },
    });
    ws1PropertyId = prop1.id;

    // 2. Create Workspace B & User 2 (Manager)
    const ws2 = await prisma.workspace.create({
      data: { name: "Workspace Beta Security", plan: "PRO" },
    });
    ws2Id = ws2.id;

    user2Id = `sec-user-2-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: user2Id,
        email: `manager2_${Date.now()}@test.com`,
        role: "PROPERTY_MANAGER",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: user2Id,
        workspaceId: ws2Id,
        role: "PROPERTY_MANAGER",
      },
    });

    const prop2 = await prisma.property.create({
      data: {
        name: "Beta Condos",
        address: "2 Beta Ave",
        workspaceId: ws2Id,
      },
    });
    ws2PropertyId = prop2.id;

    // 3. Cache valid sessions for testing
    authCache.set(hash(user1Token), {
      userId: user1Id,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    authCache.set(hash(user2Token), {
      userId: user2Id,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  });

  describe("Cross-Tenant Property Isolation", () => {
    it("User 1 can access properties in Workspace 1", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/workspaces/${ws1Id}/properties`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((p: any) => p.id === ws1PropertyId)).toBe(true);
    });

    it("User 1 is BLOCKED (403) from accessing properties in Workspace 2 (Cross-Tenant IDOR prevention)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/workspaces/${ws2Id}/properties`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("Cross-Tenant Tenant List Isolation", () => {
    it("User 2 is BLOCKED (403) from accessing tenants in Workspace 1", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/workspaces/${ws1Id}/tenants`,
        headers: { authorization: `Bearer ${user2Token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("Cross-Tenant Payment Records Isolation", () => {
    it("User 1 is BLOCKED (403) from viewing payment history of Workspace 2", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/workspaces/${ws2Id}/payments`,
        headers: { authorization: `Bearer ${user1Token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("Cross-Tenant Unit Mutation Isolation", () => {
    it("User 1 is BLOCKED (403) from creating a unit inside Workspace 2", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/workspaces/${ws2Id}/properties/${ws2PropertyId}/units`,
        headers: { authorization: `Bearer ${user1Token}` },
        payload: {
          unitNumber: "Unit-Hacked-101",
          type: "RESIDENTIAL",
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
