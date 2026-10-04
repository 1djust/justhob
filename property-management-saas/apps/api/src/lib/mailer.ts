import nodemailer from "nodemailer";
import { renderEmailLayout, escapeHtml } from "./email-template";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465");
const SMTP_USER = process.env.SMTP_USER || "propertystackapp@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "rkugylrldzpdhtas";

// Configure transporter fallback - uses SMTP environment variables if available, otherwise logs to console
const createTransporter = () => {
  const host = SMTP_HOST;
  const port = SMTP_PORT;
  const user = SMTP_USER;
  const pass = SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host: host.includes("gmail") ? "smtp.gmail.com" : host,
      port: 465,
      secure: true,
      auth: { user, pass },
      family: 4, // Critical for cloud/Render: force IPv4 to avoid IPv6 gateway drop timeouts
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    } as any);
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
 * Derives a standardized header badge from the email subject.
 */
function deriveHeaderBadge(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("verify") || s.includes("register") || s.includes("account") || s.includes("setup")) {
    return "ACCOUNT SETUP";
  }
  if (s.includes("workspace") || s.includes("onboarding") || s.includes("first property")) {
    return "MANAGER ONBOARDING";
  }
  if (s.includes("payment") || s.includes("rent") || s.includes("receipt") || s.includes("invoice")) {
    return "PAYMENT NOTIFICATION";
  }
  if (s.includes("maintenance") || s.includes("request") || s.includes("repair")) {
    return "MAINTENANCE UPDATE";
  }
  if (s.includes("lease") || s.includes("legal") || s.includes("agreement") || s.includes("renewal")) {
    return "LEASE AGREEMENT";
  }
  if (s.includes("security") || s.includes("alert") || s.includes("locked") || s.includes("critical")) {
    return "SECURITY ALERT";
  }
  return "NOTIFICATION";
}

/**
 * Converts plain text into clean styled HTML paragraphs.
 */
function formatPlainTextToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((paragraph) => {
      const escaped = escapeHtml(paragraph).replace(/\n/g, "<br/>");
      return `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">${escaped}</p>`;
    })
    .join("");
}

/**
 * Sends an email using Brevo/Resend with automatic Nodemailer fallback,
 * strictly guaranteeing the standardized PropertyStack Header & Footer layout.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  content: string,
  html?: string,
) => {
  if (process.env.NODE_ENV === "test") {
    return { messageId: "mock-test-email-id", provider: "mock" };
  }

  const brevoApiKey = process.env.BREVO_API_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = SMTP_USER;
  const resendFrom =
    process.env.RESEND_FROM || "PropertyStack <onboarding@resend.dev>";

  // Ensure every email has the exact official PropertyStack Header & Footer
  let finalHtml = html;
  if (!finalHtml && content && /<[a-z][\s\S]*>/i.test(content)) {
    finalHtml = content;
  }

  const hasOfficialLayout =
    Boolean(finalHtml) &&
    (finalHtml!.includes("#0A192F") || finalHtml!.includes("Consistent Official Brand Header"));

  if (!hasOfficialLayout) {
    const badge = deriveHeaderBadge(subject);
    const bodyHtml = finalHtml || formatPlainTextToHtml(content);
    finalHtml = renderEmailLayout({
      title: subject,
      badge,
      bodyHtml,
      recipientEmail: to,
    });
  }

  const isGmailSender = fromAddress.toLowerCase().endsWith("@gmail.com");
  const hasSmtp = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

  // Helper for sending via Nodemailer SMTP (authenticated directly via Google/SMTP with native SPF & DKIM)
  const sendViaSmtp = async () => {
    const info = await transporter.sendMail({
      from: `"PropertyStack" <${fromAddress}>`,
      to,
      replyTo: `"PropertyStack Support" <${fromAddress}>`,
      subject,
      text: content,
      html: finalHtml,
    });
    if (info.messageId === "mock-id") {
      throw new Error("SMTP transporter is in mock mode; live delivery failed");
    }
    console.log(
      `[Mailer:SMTP] Delivered to ${to} | ID: ${info.messageId} | Accepted: ${JSON.stringify(info.accepted)}`,
    );
    return { messageId: info.messageId, provider: "smtp" };
  };

  // 1. If sending from a @gmail.com address and Gmail SMTP credentials exist:
  // MUST use native Google SMTP so the message is signed with authentic Google DKIM (d=gmail.com)
  // and originates from Google's SPF network. Sending @gmail.com via Brevo/Resend fails DMARC alignment and triggers Spam filters.
  if (hasSmtp && isGmailSender) {
    try {
      return await sendViaSmtp();
    } catch (smtpErr) {
      console.error("[Mailer:SMTPError] Native SMTP send failed, falling back to Brevo/Resend:", smtpErr);
    }
  }

  // 2. Primary Driver for custom verified domains (or fallback): Brevo REST API
  if (brevoApiKey) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey.trim(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "PropertyStack",
            email: fromAddress,
          },
          to: [{ email: to }],
          subject,
          htmlContent: finalHtml,
          textContent: content,
          replyTo: {
            name: "PropertyStack Support",
            email: fromAddress,
          },
          headers: {
            "X-Mailer": "PropertyStack Engine v1.0",
          },
        }),
      });

      const data = (await response.json()) as { messageId?: string; message?: string; code?: string };

      if (response.ok && data.messageId) {
        console.log(
          `[Mailer:Brevo] Delivered to ${to} | ID: ${data.messageId} | From: ${fromAddress}`,
        );
        return { messageId: data.messageId, provider: "brevo" };
      } else {
        console.warn(
          `[Mailer:Brevo] Warning: ${data.message || JSON.stringify(data)}. Attempting fallback...`,
        );
      }
    } catch (brevoError) {
      console.error("[Mailer:BrevoError] Failed to send via Brevo:", brevoError);
      console.warn("[Mailer:Brevo] Falling back to secondary driver...");
    }
  }

  // 3. Secondary Driver: Resend REST API
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
          html: finalHtml,
          reply_to: `PropertyStack Support <${fromAddress}>`,
          headers: {
            "X-Mailer": "PropertyStack Engine v1.0",
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

  // 4. Fallback Driver: Nodemailer SMTP Transporter
  return await sendViaSmtp();
};


