import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenantEmail = 'ariyoforsolomon@gmail.com';
  
  const offers = await prisma.leaseRenewalOffer.findMany({
    where: {
      lease: {
        tenant: { email: tenantEmail }
      }
    },
    include: {
      lease: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  console.log('--- Lease Renewal Offers for ' + tenantEmail + ' ---');
  console.log(JSON.stringify(offers, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
