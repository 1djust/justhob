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

describe("Paid Legal Lease Agreement Flow", () => {
  let testWorkspaceId: string;
  let testPropertyId: string;
  let testManagerUserId: string;
  let testTenantUserId: string;
  let testTenantId: string;
  let testAdminUserId: string;
  let createdLeaseId: string;
  let createdRequestId: string;

  beforeAll(async () => {
    // 1. Create Workspace
    const workspace = await prisma.workspace.create({
      data: { name: "Legal Lease Test Workspace" },
    });
    testWorkspaceId = workspace.id;

    // 2. Create Property
    const property = await prisma.property.create({
      data: {
        workspaceId: testWorkspaceId,
        name: "Legal Test House",
        address: "456 Law Ave",
      },
    });
    testPropertyId = property.id;

    // 3. Create Manager User & WorkspaceMember link
    testManagerUserId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: testManagerUserId,
        email: `manager_${Date.now()}@legaltest.com`,
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

    // 4. Create Tenant User & Tenant
    testTenantUserId = crypto.randomUUID();
    const tenantEmail = `tenant_${Date.now()}@legaltest.com`;
    await prisma.user.create({
      data: {
        id: testTenantUserId,
        email: tenantEmail,
        name: "Test Tenant",
        role: "TENANT",
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        id: testTenantUserId,
        workspaceId: testWorkspaceId,
        name: "Test Tenant",
        email: tenantEmail,
        phone: "08012345678",
      },
    });
    testTenantId = tenant.id;

    // 5. Create Super Admin User
    testAdminUserId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: testAdminUserId,
        email: `admin_${Date.now()}@legaltest.com`,
        name: "Platform Admin",
        role: "SUPER_ADMIN",
      },
    });

    // 6. Populate Auth Cache
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
    if (createdRequestId) {
      await prisma.legalLeaseRequest.deleteMany({
        where: { id: createdRequestId },
      });
    }
    if (createdLeaseId) {
      await prisma.lease.deleteMany({
        where: { id: createdLeaseId },
      });
    }
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
    await prisma.workspaceMember.deleteMany({
      where: { userId: testManagerUserId, workspaceId: testWorkspaceId },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [testManagerUserId, testTenantUserId, testAdminUserId] },
      },
    });
    await prisma.property.deleteMany({ where: { id: testPropertyId } });
    await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } });
  });

  it("POST /api/workspaces/:workspaceId/tenants/:tenantId/legal-lease-request should create pending lease & request", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/workspaces/${testWorkspaceId}/tenants/${testTenantId}/legal-lease-request`,
      headers: {
        authorization: "Bearer mock-manager-token",
      },
      payload: {
        propertyId: testPropertyId,
        startDate: new Date().toISOString(),
        yearlyRent: 1500000, // Fee 150,000
        managerSignature: "Test Manager Signature",
        tenantName: "John Doe",
        tenantAddress: "123 Tenant St",
        landlordName: "Jane Smith",
        landlordAddress: "456 Landlord Rd",
        proofUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.lease).toBeDefined();
    expect(body.legalRequest).toBeDefined();

    createdLeaseId = body.lease.id;
    createdRequestId = body.legalRequest.id;

    // Verify database record statuses
    const dbLease = await prisma.lease.findUnique({
      where: { id: createdLeaseId },
    });
    expect(dbLease?.status).toBe("PENDING_LEGAL_VERIFICATION");
    expect(dbLease?.yearlyRent).toBe(1500000);

    const dbRequest = await prisma.legalLeaseRequest.findUnique({
      where: { id: createdRequestId },
    });
    expect(dbRequest?.status).toBe("PENDING");
    expect(dbRequest?.feeAmount).toBe(150000); // 10% of 1.5M
  });

  it("GET /api/super-admin/legal-lease-requests should return list containing request", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/super-admin/legal-lease-requests",
      headers: {
        authorization: "Bearer mock-admin-token",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.requests).toBeDefined();
    expect(body.requests.length).toBeGreaterThanOrEqual(1);

    const found = body.requests.find((r: any) => r.id === createdRequestId);
    expect(found).toBeDefined();
    expect(found.tenantName).toBe("John Doe");
    expect(found.feeAmount).toBe(150000);
  });

  it("POST /api/super-admin/legal-lease-requests/:id/verify should update request to VERIFIED and lease to PENDING_LEGAL_UPLOAD", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/super-admin/legal-lease-requests/${createdRequestId}/verify`,
      headers: {
        authorization: "Bearer mock-admin-token",
      },
      payload: {
        status: "VERIFIED",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.legalLeaseRequest.status).toBe("VERIFIED");

    // Verify database state changes
    const dbLease = await prisma.lease.findUnique({
      where: { id: createdLeaseId },
    });
    expect(dbLease?.status).toBe("PENDING_LEGAL_UPLOAD");

    const dbRequest = await prisma.legalLeaseRequest.findUnique({
      where: { id: createdRequestId },
    });
    expect(dbRequest?.status).toBe("VERIFIED");
  });

  it("POST /api/workspaces/:workspaceId/tenants/:id/leases/:leaseId/upload-legal-document should update legalDocUrl and transition status to PENDING_SIGNATURE", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/workspaces/${testWorkspaceId}/tenants/${testTenantId}/leases/${createdLeaseId}/upload-legal-document`,
      headers: {
        authorization: "Bearer mock-manager-token",
      },
      payload: {
        legalDocUrl: "data:application/pdf;base64,JVBERi0xLjQKJ...",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.lease.status).toBe("PENDING_SIGNATURE");
    expect(body.lease.legalDocUrl).toBe(
      "data:application/pdf;base64,JVBERi0xLjQKJ...",
    );

    // Verify database updates
    const dbLease = await prisma.lease.findUnique({
      where: { id: createdLeaseId },
    });
    expect(dbLease?.status).toBe("PENDING_SIGNATURE");
    expect(dbLease?.legalDocUrl).toBe(
      "data:application/pdf;base64,JVBERi0xLjQKJ...",
    );
  });

  it("should reject duplicate lease creation and legal lease requests if tenant already has a pending lease", async () => {
    // Attempting to request another legal lease for the same tenant (who is currently in PENDING_SIGNATURE status from the previous test)
    const duplicateRequestRes = await app.inject({
      method: "POST",
      url: `/api/workspaces/${testWorkspaceId}/tenants/${testTenantId}/legal-lease-request`,
      headers: {
        authorization: "Bearer mock-manager-token",
      },
      payload: {
        propertyId: testPropertyId,
        startDate: new Date().toISOString(),
        yearlyRent: 2000000,
        managerSignature: "Test Manager Signature 2",
        tenantName: "John Doe",
        tenantAddress: "123 Tenant St",
        landlordName: "Jane Smith",
        landlordAddress: "456 Landlord Rd",
        proofUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      },
    });

    expect(duplicateRequestRes.statusCode).toBe(400);
    expect(duplicateRequestRes.json().error).toContain(
      "already has an active or pending lease request",
    );

    // Attempting to create a standard lease for the same tenant
    const duplicateStandardLeaseRes = await app.inject({
      method: "POST",
      url: `/api/workspaces/${testWorkspaceId}/tenants/${testTenantId}/leases`,
      headers: {
        authorization: "Bearer mock-manager-token",
      },
      payload: {
        propertyId: testPropertyId,
        startDate: new Date().toISOString(),
        yearlyRent: 2000000,
      },
    });

    expect(duplicateStandardLeaseRes.statusCode).toBe(400);
    expect(duplicateStandardLeaseRes.json().error).toContain(
      "already has an active or pending lease",
    );
  });
});
