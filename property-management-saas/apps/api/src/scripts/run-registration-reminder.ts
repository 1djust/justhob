import "dotenv/config";
import dns from "dns/promises";

async function main() {
  console.log("==================================================");
  console.log("🚀 STARTING REGISTRATION FOLLOW-UP REMINDER JOB");
  console.log("==================================================");
  console.log(`Execution Time : ${new Date().toISOString()}`);

  // Apply IPv4 DNS fix for Supabase host resolution in serverless / CI environments
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
    // Ignore DNS resolution error and fall back to default URL
  }

  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  const { processRegistrationReminders, processOnboardingReminders } =
    await import("../cron/registration-reminder");
  const { sendEmail } = await import("../lib/mailer");

  const adminEmail = process.env.ADMIN_EMAIL || "propertystackapp@gmail.com";

  console.log(`Mode           : ${isDryRun ? "DRY-RUN (Simulated)" : "LIVE (Emails will be sent)"}`);
  console.log(`Admin Recipient: ${adminEmail}`);

  // 1. Process unconfirmed registration signups
  const regResults = await processRegistrationReminders({
    dryRun: isDryRun,
    logger: console,
  });

  // 2. Process confirmed managers with 0 properties
  console.log("\n--------------------------------------------------");
  const onboardingResults = await processOnboardingReminders({
    dryRun: isDryRun,
    logger: console,
  });

  console.log("\n==================================================");
  console.log("📊 EXECUTION SUMMARY");
  console.log("==================================================");
  console.log(`Unconfirmed Registration Scanned : ${regResults.totalUnconfirmedEvaluated}`);
  console.log(`  • Stage 1 Reminders (24h)      : ${regResults.stage1Sent}`);
  console.log(`  • Stage 2 Reminders (72h)      : ${regResults.stage2Sent}`);
  console.log(`  • Skipped                      : ${regResults.skippedCount}`);
  console.log(`Onboarding Incomplete Evaluated  : ${onboardingResults.totalEvaluated}`);
  console.log(`  • Setup Reminders Sent         : ${onboardingResults.sentCount}`);
  console.log(`  • Skipped (Already reminded)   : ${onboardingResults.skippedCount}`);
  console.log(`Errors Encountered               : ${regResults.errors.length + onboardingResults.errors.length}`);

  const allErrors = [...regResults.errors, ...onboardingResults.errors];
  if (allErrors.length > 0) {
    console.error("\nErrors:");
    allErrors.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
  }

  // If live run dispatched emails or had errors, notify admin with an audit summary
  const totalSent = regResults.stage1Sent + regResults.stage2Sent + onboardingResults.sentCount;
  if (!isDryRun && (totalSent > 0 || allErrors.length > 0)) {
    try {
      console.log(`\nDispatching admin audit summary to ${adminEmail}...`);
      await sendEmail(
        adminEmail,
        `📋 PropertyStack — Follow-up Reminders Summary (${totalSent} Sent)`,
        `Follow-up Reminders Summary\n\nTotal Sent: ${totalSent}\nRegistration Stage 1: ${regResults.stage1Sent}\nRegistration Stage 2: ${regResults.stage2Sent}\nOnboarding Setup: ${onboardingResults.sentCount}\nErrors: ${allErrors.length}`,
        `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
            <h2 style="color: #0A192F; margin-bottom: 12px;">📋 Follow-up Reminders Audit Report</h2>
            <p style="color: #334155; font-size: 14px;">The automated follow-up reminder job completed at ${new Date().toISOString()}.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
              <tr style="background-color: #f1f5f9;">
                <th style="padding: 10px 14px; text-align: left; font-size: 13px; color: #475569;">Metric</th>
                <th style="padding: 10px 14px; text-align: right; font-size: 13px; color: #475569;">Count</th>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #0066FF;">Registration Stage 1 Reminders (24h)</td>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0066FF;">${regResults.stage1Sent}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #0284c7;">Registration Stage 2 Reminders (72h)</td>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0284c7;">${regResults.stage2Sent}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #059669;">Manager Onboarding (Property Setup) Sent</td>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #059669;">${onboardingResults.sentCount}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px; color: ${allErrors.length > 0 ? '#ef4444' : '#10b981'};">Errors</td>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: ${allErrors.length > 0 ? '#ef4444' : '#10b981'};">${allErrors.length}</td>
              </tr>
            </table>
            ${
              allErrors.length > 0
                ? `<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin-top: 12px; font-size: 13px; color: #991b1b;">
                     <strong>Error Log:</strong><br/>
                     ${allErrors.map((e) => `• ${e}`).join("<br/>")}
                   </div>`
                : ""
            }
          </div>
        `,
      );
      console.log("✅ Admin summary email delivered.");
    } catch (adminEmailErr) {
      console.error(
        "Failed to send admin summary email:",
        (adminEmailErr as Error).message,
      );
    }
  }

  console.log("==================================================");
  console.log("🎉 JOB FINISHED SUCCESSFULLY");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("\n❌ Fatal Job Error:", err.message || err);
  process.exit(1);
});
