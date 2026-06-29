if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import * as dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(process.cwd(), "../../.env") });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const m = await prisma.user.findUnique({
    where: { email: "manager@justhob.com" },
  });
  const wm = await prisma.workspaceMember.findFirst({
    where: { userId: m?.id, role: "PROPERTY_MANAGER" },
  });
  console.log("Workspace:", wm?.workspaceId);
  const pmts = await prisma.payment.findMany({
    include: { lease: { include: { property: true } } },
  });
  console.log("Total payments in DB:", pmts.length);
  const myPmts = pmts.filter(
    (p) =>
      p.workspaceId === wm?.workspaceId ||
      p.lease.property.workspaceId === wm?.workspaceId,
  );
  console.log("My payments:", myPmts.length);
  for (let i = 0; i < myPmts.length; i++) {
    console.log(myPmts[i].id, myPmts[i].workspaceId, myPmts[i].status);
  }
}
run().finally(() => prisma.$disconnect());
