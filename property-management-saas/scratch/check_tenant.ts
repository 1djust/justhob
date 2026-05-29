import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { email: 'ariyoforsolomon@gmail.com' },
    include: {
      leases: {
        include: {
          renewalOffers: true
        }
      }
    }
  });
  console.log(JSON.stringify(tenant, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
