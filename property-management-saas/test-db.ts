import { prisma } from './apps/api/src/lib/database';
async function main() {
  const leases = await prisma.lease.findMany({ include: { renewalOffers: true } });
  console.log(JSON.stringify(leases, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
