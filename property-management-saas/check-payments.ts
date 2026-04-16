import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const payments = await prisma.payment.findMany({
      include: {
        lease: {
          include: {
            tenant: { select: { name: true, email: true } },
            property: { select: { name: true, workspaceId: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('--- ALL PAYMENTS LOG ---');
    payments.forEach(p => {
      console.log(`ID: ${p.id}`);
      console.log(`  Tenant: ${p.lease?.tenant?.name} (${p.lease?.tenant?.email})`);
      console.log(`  Property: ${p.lease?.property?.name}`);
      console.log(`  Amount: ${p.amount}`);
      console.log(`  Status: ${p.status}`);
      console.log(`  WorkspaceID: ${p.workspaceId}`);
      console.log(`  Lease WorkspaceID: ${p.lease?.property?.workspaceId}`);
      console.log(`  Proof: ${p.proofUrl ? 'YES' : 'NO'}`);
      console.log(`  Note: ${p.note || 'None'}`);
      console.log(`  Created: ${p.createdAt}`);
      console.log('------------------------');
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
