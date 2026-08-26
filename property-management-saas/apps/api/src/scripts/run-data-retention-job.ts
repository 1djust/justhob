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

  // 5. Total counts & HTML Email Report
  const totalPurged = results.reduce((sum, r) => sum + r.deletedCount, 0);
  const totalCleaned = totalPurged + removedOrphansCount;

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

  const now = new Date();
  const formattedDate = `${now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} WAT`;

  const webhookResult = results.find((r) => r.table === "WebhookEvent")?.deletedCount || 0;
  const errorLogResult = results.find((r) => r.table === "ErrorLog")?.deletedCount || 0;
  const securityLogResult = results.find((r) => r.table === "SecurityAuditLog")?.deletedCount || 0;

  const htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Retention Report</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner with Official Brand Colors: Deep Navy #0A192F + Electric Blue #0066FF -->
          <tr>
            <td style="background-color: #0A192F; padding: 20px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <!-- Official PropertyStack 3-Layer Logo Icon -->
                          <div style="background: linear-gradient(135deg, #0066FF 0%, #0047BA 100%); width: 38px; height: 38px; border-radius: 9px; text-align: center; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" height="100%">
                              <tr>
                                <td align="center" style="vertical-align: middle; padding-top: 5px;">
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M2 17L12 22L22 17" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M2 12L12 17L22 12" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                  </svg>
                                </td>
                              </tr>
                            </table>
                          </div>
                        </td>
                        <td style="vertical-align: middle;">
                          <div style="color: #ffffff; font-size: 16px; font-weight: 700; letter-spacing: -0.2px;">PropertyStack</div>
                          <div style="color: #93C5FD; font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; margin-top: 2px;">AUTOMATED SYSTEMS</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="display: inline-block; background-color: #1E293B; border: 1px solid #334155; border-radius: 20px; padding: 6px 14px;">
                      <span style="color: #10B981; font-size: 10px; margin-right: 4px;">●</span>
                      <span style="color: #F8FAFC; font-size: 12px; font-weight: 600;">Completed</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              
              <!-- Subtitle Category in Brand Electric Blue -->
              <div style="color: #0066FF; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
                CLOUD DATA RETENTION
              </div>

              <!-- Main Title -->
              <h1 style="color: #0A192F; font-size: 22px; font-weight: 800; line-height: 1.3; margin: 8px 0 20px 0; letter-spacing: -0.4px;">
                Daily retention run finished, ${totalCleaned} record${totalCleaned === 1 ? "" : "s"} cleaned
              </h1>

              <!-- Meta Table -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding: 4px 0;">Run time</td>
                  <td align="right" style="color: #0A192F; font-size: 13px; font-family: monospace; font-weight: 600;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding: 4px 0;">Target admin</td>
                  <td align="right" style="color: #0A192F; font-size: 13px; font-family: monospace;">${adminEmail}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 13px; padding: 4px 0;">Errors</td>
                  <td align="right" style="color: #0A192F; font-size: 13px; font-family: monospace; font-weight: 600;">${errors.length}</td>
                </tr>
              </table>

              <!-- Section: Actions Taken -->
              <div style="color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
                ACTIONS TAKEN
              </div>

              <!-- Action Row 1: WebhookEvent -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 12px 0; border-bottom: 1px solid #f8fafc;">
                <tr>
                  <td width="42" style="vertical-align: middle;">
                    <div style="background-color: #EFF6FF; width: 34px; height: 34px; border-radius: 8px; text-align: center; line-height: 34px; font-size: 16px;">
                      🔄
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 8px;">
                    <div style="color: #0A192F; font-size: 14px; font-weight: 600;">WebhookEvent</div>
                    <div style="color: #94a3b8; font-size: 12px;">Retention threshold ${retentionWebhookDays} days</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="color: ${webhookResult > 0 ? "#0066FF" : "#64748b"}; font-size: 16px; font-weight: 700;">${webhookResult}</div>
                    <div style="color: #94a3b8; font-size: 11px;">purged</div>
                  </td>
                </tr>
              </table>

              <!-- Action Row 2: ErrorLog -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 12px 0; border-bottom: 1px solid #f8fafc;">
                <tr>
                  <td width="42" style="vertical-align: middle;">
                    <div style="background-color: #EFF6FF; width: 34px; height: 34px; border-radius: 8px; text-align: center; line-height: 34px; font-size: 16px;">
                      ⚠️
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 8px;">
                    <div style="color: #0A192F; font-size: 14px; font-weight: 600;">ErrorLog</div>
                    <div style="color: #94a3b8; font-size: 12px;">Retention threshold ${retentionErrorLogDays} days</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="color: ${errorLogResult > 0 ? "#0066FF" : "#64748b"}; font-size: 16px; font-weight: 700;">${errorLogResult}</div>
                    <div style="color: #94a3b8; font-size: 11px;">purged</div>
                  </td>
                </tr>
              </table>

              <!-- Action Row 3: SecurityAuditLog -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 12px 0; border-bottom: 1px solid #f8fafc;">
                <tr>
                  <td width="42" style="vertical-align: middle;">
                    <div style="background-color: #EFF6FF; width: 34px; height: 34px; border-radius: 8px; text-align: center; line-height: 34px; font-size: 16px;">
                      🛡️
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 8px;">
                    <div style="color: #0A192F; font-size: 14px; font-weight: 600;">SecurityAuditLog</div>
                    <div style="color: #94a3b8; font-size: 12px;">Retention threshold ${retentionSecurityLogDays} days</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="color: ${securityLogResult > 0 ? "#0066FF" : "#64748b"}; font-size: 16px; font-weight: 700;">${securityLogResult}</div>
                    <div style="color: #94a3b8; font-size: 11px;">purged</div>
                  </td>
                </tr>
              </table>

              <!-- Action Row 4: Storage Cleanup -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 12px 0; margin-bottom: 28px;">
                <tr>
                  <td width="42" style="vertical-align: middle;">
                    <div style="background-color: #EFF6FF; width: 34px; height: 34px; border-radius: 8px; text-align: center; line-height: 34px; font-size: 16px;">
                      🗄️
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 8px;">
                    <div style="color: #0A192F; font-size: 14px; font-weight: 600;">Storage cleanup</div>
                    <div style="color: #94a3b8; font-size: 12px;">Orphaned files in 'uploads' bucket</div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="color: ${removedOrphansCount > 0 ? "#0066FF" : "#64748b"}; font-size: 16px; font-weight: 700;">${removedOrphansCount}</div>
                    <div style="color: #94a3b8; font-size: 11px;">removed</div>
                  </td>
                </tr>
              </table>

              <!-- Section: Active Database Footprint -->
              <div style="color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 12px;">
                ACTIVE DATABASE FOOTPRINT
              </div>

              <!-- 3-Column Footprint Card -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; padding: 16px;">
                <tr>
                  <td width="33%" align="center" style="vertical-align: middle; border-right: 1px solid #f1f5f9;">
                    <div style="color: #0A192F; font-size: 24px; font-weight: 800;">${currentWebhooks.toLocaleString()}</div>
                    <div style="color: #64748b; font-size: 12px; margin-top: 4px;">WebhookEvent</div>
                  </td>
                  <td width="33%" align="center" style="vertical-align: middle; border-right: 1px solid #f1f5f9;">
                    <div style="color: #0A192F; font-size: 24px; font-weight: 800;">${currentErrors.toLocaleString()}</div>
                    <div style="color: #64748b; font-size: 12px; margin-top: 4px;">ErrorLog</div>
                  </td>
                  <td width="34%" align="center" style="vertical-align: middle;">
                    <div style="color: #0A192F; font-size: 24px; font-weight: 800;">${currentSecurity.toLocaleString()}</div>
                    <div style="color: #64748b; font-size: 12px; margin-top: 4px;">SecurityAuditLog</div>
                  </td>
                </tr>
              </table>

              <!-- Success Status Pill / Box -->
              <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #0066FF; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td width="28" style="vertical-align: middle; font-size: 16px;">
                      ✅
                    </td>
                    <td style="vertical-align: middle; color: #0A192F; font-size: 13px; font-weight: 600;">
                      ${errors.length > 0 ? errors.join("; ") : "All database and storage operations completed with zero errors."}
                    </td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center;">
              <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 0 0 12px 0;">
                <strong>Automated report.</strong> No action is required. This message was generated by the PropertyStack data retention policy and sent to the workspace administrator on record.
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                PropertyStack · Automated Systems · <a href="https://propertystack.com" style="color: #0066FF; text-decoration: none; font-weight: 600;">Manage retention settings</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  console.log(`\nDispatching rich HTML summary report to ${adminEmail}...`);
  await sendEmail(
    adminEmail,
    `Daily retention run finished, ${totalCleaned} record${totalCleaned === 1 ? "" : "s"} cleaned`,
    `PropertyStack Data Retention: ${totalCleaned} records cleaned. Active footprint: ${currentWebhooks} Webhooks, ${currentErrors} Errors, ${currentSecurity} Security Logs.`,
    htmlReport
  );

  console.log("✅ Rich HTML email report dispatched successfully!");
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

