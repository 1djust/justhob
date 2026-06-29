if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { email: "djokn@gmail.com" },
    include: { workspace: true },
  });

  console.log("Tenants found for djokn@gmail.com:", tenants.length);
  for (const t of tenants) {
    console.log(
      `- ID: ${t.id}, Workspace: ${t.workspace.name}, allowPartialPayments: ${t.allowPartialPayments}`,
    );
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
