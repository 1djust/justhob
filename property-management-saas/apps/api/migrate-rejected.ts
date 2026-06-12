import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrate() {
  console.log("Starting migration of REJECTED payments...");
  const rejectedPayments = await prisma.payment.findMany({
    where: { status: "REJECTED" as any },
  });

  console.log(`Found ${rejectedPayments.length} REJECTED payments.`);
  const now = new Date();

  for (const p of rejectedPayments) {
    const isOverdue = p.dueDate < now;
    const newStatus = isOverdue ? "OVERDUE" : "PENDING";
    await prisma.payment.update({
      where: { id: p.id },
      data: {
        status: newStatus as any,
      },
    });
    console.log(`Updated payment ${p.id} to ${newStatus}`);
  }

  console.log("Migration complete.");
}

migrate()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
