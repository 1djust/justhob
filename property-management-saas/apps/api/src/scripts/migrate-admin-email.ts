import "dotenv/config";
import dns from "dns/promises";

async function main() {
  const host = "aws-1-eu-north-1.pooler.supabase.com";
  try {
    const ips = await dns.resolve4(host);
    if (ips && ips.length > 0) {
      const dbIp = ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0];
      if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, dbIp);
      if (process.env.DIRECT_URL) process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, dbIp);
    }
  } catch {}

  const { supabaseAdmin } = await import("../lib/supabase");
  const { prisma } = await import("../lib/database");

  console.log("==================================================");
  console.log("MIGRATING APPLICATION ADMIN EMAIL PRIVILEGES");
  console.log("==================================================");

  // 1. Ensure propertystackapp@gmail.com is SUPER_ADMIN and active
  const propertystackEmail = "propertystackapp@gmail.com";
  const propertystackUser = await prisma.user.findFirst({
    where: { email: { equals: propertystackEmail, mode: "insensitive" } },
  });

  if (propertystackUser) {
    const updatedAdmin = await prisma.user.update({
      where: { id: propertystackUser.id },
      data: {
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    console.log(`✅ Verified ${propertystackEmail} as active SUPER_ADMIN (ID: ${updatedAdmin.id})`);
  } else {
    console.log(`⚠️ User ${propertystackEmail} was not found in Prisma database.`);
  }

  // 2. Downgrade ogunduyijustus@gmail.com to USER and deactivate
  const oldEmail = "ogunduyijustus@gmail.com";
  const oldUser = await prisma.user.findFirst({
    where: { email: { equals: oldEmail, mode: "insensitive" } },
  });

  if (oldUser) {
    const updatedOldUser = await prisma.user.update({
      where: { id: oldUser.id },
      data: {
        role: "TENANT",
        isActive: false,
      },
    });
    console.log(`✅ Downgraded ${oldEmail} to role: TENANT, isActive: false (ID: ${updatedOldUser.id})`);
  } else {
    console.log(`ℹ️ User ${oldEmail} not found in Prisma database (no changes needed).`);
  }

  // Also update metadata in Supabase Auth if found
  try {
    const { data: supaUsers } = await supabaseAdmin.auth.admin.listUsers();
    const supaOldUser = supaUsers?.users?.find(
      (u) => u.email?.toLowerCase() === oldEmail.toLowerCase(),
    );
    if (supaOldUser) {
      await supabaseAdmin.auth.admin.updateUserById(supaOldUser.id, {
        user_metadata: {
          ...supaOldUser.user_metadata,
          role: "TENANT",
          isActive: false,
        },
      });
      console.log(`✅ Updated Supabase Auth metadata for ${oldEmail} to role: TENANT`);
    }
  } catch (err: any) {
    console.warn("Notice: Supabase metadata update note:", err?.message || err);
  }

  // 3. Final Verification of all active Super Admins
  const currentSuperAdmins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN", isActive: true },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  console.log("\n==================================================");
  console.log("CURRENT ACTIVE SUPER ADMINS IN DATABASE:");
  console.log("==================================================");
  currentSuperAdmins.forEach((admin, i) => {
    console.log(`  ${i + 1}. ${admin.email} (Name: ${admin.name}, Active: ${admin.isActive})`);
  });
  console.log("==================================================");

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
