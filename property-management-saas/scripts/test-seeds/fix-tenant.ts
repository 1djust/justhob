if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fix() {
  console.log("Fixing tenant profile...");

  const tenantUser = await prisma.user.findUnique({
    where: { email: "tenant@justhob.com" },
  });

  if (!tenantUser) {
    console.error("No tenant user in Prisma!");
    return;
  }

  // 1. Create Landlord
  const landlordUser = await prisma.user.upsert({
    where: { email: "landlord@justhob.com" },
    update: {},
    create: {
      id: crypto.randomUUID(),
      email: "landlord@justhob.com",
      name: "Chioma Landlord",
      role: "LANDLORD",
    },
  });

  // 2. Create Workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: "test-workspace-001" },
    update: {},
    create: { id: "test-workspace-001", name: "PropertyStack Properties" },
  });

  // 3. Assign role TENANT
  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: { userId: tenantUser.id, workspaceId: workspace.id },
    },
    update: { role: "TENANT" },
    create: {
      userId: tenantUser.id,
      workspaceId: workspace.id,
      role: "TENANT",
    },
  });

  // 3b. Assign role LANDLORD with bank details
  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: landlordUser.id,
        workspaceId: workspace.id,
      },
    },
    update: {
      role: "LANDLORD",
      bankCode: "044",
      accountNumber: "1234567890",
      accountName: "Chioma Landlord",
    },
    create: {
      userId: landlordUser.id,
      workspaceId: workspace.id,
      role: "LANDLORD",
      bankCode: "044",
      accountNumber: "1234567890",
      accountName: "Chioma Landlord",
    },
  });

  // 4. Create Property assigned to Landlord
  const prop1 = await prisma.property.upsert({
    where: { id: "test-prop-001" },
    update: { ownerId: landlordUser.id },
    create: {
      id: "test-prop-001",
      name: "Lekki Phase 1 Apartments",
      address: "12 Admiralty Way, Lekki Phase 1, Lagos",
      workspaceId: workspace.id,
      ownerId: landlordUser.id,
    },
  });

  // 5. Create Tenant Profile
  const tenant = await prisma.tenant.upsert({
    where: { id: "test-tenant-001" },
    update: { workspaceId: workspace.id },
    create: {
      id: "test-tenant-001",
      name: "Test Tenant",
      email: "tenant@justhob.com",
      phone: "+2348012345678",
      workspaceId: workspace.id,
    },
  });

  // 6. Create Lease
  await prisma.lease.upsert({
    where: { id: "test-lease-001" },
    update: {},
    create: {
      id: "test-lease-001",
      tenantId: tenant.id,
      propertyId: prop1.id,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      yearlyRent: 2400000,
      status: "ACTIVE",
    },
  });

  console.log("✅ Tenant Profile restored successfully!");
}

fix().catch((e) => {
  console.error(e);
  process.exit(1);
});
