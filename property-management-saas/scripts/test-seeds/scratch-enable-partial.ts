if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { email: 'djokn@gmail.com' },
  });

  if (!tenant) {
    console.log("Tenant not found.");
    return;
  }
  
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { allowPartialPayments: true }
  });

  console.log("Enabled allowPartialPayments for djokn@gmail.com!");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
