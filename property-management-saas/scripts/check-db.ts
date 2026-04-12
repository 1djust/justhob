import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      leases: {
        include: {
          payments: true,
          property: true
        }
      }
    }
  });
  
  console.log('--- DATABASE DIAGNOSTIC ---');
  console.log('Total Tenants:', tenants.length);
  
  for (const tenant of tenants) {
    console.log(`\nTenant: ${tenant.name} (${tenant.email})`);
    console.log(`Leases: ${tenant.leases.length}`);
    for (const lease of tenant.leases) {
      console.log(`  - Lease: ${lease.id} (${lease.status})`);
      console.log(`    - Property: ${lease.property?.name}`);
      console.log(`    - Payments: ${lease.payments.length}`);
      for (const payment of lease.payments) {
        console.log(`      - [${payment.status}] ${payment.amount} - Due: ${payment.dueDate}`);
      }
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
