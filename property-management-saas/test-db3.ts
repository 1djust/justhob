import { prisma } from './apps/api/src/lib/database';
async function main() {
  const lease = await prisma.lease.findUnique({ where: { id: "0070fd29-c8d7-4858-b66b-6dbe969a6c56" }, include: { tenant: true } });
  console.log(JSON.stringify(lease, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
