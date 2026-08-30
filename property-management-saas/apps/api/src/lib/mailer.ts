import nodemailer from "nodemailer";

// Configure transporter fallback - uses SMTP environment variables if available, otherwise logs to console
const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    if (host === "smtp.gmail.com" || host.includes("gmail")) {
      return nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      });
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // Fallback for development: log to console
  return {
    sendMail: async (options: {
      to: string;
      subject: string;
      text?: string;
      html?: string;
    }) => {
      console.log("--- EMAIL NOTIFICATION (MOCK) ---");
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Body: ${options.text || options.html}`);
      console.log("---------------------------------");
      return { messageId: "mock-id" };
    },
  } as unknown as nodemailer.Transporter;
};

const transporter = createTransporter();

/**
 * Sends an email using Resend (Production standard) with automatic Nodemailer SMTP fallback.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  content: string,
  html?: string,
) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress =
    process.env.SMTP_USER || "propertystackapp@gmail.com";
  const resendFrom =
    process.env.RESEND_FROM || "PropertyStack <onboarding@resend.dev>";

  // 1. Primary Driver: Resend REST API (High Reputation / Anti-Spam Deliverability)
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          subject,
          text: content,
          html: html || content,
          reply_to: `PropertyStack Support <${fromAddress}>`,
          headers: {
            "X-Mailer": "PropertyStack Resend Engine v1.0",
            "Feedback-ID": "transactional:propertystack:notification",
          },
        }),
      });

      const data = (await response.json()) as { id?: string; message?: string; name?: string };

      if (response.ok && data.id) {
        console.log(
          `[Mailer:Resend] Delivered to ${to} | ID: ${data.id} | From: ${resendFrom}`,
        );
        return { messageId: data.id, provider: "resend" };
      } else {
        console.warn(
          `[Mailer:Resend] Warning: ${data.message || JSON.stringify(data)}. Falling back to SMTP...`,
        );
      }
    } catch (resendError) {
      console.error("[Mailer:ResendError] Failed to send via Resend:", resendError);
      console.warn("[Mailer:Resend] Falling back to SMTP transporter...");
    }
  }

  // 2. Secondary Driver: Nodemailer SMTP Transporter
  try {
    const info = await transporter.sendMail({
      from: `"PropertyStack" <${fromAddress}>`,
      to,
      replyTo: `"PropertyStack Support" <${fromAddress}>`,
      subject,
      text: content,
      html: html || content,
      headers: {
        "X-Mailer": "PropertyStack Engine v1.0",
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        "List-Unsubscribe": `<mailto:${fromAddress}?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "Feedback-ID": "transactional:propertystack:notification",
      },
    });
    console.log(
      `[Mailer:SMTP] Delivered to ${to} | ID: ${info.messageId} | Accepted: ${JSON.stringify(info.accepted)}`,
    );
    return { messageId: info.messageId, provider: "smtp" };
  } catch (error) {
    console.error("[MailerError]", error);
    throw error;
  }
};

