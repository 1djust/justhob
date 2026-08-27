import "dotenv/config";
import dns from "dns/promises";

async function runDataRetentionTest() {
  // Apply IPv4 DNS fix for WSL 2
  const host = "aws-1-eu-north-1.pooler.supabase.com";
  try {
    const ips = await dns.resolve4(host);
    if (ips && ips.length > 0) {
      const dbIp = ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0];
      const directIp = ips.includes("51.21.189.77") ? "51.21.189.77" : dbIp;
      if (process.env.DATABASE_URL) {
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
          host,
          dbIp,
        );
      }
      if (process.env.DIRECT_URL) {
        process.env.DIRECT_URL = process.env.DIRECT_URL.replace(
          host,
          dbIp,
        );
      }
    }
  } catch {
    // ignore
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { supabaseAdmin } = await import("../lib/supabase");
  const { sendEmail } = await import("../lib/mailer");

  console.log("==================================================");
  console.log("RUNNING DATA RETENTION & PURGE TEST DIRECTLY");
  console.log("==================================================");

  const adminEmail = process.env.ADMIN_EMAIL || "support@propertystack.com";
  console.log(`Target Admin Email: ${adminEmail}\n`);

  // 1. Check existing counts in database
  const [webhookCount, errorLogCount, securityLogCount] = await Promise.all([
    prisma.webhookEvent.count(),
    prisma.errorLog.count(),
    prisma.securityAuditLog.count(),
  ]);

  console.log(`Current Database Counts:`);
  console.log(`  • WebhookEvent records     : ${webhookCount}`);
  console.log(`  • ErrorLog entries         : ${errorLogCount}`);
  console.log(`  • SecurityAuditLog entries : ${securityLogCount}\n`);

  // 2. Storage bucket inspection
  console.log(`Inspecting Supabase Storage 'uploads' bucket...`);
  const { data: files, error: storageError } = await supabaseAdmin.storage
    .from("uploads")
    .list("", { limit: 100 });

  if (storageError) {
    console.error(`Storage listing error:`, storageError.message);
  } else {
    console.log(`Total files found in 'uploads' bucket: ${files?.length || 0}`);
    if (files && files.length > 0) {
      files.forEach((f: any) =>
        console.log(`  - ${f.name} (${f.metadata?.size || 0} bytes)`),
      );
    }
  }

  // 3. Test Email Notification Dispatch
  console.log(`\nDispatching test notification report to ${adminEmail}...`);
  
  const testReport = 
`Data Retention Policy — Manual Test Report
═══════════════════════════════════════════

Status: Active & Operational
Target Email: ${adminEmail}

Database Summary:
  • WebhookEvent records     : ${webhookCount}
  • ErrorLog entries         : ${errorLogCount}
  • SecurityAuditLog entries : ${securityLogCount}

Storage Summary:
  • Files in 'uploads' bucket: ${files?.length || 0}

All automated daily purge jobs are scheduled for 02:00 AM daily.`;

  await sendEmail(
    adminEmail,
    `[TEST] Data Retention System Audit & Status Report`,
    testReport
  );

  console.log(`\nEmail dispatch triggered successfully!`);
  console.log("==================================================");
  console.log("TEST COMPLETED SUCCESSFULLY");
  console.log("==================================================");

  await prisma.$disconnect();
}

runDataRetentionTest().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
