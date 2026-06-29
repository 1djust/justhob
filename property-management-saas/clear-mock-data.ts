import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), "apps/api/.env") });
dotenv.config({ path: join(process.cwd(), ".env") }); // Fallback

const { prisma } = require("./apps/api/src/lib/database");

async function clearMockData() {
  console.log(
    "🧹 Clearing mock sample data from PRO and ENTERPRISE workspaces...",
  );

  const mockPropertyNames = [
    "PRO Sample Property",
    "ENTERPRISE Sample Property",
  ];
  const mockTenantNames = ["PRO Tenant", "ENTERPRISE Tenant"];

  // Find all leases attached to the mock properties to delete them first
  // to avoid foreign key constraint errors if cascading deletes are not set up perfectly
  const mockProperties = await prisma.property.findMany({
    where: { name: { in: mockPropertyNames } },
  });

  for (const property of mockProperties) {
    const units = await prisma.unit.findMany({
      where: { propertyId: property.id },
    });

    for (const unit of units) {
      const leases = await prisma.lease.findMany({
        where: { unitId: unit.id },
      });

      for (const lease of leases) {
        await prisma.payment.deleteMany({ where: { leaseId: lease.id } });
        await prisma.maintenanceRequest.deleteMany({
          where: { propertyId: property.id },
        });
      }

      await prisma.lease.deleteMany({ where: { unitId: unit.id } });
    }

    await prisma.unit.deleteMany({ where: { propertyId: property.id } });
    await prisma.property.delete({ where: { id: property.id } });
  }

  // Now delete mock tenants
  for (const tenantName of mockTenantNames) {
    await prisma.tenant.deleteMany({ where: { name: tenantName } });
  }

  console.log("✅ Mock data successfully cleared!");
}

clearMockData()
  .catch(console.error)
  .finally(() => process.exit(0));
