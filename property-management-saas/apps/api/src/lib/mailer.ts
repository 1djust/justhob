import nodemailer from 'nodemailer';

// Configure transporter - uses environment variables if available, otherwise logs to console
const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // Fallback for development: log to console
  return {
    sendMail: async (options: any) => {
      console.log('--- EMAIL NOTIFICATION (MOCK) ---');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Body: ${options.text || options.html}`);
      console.log('---------------------------------');
      return { messageId: 'mock-id' };
    },
  } as any;
};

const transporter = createTransporter();

export const sendEmail = async (to: string, subject: string, content: string, html?: string) => {
  try {
    await transporter.sendMail({
      from: '"EstateOS" <notifications@estateos.app>',
      to,
      subject,
      text: content,
      html: html || content,
    });
  } catch (error) {
    console.error('[MailerError]', error);
  }
};
