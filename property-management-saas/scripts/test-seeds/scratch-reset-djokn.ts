if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'djokn@gmail.com' } });
  if (!user) return console.log("User not found");

  const tenant = await prisma.tenant.findFirst({
    where: { email: 'djokn@gmail.com' },
    include: { leases: true }
  });

  if (!tenant || tenant.leases.length === 0) return console.log("Tenant or leases not found");
  
  const firstLease = tenant.leases[0];

  // Delete all existing payments for this lease to clear out the messy duplicates
  await prisma.payment.deleteMany({
    where: { leaseId: firstLease.id }
  });
  console.log("Cleared old payments.");

  // Create one completely fresh OVERDUE invoice 
  // (we make it slightly overdue so it shows up prominently)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() - 1); // 1 day ago

  const payment = await prisma.payment.create({
    data: {
      amount: firstLease.yearlyRent,
      dueDate: dueDate,
      status: 'OVERDUE',
      leaseId: firstLease.id,
      amountPaid: null,
      balancePromise: null,
    }
  });

  console.log("Created fresh test payment:", payment.id);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
