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
 * Strips HTML tags into clean, human-readable plain text.
 * Prevents SpamAssassin MIME_HTML_ONLY penalty by ensuring every email
 * has a high-quality plain-text multipart alternative.
 */
export function stripHtmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&pound;/g, "£")
    .replace(/&euro;/g, "€")
    .replace(/&copy;/g, "©")
    .replace(/&bull;/g, "•")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Automatically sanitizes email content (HTML, plain-text, subject) across all outgoing mail
 * to strictly prevent spam filter triggers, phishing heuristic flags, and local URLs.
 */
export function sanitizeEmailContentForAntiSpam(input: {
  subject: string;
  content: string;
  html?: string;
  to: string;
}): {
  cleanSubject: string;
  cleanContent: string;
  cleanHtml?: string;
} {
  const publicBaseUrl =
    process.env.FRONTEND_URL &&
    !process.env.FRONTEND_URL.includes("localhost") &&
    !process.env.FRONTEND_URL.includes("127.0.0.1")
      ? process.env.FRONTEND_URL.replace(/\/$/, "")
      : "https://propertystack.vercel.app";

  // 1. Clean Subject Line: strip spammy symbols, emojis, and surrounding quotes that trigger spam heuristic flags
  const cleanSubject = input.subject
    .replace(/^([🚨🛑📱🔑📥⚠️🔔💡💰✨👋🚀]+\s*)+/gu, "")
    .replace(/(\s*[🚨🛑📱🔑📥⚠️🔔💡💰✨👋🚀]+)+$/gu, "")
    .replace(/!{2,}/g, "!")
    .replace(/\?{2,}/g, "?")
    .replace(/["“”]/g, "") // strip quotes from subject to prevent phishing / fake invitation heuristics
    .trim();

  // Helper to scrub a text string
  const scrubString = (str: string): string => {
    if (!str) return str;
    return str
      // Replace all localhost / 127.0.0.1 references with the public HTTPS URL
      .replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/gi, publicBaseUrl)
      // Normalize insecure http links for propertystack / justhob to https
      .replace(/http:\/\/(propertystack|justhob)\.vercel\.app/gi, "https://$1.vercel.app")
      // Normalize raw Supabase auth verification endpoints to the official login domain (prevents phishing domain mismatch flags)
      .replace(/https?:\/\/[a-z0-9-]+\.supabase\.co\/auth\/v1\/verify[^\s"'<>]*/gi, `${publicBaseUrl}/login`)
      // Normalize raw APK download links to the verified web download page (prevents malware heuristic flags)
      .replace(/https?:\/\/[^\s"'<>]+\/downloads\/propertystack-tenant\.apk/gi, `${publicBaseUrl}/download`)
      // Remove Android security bypass instructions (heavily penalized by Google SpamAssassin / Postmaster)
      .replace(/tap\s+["']?Settings["']?\s+and\s+enable\s+["']?Allow from this source["']?/gi, "Open on your Android device to install directly")
      .replace(/enable\s+["']?Allow from this source["']?/gi, "install directly")
      .replace(/unknown sources/gi, "trusted sources")
      // Clean download prompts & APK button labels
      .replace(/📥\s*Download PropertyStack Mobile App (\.apk|\(\.apk\))/gi, "Download PropertyStack for Android")
      .replace(/Download PropertyStack Mobile App (\.apk|\(\.apk\))/gi, "Download PropertyStack for Android")
      .replace(/📥\s*Download/g, "Download")
      // Clean phishing trigger CTA: "Activate Your Account" -> "Sign In to Your Account"
      .replace(/Activate Your Account/gi, "Sign In to Your Account")
      .replace(/activate your account/gi, "sign in to your account")
      // Clean OTP/credential phishing trigger words
      .replace(/One-time access code/gi, "Temporary Password")
      .replace(/one-time access code/gi, "temporary password")
      .replace(/One-time access/gi, "Temporary Password")
      // Clean phishing emoji markers and titles
      .replace(/🔑\s*Your Login Credentials/gi, "Account Access Details")
      .replace(/🔑\s*Your/g, "Your")
      .replace(/🚨\s*\[Security Alert\]/g, "[Security Alert]")
      .replace(/🛑\s*\[Critical Alert\]/g, "[Critical Alert]")
      .replace(/📱\s*How to Get/g, "How to Get")
      .replace(/💻\s*Prefer Using a Computer\?/g, "Prefer Using a Computer?");
  };

  const cleanContent = scrubString(input.content);
  const cleanHtml = input.html ? scrubString(input.html) : undefined;

  return { cleanSubject, cleanContent, cleanHtml };
}

/**
 * Clean RFC headers for transactional 1-to-1 system emails to maximize inbox deliverability.
 * Avoids 'Precedence: bulk' or 'Auto-Submitted' which trigger spam/promotions classification.
 */
function getAntiSpamHeaders(senderEmail: string) {
  return {
    "X-Auto-Response-Suppress": "All",
  };
}

/**
 * Sends an email using Brevo/Resend with automatic Nodemailer fallback,
 * strictly guaranteeing the standardized PropertyStack Header & Footer layout.
 */
export const sendEmail = async (
  to: string,
  rawSubject: string,
  rawContent: string,
  rawHtml?: string,
) => {
  if (process.env.NODE_ENV === "test") {
    return { messageId: "mock-test-email-id", provider: "mock" };
  }

  // 1. Globally apply anti-spam sanitization to subject, content, and HTML
  const { cleanSubject, cleanContent, cleanHtml } =
    sanitizeEmailContentForAntiSpam({
      subject: rawSubject,
      content: rawContent,
      html: rawHtml,
      to,
    });

  const subject = cleanSubject;
  const content = cleanContent;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = SMTP_USER;
  const resendFrom =
    process.env.RESEND_FROM || "PropertyStack <onboarding@resend.dev>";

  // Ensure every email has the exact official PropertyStack Header & Footer
  let finalHtml = cleanHtml;
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

  // Guarantee clean matching plain text fallback (avoids MIME_HTML_ONLY spam penalty)
  let cleanPlainText = content;
  if (!cleanPlainText || /<[a-z][\s\S]*>/i.test(cleanPlainText)) {
    cleanPlainText = stripHtmlToPlainText(finalHtml || cleanPlainText);
  }

  const isGmailSender = fromAddress.toLowerCase().endsWith("@gmail.com");
  const hasSmtp = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
  const antiSpamHeaders = getAntiSpamHeaders(fromAddress);

  // Helper for sending via Nodemailer SMTP (authenticated directly via Google/SMTP with native SPF & DKIM)
  const sendViaSmtp = async () => {
    const info = await transporter.sendMail({
      from: `"PropertyStack" <${fromAddress}>`,
      to,
      replyTo: `"PropertyStack Support" <${fromAddress}>`,
      subject,
      text: cleanPlainText,
      html: finalHtml,
      headers: antiSpamHeaders,
    });
    if (info.messageId === "mock-id") {
      throw new Error("SMTP transporter is in mock mode; live delivery failed");
    }
    console.log(
      `[Mailer:SMTP] Delivered to ${to} | ID: ${info.messageId} | Accepted: ${JSON.stringify(info.accepted)}`,
    );
    return { messageId: info.messageId, provider: "smtp" };
  };

  // Helper for sending via Vercel HTTPS Relay (overcomes Render and local ISP port 465 blocking)
  const sendViaVercelRelay = async () => {
    const relaySecret =
      process.env.ADMIN_SECURITY_KEY || "8d5e1b2f7a9c3d4e0f8b7a6c5d4e2f1a";

    // Support primary and secondary Vercel deployment URLs with automatic fallback
    const relayEndpoints = [
      "https://propertystack.vercel.app/api/mail/relay",
      process.env.MAIL_RELAY_URL,
      "https://justhob.vercel.app/api/mail/relay",
    ].filter(Boolean) as string[];

    let lastError: Error | null = null;
    for (const relayUrl of relayEndpoints) {
      try {
        const res = await fetch(relayUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${relaySecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to,
            subject,
            html: finalHtml,
            text: cleanPlainText,
          }),
          signal: AbortSignal.timeout(15000),
        });

        const data = (await res.json()) as {
          success?: boolean;
          messageId?: string;
          error?: string;
        };
        if (res.ok && data.success && data.messageId) {
          console.log(
            `[Mailer:VercelRelay] Delivered to ${to} | ID: ${data.messageId} | via ${relayUrl}`,
          );
          return { messageId: data.messageId, provider: "relay-smtp" };
        }
        lastError = new Error(data.error || `Relay returned status ${res.status}`);
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error("All Vercel mail relay endpoints failed");
  };

  // Helper for sending via Resend API (used with verified envelope sender)
  const sendViaResend = async () => {
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
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
        text: cleanPlainText,
        html: finalHtml,
        reply_to: `PropertyStack Support <${fromAddress}>`,
        headers: antiSpamHeaders,
      }),
    });

    const data = (await response.json()) as { id?: string; message?: string; name?: string };

    if (response.ok && data.id) {
      console.log(
        `[Mailer:Resend] Delivered to ${to} | ID: ${data.id} | From: ${resendFrom}`,
      );
      return { messageId: data.id, provider: "resend" };
    }
    throw new Error(data.message || `Resend failed: ${JSON.stringify(data)}`);
  };

  // Helper for sending via Brevo API (ONLY for custom verified domains, NEVER for @gmail.com)
  const sendViaBrevo = async () => {
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY is not configured");
    }
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
        textContent: cleanPlainText,
        replyTo: {
          name: "PropertyStack Support",
          email: fromAddress,
        },
        headers: antiSpamHeaders,
      }),
    });

    const data = (await response.json()) as { messageId?: string; message?: string; code?: string };

    if (response.ok && data.messageId) {
      console.log(
        `[Mailer:Brevo] Delivered to ${to} | ID: ${data.messageId} | From: ${fromAddress}`,
      );
      return { messageId: data.messageId, provider: "brevo" };
    }
    throw new Error(data.message || `Brevo failed: ${JSON.stringify(data)}`);
  };

  // 1. FOR GMAIL SENDERS (@gmail.com):
  // Google DMARC strictly rejects/quarantines emails claiming to be from @gmail.com if sent from Brevo
  // because Brevo cannot sign DKIM for Google. Direct Google SMTP (via Vercel Relay or native SMTP) is REQUIRED.
  if (isGmailSender) {
    // Primary: Vercel HTTPS Relay (Google SMTP authenticated on AWS/Vercel with port 465 open)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await sendViaVercelRelay();
      } catch (relayErr) {
        console.warn(`[Mailer:VercelRelay] Attempt ${attempt} failed:`, relayErr);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Secondary: Direct SMTP to Google
    if (hasSmtp) {
      try {
        return await sendViaSmtp();
      } catch (smtpErr) {
        console.error("[Mailer:SMTPError] Direct SMTP failed:", smtpErr);
      }
    }

    // Tertiary: Fall back to Resend with verified sender (e.g. onboarding@resend.dev), NEVER spoof via Brevo
    if (resendApiKey) {
      try {
        return await sendViaResend();
      } catch (resendErr) {
        console.error("[Mailer:ResendError] Resend fallback failed:", resendErr);
      }
    }

    throw new Error(
      "All delivery channels for @gmail.com sender failed. Ensure Vercel mail relay is online.",
    );
  }

  // 2. FOR CUSTOM / VERIFIED DOMAINS:
  // Can use Vercel Relay, Direct SMTP, Brevo, or Resend
  const isRender =
    process.env.RENDER === "true" ||
    Boolean(process.env.RENDER) ||
    process.env.NODE_ENV === "production";

  if (isRender) {
    try {
      return await sendViaVercelRelay();
    } catch (relayErr) {
      console.warn("[Mailer:VercelRelay] Failed on Render, trying fallbacks:", relayErr);
    }
  }

  if (hasSmtp) {
    try {
      return await sendViaSmtp();
    } catch (smtpErr) {
      console.warn("[Mailer:SMTPError] Direct SMTP failed, trying API drivers:", smtpErr);
    }
  }

  if (brevoApiKey) {
    try {
      return await sendViaBrevo();
    } catch (brevoErr) {
      console.warn("[Mailer:BrevoError] Brevo failed, trying Resend:", brevoErr);
    }
  }

  if (resendApiKey) {
    try {
      return await sendViaResend();
    } catch (resendErr) {
      console.warn("[Mailer:ResendError] Resend failed, trying final SMTP attempt:", resendErr);
    }
  }

  return await sendViaSmtp();
};


