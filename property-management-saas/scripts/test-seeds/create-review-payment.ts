import * as dotenv from "dotenv";
import { join } from "path";

// Load .env before initializing Prisma
dotenv.config({ path: join(process.cwd(), "apps/api/.env") });
dotenv.config({ path: join(process.cwd(), ".env") }); // Fallback

const { prisma } = require(join(process.cwd(), "apps/api/src/lib/database"));

async function main() {
  const tenantEmail = "tenant@justhob.com";
  console.log(`🚀 Creating test payment under review for tenant: ${tenantEmail}`);

  // Find tenant with active leases
  const tenant = await prisma.tenant.findFirst({
    where: { email: tenantEmail },
    include: { leases: true },
  });

  if (!tenant) {
    throw new Error(`Tenant with email ${tenantEmail} not found!`);
  }

  if (!tenant.leases || tenant.leases.length === 0) {
    throw new Error(`Tenant has no leases in the database!`);
  }

  const lease = tenant.leases[0];
  const workspaceId = tenant.workspaceId;

  console.log(`Found lease ID: ${lease.id}, workspace ID: ${workspaceId}`);

  // Create a new payment with status UNDER_REVIEW
  const payment = await prisma.payment.create({
    data: {
      leaseId: lease.id,
      workspaceId: workspaceId,
      amount: 150000,
      status: "UNDER_REVIEW",
      dueDate: new Date(),
      note: "E2E Test Review Payment",
      proofUrl: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23", // mock receipt image
    },
  });

  console.log(`\n✅ SUCCESS! Created payment under review:`);
  console.log(`- Payment ID: ${payment.id}`);
  console.log(`- Lease ID:   ${payment.leaseId}`);
  console.log(`- Amount:     ₦${payment.amount}`);
  console.log(`- Status:     ${payment.status}`);
  console.log(`- Due Date:   ${payment.dueDate.toISOString()}`);
}

main()
  .catch((error) => {
    console.error("❌ Failed to create review payment:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
