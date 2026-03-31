import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
});

async function reset() {
  console.log('🗑️  Wiping all data...\n');

  await prisma.maintenanceRequest.deleteMany();
  console.log('  ✓ Maintenance requests cleared');
  
  await prisma.payment.deleteMany();
  console.log('  ✓ Payments cleared');
  
  await prisma.lease.deleteMany();
  console.log('  ✓ Leases cleared');
  
  await prisma.tenant.deleteMany();
  console.log('  ✓ Tenants cleared');
  
  await prisma.property.deleteMany();
  console.log('  ✓ Properties cleared');
  
  await prisma.workspaceMember.deleteMany();
  console.log('  ✓ Workspace members cleared');
  
  await prisma.workspace.deleteMany();
  console.log('  ✓ Workspaces cleared');
  
  await prisma.user.deleteMany();
  console.log('  ✓ Users cleared');

  console.log('\n✅ Database is completely clean. Ready for manual testing!\n');

  await prisma.$disconnect();
}

reset().catch(e => { console.error(e); process.exit(1); });
