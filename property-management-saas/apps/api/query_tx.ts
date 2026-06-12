import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const payments = await prisma.payment.findMany({
    take: 1,
    orderBy: { createdAt: 'desc' },
    include: { transactions: true }
  });
  console.log(JSON.stringify(payments, null, 2));
}
main().catch(console.error);
