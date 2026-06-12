if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("❌ Please provide a tenant email.");
    console.log("Usage: npx tsx reset-tenant-payments.ts <tenant-email>");
    console.log("Example: npx tsx reset-tenant-payments.ts djokn@gmail.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return console.log(`❌ User with email ${email} not found`);

  const tenant = await prisma.tenant.findFirst({
    where: { email },
    include: { 
      leases: {
        include: { property: true }
      } 
    }
  });

  if (!tenant || tenant.leases.length === 0) return console.log(`❌ Tenant or leases not found for ${email}`);
  
  const firstLease = tenant.leases[0];

  // Delete all existing payments for this lease
  await prisma.payment.deleteMany({
    where: { leaseId: firstLease.id }
  });
  console.log(`🧹 Cleared all old payments for ${email}.`);

  // Create one completely fresh OVERDUE invoice 
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() - 1); // 1 day ago

  const payment = await prisma.payment.create({
    data: {
      amount: firstLease.yearlyRent,
      dueDate: dueDate,
      status: 'OVERDUE',
      leaseId: firstLease.id,
      workspaceId: firstLease.property.workspaceId,
      amountPaid: null,
      balancePromise: null,
    }
  });

  console.log(`✅ Created 1 fresh test payment (OVERDUE): ${payment.id}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
