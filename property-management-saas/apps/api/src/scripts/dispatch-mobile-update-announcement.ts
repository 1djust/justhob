import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

async function main() {
  const { PrismaClient } = await import("@property-management/database");
  const { sendEmail } = await import("../lib/mailer");
  const { renderEmailLayout } = await import("../lib/email-template");

  const prisma = new PrismaClient();

  try {
    const users = await prisma.user.findMany({
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

    console.log(`[Update Dispatch] Found ${users.length} registered users in database.`);

    const apkUrl = "https://propertystack.vercel.app/downloads/propertystack-tenant.apk";
    const webUrl = "https://propertystack.vercel.app";

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      if (!user.email || !user.email.includes("@")) {
        console.warn(`[Update Dispatch] Skipping invalid email: ${user.email}`);
        continue;
      }

      const firstName = user.name ? user.name.split(" ")[0] : "PropertyStack User";

      const bodyHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 800;">
            PropertyStack Mobile App v0.3.5 is Live! 📱
          </h2>
          <p style="font-size: 15px; color: #334155; margin-bottom: 20px;">
            Hello ${firstName},
          </p>
          <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">
            A brand new update for the <strong>PropertyStack Mobile App (v0.3.5 Build 23)</strong> is now officially available for download. We've introduced major performance upgrades and resolved key mobile issues.
          </p>

          <!-- Feature Highlights Box -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: #0f172a; font-weight: 700;">
              ✨ What's New in v0.3.5:
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.7;">
              <li><strong>⚡ Instant One-Touch Fingerprint Unlock:</strong> Fixed the authentication prompt so you can now unlock your app instantly with a single fingerprint tap.</li>
              <li><strong>🚀 Automatic In-App Update Alerts:</strong> When you open the mobile app, you'll be automatically notified with a one-tap download prompt.</li>
              <li><strong>🏢 Landlord & Manager Dashboard Sync:</strong> Real-time financial metrics, unit occupancy rates, and tenant payments load faster and smoother.</li>
              <li><strong>📄 Certified PDF Rent Receipts:</strong> Generate, share, and preview official payment receipts natively on your device.</li>
            </ul>
          </div>

          <!-- Download Action Button -->
          <div style="text-align: center; margin: 30px 0 24px 0;">
            <a href="${apkUrl}"
               style="background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 102, 255, 0.25);">
              📥 Download Mobile App Update (v0.3.5 APK)
            </a>
          </div>

          <!-- Alternative Option -->
          <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 20px;">
            Already have the app installed? Simply open your PropertyStack app and tap <strong>"Download Update"</strong> on the popup to upgrade immediately.
          </p>

          <p style="font-size: 14px; color: #475569; margin-top: 24px;">
            Best regards,<br/>
            <strong>The PropertyStack Engineering Team</strong>
          </p>
        </div>
      `;

      const finalHtml = renderEmailLayout({
        title: "PropertyStack Mobile App v0.3.5 Update",
        badge: "MOBILE APP UPDATE",
        bodyHtml,
        recipientEmail: user.email,
        footerNote: "You received this email because you are a registered user of PropertyStack.",
      });

      const textContent = `
PropertyStack Mobile App v0.3.5 is Live!
============================================

Hello ${firstName},

A brand new update for the PropertyStack Mobile App (v0.3.5 Build 23) is now officially available for download!

What's New in v0.3.5:
- Instant One-Touch Fingerprint Unlock: Fixed authentication flow for seamless single-tap entry.
- Automatic In-App Update Alerts: Automatically receive one-tap upgrade prompts on launch.
- Landlord & Manager Dashboard Sync: Faster financial and unit data syncing.
- Certified PDF Rent Receipts: Generate, preview, and share official receipts directly from mobile.

Download the update directly:
${apkUrl}

Or visit the web portal:
${webUrl}

Best regards,
The PropertyStack Engineering Team
      `.trim();

      try {
        console.log(`[Update Dispatch] Sending to ${user.email} (${user.role})...`);
        const result = await sendEmail(
          user.email,
          "📱 PropertyStack Mobile App Update v0.3.5 is Now Available!",
          textContent,
          finalHtml,
        );
        console.log(`[Update Dispatch] ✔ Successfully sent to ${user.email} via ${result.provider} (ID: ${result.messageId})`);
        successCount++;
      } catch (err) {
        console.error(`[Update Dispatch] ✖ Failed to send to ${user.email}:`, err);
        failCount++;
      }

      // Small 300ms pause to ensure rate limits are respected
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`\n========================================`);
    console.log(`[Update Dispatch Summary]`);
    console.log(`Total Target Users: ${users.length}`);
    console.log(`Successfully Sent:  ${successCount}`);
    console.log(`Failed:             ${failCount}`);
    console.log(`========================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[Update Dispatch] Fatal error:", err);
  process.exit(1);
});
