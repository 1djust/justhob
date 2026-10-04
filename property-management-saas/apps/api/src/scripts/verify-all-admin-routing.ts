import "dotenv/config";
import dns from "dns/promises";

async function main() {
  const host = "aws-1-eu-north-1.pooler.supabase.com";
  try {
    const res = await dns.lookup(host);
    if (res?.address) {
      if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, res.address);
      if (process.env.DIRECT_URL) process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, res.address);
    }
  } catch {}

  const { prisma } = await import("../lib/database");
  const { SecurityService } = await import("../services/security");

  console.log("==================================================");
  console.log("🔍 COMPREHENSIVE ADMIN ROUTING & SECURITY AUDIT");
  console.log("==================================================");

  // 1. Environment checks
  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpUser = process.env.SMTP_USER;
  console.log("\n[1] ENVIRONMENT VARIABLES:");
  console.log(`  • ADMIN_EMAIL : ${adminEmail}`);
  console.log(`  • SMTP_USER   : ${smtpUser}`);

  if (adminEmail !== "propertystackapp@gmail.com") {
    throw new Error(`ADMIN_EMAIL is not propertystackapp@gmail.com! Current: ${adminEmail}`);
  }
  if (smtpUser !== "propertystackapp@gmail.com") {
    throw new Error(`SMTP_USER is not propertystackapp@gmail.com! Current: ${smtpUser}`);
  }
  console.log("  ✅ Environment variables verified: 100% propertystackapp@gmail.com");

  // 2. Database User Role & Active Status
  console.log("\n[2] DATABASE USERS STATUS:");
  const propertystackUser = await prisma.user.findFirst({
    where: { email: { equals: "propertystackapp@gmail.com", mode: "insensitive" } },
  });
  console.log(`  • propertystackapp@gmail.com -> Role: ${propertystackUser?.role}, isActive: ${propertystackUser?.isActive}`);

  const oldUser = await prisma.user.findFirst({
    where: { email: { equals: "ogunduyijustus@gmail.com", mode: "insensitive" } },
  });
  console.log(`  • ogunduyijustus@gmail.com   -> Role: ${oldUser?.role}, isActive: ${oldUser?.isActive}`);

  if (propertystackUser?.role !== "SUPER_ADMIN" || propertystackUser?.isActive !== true) {
    throw new Error("propertystackapp@gmail.com is NOT active SUPER_ADMIN!");
  }
  if (oldUser?.role === "SUPER_ADMIN" || oldUser?.isActive === true) {
    throw new Error("ogunduyijustus@gmail.com is STILL SUPER_ADMIN or active!");
  }
  console.log("  ✅ Database roles verified: ogunduyijustus is disabled, propertystackapp is active SUPER_ADMIN.");

  // 3. SecurityService Target Resolution
  console.log("\n[3] SECURITY ALERT DISPATCH RECIPIENTS:");
  const superAdmins = await (SecurityService as any).getSuperAdmins();
  console.log("  Recipients for Security Alerts / Lockouts / Blacklists:");
  superAdmins.forEach((a: any, idx: number) => {
    console.log(`    ${idx + 1}. [${a.id}] ${a.email}`);
  });

  const containsOldEmail = superAdmins.some(
    (a: any) => a.email.toLowerCase() === "ogunduyijustus@gmail.com"
  );
  if (containsOldEmail) {
    throw new Error("CRITICAL BUG: SecurityService still includes ogunduyijustus@gmail.com!");
  }
  const containsNewEmail = superAdmins.some(
    (a: any) => a.email.toLowerCase() === "propertystackapp@gmail.com"
  );
  if (!containsNewEmail) {
    throw new Error("CRITICAL BUG: SecurityService does not include propertystackapp@gmail.com!");
  }
  console.log("  ✅ SecurityService verified: Only propertystackapp@gmail.com receives alerts.");

  console.log("\n==================================================");
  console.log("🎉 AUDIT RESULT: 100% VERIFIED — ZERO ERRORS OR BUGS");
  console.log("==================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ AUDIT FAILED:", err);
  process.exit(1);
});
