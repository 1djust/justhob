import "dotenv/config";
import { buildRegistrationReminderEmail } from "../cron/registration-reminder";
import { sendEmail } from "../lib/mailer";

async function main() {
  const targetEmail = process.env.ADMIN_EMAIL || "propertystackapp@gmail.com";
  const frontendUrl =
    process.env.PUBLIC_FRONTEND_URL ||
    (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes("localhost")
      ? process.env.FRONTEND_URL
      : "https://justhob.vercel.app");

  console.log("==================================================");
  console.log("📧 SENDING SAMPLE REGISTRATION REMINDER EMAILS");
  console.log("==================================================");
  console.log(`Recipient   : ${targetEmail}`);
  console.log(`Frontend URL: ${frontendUrl}`);

  // 1. Send Stage 1 Sample
  console.log("\n[1/2] Sending Stage 1 Reminder Sample...");
  const stage1 = buildRegistrationReminderEmail({
    email: targetEmail,
    name: "Justus",
    stage: 1,
    frontendUrl,
  });

  await sendEmail(
    targetEmail,
    `[PREVIEW] ${stage1.subject}`,
    stage1.text,
    stage1.html,
  );
  console.log("✅ Stage 1 sample email dispatched!");

  // 2. Send Stage 2 Sample
  console.log("\n[2/2] Sending Stage 2 (Final Reminder) Sample...");
  const stage2 = buildRegistrationReminderEmail({
    email: targetEmail,
    name: "Justus",
    stage: 2,
    frontendUrl,
  });

  await sendEmail(
    targetEmail,
    `[PREVIEW] ${stage2.subject}`,
    stage2.text,
    stage2.html,
  );
  console.log("✅ Stage 2 sample email dispatched!");

  console.log("\n==================================================");
  console.log("🎉 BOTH SAMPLE EMAILS SENT SUCCESSFULLY");
  console.log("Check your inbox at " + targetEmail + " to review the templates.");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Failed to send sample emails:", err);
  process.exit(1);
});
