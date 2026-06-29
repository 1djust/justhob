if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), "apps/api/.env") });
const prisma = new PrismaClient();

async function fix() {
  const proTenant = await prisma.tenant.findFirst({
    where: { email: "pro-tenant@justhob.com" },
  });
  if (!proTenant) {
    console.log("Pro tenant not found");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: "pro-tenant@justhob.com" },
  });
  if (!user) {
    console.log(
      "Pro user not found in Prisma User table. Has the user logged in yet?",
    );
    return;
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, workspaceId: proTenant.workspaceId },
  });
  if (!member) {
    await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: proTenant.workspaceId,
        role: "TENANT",
      },
    });
    console.log("Created WorkspaceMember for pro-tenant@justhob.com");
  } else {
    console.log("WorkspaceMember already exists");
  }
}
fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
