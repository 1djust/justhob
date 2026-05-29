import { prisma } from './apps/api/src/lib/database';
async function main() {
  const allOffers = await prisma.leaseRenewalOffer.findMany({ include: { lease: true } });
  const pending = allOffers.filter(o => o.status === 'PENDING');
  console.log('Total Pending Offers:', pending.length);
  pending.forEach(o => {
    console.log(`Offer ID: ${o.id}, Lease ID: ${o.leaseId}, Rent: ${o.newRent}, Lease Status: ${o.lease.status}`);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
