import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import dns from "dns/promises";
import { randomUUID } from "crypto";

// Resolve DB hostname to IPv4 BEFORE importing app/prisma
const DB_HOST = "aws-1-eu-north-1.pooler.supabase.com";
try {
  const ips = await dns.resolve4(DB_HOST);
  const isPoolerPort = process.env.DATABASE_URL?.includes(":6543");
  const dbIp = isPoolerPort
    ? (ips?.includes("51.21.18.29") ? "51.21.18.29" : ips?.[0] || "51.21.18.29")
    : (ips?.includes("51.21.189.77") ? "51.21.189.77" : (ips && ips.length > 1 ? ips[1] : "51.21.189.77"));
  const directIp = ips?.includes("51.21.189.77") ? "51.21.189.77" : ips?.[0] || "51.21.189.77";

  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace(DB_HOST, dbIp);
    if (!isPoolerPort && process.env.DATABASE_URL.includes("51.21.18.29")) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace("51.21.18.29", "51.21.189.77");
    }
  }
  if (process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.DIRECT_URL.replace(DB_HOST, directIp);
  }
} catch {
  if (process.env.DATABASE_URL?.includes(":5432") && process.env.DATABASE_URL.includes("51.21.18.29")) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace("51.21.18.29", "51.21.189.77");
  }
}

const { app } = await import("../src/app");
const { prisma } = await import("../src/lib/database");
const { authCache } = await import("../src/lib/middleware");
const mailer = await import("../src/lib/mailer");
const {
  sendTenantWelcomeEmail,
  notifyLandlordsOfNewTenant,
  notifyTenantOfLeaseReadyToSign,
} = await import("../src/routes/tenants");

