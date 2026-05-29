const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const lease = await prisma.lease.findFirst({
    where: { status: 'ACTIVE' },
    include: { tenant: true, property: true }
  });

  if (!lease) {
    console.log('No active lease found.');
    return;
  }

  console.log(`Found active lease for ${lease.tenant.name} at ${lease.property.name}. Creating renewal offer...`);

  const offer = await prisma.leaseRenewalOffer.create({
    data: {
      leaseId: lease.id,
      newRent: lease.yearlyRent * 1.1, // 10% increase
      newStartDate: new Date('2027-01-01'),
      newEndDate: new Date('2028-01-01'),
      terms: 'Standard terms apply. 10% rent increase.',
      status: 'PENDING'
    }
  });

  await prisma.lease.update({
    where: { id: lease.id },
    data: { status: 'PENDING_RENEWAL' }
  });

  console.log('Renewal offer created successfully:', offer.id);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
