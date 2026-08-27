import "dotenv/config";

async function main() {
  console.log("==================================================");
  console.log("🚀 DISPATCHING ONBOARDING SETUP REMINDERS");
  console.log("==================================================");
  console.log(`Execution Time: ${new Date().toISOString()}`);

  const { supabaseAdmin } = await import("../lib/supabase");
  const { sendEmail } = await import("../lib/mailer");
  const { buildOnboardingReminderEmail } = await import(
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

  // Target verified real managers who have 0 properties
  const targetEmails = ["bitachonattorneys@gmail.com", "gbenahonyessiho@gmail.com"];

  const { data: supaData, error: supaError } = await supabaseAdmin.auth.admin.listUsers();
  if (supaError) {
    console.error("Failed to list Supabase users:", supaError.message);
    process.exit(1);
  }

  const targetUsers = supaData.users.filter(
    (u) => u.email && targetEmails.includes(u.email.toLowerCase()),
  );

  console.log(`Found ${targetUsers.length} target manager(s) in Supabase Auth.\n`);

  const now = new Date();
  const results: Array<{
    email: string;
    name: string;
    status: string;
  }> = [];

  for (let i = 0; i < targetUsers.length; i++) {
    const user = targetUsers[i];
    const userEmail = user.email!.toLowerCase().trim();
    const meta = user.user_metadata || {};
    const userName = (meta.name as string) || undefined;

    console.log(`[${i + 1}/${targetUsers.length}] Dispatching Onboarding Guide to ${userEmail} (${userName || "No name"})...`);

    const emailContent = buildOnboardingReminderEmail({
      email: userEmail,
      name: userName,
      frontendUrl,
    });

    try {
      await sendEmail(
        userEmail,
        emailContent.subject,
        emailContent.text,
        emailContent.html,
      );

      // Record delivery timestamp in Supabase Auth user_metadata
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...meta,
          onboarding_reminder_sent_at: now.toISOString(),
        },
      });

      console.log(`    ✅ Successfully delivered Onboarding Guide to ${userEmail}`);
      results.push({
        email: userEmail,
        name: userName || "N/A",
        status: "DELIVERED",
      });
    } catch (err) {
      console.error(`    ❌ Failed to send to ${userEmail}:`, (err as Error).message);
      results.push({
        email: userEmail,
        name: userName || "N/A",
        status: `FAILED: ${(err as Error).message}`,
      });
    }
  }

  console.log("\n==================================================");
  console.log("📊 ONBOARDING DISPATCH SUMMARY");
  console.log("==================================================");
  results.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.status}] ${r.email} (${r.name})`);
  });

  // Dispatch Admin Summary Notification
  try {
    console.log(`\nDispatching admin audit summary to ${adminEmail}...`);
    await sendEmail(
      adminEmail,
      `📋 PropertyStack — Onboarding Reminders Dispatch (${results.filter((r) => r.status === "DELIVERED").length} Sent)`,
      `Onboarding Reminders Summary:\n\nTotal Sent: ${results.filter((r) => r.status === "DELIVERED").length}\n\nDetails:\n${results.map((r) => `• ${r.email}: ${r.status}`).join("\n")}`,
      `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
          <h2 style="color: #0A192F; margin-bottom: 12px;">📋 Onboarding Reminder Dispatch</h2>
          <p style="color: #334155; font-size: 14px;">The onboarding property setup reminders were delivered from <strong>PropertyStack &lt;${smtpUser}&gt;</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 10px 14px; text-align: left; font-size: 13px; color: #475569;">Recipient</th>
              <th style="padding: 10px 14px; text-align: left; font-size: 13px; color: #475569;">Name</th>
              <th style="padding: 10px 14px; text-align: right; font-size: 13px; color: #475569;">Status</th>
            </tr>
            ${results
              .map(
                (r) => `
              <tr>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px;">${r.email}</td>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b;">${r.name}</td>
                <td style="padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 14px; text-align: right; font-weight: bold; color: ${r.status === "DELIVERED" ? "#10b981" : "#ef4444"};">${r.status}</td>
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
  console.log("🎉 ONBOARDING DISPATCH COMPLETED");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal dispatch error:", err);
  process.exit(1);
});
