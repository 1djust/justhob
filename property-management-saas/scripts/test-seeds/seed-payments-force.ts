if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(process.cwd(), "../../.env") }); 
dotenv.config({ path: join(process.cwd(), ".env") }); 
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "manager@justhob.com" }, include: { workspaces: true } });
    if (!user) return console.log("Manager not found");
    const workspaceId = user.workspaces[0]?.workspaceId;
    if (!workspaceId) return console.log("No workspace");
    console.log("Found workspace:", workspaceId);
    
    // Check if properties exist, if not create them
    let props = await prisma.property.findMany({ where: { workspaceId }});
    if (props.length === 0) {
        console.log("Creating property...");
        const prop = await prisma.property.create({ data: { workspaceId, name: "Luxury Appts", address: "123", type: "RESIDENTIAL", status: "ACTIVE" } });
        const unit = await prisma.unit.create({ data: { propertyId: prop.id, unitNumber: "101", rentAmount: 1000, type: "APARTMENT", status: "VACANT" }});
        const tenant = await prisma.tenant.create({ data: { workspaceId, name: "Test Tenant", email: "test@example.com", phone: "123", status: "ACTIVE" } });
        await prisma.lease.create({ data: { propertyId: prop.id, unitId: unit.id, tenantId: tenant.id, startDate: new Date(), endDate: new Date(), yearlyRent: 12000, status: "ACTIVE" }});
    }

    const leases = await prisma.lease.findMany({ include: { property: true } });
    const myLeases = leases.filter(l => l.property.workspaceId === workspaceId);
    if (myLeases.length === 0) return console.log("No leases");
    
    const statuses = ["PAID", "PENDING", "UNDER_REVIEW", "OVERDUE"];
    for (let i = 0; i < 20; i++) {
      const lease = myLeases[i % myLeases.length];
      const newStatus = statuses[i % statuses.length];
      await prisma.payment.create({
        data: {
          workspaceId,
          leaseId: lease.id,
          amount: 150000,
          dueDate: new Date(Date.now() - i * 100000000),
          status: newStatus as any,
          proofUrl: (newStatus === "UNDER_REVIEW") ? "https://example.com/proof.jpg" : undefined,
          transactionId: `TXN-${Date.now()}-${i}`
        }
      });
    }
    console.log("Success seeding everything!");
  } catch (e) {
    console.log("ERROR", e);
  }
}
run().finally(() => prisma.$disconnect());
