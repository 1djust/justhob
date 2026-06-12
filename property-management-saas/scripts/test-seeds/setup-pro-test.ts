if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import "dotenv/config";
import { prisma } from "./lib/database";

async function setupProTest() {
  const email = "manager@justhob.com";
  console.log(`🚀 Setting up Pro Plan test environment for ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      workspaces: {
        where: { role: "PROPERTY_MANAGER" },
        include: { workspace: true },
      },
    },
  });

  if (!user || user.workspaces.length === 0) {
    console.error("❌ Manager workspace not found.");
    return;
  }

  const workspaceId = user.workspaces[0].workspaceId;
  const workspace = user.workspaces[0].workspace;

  if (workspace.plan !== "PRO") {
    console.log("Updating workspace to PRO plan...");
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: "PRO" },
    });
  }

  // 1. Setup 10 Properties
  const currentProps = await prisma.property.count({
    where: { workspaceId, deletedAt: null },
  });
  const propsToCreate = 10 - currentProps;
  if (propsToCreate > 0) {
    console.log(`Creating ${propsToCreate} properties...`);
    for (let i = 0; i < propsToCreate; i++) {
      await prisma.property.create({
        data: {
          name: `Pro Test Property ${currentProps + i + 1}`,
          address: `Address ${currentProps + i + 1}`,
          workspaceId,
        },
      });
    }
  }

  const properties = await prisma.property.findMany({
    where: { workspaceId, deletedAt: null },
  });

  // 2. Setup 50 Units
  const currentUnits = await prisma.unit.count({ where: { workspaceId } });
  const unitsToCreate = 50 - currentUnits;
  if (unitsToCreate > 0) {
    console.log(`Creating ${unitsToCreate} units...`);
    for (let i = 0; i < unitsToCreate; i++) {
      // Distribute units across properties
      const prop = properties[i % properties.length];
      await prisma.unit.create({
        data: {
          unitNumber: `U-${currentUnits + i + 1}`,
          type: "MINI_FLAT",
          propertyId: prop.id,
          workspaceId,
        },
      });
    }
  }

  const units = await prisma.unit.findMany({ where: { workspaceId } });

  // 3. Setup 50 Tenants
  const currentTenants = await prisma.tenant.count({
    where: { workspaceId, deletedAt: null },
  });
  const tenantsToCreate = 50 - currentTenants;
  if (tenantsToCreate > 0) {
    console.log(`Creating ${tenantsToCreate} tenants and leases...`);
    for (let i = 0; i < tenantsToCreate; i++) {
      const unit = units[i % units.length];
      const tenant = await prisma.tenant.create({
        data: {
          name: `Pro Test Tenant ${currentTenants + i + 1}`,
          email: `tenant${currentTenants + i + 1}@example.com`,
          workspaceId,
        },
      });

      await prisma.lease.create({
        data: {
          tenantId: tenant.id,
          propertyId: unit.propertyId,
          unitId: unit.id,
          startDate: new Date(),
          yearlyRent: 1200000,
          status: "ACTIVE",
        },
      });
    }
  }

  await createOwners(workspaceId);

  console.log("\n✨ Pro Plan Test Setup Complete!");
  console.log(`- Properties: 10/10`);
  console.log(`- Units: 50/50`);
  console.log(`- Tenants: 50/50`);
  console.log(`- Owners: 3/3`);
  console.log(
    "\nYou have now HIT THE LIMIT for everything. Your next attempt to add a property, unit, tenant, or owner will be blocked.",
  );
}

async function createOwners(workspaceId: string) {
  const currentOwners = await prisma.workspaceMember.count({
    where: { workspaceId, role: "LANDLORD" },
  });

  const ownersToCreate = 3 - currentOwners;
  if (ownersToCreate > 0) {
    console.log(`Creating ${ownersToCreate} owners...`);
    for (let i = 0; i < ownersToCreate; i++) {
      const email = `owner${currentOwners + i + 1}@example.com`;
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: `test-owner-${currentOwners + i + 1}`,
            email,
            name: `Pro Test Owner ${currentOwners + i + 1}`,
          },
        });
      }

      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId,
          role: "LANDLORD",
        },
      });
    }
  }
}

setupProTest()
  .catch(console.error)
  .finally(() => process.exit());
