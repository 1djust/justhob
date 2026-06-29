if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), "apps/api/.env") });
dotenv.config({ path: join(process.cwd(), ".env") });

const { prisma } = require("./apps/api/src/lib/database");
const { hash } = require("bcryptjs");

async function run() {
  const email = "djokn@gmail.com";

  // Find Pro manager
  const proManager = await prisma.user.findUnique({
    where: { email: "manager_pro@justhob.com" },
  });
  if (!proManager) return console.log("Pro manager not found");

  const wm = await prisma.workspaceMember.findFirst({
    where: { userId: proManager.id },
  });
  if (!wm) return console.log("Workspace not found");
  const workspaceId = wm.workspaceId;

  // Find a property
  const property = await prisma.property.findFirst({ where: { workspaceId } });
  if (!property) return console.log("No property found");

  // Find a unit
  const unit = await prisma.unit.findFirst({
    where: { propertyId: property.id },
  });
  if (!unit) return console.log("No unit found");

  // Create Tenant record
  let tenant = await prisma.tenant.findFirst({ where: { email } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Mode Ola (Tester)",
        email,
        phone: "08012345678",
        workspaceId,
      },
    });
    console.log("Created Tenant record");
  }

  // Create Lease
  await prisma.lease.create({
    data: {
      tenantId: tenant.id,
      unitId: unit.id,
      propertyId: property.id,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      yearlyRent: 1500000,
      status: "ACTIVE",
    },
  });
  console.log("Created Lease");

  // Ensure User record exists
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: "Mode Ola",
        password: await hash("Test1234!", 10),
      },
    });
  }

  // Link to workspace
  const existingWm = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, workspaceId },
  });
  if (!existingWm) {
    await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId,
        role: "TENANT",
      },
    });
  }

  console.log(
    "✅ Successfully set up djokn@gmail.com with tenant profile, lease, and workspace access!",
  );
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
