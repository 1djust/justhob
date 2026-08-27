import "dotenv/config";
import dns from "dns/promises";

async function main() {
  console.log("==================================================");
  console.log("🚀 DISPATCHING EMAILS TO ALL INCOMPLETE SIGNUPS");
  console.log("==================================================");
  console.log(`Execution Time: ${new Date().toISOString()}`);

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
    // fallback
  }

  const { supabaseAdmin } = await import("../lib/supabase");
  const { sendEmail } = await import("../lib/mailer");
  const { buildRegistrationReminderEmail } = await import(
    "../cron/registration-reminder"
  );

  const frontendUrl =
    process.env.PUBLIC_FRONTEND_URL ||
    (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes("localhost")
      ? process.env.FRONTEND_URL
      : "https://justhob.vercel.app");

  const adminEmail = process.env.ADMIN_EMAIL || "propertystackapp@gmail.com";
  const smtpUser = process.env.SMTP_USER || "propertystackapp@gmail.com";

  console.log(`Sender Account : PropertyStack <${smtpUser}>`);
  console.log(`Frontend URL   : ${frontendUrl}`);
  console.log(`Admin Recipient: ${adminEmail}\n`);

  let page = 1;
  const perPage = 100;
  let allUsers: Array<{
    id: string;
    email?: string;
    created_at: string;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  }> = [];

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      console.error("Failed to list Supabase users:", error.message);
      break;
    }
    if (!data?.users || data.users.length === 0) break;
    allUsers = allUsers.concat(data.users);
    if (data.users.length < perPage) break;
    page++;
  }

  const unconfirmedUsers = allUsers.filter((u) => !u.email_confirmed_at && u.email);
  console.log(`Found ${unconfirmedUsers.length} total unconfirmed user(s) in Supabase Auth.\n`);

  const results: Array<{
    email: string;
    name: string;
    stage: 1 | 2;
    status: string;
  }> = [];

  const now = new Date();

  for (let i = 0; i < unconfirmedUsers.length; i++) {
    const user = unconfirmedUsers[i];
    const userEmail = user.email!.toLowerCase().trim();
    const meta = user.user_metadata || {};
    const userName = typeof meta.name === "string" ? meta.name : undefined;
    const reminderCount =
      typeof meta.registration_reminder_count === "number"
        ? meta.registration_reminder_count
        : 0;

    // Determine Stage (1 for first reminder, 2 for final reminder)
    const stage: 1 | 2 = reminderCount >= 1 ? 2 : 1;

    console.log(`[${i + 1}/${unconfirmedUsers.length}] Dispatching Stage ${stage} reminder to ${userEmail} (${userName || "No name"})...`);

    const emailContent = buildRegistrationReminderEmail({
      email: userEmail,
      name: userName,
      stage,
      frontendUrl,
    });

    try {
      await sendEmail(
        userEmail,
        emailContent.subject,
        emailContent.text,
        emailContent.html,
      );

      // Update Supabase user_metadata
      const updatedMetadata = {
        ...meta,
        registration_reminder_count: reminderCount + 1,
        last_registration_reminder_at: now.toISOString(),
      };

      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: updatedMetadata,
      });

      console.log(`    ✅ Successfully delivered Stage ${stage} to ${userEmail}`);
      results.push({
        email: userEmail,
        name: userName || "N/A",
        stage,
        status: "DELIVERED",
      });
    } catch (err) {
      console.error(`    ❌ Failed to send to ${userEmail}:`, (err as Error).message);
      results.push({
        email: userEmail,
        name: userName || "N/A",
        stage,
        status: `FAILED: ${(err as Error).message}`,
      });
    }
  }

  console.log("\n==================================================");
  console.log("📊 DISPATCH SUMMARY REPORT");
  console.log("==================================================");
  results.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.status}] ${r.email} (${r.name}) -> Stage ${r.stage}`);
  });

  // Dispatch Admin Summary Notification
  try {
    console.log(`\nDispatching admin audit summary to ${adminEmail}...`);
    await sendEmail(
      adminEmail,
      `📋 PropertyStack — Live Registration Reminder Dispatch (${results.filter(r => r.status === 'DELIVERED').length} Sent)`,
      `Registration Reminder Dispatch Summary:\n\nTotal Processed: ${results.length}\nDelivered: ${results.filter(r => r.status === 'DELIVERED').length}\n\nDetails:\n${results.map(r => `• ${r.email} (Stage ${r.stage}): ${r.status}`).join("\n")}`,
      `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
          <h2 style="color: #0A192F; margin-bottom: 12px;">📋 Live Registration Reminder Dispatch</h2>
          <p style="color: #334155; font-size: 14px;">The batch registration follow-up dispatches were executed from <strong>PropertyStack &lt;${smtpUser}&gt;</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 10px 14px; text-align: left; font-size: 13px; color: #475569;">Recipient</th>
              <th style="padding: 10px 14px; text-align: left; font-size: 13px; color: #475569;">Name</th>
              <th style="padding: 10px 14px; text-align: center; font-size: 13px; color: #475569;">Stage</th>
              <th style="padding: 10px 14px; text-align: right; font-size: 13px; color: #475569;">Status</th>
            </tr>
            ${results
              .map(
                (r) => `
              <tr>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px;">${r.email}</td>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b;">${r.name}</td>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px; text-align: center; font-weight: bold; color: #0066FF;">Stage ${r.stage}</td>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px; text-align: right; font-weight: bold; color: ${r.status === 'DELIVERED' ? '#10b981' : '#ef4444'};">${r.status}</td>
              </tr>
            `,
              )
              .join("")}
          </table>
        </div>
      `,
    );
    console.log("✅ Admin summary email delivered.");
  } catch (adminErr) {
    console.error("Admin summary delivery error:", (adminErr as Error).message);
  }

  console.log("==================================================");
  console.log("🎉 BATCH DISPATCH COMPLETED");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal dispatch error:", err);
  process.exit(1);
});
