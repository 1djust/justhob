import { prisma } from './packages/database';

async function main() {
  const lease = await prisma.lease.findFirst({
    include: {
      payments: true,
      tenant: true
    }
  });

  if (!lease) {
    console.log("No lease found");
    return;
  }

  console.log("=== LEASE INFO ===");
  console.log("Tenant:", lease.tenant?.name);
  console.log("Monthly Rent in DB (mapped to yearlyRent):", lease.yearlyRent);

  console.log("\n=== PAYMENTS INFO ===");
  lease.payments.forEach(p => {
    console.log(`Payment ID: ${p.id} | Amount: ${p.amount} | Status: ${p.status}`);
  });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
