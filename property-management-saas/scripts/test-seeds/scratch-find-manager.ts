if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { email: "djokn@gmail.com" },
  });

  if (!tenant) {
    console.log("Tenant not found.");
    return;
  }

  const workspaceId = tenant.workspaceId;

  const managers = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: true },
  });

  console.log("Managers in this workspace:");
  managers.forEach((m) => {
    console.log(`- ${m.user.name} (${m.user.email}) - Role: ${m.role}`);
  });
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
