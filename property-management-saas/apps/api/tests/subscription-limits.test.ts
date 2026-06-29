import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
const { prisma } = await import("../src/lib/database");
const { authCache } = await import("../src/lib/middleware");

describe("Subscription Limits and Feature Gating", () => {
  let freeWorkspaceId: string;
  let unitWorkspaceId: string;
  let proWorkspaceId: string;
  let enterpriseWorkspaceId: string;

  let freeManagerId: string;
  let unitManagerId: string;
  let proManagerId: string;
  let enterpriseManagerId: string;

  const freeToken = "token-free-mgr";
  const unitToken = "token-unit-mgr";
  const proToken = "token-pro-mgr";
  const entToken = "token-ent-mgr";

  beforeAll(async () => {
    // 1. Create Workspaces
    const freeWS = await prisma.workspace.create({
      data: { name: "Free Workspace Plan", plan: "FREE" },
    });
    freeWorkspaceId = freeWS.id;

    const unitWS = await prisma.workspace.create({
      data: { name: "Free Unit Workspace Plan", plan: "FREE" },
    });
    unitWorkspaceId = unitWS.id;

    const proWS = await prisma.workspace.create({
      data: { name: "Pro Workspace Plan", plan: "PRO" },
    });
    proWorkspaceId = proWS.id;

    const entWS = await prisma.workspace.create({
      data: { name: "Enterprise Workspace Plan", plan: "ENTERPRISE" },
    });
    enterpriseWorkspaceId = entWS.id;

    // 2. Create Manager Users
    freeManagerId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: freeManagerId,
        email: `free_mgr_${Date.now()}@limits.com`,
        name: "Free Manager",
        role: "PROPERTY_MANAGER",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: freeManagerId,
        workspaceId: freeWorkspaceId,
        role: "PROPERTY_MANAGER",
      },
    });

    unitManagerId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: unitManagerId,
        email: `unit_mgr_${Date.now()}@limits.com`,
        name: "Unit Manager",
        role: "PROPERTY_MANAGER",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: unitManagerId,
        workspaceId: unitWorkspaceId,
        role: "PROPERTY_MANAGER",
      },
    });

    proManagerId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: proManagerId,
        email: `pro_mgr_${Date.now()}@limits.com`,
        name: "Pro Manager",
        role: "PROPERTY_MANAGER",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: proManagerId,
        workspaceId: proWorkspaceId,
        role: "PROPERTY_MANAGER",
      },
    });

    enterpriseManagerId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: enterpriseManagerId,
        email: `ent_mgr_${Date.now()}@limits.com`,
        name: "Enterprise Manager",
        role: "PROPERTY_MANAGER",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: enterpriseManagerId,
        workspaceId: enterpriseWorkspaceId,
        role: "PROPERTY_MANAGER",
      },
    });

    // 3. Setup Auth Token Mocking
    authCache.set(freeToken, {
      userId: freeManagerId,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    authCache.set(unitToken, {
      userId: unitManagerId,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    authCache.set(proToken, {
      userId: proManagerId,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    authCache.set(entToken, {
      userId: enterpriseManagerId,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  }, 30000);

  afterAll(async () => {
    // Cleanup created resources
    await prisma.workspaceMember.deleteMany({
      where: {
        workspaceId: {
          in: [freeWorkspaceId, unitWorkspaceId, proWorkspaceId, enterpriseWorkspaceId],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [freeManagerId, unitManagerId, proManagerId, enterpriseManagerId] },
      },
    });
    await prisma.tenant.deleteMany({
      where: {
        workspaceId: {
          in: [freeWorkspaceId, unitWorkspaceId, proWorkspaceId, enterpriseWorkspaceId],
        },
      },
    });
    await prisma.unit.deleteMany({
      where: {
        workspaceId: {
          in: [freeWorkspaceId, unitWorkspaceId, proWorkspaceId, enterpriseWorkspaceId],
        },
      },
    });
    await prisma.property.deleteMany({
      where: {
        workspaceId: {
          in: [freeWorkspaceId, unitWorkspaceId, proWorkspaceId, enterpriseWorkspaceId],
        },
      },
    });
    await prisma.workspace.deleteMany({
      where: {
        id: { in: [freeWorkspaceId, unitWorkspaceId, proWorkspaceId, enterpriseWorkspaceId] },
      },
    });
  }, 30000);

  describe("Properties and Units Limits", () => {
    it("FREE plan: permits exactly 1 property, rejects 2nd with 402", async () => {
      // 1. Create first property
      const res1 = await app.inject({
        method: "POST",
        url: `/api/workspaces/${freeWorkspaceId}/properties`,
        headers: { authorization: `Bearer ${freeToken}` },
        payload: {
          name: "Free Property 1",
          address: "123 Free Lane",
          units: [{ unitNumber: "A1", type: "MINI_FLAT" }],
        },
      });
      expect(res1.statusCode).toBe(201);

      // 2. Try to create second property
      const res2 = await app.inject({
        method: "POST",
        url: `/api/workspaces/${freeWorkspaceId}/properties`,
        headers: { authorization: `Bearer ${freeToken}` },
        payload: {
          name: "Free Property 2",
          address: "456 Free Blvd",
        },
      });
      expect(res2.statusCode).toBe(402);
      expect(res2.json().error.message).toContain("Plan limit reached: Maximum 1 property allowed");
    });

    it("FREE plan: permits exactly 3 units, rejects 4th with 402", async () => {
      // Try to create 4 units in the first property on the fresh unit workspace
      const res = await app.inject({
        method: "POST",
        url: `/api/workspaces/${unitWorkspaceId}/properties`,
        headers: { authorization: `Bearer ${unitToken}` },
        payload: {
          name: "Free Property Unit Limit",
          address: "789 Free Ave",
          units: [
            { unitNumber: "U1", type: "MINI_FLAT" },
            { unitNumber: "U2", type: "MINI_FLAT" },
            { unitNumber: "U3", type: "MINI_FLAT" },
            { unitNumber: "U4", type: "MINI_FLAT" },
          ],
        },
      });
      // Should fail since 4 units exceeds the limit of 3
      expect(res.statusCode).toBe(402);
      expect(res.json().error.message).toContain("Plan limit reached: Maximum 3 units allowed");
    });

    it("PRO plan: allows creating up to 10 properties", async () => {
      // Create 10 properties in the Pro workspace
      for (let i = 1; i <= 10; i++) {
        const res = await app.inject({
          method: "POST",
          url: `/api/workspaces/${proWorkspaceId}/properties`,
          headers: { authorization: `Bearer ${proToken}` },
          payload: {
            name: `Pro Property ${i}`,
            address: `${i} Pro Street`,
          },
        });
        expect(res.statusCode).toBe(201);
      }

      // 11th property creation should be blocked
      const resBlocked = await app.inject({
        method: "POST",
        url: `/api/workspaces/${proWorkspaceId}/properties`,
        headers: { authorization: `Bearer ${proToken}` },
        payload: {
          name: "Pro Property 11",
          address: "11 Pro Street",
        },
      });
      expect(resBlocked.statusCode).toBe(402);
      expect(resBlocked.json().error.message).toContain("Plan limit reached: Maximum 10 property allowed");
    }, 90000);
  });

  describe("Tenants Limits", () => {
    it("FREE plan: permits exactly 3 tenants, rejects 4th with 402", async () => {
      // Create 3 tenants
      for (let i = 1; i <= 3; i++) {
        const res = await app.inject({
          method: "POST",
          url: `/api/workspaces/${freeWorkspaceId}/tenants`,
          headers: { authorization: `Bearer ${freeToken}` },
          payload: {
            name: `Free Tenant ${i}`,
            email: `free_tenant_${i}_${Date.now()}@limits.com`,
            phone: `0801111111${i}`,
          },
        });
        expect(res.statusCode).toBe(201);
      }

      // Try creating 4th tenant
      const resBlocked = await app.inject({
        method: "POST",
        url: `/api/workspaces/${freeWorkspaceId}/tenants`,
        headers: { authorization: `Bearer ${freeToken}` },
        payload: {
          name: "Free Tenant 4",
          email: `free_tenant_4_${Date.now()}@limits.com`,
          phone: "08011111114",
        },
      });
      expect(resBlocked.statusCode).toBe(402);
      expect(resBlocked.json().error.message).toContain("Plan limit reached: Maximum 3 tenants allowed");
    }, 60000);
  });

  describe("Feature Gating: Enterprise Exports", () => {
    it("FREE and PRO plans: reject export endpoints with 402", async () => {
      const resFree = await app.inject({
        method: "GET",
        url: `/api/workspaces/${freeWorkspaceId}/export/tenants`,
        headers: { authorization: `Bearer ${freeToken}` },
      });
      expect(resFree.statusCode).toBe(402);
      expect(resFree.json().error).toContain("Data Export is an Enterprise-only feature");

      const resPro = await app.inject({
        method: "GET",
        url: `/api/workspaces/${proWorkspaceId}/export/tenants`,
        headers: { authorization: `Bearer ${proToken}` },
      });
      expect(resPro.statusCode).toBe(402);
      expect(resPro.json().error).toContain("Data Export is an Enterprise-only feature");
    });

    it("ENTERPRISE plan: allows accessing export endpoint", async () => {
      const resEnt = await app.inject({
        method: "GET",
        url: `/api/workspaces/${enterpriseWorkspaceId}/export/tenants`,
        headers: { authorization: `Bearer ${entToken}` },
      });
      // Bypasses the 402 check, should return success
      expect(resEnt.statusCode).toBe(200);
    });
  });
});
