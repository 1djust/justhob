import { prisma } from './packages/database';

async function main() {
  const deleted = await prisma.payment.delete({
    where: { id: 'a7b87f65-e1a2-44c2-9fd4-cbf06f48e3b9' }
  });
  console.log('Deleted payment:', deleted.id, '| Amount:', deleted.amount, '| Status:', deleted.status);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
