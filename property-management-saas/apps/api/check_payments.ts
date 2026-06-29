import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { email: "tenant@justhob.com" },
    include: { leases: { include: { payments: true } } },
  });
  console.log(
    JSON.stringify(
      tenant?.leases?.flatMap((l) => l.payments),
      null,
      2,
    ),
  );
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
