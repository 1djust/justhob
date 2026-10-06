import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import dns from "dns/promises";
import { randomUUID } from "crypto";

// Resolve DB hostname to IPv4 BEFORE importing app/prisma (mirrors legal-lease.test.ts logic)
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
const mailer = await import("../src/lib/mailer");
const { notifyLandlordOfPropertyAssignment } = await import(
  "../src/routes/properties"
);

describe("Property Assignment Notifications & Landlord Emails", () => {
  let workspaceId: string;
  let managerId: string;
  let landlordId: string;
  let secondLandlordId: string;
  let testPropertyId: string;
  const managerToken = "token-test-manager-property-notif";

  beforeAll(async () => {
    // 1. Create a test workspace
    const ws = await prisma.workspace.create({
      data: { name: "Property Notification Workspace", plan: "PRO" },
    });
    workspaceId = ws.id;

    // 2. Create Manager user & member
    managerId = randomUUID();
    await prisma.user.create({
      data: {
        id: managerId,
        email: `manager_${Date.now()}@testprops.com`,
        name: "Property Manager Justus",
        role: "PROPERTY_MANAGER",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: managerId,
        role: "PROPERTY_MANAGER",
      },
    });

    // Seed mock auth token for manager
    authCache.set(managerToken, {
      userId: managerId,
      globalUserRole: "PROPERTY_MANAGER",
      isAAL2: false,
      expiresAt: Date.now() + 3600000,
    });

    // 3. Create Landlord 1
    landlordId = randomUUID();
    await prisma.user.create({
      data: {
        id: landlordId,
        email: `landlord1_${Date.now()}@testprops.com`,
        name: "Chief Landlord Alpha",
        role: "LANDLORD",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: landlordId,
        role: "LANDLORD",
      },
    });

    // 4. Create Landlord 2 (for reassignment test)
    secondLandlordId = randomUUID();
    await prisma.user.create({
      data: {
        id: secondLandlordId,
        email: `landlord2_${Date.now()}@testprops.com`,
        name: "Madam Landlord Beta",
        role: "LANDLORD",
      },
    });
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: secondLandlordId,
        role: "LANDLORD",
      },
    });
  });

  afterAll(async () => {
    // Clean up test records
    await prisma.notification.deleteMany({
      where: { userId: { in: [landlordId, secondLandlordId] } },
    });
    if (testPropertyId) {
      await prisma.unit.deleteMany({ where: { propertyId: testPropertyId } });
      await prisma.property.deleteMany({ where: { id: testPropertyId } });
    }
    await prisma.property.deleteMany({ where: { workspaceId } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
    await prisma.user.deleteMany({
      where: { id: { in: [managerId, landlordId, secondLandlordId] } },
    });
    await prisma.workspace.delete({ where: { id: workspaceId } });
  });

  it("notifyLandlordOfPropertyAssignment sends in-app notification, socket event, and email to landlord", async () => {
    const sendEmailSpy = vi.spyOn(mailer, "sendEmail");
    const emitSpy = vi.fn();
    const mockFastify = {
      io: {
        to: vi.fn().mockReturnValue({ emit: emitSpy }),
      },
      log: {
        error: vi.fn(),
      },
    } as any;

    await notifyLandlordOfPropertyAssignment({
      fastify: mockFastify,
      workspaceId,
      propertyId: "test-prop-id-1",
      propertyName: "Emerald Gardens Estate",
      propertyAddress: "12 Palm Avenue, Lekki Phase 1",
      unitsCount: 4,
      ownerId: landlordId,
      managerId,
      frontendUrl: "https://propertystack.vercel.app",
      isUpdate: false,
    });

    // 1. Verify in-app DB notification
    const notification = await prisma.notification.findFirst({
      where: {
        userId: landlordId,
        type: "PROPERTY_ASSIGNED",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(notification).not.toBeNull();
    expect(notification?.title).toContain("New Property Added");
    expect(notification?.message).toContain("Emerald Gardens Estate");
    expect(notification?.message).toContain("12 Palm Avenue");
    expect(notification?.message).toContain("4 units");

    // 2. Verify WebSocket emission
    expect(mockFastify.io.to).toHaveBeenCalledWith(`user:${landlordId}`);
    expect(emitSpy).toHaveBeenCalledWith(
      "NOTIFICATION_CREATED",
      expect.objectContaining({
        title: expect.stringContaining("New Property Added"),
        type: "PROPERTY_ASSIGNED",
      }),
    );

    // 3. Verify transactional email dispatch
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.stringContaining("@testprops.com"),
      expect.stringContaining("New Property Assigned: Emerald Gardens Estate"),
      expect.stringContaining("Emerald Gardens Estate"),
      expect.stringContaining("Emerald Gardens Estate"),
    );

    sendEmailSpy.mockRestore();
  });

  it("POST /api/workspaces/:workspaceId/properties creates property and triggers landlord notifications", async () => {
    const sendEmailSpy = vi.spyOn(mailer, "sendEmail");

    const response = await app.inject({
      method: "POST",
      url: `/api/workspaces/${workspaceId}/properties`,
      headers: {
        Authorization: `Bearer ${managerToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Sapphire Court",
        address: "44 Marine Drive, Victoria Island",
        ownerId: landlordId,
        units: [
          { unitNumber: "A1", type: "TWO_BEDROOM_FLAT" },
          { unitNumber: "A2", type: "THREE_BEDROOM_FLAT" },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.property).toBeDefined();
    expect(body.property.name).toBe("Sapphire Court");
    expect(body.property.ownerId).toBe(landlordId);
    testPropertyId = body.property.id;

    // Resiliently poll for the unawaited background notification
    let notif: any = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      notif = await prisma.notification.findFirst({
        where: {
          userId: landlordId,
          message: { contains: "Sapphire Court" },
        },
      });
      if (notif) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(notif).not.toBeNull();
    expect(notif?.message).toContain("2 units");

    // Resiliently verify email dispatched
    let emailFound = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (
        sendEmailSpy.mock.calls.some(
          (call) =>
            call[0].includes("@testprops.com") &&
            call[1].includes("New Property Assigned: Sapphire Court")
        )
      ) {
        emailFound = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(emailFound).toBe(true);

    sendEmailSpy.mockRestore();
  });

  it("PUT /api/workspaces/:workspaceId/properties/:id reassigns property and triggers notification for the new landlord", async () => {
    const sendEmailSpy = vi.spyOn(mailer, "sendEmail");

    const response = await app.inject({
      method: "PUT",
      url: `/api/workspaces/${workspaceId}/properties/${testPropertyId}`,
      headers: {
        Authorization: `Bearer ${managerToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        name: "Sapphire Court",
        address: "44 Marine Drive, Victoria Island",
        ownerId: secondLandlordId, // Reassigned to Landlord 2!
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.property.ownerId).toBe(secondLandlordId);

    // Resiliently poll for the unawaited background notification
    let notif: any = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      notif = await prisma.notification.findFirst({
        where: {
          userId: secondLandlordId,
          message: { contains: "Sapphire Court" },
        },
      });
      if (notif) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(notif).not.toBeNull();
    expect(notif?.title).toContain("Property Reassigned");

    // Resiliently verify email dispatched to Landlord 2
    let emailFound = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (
        sendEmailSpy.mock.calls.some(
          (call) =>
            call[0].includes("landlord2_") &&
            call[1].includes("New Property Assigned: Sapphire Court")
        )
      ) {
        emailFound = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(emailFound).toBe(true);

    sendEmailSpy.mockRestore();
  });
});
