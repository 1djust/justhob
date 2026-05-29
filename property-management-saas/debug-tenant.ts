import { prisma } from './apps/api/src/lib/database';

async function debug() {
  const lease = await prisma.lease.findFirst({ where: { status: 'ACTIVE' }, include: { tenant: true } });
  console.log('Lease Tenant name:', lease?.tenant?.name);
  console.log('Lease Tenant email:', lease?.tenant?.email);
  
  const user = await prisma.user.findUnique({ where: { email: lease?.tenant?.email || '' } });
  console.log('User found by email:', !!user, user?.id);

  if (!user) {
    console.log('\nAll users:');
    const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
    for (const u of users) console.log(`  ${u.role}: ${u.email} (${u.id.slice(0,8)}...)`);

    console.log('\nAll tenants:');
    const tenants = await prisma.tenant.findMany({ take: 5, select: { id: true, name: true, email: true } });
    for (const t of tenants) console.log(`  ${t.name}: ${t.email} (${t.id.slice(0,8)}...)`);
  }
}

debug().catch(console.error).finally(() => process.exit(0));
