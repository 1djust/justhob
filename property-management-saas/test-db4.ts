import { prisma } from './apps/api/src/lib/database';
async function main() {
  const offers = await prisma.leaseRenewalOffer.findMany({ 
    where: { leaseId: "0070fd29-c8d7-4858-b66b-6dbe969a6c56", status: "PENDING" }
  });
  console.log(JSON.stringify(offers, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
