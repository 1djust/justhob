import { prisma } from './apps/api/src/lib/database';

async function test() {
  const tenantUser = await prisma.user.findUnique({ where: { email: 'tenant@justhob.com' } });
  if (tenantUser) {
    const notifs = await prisma.notification.findMany({
      where: { userId: tenantUser.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    console.log(notifs);
  }
}
test().catch(console.error).finally(() => process.exit(0));
