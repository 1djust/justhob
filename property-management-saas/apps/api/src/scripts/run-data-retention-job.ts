import "dotenv/config";
import dns from "dns/promises";

async function main() {
  console.log("==================================================");
  console.log("🚀 STARTING AUTOMATED DATA RETENTION CLOUD JOB");
  console.log("==================================================");
  console.log(`Execution Time : ${new Date().toISOString()}`);

  // Apply IPv4 DNS fix for Supabase host resolution
  const host = "aws-1-eu-north-1.pooler.supabase.com";
  try {
    const ips = await dns.resolve4(host);
    if (ips && ips.length > 0) {
      const dbIp = ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0];
      if (process.env.DATABASE_URL) {
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace(host, dbIp);
      }
      if (process.env.DIRECT_URL) {
        process.env.DIRECT_URL = process.env.DIRECT_URL.replace(host, dbIp);
      }
    }
  } catch {
    // Ignore DNS error and fall back to default env URL
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { supabaseAdmin } = await import("../lib/supabase");
  const { sendEmail } = await import("../lib/mailer");

  const adminEmail = process.env.ADMIN_EMAIL || "ogunduyijustus@gmail.com";
  const retentionWebhookDays = parseInt(process.env.DATA_RETENTION_WEBHOOK_DAYS || "30", 10);
  const retentionErrorLogDays = parseInt(process.env.DATA_RETENTION_ERROR_LOG_DAYS || "90", 10);
  const retentionSecurityLogDays = parseInt(process.env.DATA_RETENTION_SECURITY_LOG_DAYS || "180", 10);

  function daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  const results: { table: string; deletedCount: number; retentionDays: number }[] = [];
  const errors: string[] = [];

  // 1. Purge old WebhookEvent records
  try {
    const cutoff = daysAgo(retentionWebhookDays);
    const { count } = await prisma.webhookEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    results.push({ table: "WebhookEvent", deletedCount: count, retentionDays: retentionWebhookDays });
    console.log(`[RETENTION] Purged ${count} WebhookEvent records older than ${retentionWebhookDays} days.`);
  } catch (err) {
    const msg = `WebhookEvent cleanup failed: ${(err as Error).message}`;
    errors.push(msg);
    console.error(`[ERROR] ${msg}`);
  }

  // 2. Purge old ErrorLog entries
  try {
    const cutoff = daysAgo(retentionErrorLogDays);
    const { count } = await prisma.errorLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    results.push({ table: "ErrorLog", deletedCount: count, retentionDays: retentionErrorLogDays });
    console.log(`[RETENTION] Purged ${count} ErrorLog entries older than ${retentionErrorLogDays} days.`);
  } catch (err) {
    const msg = `ErrorLog cleanup failed: ${(err as Error).message}`;
    errors.push(msg);
    console.error(`[ERROR] ${msg}`);
  }

  // 3. Purge old SecurityAuditLog entries
  try {
    const cutoff = daysAgo(retentionSecurityLogDays);
    const { count } = await prisma.securityAuditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    results.push({ table: "SecurityAuditLog", deletedCount: count, retentionDays: retentionSecurityLogDays });
    console.log(`[RETENTION] Purged ${count} SecurityAuditLog entries older than ${retentionSecurityLogDays} days.`);
  } catch (err) {
    const msg = `SecurityAuditLog cleanup failed: ${(err as Error).message}`;
    errors.push(msg);
    console.error(`[ERROR] ${msg}`);
  }

  // 4. Scan and clean orphaned files in Supabase Storage
  let removedOrphansCount = 0;
  try {
    const allStoragePaths: string[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data: files, error } = await supabaseAdmin.storage
        .from("uploads")
        .list("", { limit: PAGE_SIZE, offset });

      if (error) {
        errors.push(`Storage listing failed: ${error.message}`);
        break;
      }
      if (!files || files.length === 0) break;

      for (const file of files) {
        if (file.name && file.id) {
          allStoragePaths.push(file.name);
        }
      }
      if (files.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (allStoragePaths.length > 0) {
      const referencedUrls = new Set<string>();
      const [properties, maintenanceRequests, leases, payments, paymentTransactions, upgradeRequests, legalLeaseRequests] =
        await Promise.all([
          prisma.property.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
          prisma.maintenanceRequest.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
          prisma.lease.findMany({ where: { OR: [{ signatureUrl: { not: null } }, { legalDocUrl: { not: null } }] }, select: { signatureUrl: true, legalDocUrl: true } }),
          prisma.payment.findMany({ where: { OR: [{ paymentUrl: { not: null } }, { proofUrl: { not: null } }] }, select: { paymentUrl: true, proofUrl: true } }),
          prisma.paymentTransaction.findMany({ where: { proofUrl: { not: null } }, select: { proofUrl: true } }),
          prisma.upgradeRequest.findMany({ select: { proofUrl: true } }),
          prisma.legalLeaseRequest.findMany({ select: { proofUrl: true } }),
        ]);

      for (const p of properties) if (p.imageUrl) referencedUrls.add(p.imageUrl);
      for (const m of maintenanceRequests) if (m.imageUrl) referencedUrls.add(m.imageUrl);
      for (const l of leases) {
        if (l.signatureUrl) referencedUrls.add(l.signatureUrl);
        if (l.legalDocUrl) referencedUrls.add(l.legalDocUrl);
      }
      for (const pay of payments) {
        if (pay.paymentUrl) referencedUrls.add(pay.paymentUrl);
        if (pay.proofUrl) referencedUrls.add(pay.proofUrl);
      }
      for (const pt of paymentTransactions) if (pt.proofUrl) referencedUrls.add(pt.proofUrl);
      for (const ur of upgradeRequests) if (ur.proofUrl) referencedUrls.add(ur.proofUrl);
      for (const llr of legalLeaseRequests) if (llr.proofUrl) referencedUrls.add(llr.proofUrl);

      const orphanedPaths: string[] = [];
      for (const storagePath of allStoragePaths) {
        const isReferenced = Array.from(referencedUrls).some((url) => url.includes(storagePath));
        if (!isReferenced) {
          orphanedPaths.push(storagePath);
        }
      }

      if (orphanedPaths.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < orphanedPaths.length; i += BATCH_SIZE) {
          const batch = orphanedPaths.slice(i, i + BATCH_SIZE);
          const { error } = await supabaseAdmin.storage.from("uploads").remove(batch);
          if (error) {
            errors.push(`Orphan removal batch error: ${error.message}`);
          } else {
            removedOrphansCount += batch.length;
          }
        }
      }
    }
    console.log(`[STORAGE] Removed ${removedOrphansCount} orphaned files from 'uploads' bucket.`);
  } catch (err) {
    const msg = `Orphan file cleanup failed: ${(err as Error).message}`;
    errors.push(msg);
    console.error(`[ERROR] ${msg}`);
  }

  // 5. Total counts & Email Report
  const totalPurged = results.reduce((sum, r) => sum + r.deletedCount, 0);

  // Read current database counts for summary
  const [currentWebhooks, currentErrors, currentSecurity] = await Promise.all([
    prisma.webhookEvent.count(),
    prisma.errorLog.count(),
    prisma.securityAuditLog.count(),
  ]);

  console.log(`\nCurrent Database Status:`);
  console.log(`  • WebhookEvent records     : ${currentWebhooks}`);
  console.log(`  • ErrorLog entries         : ${currentErrors}`);
  console.log(`  • SecurityAuditLog entries : ${currentSecurity}`);

  const report = `
Data Retention Policy — Cloud Automated Report
══════════════════════════════════════════════
Status: Completed
Timestamp: ${new Date().toISOString()}
Target Admin: ${adminEmail}

Summary of Actions Taken:
${results.map((r) => `  • ${r.table}: ${r.deletedCount} records purged (retention threshold: ${r.retentionDays} days)`).join("\n")}
  • Storage Cleanup: ${removedOrphansCount} orphaned files removed from 'uploads' bucket

Current Database Active Footprint:
  • WebhookEvent records     : ${currentWebhooks}
  • ErrorLog entries         : ${currentErrors}
  • SecurityAuditLog entries : ${currentSecurity}

${errors.length > 0 ? `⚠️ Errors Encountered:\n${errors.map((e) => `  • ${e}`).join("\n")}` : "✅ All database and storage operations completed with zero errors."}
`;

  console.log(`\nDispatching summary email report to ${adminEmail}...`);
  await sendEmail(
    adminEmail,
    `[AUTOMATED] PropertyStack Daily Data Retention Report — ${totalPurged + removedOrphansCount} items cleaned`,
    report
  );

  console.log("✅ Email report dispatched successfully!");
  console.log("==================================================");
  console.log("CLOUD JOB COMPLETED SUCCESSFULLY");
  console.log("==================================================");

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal Job Error:", err);
  process.exit(1);
});
