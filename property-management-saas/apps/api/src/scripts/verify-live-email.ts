import "dotenv/config";
import nodemailer from "nodemailer";

async function main() {
  const user = process.env.SMTP_USER || "ogunduyijustus@gmail.com";
  const pass = process.env.SMTP_PASS;
  const adminEmail = process.env.ADMIN_EMAIL || "propertystackapp@gmail.com";

  console.log("==================================================");
  console.log("TESTING LIVE GMAIL SMTP CONNECTION");
  console.log("==================================================");
  console.log(`SMTP User   : ${user}`);
  console.log(`SMTP Pass   : ${pass ? "****" + pass.slice(-4) : "NOT_SET"}`);
  console.log(`Sending To  : ${adminEmail}`);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  console.log("\nVerifying SMTP credentials with Google...");
  await transporter.verify();
  console.log("✅ SUCCESS: Google SMTP server authenticated successfully!");

  console.log(`\nDispatching real email to ${adminEmail}...`);
  const info = await transporter.sendMail({
    from: `"PropertyStack" <${user}>`,
    to: adminEmail,
    subject: "🔔 PropertyStack — Real-Time Admin Notification Test",
    text: `Hello Justus,\n\nThis is a real-time verification email from your PropertyStack server.\n\nYour automated Data Retention & Security notifications are now fully connected to your Gmail inbox.\n\nTime: ${new Date().toLocaleString()}\nEnvironment: PropertyStack Backend`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
        <h2 style="color: #0f172a;">🔔 PropertyStack Admin Notification</h2>
        <p style="font-size: 16px; color: #334155;">Hello <strong>Justus</strong>,</p>
        <p style="font-size: 15px; color: #334155;">
          This is a <strong>live verification email</strong> from your PropertyStack server.
        </p>
        <div style="background-color: #ffffff; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="margin: 0; color: #065f46; font-weight: bold;">✅ SMTP Handshake Successful</p>
          <p style="margin: 4px 0 0 0; color: #047857; font-size: 14px;">
            All automated daily <strong>Data Retention Cleanup</strong> and <strong>Security Audit</strong> reports will now be delivered directly to this Gmail inbox in real-time.
          </p>
        </div>
        <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">
          Timestamp: ${new Date().toISOString()}<br/>
          Server: PropertyStack SaaS Backend
        </p>
      </div>
    `,
  });

  console.log(`\n🎉 EMAIL DELIVERED! Message ID: ${info.messageId}`);
  console.log("==================================================");
  console.log("Check your Gmail inbox (and Spam folder just in case)!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("\n❌ SMTP Connection Failed:", err.message || err);
  process.exit(1);
});
