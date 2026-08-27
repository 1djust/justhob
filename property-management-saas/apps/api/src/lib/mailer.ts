import nodemailer from "nodemailer";

// Configure transporter - uses environment variables if available, otherwise logs to console
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

export const sendEmail = async (
  to: string,
  subject: string,
  content: string,
  html?: string,
) => {
  try {
    const fromAddress =
      process.env.SMTP_USER || "notifications@propertystack.com";
    const info = await transporter.sendMail({
      from: `"PropertyStack" <${fromAddress}>`,
      to,
      subject,
      text: content,
      html: html || content,
    });
    console.log(
      `[Mailer] Delivered to ${to} | ID: ${info.messageId} | Accepted: ${JSON.stringify(info.accepted)}`,
    );
    return info;
  } catch (error) {
    console.error("[MailerError]", error);
    throw error;
  }
};
