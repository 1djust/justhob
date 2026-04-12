import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const activeLease = await prisma.lease.findFirst({
    where: { status: 'ACTIVE' }
  });

  if (!activeLease) {
    console.log('No active lease found to seed payment.');
    return;
  }

  const payment = await prisma.payment.create({
    data: {
      leaseId: activeLease.id,
      amount: 150000,
      dueDate: new Date(),
      status: 'PENDING',
      note: 'Test Rent Payment - Proof of Payment Upload Test',
      transactionId: `TEST-${Date.now()}`
    }
  });

  console.log('Successfully seeded test payment:');
  console.log(JSON.stringify(payment, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
