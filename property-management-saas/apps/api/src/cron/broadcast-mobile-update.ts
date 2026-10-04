import { prisma } from "../lib/database";
import { sendEmail } from "../lib/mailer";
import { renderEmailLayout } from "../lib/email-template";

export interface BroadcastUpdateOptions {
  dryRun?: boolean;
  version?: string;
  buildNumber?: number;
  apkUrl?: string;
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
}

export async function broadcastMobileUpdate(options: BroadcastUpdateOptions = {}) {
  const {
    dryRun = false,
    version = "0.3.5",
    buildNumber = 23,
    apkUrl = "https://propertystack.vercel.app/downloads/propertystack-tenant.apk",
    logger = console,
  } = options;

  logger.info(
    `[BroadcastUpdate] Starting mobile update email dispatch (v${version}+${buildNumber}, dryRun=${dryRun})...`,
  );

  const activeUsers = await prisma.user.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  logger.info(`[BroadcastUpdate] Found ${activeUsers.length} active users.`);

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const deliveryResults: Array<{
    email: string;
    status: string;
    id?: string;
    error?: string;
  }> = [];

  for (const user of activeUsers) {
    if (!user.email || !user.email.includes("@")) {
      logger.warn(`[BroadcastUpdate] Skipping invalid user email: ${user.email}`);
      skippedCount++;
      continue;
    }

    const firstName = user.name ? user.name.split(" ")[0] : "PropertyStack User";

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 800;">
          PropertyStack Mobile App v${version} is Now Available! 📱
        </h2>
        <p style="font-size: 15px; color: #334155; margin-bottom: 18px;">
          Hello ${firstName},
        </p>
        <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">
          A major performance and reliability update for the <strong>PropertyStack Mobile App (v${version} Build ${buildNumber})</strong> is now live. We have introduced key stability improvements and streamlined user security.
        </p>

        <!-- Feature Highlights Box -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: #0f172a; font-weight: 700;">
            ✨ Key Highlights in v${version}:
          </h3>
          <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.7;">
            <li><strong>⚡ Single-Touch Fingerprint Unlock:</strong> Fixed biometric authentication so your phone unlocks immediately with a single touch—no duplicate prompts.</li>
            <li><strong>🚀 Seamless In-App Updates:</strong> Whenever a new build drops, your app will automatically notify you with an instant one-tap download alert.</li>
            <li><strong>🏢 Landlord & Manager Real-Time Sync:</strong> Portfolio revenue, occupancy metrics, and payment review dashboards load faster and smoother.</li>
            <li><strong>📄 Verified PDF Rent Receipts:</strong> Generate, share, and preview official payment receipts natively on your device.</li>
          </ul>
        </div>

        <!-- Download Action Button -->
        <div style="text-align: center; margin: 28px 0 20px 0;">
          <a href="${apkUrl}"
             style="background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 102, 255, 0.25);">
            📥 Download Mobile App Update (v${version} APK)
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 20px;">
          Already have the app? Open PropertyStack on your phone and tap <strong>"Download Update"</strong> on the in-app popup to install.
        </p>

        <p style="font-size: 14px; color: #475569; margin-top: 24px;">
          Best regards,<br/>
          <strong>The PropertyStack Team</strong>
        </p>
      </div>
    `;

    const finalHtml = renderEmailLayout({
      title: `PropertyStack Mobile App v${version} Update`,
      badge: "MOBILE APP UPDATE",
      bodyHtml,
      recipientEmail: user.email,
      footerNote:
        "You received this email because you are a registered user of PropertyStack.",
    });

    const textContent = `
PropertyStack Mobile App v${version} is Now Available!
======================================================

Hello ${firstName},

A major performance and reliability update for the PropertyStack Mobile App (v${version} Build ${buildNumber}) is now live!

Key Highlights in v${version}:
- Single-Touch Fingerprint Unlock: Fixed biometric authentication for instant single-tap access.
- Seamless In-App Updates: Automatic in-app notification prompt on launch.
- Landlord & Manager Real-Time Sync: Faster data and metrics synchronization.
- Verified PDF Rent Receipts: Generate and share official receipts on mobile.

Download the update directly:
${apkUrl}

Or open the app on your phone to update automatically.

Best regards,
The PropertyStack Team
    `.trim();

    if (dryRun) {
      logger.info(`[BroadcastUpdate:DRY-RUN] Would send to ${user.email}`);
      sentCount++;
      deliveryResults.push({ email: user.email, status: "dry-run" });
      continue;
    }

    try {
      logger.info(`[BroadcastUpdate] Sending to ${user.email}...`);
      const result = await sendEmail(
        user.email,
        `📱 PropertyStack Mobile App Update v${version} is Now Available!`,
        textContent,
        finalHtml,
      );
      logger.info(
        `[BroadcastUpdate] ✔ Delivered to ${user.email} (Provider: ${result.provider}, ID: ${result.messageId})`,
      );
      sentCount++;
      deliveryResults.push({
        email: user.email,
        status: "sent",
        id: result.messageId,
      });
    } catch (err) {
      logger.error(`[BroadcastUpdate] ✖ Error sending to ${user.email}:`, err);
      failedCount++;
      deliveryResults.push({
        email: user.email,
        status: "failed",
        error: (err as Error).message,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  return {
    totalUsers: activeUsers.length,
    sent: sentCount,
    failed: failedCount,
    skipped: skippedCount,
    results: deliveryResults,
  };
}
