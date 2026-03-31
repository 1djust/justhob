
import { prisma } from './packages/database';
async function main() {
  const t = await prisma.tenant.findFirst({ where: { email: 'tenant-final@test.com' } });
  console.log('Tenant Record:', t);
}
main().finally(() => prisma.$disconnect());
