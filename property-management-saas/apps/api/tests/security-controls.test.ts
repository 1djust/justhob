import { describe, it, expect, beforeAll } from "vitest";
import dns from "dns/promises";
import crypto from "crypto";

// Resolve DB hostname to IPv4 BEFORE importing app/prisma (mirrors index.ts logic)
const DB_HOST = "aws-1-eu-north-1.pooler.supabase.com";
try {
  const ips = await dns.resolve4(DB_HOST);
  if (ips && ips.length > 0) {
    // DATABASE_URL uses port 6543 (pooler) which listens on 51.21.18.29
    const dbIp = ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0];
    // DIRECT_URL uses port 5432 (direct) which listens on 51.21.189.77
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

describe("Security Access Controls & Gateways", () => {
  let workspaceId: string;
  let otherWorkspaceId: string;
  let tenantId: string;
  let tenantUserId: string;
  let otherTenantUserId: string;
  let managerUserId: string;
  let propertyId: string;

  const tenantToken = "token-tenant-auth";
  const otherTenantToken = "token-other-tenant-auth";
  const managerToken = "token-manager-auth";

  beforeAll(async () => {
    // 1. Create a workspace
    const ws = await prisma.workspace.create({
      data: { name: "Security Test Workspace", plan: "FREE" },
    });
    workspaceId = ws.id;

    const otherWs = await prisma.workspace.create({
      data: { name: "Other Test Workspace", plan: "FREE" },
    });
    otherWorkspaceId = otherWs.id;

    // 2. Create property
    const prop = await prisma.property.create({
      data: {
        name: "Security Test Villa",
        address: "123 Security Way",
        workspaceId,
      },
    });
    propertyId = prop.id;

    // 3. Create tenant user and tenant profile
    tenantUserId = crypto.randomUUID();
    const tenantEmail = `tenant_${Date.now()}@security.com`;
    await prisma.user.create({
      data: {
        id: tenantUserId,
        email: tenantEmail,
        name: "Legit Tenant",
        role: "TENANT",
      },
    });
    const tenantProfile = await prisma.tenant.create({
      data: {
        name: "Legit Tenant",
        email: tenantEmail,
        workspaceId,
      },
    });
    tenantId = tenantProfile.id;

    // 4. Create another tenant user in a different workspace
    otherTenantUserId = crypto.randomUUID();
    const otherEmail = `other_${Date.now()}@security.com`;
    await prisma.user.create({
      data: {
        id: otherTenantUserId,
        email: otherEmail,
        name: "Attacker Tenant",
        role: "TENANT",
      },
    });

    // 5. Create manager user
    managerUserId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: managerUserId,
        email: `mgr_${Date.now()}@security.com`,
        name: "Workspace Manager",
        role: "PROPERTY_MANAGER",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: managerUserId,
        workspaceId,
        role: "PROPERTY_MANAGER",
      },
    });

    // 6. Seed mock tokens in authCache (both raw and sha256 hashed for tokenHash lookup)
    const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
    
    authCache.set(hash(tenantToken), {
      userId: tenantUserId,
      globalUserRole: "TENANT",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    authCache.set(hash(otherTenantToken), {
      userId: otherTenantUserId,
      globalUserRole: "TENANT",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    authCache.set(hash(managerToken), {
      userId: managerUserId,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  });

  describe("C-2: Public Maintenance Endpoint Access Controls", () => {
    it("should return 401 when no auth header is provided", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/public/tenants/${tenantId}/maintenance`,
        payload: {
          propertyId,
          description: "Water pipe leaking",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 when a tenant from a different workspace attempts access (IDOR check)", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/public/tenants/${tenantId}/maintenance`,
        headers: {
          authorization: `Bearer ${otherTenantToken}`,
        },
        payload: {
          propertyId,
          description: "Water pipe leaking",
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: "You are not authorized to submit requests for this tenant",
      });
    });

    it("should return 201 when the correct tenant submits the request", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/public/tenants/${tenantId}/maintenance`,
        headers: {
          authorization: `Bearer ${tenantToken}`,
        },
        payload: {
          propertyId,
          description: "Water pipe leaking",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().request).toBeDefined();
    });

    it("should return 201 when a manager of the workspace submits the request", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/public/tenants/${tenantId}/maintenance`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          propertyId,
          description: "AC not cooling",
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe("C-5: Supabase Auth Webhook Fail-Closed Behavior", () => {
    it("should reject requests with 401 if secret is not configured or mismatch", async () => {
      const oldSecret = process.env.SUPABASE_WEBHOOK_SECRET;
      
      // Force secret to not match
      process.env.SUPABASE_WEBHOOK_SECRET = "super-secret-correct-token";

      const response = await app.inject({
        method: "POST",
        url: "/api/public/webhooks/supabase-auth",
        headers: {
          authorization: "Bearer wrong-token",
        },
        payload: {},
      });

      expect(response.statusCode).toBe(401);

      // Restore
      process.env.SUPABASE_WEBHOOK_SECRET = oldSecret;
    });

    it("should reject requests with 401 when the webhook secret is missing/undefined (fail-closed check)", async () => {
      const oldSecret = process.env.SUPABASE_WEBHOOK_SECRET;
      
      // Delete secret configuration entirely
      delete process.env.SUPABASE_WEBHOOK_SECRET;

      const response = await app.inject({
        method: "POST",
        url: "/api/public/webhooks/supabase-auth",
        headers: {
          authorization: "Bearer some-token",
        },
        payload: {},
      });

      // Should fail closed, rejecting all requests
      expect(response.statusCode).toBe(401);

      // Restore
      process.env.SUPABASE_WEBHOOK_SECRET = oldSecret;
    });
  });

  describe("C-7: Workspace Scoping on Payment Updates (IDOR Prevention)", () => {
    it("should return 404 when attempting to update a payment in a different workspace", async () => {
      // 1. Create a payment in the legitimate workspace
      const lease = await prisma.lease.create({
        data: {
          tenantId,
          propertyId,
          startDate: new Date(),
          yearlyRent: 1200000,
          status: "ACTIVE",
        },
      });

      const payment = await prisma.payment.create({
        data: {
          leaseId: lease.id,
          workspaceId,
          amount: 100000,
          dueDate: new Date(),
          status: "PENDING",
        },
      });

      // 2. Attempt to update it using otherWorkspaceId parameter in route
      const response = await app.inject({
        method: "PATCH",
        url: `/api/workspaces/${otherWorkspaceId}/payments/${payment.id}/partial`,
        headers: {
          authorization: `Bearer ${managerToken}`, // Manager belongs to workspaceId, not otherWorkspaceId
        },
        payload: {
          amountPaid: 50000,
        },
      });

      expect([403, 404]).toContain(response.statusCode);
    });
  });

  describe("Hardening: HTTP Security Headers & Cache-Control", () => {
    it("should attach strict defense-in-depth security headers to responses", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["permissions-policy"]).toContain("camera=()");
    });

    it("should enforce no-store Cache-Control on sensitive authenticated routes", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/workspaces/${workspaceId}/properties`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.headers["pragma"]).toBe("no-cache");
    });
  });

  describe("Hardening: Bank Verification Input Validation", () => {
    it("should reject non-10-digit or non-numeric account numbers with 400", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/workspaces/${workspaceId}/bank/resolve`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          accountNumber: "12345", // too short
          bankCode: "058",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should accept valid 10-digit numeric account numbers", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/workspaces/${workspaceId}/bank/resolve`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          accountNumber: "0123456789",
          bankCode: "058",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().verified).toBe(true);
      expect(response.json().accountName).toBeDefined();
    });
  });

  describe("Hardening: File Upload Extension and MIME Validation", () => {
    it("should reject unauthorized executable or script file extensions", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/uploads/presigned-url",
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          fileName: "malicious.sh",
          contentType: "application/x-sh",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("Only images (JPEG, PNG) and PDFs are allowed");
    });
  });
});
