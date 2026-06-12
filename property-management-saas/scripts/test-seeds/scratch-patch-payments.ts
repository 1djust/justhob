if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.payment.findMany({
    where: { workspaceId: null },
    include: { lease: { include: { property: true } } }
  });

  for (const payment of payments) {
    if (payment.lease?.property?.workspaceId) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { workspaceId: payment.lease.property.workspaceId }
      });
      console.log(`Patched payment ${payment.id} with workspaceId ${payment.lease.property.workspaceId}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
