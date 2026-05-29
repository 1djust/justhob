import { prisma } from './apps/api/src/lib/database';
async function main() {
  const offers = await prisma.leaseRenewalOffer.findMany({ include: { lease: true } });
  console.log(JSON.stringify(offers, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
