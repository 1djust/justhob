if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import { prisma } from "./apps/api/src/lib/database";

async function check() {
  const pendingPayments = await prisma.payment.findMany({
    where: { status: "PENDING" },
    take: 5,
    include: { lease: { include: { tenant: true, property: true } } },
  });

  console.log(`Found ${pendingPayments.length} PENDING payments:`);
  for (const p of pendingPayments) {
    console.log(
      `  - ID: ${p.id.slice(0, 8)}... | Tenant: ${p.lease.tenant.name} | Property: ${p.lease.property.name} | Amount: ₦${p.amount} | Due: ${p.dueDate.toISOString().split("T")[0]} | LeaseID: ${p.leaseId.slice(0, 8)}...`,
    );
  }

  if (pendingPayments.length === 0) {
    console.log(
      "\nNo PENDING payments found. Showing latest 5 payments (any status):",
    );
    const allPayments = await prisma.payment.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { lease: { include: { tenant: true, property: true } } },
    });
    for (const p of allPayments) {
      console.log(
        `  - ID: ${p.id.slice(0, 8)}... | Status: ${p.status} | Tenant: ${p.lease.tenant.name} | Property: ${p.lease.property.name} | Amount: ₦${p.amount} | Due: ${p.dueDate.toISOString().split("T")[0]}`,
      );
    }
  }
}

check()
  .catch(console.error)
  .finally(() => process.exit(0));
