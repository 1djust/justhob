import 'dotenv/config';
import { prisma } from './lib/database';

async function testInvoiceLimit() {
  console.log('--- Testing Invoice Limits ---');
  
  const managerEmail = 'free-manager@justhob.com';
  
  // 1. Get Free Workspace
  const user = await prisma.user.findUnique({
    where: { email: managerEmail },
    include: { workspaces: { include: { workspace: true } } }
  });

  if (!user || user.workspaces.length === 0) {
    console.error('Free manager not found. Did you run setup-tiers.ts?');
    return;
  }

  const workspace = user.workspaces[0].workspace;

  // 2. Get the Lease (Assuming it was created by setup-test-tenants)
  const lease = await prisma.lease.findFirst({
    where: { property: { workspaceId: workspace.id } }
  });

  if (!lease) {
    console.error('Lease not found for the Free Workspace. Did you run setup-test-tenants.ts?');
    return;
  }

  console.log(`\nTesting FREE Plan limit (Max 5 Invoices)...`);
  
  for (let i = 1; i <= 6; i++) {
    try {
      await prisma.$transaction(async (tx: any) => {
        const ws = await tx.workspace.findUnique({ where: { id: workspace.id } });
        if (ws?.plan === 'FREE') {
          const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          const paymentCount = await tx.payment.count({
            where: { 
              workspaceId: workspace.id, 
              createdAt: { gte: startOfMonth }
            }
          });
          
          if (paymentCount >= 5) {
            throw new Error('LIMIT_INVOICES');
          }
        }

        await tx.payment.create({
          data: {
            leaseId: lease.id,
            workspaceId: workspace.id,
            amount: 50000,
            dueDate: new Date(),
            status: 'PENDING',
            note: `Test Invoice ${i}`,
            transactionId: `TEST-INV-${Date.now()}-${i}`
          }
        });
      }).catch((err: any) => {
        if (err.message === 'LIMIT_INVOICES') {
          throw new Error('Free plan limit reached: Maximum 5 invoices per month.');
        }
        throw err;
      });
      console.log(`✅ Successfully created Invoice (Payment) ${i}`);
    } catch (e: any) {
      console.log(`❌ Failed creating Invoice (Payment) ${i}: ${e.message}`);
    }
  }


  // Now test PRO Plan
  console.log('\nTesting PRO Plan Limits (Unlimited Invoices)...');
  
  const proUser = await prisma.user.findUnique({
    where: { email: 'manager@justhob.com' },
    include: { workspaces: { include: { workspace: true } } }
  });

  if (proUser && proUser.workspaces.length > 0) {
    const proWs = proUser.workspaces[0].workspace;
    const proLease = await prisma.lease.findFirst({ where: { property: { workspaceId: proWs.id } } });

    if (proLease) {
      for (let i = 1; i <= 6; i++) {
        try {
          await prisma.$transaction(async (tx: any) => {
            const ws = await tx.workspace.findUnique({ where: { id: proWs.id } });
            if (ws?.plan === 'FREE') {
              const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
              const paymentCount = await tx.payment.count({
                where: { workspaceId: proWs.id, createdAt: { gte: startOfMonth } }
              });
              if (paymentCount >= 5) throw new Error('LIMIT_INVOICES');
            }

            await tx.payment.create({
              data: {
                leaseId: proLease.id,
                workspaceId: proWs.id,
                amount: 75000,
                dueDate: new Date(),
                status: 'PENDING',
                note: `Pro Test Invoice ${i}`,
                transactionId: `TEST-INV-PRO-${Date.now()}-${i}`
              }
            });
          });
          console.log(`✅ PRO Plan: Successfully created Invoice (Payment) ${i}`);
        } catch (e: any) {
          console.log(`❌ PRO Plan Failed: ${e.message}`);
        }
      }
    } else {
      console.log('Pro Lease not found. Run setup-test-tenants.ts first.');
    }
  }

  console.log('\n✅ Test complete. Check the web dashboard to see the error UI handling.');
}

testInvoiceLimit().catch(console.error).finally(() => process.exit());
