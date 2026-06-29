const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const workspaceId = "0d854a1f-7f96-45de-8dad-5143b10fc3ff";
  
  const properties = await prisma.property.findMany({
    where: {
      workspaceId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      units: { orderBy: { unitNumber: "asc" } },
      leases: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          yearlyRent: true,
          tenant: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
        },
      },
    },
  });

  console.log('API Properties Response:');
  console.log(JSON.stringify(properties, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
