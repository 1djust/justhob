import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { email: 'tenant@justhob.com' },
    include: { workspace: true }
  });
  console.log("Tenant allowPartialPayments:", tenant?.allowPartialPayments);
  console.log("Workspace allowPartialPayments:", tenant?.workspace?.allowPartialPayments);
}
main().catch(console.error).finally(() => prisma.$disconnect());