describe("Tenant Creation Notifications & Welcome Emails", () => {
  let workspaceId: string;
  let managerId: string;
  let landlordMemberId: string;
  let propertyOwnerId: string;
  let propertyId: string;
  const managerToken = "token-test-manager-notif";

  beforeAll(async () => {
    // 1. Create a test workspace
    const ws = await prisma.workspace.create({
      data: { name: "Notification Test Workspace", plan: "PRO" },
    });
    workspaceId = ws.id;

    // 2. Create Manager user & member
    managerId = randomUUID();
    await prisma.user.create({
      data: {
        id: managerId,
        email: `manager_${Date.now()}@testpropertystack.com`,
        name: "Test Manager",
        role: "PROPERTY_MANAGER",
      },
    });
    await prisma.workspaceMember.create({
      data: { workspaceId, userId: managerId, role: "PROPERTY_MANAGER" },
    });

    // 3. Create Landlord Workspace Member
    landlordMemberId = randomUUID();
    await prisma.user.create({
      data: {
        id: landlordMemberId,
        email: `landlord_member_${Date.now()}@testpropertystack.com`,
        name: "Landlord Member",
        role: "LANDLORD",
      },
    });
    await prisma.workspaceMember.create({
      data: { workspaceId, userId: landlordMemberId, role: "LANDLORD" },
    });

    // 4. Create Property Owner (assigned via Property.ownerId)
    propertyOwnerId = randomUUID();
    await prisma.user.create({
      data: {
        id: propertyOwnerId,
        email: `property_owner_${Date.now()}@testpropertystack.com`,
        name: "Property Owner",
        role: "LANDLORD",
      },
    });
    const prop = await prisma.property.create({
      data: {
        name: "Sunset Heights",
        address: "123 Ocean View",
        workspaceId,
        ownerId: propertyOwnerId,
      },
    });
    propertyId = prop.id;

    // 5. Setup Auth Token Mocking
    authCache.set(managerToken, {
      userId: managerId,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  });

  afterAll(async () => {
    try {
      await prisma.notification.deleteMany({
        where: { userId: { in: [landlordMemberId, propertyOwnerId] } },
      });
      await prisma.property.deleteMany({ where: { id: propertyId } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
      await prisma.tenant.deleteMany({ where: { workspaceId } });
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
      await prisma.user.deleteMany({
        where: { id: { in: [managerId, landlordMemberId, propertyOwnerId] } },
      });
    } catch {
      // Cleanup best-effort
    }
  });

  it("sendTenantWelcomeEmail formats email with credentials and mobile app download instructions", async () => {
    const sendMailSpy = vi.spyOn(mailer, "sendEmail");

    await sendTenantWelcomeEmail({
      tenantEmail: "newtenant@example.com",
      tenantName: "Alice Walker",
      managerName: "Test Manager",
      workspaceName: "Notification Test Workspace",
      tempPassword: "SecureTempPassword!123",
      frontendUrl: "https://justhob.vercel.app",
    });

    expect(sendMailSpy).toHaveBeenCalled();
    const lastCall = sendMailSpy.mock.calls[sendMailSpy.mock.calls.length - 1];
    const [to, subject, text, html] = lastCall;

    expect(to).toBe("newtenant@example.com");
    expect(subject).toContain("Welcome to Notification Test Workspace");

    // Plain text checks
    expect(text).toContain("newtenant@example.com");
    expect(text).toContain("SecureTempPassword!123");
    expect(text).toContain("/download");

    // HTML checks
    expect(html).toContain("Alice Walker");
    expect(html).toContain("SecureTempPassword!123");
    expect(html).toContain("Sign In to Your Account");
    expect(html).toContain("/download");
  });

  it("notifyLandlordsOfNewTenant sends in-app notifications, socket events, and emails to all landlords in workspace", async () => {
    const sendMailSpy = vi.spyOn(mailer, "sendEmail");
    const emittedEvents: Array<{ room: string; event: string; payload: unknown }> = [];

    const mockFastify = {
      io: {
        to: (room: string) => ({
          emit: (event: string, payload: unknown) => {
            emittedEvents.push({ room, event, payload });
          },
        }),
      },
      log: {
        error: vi.fn(),
      },
    } as any;

    await notifyLandlordsOfNewTenant({
      fastify: mockFastify,
      workspaceId,
      tenantName: "John Doe",
      tenantEmail: "johndoe@example.com",
      tenantPhone: "+1-555-0199",
      managerName: "Test Manager",
      workspaceName: "Notification Test Workspace",
      frontendUrl: "https://justhob.vercel.app",
    });

    // 1. Verify in-app notifications were created in the database
    const notifications = await prisma.notification.findMany({
      where: {
        userId: { in: [landlordMemberId, propertyOwnerId] },
        type: "TENANT_CREATED",
      },
    });

    expect(notifications.length).toBe(2);
    expect(notifications.some((n) => n.userId === landlordMemberId)).toBe(true);
    expect(notifications.some((n) => n.userId === propertyOwnerId)).toBe(true);
    expect(notifications[0].title).toBe("New Tenant Created");
    expect(notifications[0].message).toContain("John Doe");

    // 2. Verify socket events were emitted to each landlord's room
    const memberSocketEvent = emittedEvents.find(
      (e) => e.room === `user:${landlordMemberId}` && e.event === "NOTIFICATION_CREATED"
    );
    const ownerSocketEvent = emittedEvents.find(
      (e) => e.room === `user:${propertyOwnerId}` && e.event === "NOTIFICATION_CREATED"
    );

    expect(memberSocketEvent).toBeDefined();
    expect(ownerSocketEvent).toBeDefined();

    // 3. Verify emails were dispatched to both landlords
    const landlordCalls = sendMailSpy.mock.calls.filter((call) =>
      call[1].includes("New Tenant Profile Created: John Doe")
    );
    expect(landlordCalls.length).toBe(2);

    const recipientEmails = landlordCalls.map((c) => c[0]);
    const memberUser = await prisma.user.findUnique({ where: { id: landlordMemberId } });
    const ownerUser = await prisma.user.findUnique({ where: { id: propertyOwnerId } });

    expect(recipientEmails).toContain(memberUser!.email);
    expect(recipientEmails).toContain(ownerUser!.email);

    // Verify landlord email content
    const landlordEmailHtml = landlordCalls[0][3];
    expect(landlordEmailHtml).toContain("John Doe");
    expect(landlordEmailHtml).toContain("johndoe@example.com");
    expect(landlordEmailHtml).toContain("+1-555-0199");
    expect(landlordEmailHtml).toContain("/landlord/tenants");
  });

  it("POST /api/workspaces/:workspaceId/tenants end-to-end endpoint triggers welcome credentials and landlord notifications", async () => {
    const sendMailSpy = vi.spyOn(mailer, "sendEmail");
    const newTenantEmail = `tenant_${Date.now()}@e2enotif.com`;

    const res = await app.inject({
      method: "POST",
      url: `/api/workspaces/${workspaceId}/tenants`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: "Jane Smith",
        email: newTenantEmail,
        phone: "+1-555-9988",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.tenant).toBeDefined();
    expect(body.tenant.name).toBe("Jane Smith");
    expect(body.credentials).toBeDefined();
    expect(body.credentials.email).toBe(newTenantEmail);
    expect(body.credentials.tempPassword).toBeDefined();

    // Resiliently poll for the unawaited background notifications to complete
    let landlordNotifs: unknown[] = [];
    for (let attempt = 0; attempt < 30; attempt++) {
      landlordNotifs = await prisma.notification.findMany({
        where: {
          userId: { in: [landlordMemberId, propertyOwnerId] },
          type: "TENANT_CREATED",
          message: { contains: "Jane Smith" },
        },
      });
      if (landlordNotifs.length === 2) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(landlordNotifs.length).toBe(2);

    // Confirm tenant welcome email was dispatched
    const tenantEmailCalls = sendMailSpy.mock.calls.filter(
      (call) => call[0] === newTenantEmail
    );
    expect(tenantEmailCalls.length).toBeGreaterThanOrEqual(1);
    expect(tenantEmailCalls[0][1]).toContain("Welcome to Notification Test Workspace");
  });

  it("notifyTenantOfLeaseReadyToSign creates DB notification (LEASE_READY_TO_SIGN), emits NOTIFICATION_CREATED, and dispatches branded email to tenant", async () => {
    const sendMailSpy = vi.spyOn(mailer, "sendEmail");
    const emittedEvents: Array<{ room: string; event: string; payload: unknown }> = [];

    // Create a dedicated user & tenant for this test
    const testTenantUserId = randomUUID();
    const testTenantEmail = `lease_tenant_${Date.now()}@testpropertystack.com`;

    await prisma.user.create({
      data: {
        id: testTenantUserId,
        email: testTenantEmail,
        name: "Marcus Aurelius",
        role: "TENANT",
      },
    });

    const tenant = await prisma.tenant.create({
      data: {
        id: testTenantUserId,
        name: "Marcus Aurelius",
        email: testTenantEmail,
        workspaceId,
      },
    });

    const mockFastify = {
      io: {
        to: (room: string) => ({
          emit: (event: string, payload: unknown) => {
            emittedEvents.push({ room, event, payload });
          },
        }),
      },
      log: {
        error: vi.fn(),
      },
    } as any;

    await notifyTenantOfLeaseReadyToSign({
      fastify: mockFastify,
      workspaceId,
      tenantId: tenant.id,
      leaseId: "fake-lease-123",
      propertyName: "Sunset Heights",
      unitNumber: "4B",
      startDate: new Date("2026-11-01"),
      endDate: new Date("2027-10-31"),
      yearlyRent: 3600000,
      managerName: "Test Manager",
      workspaceName: "Notification Test Workspace",
      frontendUrl: "https://justhob.vercel.app",
    });

    // 1. Verify in-app notification in DB
    const notif = await prisma.notification.findFirst({
      where: {
        userId: tenant.id,
        type: "LEASE_READY_TO_SIGN",
      },
    });

    expect(notif).toBeDefined();
    expect(notif!.title).toBe("Lease Agreement Ready for Signature");
    expect(notif!.message).toContain("Test Manager");
    expect(notif!.message).toContain("Sunset Heights");
    expect(notif!.message).toContain("Unit 4B");

    // 2. Verify WebSocket emission
    const socketEvent = emittedEvents.find(
      (e) => e.room === `user:${tenant.id}` && e.event === "NOTIFICATION_CREATED"
    );
    expect(socketEvent).toBeDefined();
    expect((socketEvent!.payload as any).type).toBe("LEASE_READY_TO_SIGN");

    // 3. Verify email dispatch
    const emailCalls = sendMailSpy.mock.calls.filter(
      (call) => call[0] === testTenantEmail
    );
    expect(emailCalls.length).toBeGreaterThanOrEqual(1);
    const [to, subject, text, html] = emailCalls[emailCalls.length - 1];
    expect(to).toBe(testTenantEmail);
    expect(subject).toContain("Lease Agreement Ready for Signature: Sunset Heights");
    expect(text).toContain("Marcus Aurelius");
    expect(text).toContain("Sunset Heights");
    expect(text).toContain("Unit 4B");
    expect(text).toContain("₦3,600,000");
    expect(text).toContain("/download");

    expect(html).toContain("Marcus Aurelius");
    expect(html).toContain("Sunset Heights");
    expect(html).toContain("Unit 4B");
    expect(html).toContain("₦3,600,000");
    expect(html).toContain("Open App & Sign Agreement");
    expect(html).toContain("/download");

    // Cleanup
    await prisma.notification.deleteMany({ where: { userId: tenant.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
    await prisma.user.deleteMany({ where: { id: testTenantUserId } });
  });

  it("POST /api/workspaces/:workspaceId/tenants/:id/leases end-to-end endpoint creates lease with PENDING_SIGNATURE and triggers lease ready notifications to tenant", async () => {
    const sendMailSpy = vi.spyOn(mailer, "sendEmail");

    // 1. Create a tenant with user account
    const tenantUserId = randomUUID();
    const tenantEmail = `e2e_lease_tenant_${Date.now()}@testpropertystack.com`;

    await prisma.user.create({
      data: {
        id: tenantUserId,
        email: tenantEmail,
        name: "David Adeleke",
        role: "TENANT",
      },
    });

    const tenant = await prisma.tenant.create({
      data: {
        id: tenantUserId,
        name: "David Adeleke",
        email: tenantEmail,
        workspaceId,
      },
    });

    // 2. Manager posts new lease for tenant
    const res = await app.inject({
      method: "POST",
      url: `/api/workspaces/${workspaceId}/tenants/${tenant.id}/leases`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        propertyId,
        startDate: "2026-12-01T00:00:00.000Z",
        endDate: "2027-11-30T00:00:00.000Z",
        yearlyRent: 4500000,
        agreementText: "Standard Nigerian Tenancy Agreement Terms",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.lease).toBeDefined();
    expect(body.lease.status).toBe("PENDING_SIGNATURE");
    expect(body.lease.tenantId).toBe(tenant.id);
    expect(body.lease.propertyId).toBe(propertyId);
    expect(body.lease.yearlyRent).toBe(4500000);

    // 3. Poll for the unawaited background notifications
    let leaseNotif: any = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      leaseNotif = await prisma.notification.findFirst({
        where: {
          userId: tenant.id,
          type: "LEASE_READY_TO_SIGN",
        },
      });
      if (leaseNotif) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    expect(leaseNotif).toBeDefined();
    expect(leaseNotif.title).toBe("Lease Agreement Ready for Signature");
    expect(leaseNotif.message).toContain("Sunset Heights");

    // 4. Confirm email was dispatched to tenant
    let emailFound = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const emailCalls = sendMailSpy.mock.calls.filter(
        (call) =>
          call[0] === tenantEmail &&
          call[1].includes("Lease Agreement Ready for Signature")
      );
      if (emailCalls.length > 0) {
        emailFound = true;
        expect(emailCalls[0][3]).toContain("David Adeleke");
        expect(emailCalls[0][3]).toContain("Sunset Heights");
        expect(emailCalls[0][3]).toContain("₦4,500,000");
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(emailFound).toBe(true);

    // Cleanup
    await prisma.notification.deleteMany({ where: { userId: tenant.id } });
    await prisma.lease.deleteMany({ where: { id: body.lease.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
    await prisma.user.deleteMany({ where: { id: tenantUserId } });
  });

  it("Full Lifecycle: Manager assigns lease with Unit -> Tenant notified -> Tenant approves & signs -> Lease ACTIVE & Unit OCCUPIED", async () => {
    const sendMailSpy = vi.spyOn(mailer, "sendEmail");

    // 1. Create a Unit on the test property
    const unit = await prisma.unit.create({
      data: {
        workspaceId,
        propertyId,
        unitNumber: "Penthouse-3A",
        type: "TWO_BEDROOM_FLAT",
        status: "VACANT",
      },
    });

    // 2. Create Tenant user & membership
    const tenantUserId = randomUUID();
    const tenantEmail = `lifecycle_tenant_${Date.now()}@testpropertystack.com`;
    const tenantToken = "token-test-tenant-lifecycle";

    await prisma.user.create({
      data: {
        id: tenantUserId,
        email: tenantEmail,
        name: "Amara Kanu",
        role: "TENANT",
      },
    });

    await prisma.workspaceMember.create({
      data: {
        userId: tenantUserId,
        workspaceId,
        role: "TENANT",
      },
    });

    authCache.set(tenantToken, {
      userId: tenantUserId,
      globalUserRole: "TENANT",
      isAAL2: false,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    const tenant = await prisma.tenant.create({
      data: {
        id: tenantUserId,
        name: "Amara Kanu",
        email: tenantEmail,
        workspaceId,
      },
    });

    // 3. Manager assigns lease for tenant on Penthouse-3A
    const createLeaseRes = await app.inject({
      method: "POST",
      url: `/api/workspaces/${workspaceId}/tenants/${tenant.id}/leases`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        propertyId,
        unitId: unit.id,
        startDate: "2026-11-01T00:00:00.000Z",
        endDate: "2027-10-31T00:00:00.000Z",
        yearlyRent: 7200000,
        agreementText: "Exclusive Tenancy Agreement for Penthouse-3A",
        managerSignature: "Manager Digital Signature 2026",
      },
    });

    expect(createLeaseRes.statusCode).toBe(201);
    const leaseData = createLeaseRes.json().lease;
    expect(leaseData.status).toBe("PENDING_SIGNATURE");
    expect(leaseData.unitId).toBe(unit.id);
    expect(leaseData.yearlyRent).toBe(7200000);

    // 4. Verify in-app notification in DB
    let tenantNotif: any = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      tenantNotif = await prisma.notification.findFirst({
        where: {
          userId: tenantUserId,
          type: "LEASE_READY_TO_SIGN",
        },
      });
      if (tenantNotif) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(tenantNotif).toBeDefined();
    expect(tenantNotif.title).toBe("Lease Agreement Ready for Signature");
    expect(tenantNotif.message).toContain("Penthouse-3A");

    // 5. Verify email was dispatched
    let emailFound = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const emailCalls = sendMailSpy.mock.calls.filter(
        (call) =>
          call[0] === tenantEmail &&
          call[1].includes("Lease Agreement Ready for Signature")
      );
      if (emailCalls.length > 0) {
        emailFound = true;
        expect(emailCalls[0][3]).toContain("Amara Kanu");
        expect(emailCalls[0][3]).toContain("Penthouse-3A");
        expect(emailCalls[0][3]).toContain("₦7,200,000");
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(emailFound).toBe(true);

    // 6. Tenant opens app, reviews and signs the lease
    const approveRes = await app.inject({
      method: "POST",
      url: `/api/tenant/leases/${leaseData.id}/approve`,
      headers: { authorization: `Bearer ${tenantToken}` },
      payload: {
        signatureUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      },
    });

    expect(approveRes.statusCode).toBe(200);
    const approvedLease = approveRes.json().lease;
    expect(approvedLease.status).toBe("ACTIVE");
    expect(approvedLease.signatureUrl).toContain("data:image/png;base64");

    // 7. Verify Unit transitioned to OCCUPIED in database
    const updatedUnit = await prisma.unit.findUnique({
      where: { id: unit.id },
    });
    expect(updatedUnit?.status).toBe("OCCUPIED");

    // 8. Verify Manager received confirmation notification
    const managerNotif = await prisma.notification.findFirst({
      where: {
        userId: managerId,
        title: "Lease Agreement Signed",
      },
    });
    expect(managerNotif).toBeDefined();
    expect(managerNotif?.message).toContain("Amara Kanu");

    // Cleanup
    await prisma.notification.deleteMany({
      where: {
        userId: { in: [tenantUserId, managerId] },
        title: { in: ["Lease Agreement Ready for Signature", "Lease Agreement Signed"] },
      },
    });
    await prisma.lease.deleteMany({ where: { id: leaseData.id } });
    await prisma.unit.deleteMany({ where: { id: unit.id } });
    await prisma.workspaceMember.deleteMany({
      where: { userId: tenantUserId, workspaceId },
    });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
    await prisma.user.deleteMany({ where: { id: tenantUserId } });
  });
});


