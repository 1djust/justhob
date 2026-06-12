if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { email: 'djokn@gmail.com' },
    include: { leases: true }
  });

  if (!tenant) {
    console.log("Tenant not found. Please log into the web dashboard and add this tenant first.");
    return;
  }
  
  if (tenant.leases.length === 0) {
    console.log("Tenant has no lease. Please assign a lease first from the dashboard.");
    return;
  }

  const leaseId = tenant.leases[0].id;

  const newPayment = await prisma.payment.create({
    data: {
      leaseId,
      workspaceId: tenant.workspaceId,
      amount: tenant.leases[0].yearlyRent,
      status: "PENDING",
      dueDate: new Date(new Date().getTime() - 24*60*60*1000), // 1 day ago
      note: "Overdue Rent for Testing",
    },
  });

  console.log("Created unpaid payment for djokn@gmail.com: ", newPayment.id);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
