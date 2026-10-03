import "dotenv/config";
import dns from "dns/promises";

const PROTECTED_EMAILS = new Set([
  "djohnvpn@gmail.com",
  "djustusvpn@gmail.com",
  "propertystackapp@gmail.com",
  "gbenahonyessiho@gmail.com",
  "ogunduyijustus@gmail.com",
  "cagah37014@preparmy.com",
]);

const TEST_DOMAINS = [
  "@example.com",
  "@test.com",
  "@security.com",
  "@limits.com",
  "@audittest.com",
  "@test-gatekeeper.com",
  "@justhob.com",
  "@ehwit.com",
  "@legaltest.com",
  "@logstest.com",
];

function isTestUser(email?: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  if (PROTECTED_EMAILS.has(lower)) return false;
  if (TEST_DOMAINS.some((d) => lower.endsWith(d))) return true;
  if (
    lower.startsWith("test_") ||
    lower.startsWith("e2e-") ||
    lower.startsWith("super-admin-shield-") ||
    lower.startsWith("realtime-test-") ||
    lower.startsWith("unit_mgr_") ||
    lower.startsWith("ent_mgr_") ||
    lower.startsWith("pro_mgr_") ||
    lower.startsWith("free_mgr_") ||
    lower.startsWith("landlord_") ||
    lower.startsWith("manager_") ||
    lower.startsWith("tenant_") ||
    lower.startsWith("other_") ||
    lower.startsWith("free_tenant_")
  ) {
    return true;
  }
  return false;
}

async function main() {
  console.log("==================================================");
  console.log("🧹 SECOND PASS: CLEANING ORPHAN PRISMA TEST DATA");
  console.log("==================================================");

  const host = "aws-1-eu-north-1.pooler.supabase.com";
  try {
    const ips = await dns.resolve4(host);
    if (ips && ips.length > 0) {
      const dbIp = ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0];
      if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, dbIp);
      if (process.env.DIRECT_URL) process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, dbIp);
    }
  } catch {}

  const { prisma } = await import("../lib/database");

  const allUsers = await prisma.user.findMany();
  const testUsers = allUsers.filter((u) => isTestUser(u.email));

  console.log(`Found ${testUsers.length} test users in Prisma to clean.`);

  for (const user of testUsers) {
    console.log(`Cleaning user: ${user.email} (${user.id})...`);
    try {
      // 1. Unlink owned properties
      await prisma.property.updateMany({
        where: { ownerId: user.id },
        data: { ownerId: null },
      });

      // 2. Delete maintenance messages
      await prisma.maintenanceMessage.deleteMany({
        where: { senderId: user.id },
      });

      // 3. Delete upgrade requests
      await prisma.upgradeRequest.deleteMany({
        where: { userId: user.id },
      });

      // 4. Delete notifications
      await prisma.notification.deleteMany({
        where: { userId: user.id },
      });

      // 5. Delete workspace memberships
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId: user.id },
      });

      for (const m of memberships) {
        await prisma.workspaceMember.delete({
          where: { id: m.id },
        });

        // If workspace now has 0 members, delete workspace
        const remaining = await prisma.workspaceMember.count({
          where: { workspaceId: m.workspaceId },
        });
        if (remaining === 0) {
          await prisma.workspace.delete({
            where: { id: m.workspaceId },
          }).catch(() => {});
        }
      }

      // 6. Delete user
      await prisma.user.delete({
        where: { id: user.id },
      });
      console.log(`  ✓ Successfully deleted user ${user.email}`);
    } catch (err: any) {
      console.error(`  ✗ Error deleting ${user.email}: ${err.message}`);
    }
  }

  // Final count of remaining Prisma users
  const remainingUsers = await prisma.user.findMany({
    select: { email: true, role: true },
  });

  console.log("\n==================================================");
  console.log(`REMAINING PRISMA USERS (${remainingUsers.length} total):`);
  remainingUsers.forEach((u) => console.log(`- [${u.role}] ${u.email}`));
  console.log("==================================================");
}

main().catch(console.error);
