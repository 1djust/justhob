if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import { join } from "path";

// Load .env before initializing Prisma
dotenv.config({ path: join(process.cwd(), "../../.env") }); 
dotenv.config({ path: join(process.cwd(), ".env") }); 

const { prisma } = require("./src/lib/database");

async function seedManagerData() {
  console.log("Seeding data for manager@justhob.com...");

  // Get user
  const user = await prisma.user.findUnique({
    where: { email: "manager@justhob.com" },
    include: { workspaces: true }
  });

  if (!user) {
    console.error("User manager@justhob.com not found!");
    process.exit(1);
  }

  const workspaceId = user.workspaces[0]?.workspaceId;
  if (!workspaceId) {
    console.error("Manager has no workspace!");
    process.exit(1);
  }

  console.log(`Using Workspace ID: ${workspaceId}`);

  // Create Properties
  const properties = [
    { name: "Sunset Apartments", address: "123 Sunset Blvd", type: "RESIDENTIAL" },
    { name: "Ocean View Complex", address: "456 Ocean Dr", type: "RESIDENTIAL" },
    { name: "Downtown Office Plaza", address: "789 Main St", type: "COMMERCIAL" },
  ];

  const createdProperties = [];
  for (const p of properties) {
    const prop = await prisma.property.create({
      data: {
        workspaceId,
        name: p.name,
        address: p.address,
        type: p.type,
        status: "ACTIVE"
      }
    });
    createdProperties.push(prop);
  }

  console.log("Created properties:", createdProperties.map(p => p.name));

  // Create Units
  const units = [];
  for (const prop of createdProperties) {
    for (let i = 1; i <= 5; i++) {
      const unit = await prisma.unit.create({
        data: {
          propertyId: prop.id,
          unitNumber: `${i}0${i}`,
          type: prop.type === "RESIDENTIAL" ? "APARTMENT" : "OFFICE",
          status: "VACANT",
          rentAmount: Math.floor(Math.random() * 5000) + 1000,
        }
      });
      units.push(unit);
    }
  }

  console.log(`Created ${units.length} units.`);

  // Create Tenants
  const tenantNames = [
    "Emily Bennett", "Michael Thompson", "Olivia Rhye", "Ethan Roberts",
    "Sarah Jenkins", "David Chen", "Marcus Johnson", "Sophia Patel",
    "James Wilson", "Isabella Garcia"
  ];

  const createdTenants = [];
  for (const name of tenantNames) {
    const tenant = await prisma.tenant.create({
      data: {
        workspaceId,
        name,
        email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
        phone: "+1234567890",
        status: "ACTIVE"
      }
    });
    createdTenants.push(tenant);
  }

  console.log(`Created ${createdTenants.length} tenants.`);

  // Create Leases
  let tenantIdx = 0;
  for (let i = 0; i < 10; i++) {
    const unit = units[i];
    const tenant = createdTenants[tenantIdx++];
    
    // Some leases start early this year, some late last year
    const startYear = new Date().getFullYear();
    const startMonth = Math.floor(Math.random() * 6); // Jan to Jun
    const startDate = new Date(startYear, startMonth, 1);
    
    // Some are 1 year, some are 6 months
    const durationMonths = Math.random() > 0.5 ? 12 : 6;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    await prisma.lease.create({
      data: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        tenantId: tenant.id,
        startDate,
        endDate,
        yearlyRent: unit.rentAmount * 12,
        status: "ACTIVE"
      }
    });

    // Mark unit as occupied
    await prisma.unit.update({
      where: { id: unit.id },
      data: { status: "OCCUPIED" }
    });
  }

  // Create an overlapping/expired lease
  const expiredTenant = createdTenants[tenantIdx++];
  if(expiredTenant) {
    await prisma.lease.create({
      data: {
        propertyId: units[0].propertyId,
        unitId: units[0].id,
        tenantId: expiredTenant.id,
        startDate: new Date(new Date().getFullYear() - 1, 0, 1),
        endDate: new Date(new Date().getFullYear() - 1, 11, 31),
        yearlyRent: units[0].rentAmount * 12,
        status: "EXPIRED"
      }
    });
  }

  console.log("Created leases.");
  console.log("✨ Seed data complete!");
}

seedManagerData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
