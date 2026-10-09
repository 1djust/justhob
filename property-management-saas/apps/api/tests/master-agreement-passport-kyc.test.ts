import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/lib/database";
import { authCache } from "../src/lib/middleware";

describe("Master Tenancy Agreement & Tenant KYC Passport Photo Suite", () => {
  let testWorkspaceId: string;
  let testPropertyId: string;
  let testUnitId: string;
  let testManagerUserId: string;
  let testTenantUserId: string;
  let testTenantId: string;
  let testLease1Id: string;
  let testLease2Id: string;

  const sampleMasterAgreementPdf = "https://example.com/master-building-agreement.pdf";
  const sampleCustomLeasePdf = "https://example.com/custom-lawyer-lease.pdf";
  const samplePassportBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...";

  beforeAll(async () => {
    // 1. Create Workspace
    const workspace = await prisma.workspace.create({
      data: { name: "Agreement & KYC Test Workspace", plan: "PRO" },
    });
    testWorkspaceId = workspace.id;

    // 2. Create Manager User & WorkspaceMember
    testManagerUserId = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id: testManagerUserId,
        email: `manager_${Date.now()}@kyctest.com`,
        name: "Building Manager",
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

    // 3. Create Tenant User & Tenant Profile
    testTenantUserId = crypto.randomUUID();
    const tenantEmail = `tenant_${Date.now()}@kyctest.com`;
    await prisma.user.create({
      data: {
        id: testTenantUserId,
        email: tenantEmail,
        name: "KYC Test Tenant",
        role: "TENANT",
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        id: testTenantUserId,
        workspaceId: testWorkspaceId,
        name: "KYC Test Tenant",
        email: tenantEmail,
        phone: "08098765432",
      },
    });
    testTenantId = tenant.id;

    await prisma.workspaceMember.create({
      data: {
        userId: testTenantUserId,
        workspaceId: testWorkspaceId,
        role: "TENANT",
      },
    });

    // 4. Register mock auth tokens in authCache
    authCache.set("mock-manager-token-kyc", {
      userId: testManagerUserId,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    authCache.set("mock-tenant-token-kyc", {
      userId: testTenantUserId,
      globalUserRole: "TENANT",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  });

  afterAll(async () => {
    // Clean up cache
    authCache.delete("mock-manager-token-kyc");
    authCache.delete("mock-tenant-token-kyc");

    // Clean up database records
    if (testLease1Id) {
      await prisma.lease.deleteMany({ where: { id: testLease1Id } });
    }
    if (testLease2Id) {
      await prisma.lease.deleteMany({ where: { id: testLease2Id } });
    }
    if (testUnitId) {
      await prisma.unit.deleteMany({ where: { id: testUnitId } });
    }
    if (testTenantId) {
      await prisma.tenant.deleteMany({ where: { id: testTenantId } });
    }
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: testWorkspaceId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testManagerUserId, testTenantUserId] } },
    });
    if (testPropertyId) {
      await prisma.property.deleteMany({ where: { id: testPropertyId } });
    }
    if (testWorkspaceId) {
      await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } });
    }
  });

  it("1. Should save master tenancy agreement (agreementDocUrl) when creating property", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/workspaces/${testWorkspaceId}/properties`,
      headers: {
        authorization: "Bearer mock-manager-token-kyc",
      },
      payload: {
        name: "Grand View Towers",
        address: "123 Skyline Blvd",
        agreementDocUrl: sampleMasterAgreementPdf,
        units: [{ unitNumber: "A101", type: "RESIDENTIAL" }],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    testPropertyId = body.id;
    testUnitId = body.units[0].id;

    // Verify stored in DB
    const property = await prisma.property.findUnique({
      where: { id: testPropertyId },
    });
    expect(property).not.toBeNull();
    expect(property?.agreementDocUrl).toBe(sampleMasterAgreementPdf);
  });

  it("2. Should update master tenancy agreement (agreementDocUrl) on existing property", async () => {
    const updatedPdf = "https://example.com/updated-building-agreement-v2.pdf";
    const res = await app.inject({
      method: "PUT",
      url: `/api/workspaces/${testWorkspaceId}/properties/${testPropertyId}`,
      headers: {
        authorization: "Bearer mock-manager-token-kyc",
      },
      payload: {
        agreementDocUrl: updatedPdf,
      },
    });

    expect(res.statusCode).toBe(200);

    const property = await prisma.property.findUnique({
      where: { id: testPropertyId },
    });
    expect(property?.agreementDocUrl).toBe(updatedPdf);
  });

  it("3. Should auto-inherit master property agreementDocUrl when creating lease without custom doc", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/workspaces/${testWorkspaceId}/tenants/${testTenantId}/leases`,
      headers: {
        authorization: "Bearer mock-manager-token-kyc",
      },
      payload: {
        propertyId: testPropertyId,
        unitId: testUnitId,
        startDate: new Date().toISOString(),
        yearlyRent: 1500000,
        agreementText: "Standard lease terms for Unit A101",
        managerSignature: "John Property Manager",
        // Notice: NO legalDocUrl provided!
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    testLease1Id = body.lease.id;

    // Verify lease has auto-inherited property agreementDocUrl
    const lease = await prisma.lease.findUnique({
      where: { id: testLease1Id },
    });
    expect(lease).not.toBeNull();
    expect(lease?.legalDocUrl).toBe("https://example.com/updated-building-agreement-v2.pdf");
    expect(lease?.status).toBe("PENDING_SIGNATURE");
  });

  it("4. Should tenant approve lease with digital signature AND KYC passport photograph", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/tenant/leases/${testLease1Id}/approve`,
      headers: {
        authorization: "Bearer mock-tenant-token-kyc",
      },
      payload: {
        signatureUrl: "KYC Test Tenant",
        passportPhotoUrl: samplePassportBase64,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.lease.status).toBe("ACTIVE");
    expect(body.lease.passportPhotoUrl).toBe(samplePassportBase64);

    // Verify in database: Lease record updated
    const updatedLease = await prisma.lease.findUnique({
      where: { id: testLease1Id },
    });
    expect(updatedLease?.status).toBe("ACTIVE");
    expect(updatedLease?.passportPhotoUrl).toBe(samplePassportBase64);
    expect(updatedLease?.signatureUrl).toBe("KYC Test Tenant");

    // Verify in database: Tenant KYC profile updated
    const updatedTenant = await prisma.tenant.findUnique({
      where: { id: testTenantId },
    });
    expect(updatedTenant?.passportPhotoUrl).toBe(samplePassportBase64);
  });

  it("5. Should return passportPhotoUrl when manager lists workspace tenants", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/workspaces/${testWorkspaceId}/tenants`,
      headers: {
        authorization: "Bearer mock-manager-token-kyc",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const foundTenant = body.tenants.find((t: any) => t.id === testTenantId);
    expect(foundTenant).toBeDefined();
    expect(foundTenant.passportPhotoUrl).toBe(samplePassportBase64);
  });
});
