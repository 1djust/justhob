if (process.env.NODE_ENV === "production")
  throw new Error("CRITICAL: Cannot run test scripts in production!");

import { prisma } from "./apps/api/src/lib/database";

async function setupScenario() {
  console.log("🛠️  Setting up Lease Expiry Scenario (30 Days)...");

  // Find the test tenant
  const tenant = await prisma.tenant.findFirst({
    where: { email: "tenant@justhob.com" },
    include: { leases: true },
  });

  if (!tenant || tenant.leases.length === 0) {
    console.error("❌ Could not find test tenant or lease.");
    return;
  }

  const lease = tenant.leases[0];
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 30);
  targetDate.setHours(0, 0, 0, 0);

  // Update lease to expire in exactly 30 days
  await prisma.lease.update({
    where: { id: lease.id },
    data: {
      status: "ACTIVE",
      endDate: targetDate,
    },
  });

  console.log(
    `✅ Success! Lease for ${tenant.name} updated to expire on ${targetDate.toDateString()} (30 days from now).`,
  );
  console.log(
    '\n👉 Now, go to your Admin Dashboard and click "Run System Jobs Now"!',
  );
}

setupScenario()
  .catch(console.error)
  .finally(() => process.exit(0));
