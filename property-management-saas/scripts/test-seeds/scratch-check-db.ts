if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from "@prisma/client";
import fastify from "fastify";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { email: "djokn@gmail.com" },
  });

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: tenant?.workspaceId, role: "TENANT" },
  });

  console.log("Tenant object from DB:", tenant);

  const tenantDashboardObj = await prisma.tenant.findFirst({
    where: {
      workspaceId: membership!.workspaceId,
      email: "djokn@gmail.com",
      deletedAt: null,
    },
    include: {
      workspace: { select: { allowPartialPayments: true } },
    },
  });

  console.log("Tenant with workspace:", tenantDashboardObj);

  const effective =
    tenantDashboardObj?.allowPartialPayments ??
    tenantDashboardObj?.workspace?.allowPartialPayments ??
    true;
  console.log("Effective allowPartialPayments:", effective);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
