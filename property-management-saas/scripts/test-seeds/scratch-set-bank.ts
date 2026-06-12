if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { email: 'djokn@gmail.com' },
  });

  if (!tenant) {
    console.log("Tenant not found.");
    return;
  }
  
  const workspaceId = tenant.workspaceId;

  // Update all members in this workspace with test bank details (which includes the owner)
  await prisma.workspaceMember.updateMany({
    where: { workspaceId: workspaceId },
    data: {
      bankCode: "044", // Access Bank
      accountNumber: "1234567890",
      accountName: "Emerald Gardens Property (Test)",
    },
  });

  console.log("Bank details set successfully for the landlord in this workspace!");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
