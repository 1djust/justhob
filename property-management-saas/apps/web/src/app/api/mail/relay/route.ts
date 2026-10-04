import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const SMTP_USER = process.env.SMTP_USER || "propertystackapp@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "rkugylrldzpdhtas";
const RELAY_SECRET = process.env.ADMIN_SECURITY_KEY || "8d5e1b2f7a9c3d4e0f8b7a6c5d4e2f1a";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const allowedTokens = new Set(
      [
        "8d5e1b2f7a9c3d4e0f8b7a6c5d4e2f1a",
        "620ee6b4a390c53d0e2e92c2df9fa8f9c1dbde5b8e9ab53488bbd23d8c2c1e8d",
        process.env.ADMIN_SECURITY_KEY,
        process.env.CRON_SECRET,
      ].filter(Boolean) as string[],
    );

    if (!token || !allowedTokens.has(token)) {
      return NextResponse.json(
        { error: "Unauthorized relay access" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { to, subject, html, text } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: "Missing required fields (to, subject)" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    } as any);

    const info = await transporter.sendMail({
      from: `"PropertyStack" <${SMTP_USER}>`,
      to,
      replyTo: `"PropertyStack Support" <${SMTP_USER}>`,
      subject,
      text: text || "",
      html: html || undefined,
    });

    console.log(`[VercelRelay] Successfully dispatched email to ${to}: ${info.messageId}`);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      provider: "relay-smtp",
    });
  } catch (err: any) {
    console.error("[VercelRelay] Delivery error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to relay email via SMTP",
      },
      { status: 500 },
    );
  }
}
