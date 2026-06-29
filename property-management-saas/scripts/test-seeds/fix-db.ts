if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import { prisma } from "./apps/api/src/lib/database";
async function main() {
  await prisma.lease.update({
    where: { id: "0070fd29-c8d7-4858-b66b-6dbe969a6c56" },
    data: { status: "PENDING_RENEWAL" },
  });
  console.log("Lease updated to PENDING_RENEWAL");
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
