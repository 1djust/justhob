import { prisma } from './packages/database';

async function testFetch() {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('No tenant found to test.');
      return;
    }

    console.log('Found tenant:', tenant.id);
    
    // Simulate the query from GET /payments
    const payments = await prisma.payment.findMany({
      where: {
        lease: {
          tenantId: tenant.id
        }
      },
      include: {
        lease: {
          include: {
            property: { select: { id: true, name: true, address: true } }
          }
        }
      },
      orderBy: { dueDate: 'desc' }
    });

    console.log('Payments fetch success! Count:', payments.length);
  } catch (e: any) {
    console.error('Error fetching payments:', e.message);
  }
}

testFetch().then(() => prisma.$disconnect());
