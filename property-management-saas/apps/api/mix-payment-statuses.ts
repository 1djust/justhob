import * as dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(process.cwd(), "../../.env") });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const manager = await prisma.user.findUnique({
    where: { email: "manager@justhob.com" },
  });

  if (!manager) return console.log("Manager not found");

  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: { userId: manager.id },
  });

  if (!workspaceMember) return console.log("Workspace not found");

  const payments = await prisma.payment.findMany({
    where: { workspaceId: workspaceMember.workspaceId },
  });

  const statuses = ["PAID", "PENDING", "UNDER_REVIEW", "OVERDUE"];

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    const newStatus = statuses[i % statuses.length];

    await prisma.payment.update({
      where: { id: p.id },
      data: {
        status: newStatus as any,
        proofUrl:
          newStatus === "UNDER_REVIEW"
            ? "https://example.com/proof.jpg"
            : p.proofUrl,
        rejectionReason: p.rejectionReason,
        paidDate: newStatus === "PAID" ? new Date() : p.paidDate,
      },
    });
    console.log(`Updated ${p.id.slice(0, 8)}... to ${newStatus}`);
  }

  console.log("Done updating payment statuses!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
