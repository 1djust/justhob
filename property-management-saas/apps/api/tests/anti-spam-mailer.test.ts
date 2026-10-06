import { describe, it, expect } from "vitest";
import {
  sanitizeEmailContentForAntiSpam,
  stripHtmlToPlainText,
  sendEmail,
} from "../src/lib/mailer";
import { renderEmailLayout } from "../src/lib/email-template";

describe("Anti-Spam Mailer Engine & Sanitization", () => {
  it("strips spam-trigger emojis and normalizes exclamation marks in subjects", () => {
    const dirty = [
      "🚨 [Security Alert] Failed Login Attempt: test@example.com",
      "🛑 [Critical Alert] Account Locked Out: admin@example.com",
      "📱 PropertyStack Mobile App v0.3.5 is Now Available! 📱",
      "Welcome to PropertyStack, Alice! 🚀",
      "🔑 Your Login Credentials!!!",
      "📥 Download Your Receipt Now",
    ];

    const cleaned = dirty.map((subj) =>
      sanitizeEmailContentForAntiSpam({
        subject: subj,
        content: "Sample content",
        to: "user@example.com",
      }).cleanSubject,
    );

    expect(cleaned[0]).toBe("[Security Alert] Failed Login Attempt: test@example.com");
    expect(cleaned[1]).toBe("[Critical Alert] Account Locked Out: admin@example.com");
    expect(cleaned[2]).toBe("PropertyStack Mobile App v0.3.5 is Now Available!");
    expect(cleaned[3]).toBe("Welcome to PropertyStack, Alice!");
    expect(cleaned[4]).toBe("Your Login Credentials!");
    expect(cleaned[5]).toBe("Download Your Receipt Now");
  });

  it("replaces localhost and 127.0.0.1 development URLs with verified HTTPS production URLs", () => {
    const sampleContent = `
      Please sign in to your dashboard: http://localhost:3000/login?email=test%40example.com
      Or visit http://127.0.0.1:3000/downloads/propertystack-tenant.apk
      API webhook: http://localhost:3001/api/v1/health
    `;

    const { cleanContent } = sanitizeEmailContentForAntiSpam({
      subject: "Test Subject",
      content: sampleContent,
      to: "test@example.com",
    });

    expect(cleanContent).not.toContain("localhost");
    expect(cleanContent).not.toContain("127.0.0.1");
    expect(cleanContent).toContain("https://propertystack.vercel.app/login");
    expect(cleanContent).toContain("https://propertystack.vercel.app/download");
    expect(cleanContent).toContain("https://propertystack.vercel.app/api/v1/health");
  });

  it("neutralizes malware and Android sideloading bypass heuristics", () => {
    const maliciousInstructions = `
      Note: If your phone displays an install prompt, tap "Settings" and enable "Allow from this source".
      Also enable unknown sources to complete setup.
      Click below to 📥 Download PropertyStack Mobile App (.apk).
      🔑 Your Login Credentials:
    `;

    const { cleanContent } = sanitizeEmailContentForAntiSpam({
      subject: "Welcome",
      content: maliciousInstructions,
      to: "test@example.com",
    });

    expect(cleanContent).not.toContain("Allow from this source");
    expect(cleanContent).not.toContain("unknown sources");
    expect(cleanContent).not.toContain("📥");
    expect(cleanContent).not.toContain("🔑");
    expect(cleanContent).toContain("Open on your Android device to install directly");
    expect(cleanContent).toContain("trusted sources");
    expect(cleanContent).toContain("Download PropertyStack for Android");
    expect(cleanContent).toContain("Account Access Details");
  });

  it("converts HTML emails into crisp, spam-free plain text alternatives", () => {
    const html = `
      <div style="font-family: sans-serif;">
        <h2>Rent Payment Received</h2>
        <p>Dear John,<br/>Your payment of &pound;500 has been verified.</p>
        <ul>
          <li>Receipt Number: #12345</li>
          <li>Date: 2026-10-05</li>
        </ul>
        <p>Thank you for choosing PropertyStack.</p>
      </div>
    `;

    const plainText = stripHtmlToPlainText(html);

    expect(plainText).toContain("Rent Payment Received");
    expect(plainText).toContain("Dear John,");
    expect(plainText).toContain("Your payment of £500 has been verified.");
    expect(plainText).toContain("• Receipt Number: #12345");
    expect(plainText).toContain("• Date: 2026-10-05");
    expect(plainText).not.toContain("<div");
    expect(plainText).not.toContain("<h2>");
    expect(plainText).not.toContain("</li>");
  });

  it("renders CAN-SPAM compliant footers with notification preferences and preheaders", () => {
    const rendered = renderEmailLayout({
      title: "Account Notification",
      badge: "NOTIFICATION",
      bodyHtml: "<p>Your profile has been updated.</p>",
      recipientEmail: "resident@example.com",
      preheader: "Your account profile has been updated on PropertyStack.",
    });

    expect(rendered).toContain("resident@example.com");
    expect(rendered).toContain("PropertyStack Inc. All rights reserved.");
    expect(rendered).toContain("Notification Preferences");
    expect(rendered).toContain("https://propertystack.vercel.app/settings/notifications");
    expect(rendered).toContain("propertystack.vercel.app");
    expect(rendered).toContain("#0A192F"); // Official brand header color
    expect(rendered).toContain("Your account profile has been updated on PropertyStack.");
  });

  it("scrubs Supabase verify links and phishing triggers from email content", () => {
    const rawContent = `
      Please click below to activate:
      <a href="https://gushvedprjygyauwzvnf.supabase.co/auth/v1/verify?token=pkce_123&type=invite&redirect_to=https://propertystack.vercel.app/login">
        Activate Your Account
      </a>
      One-time access code: 3bf4d8e9A!1
    `;

    const { cleanContent, cleanSubject } = sanitizeEmailContentForAntiSpam({
      subject: 'Invitation to join "Djust Homes" on PropertyStack',
      content: rawContent,
      to: "tenant@example.com",
    });

    expect(cleanSubject).toBe("Invitation to join Djust Homes on PropertyStack");
    expect(cleanContent).not.toContain("supabase.co");
    expect(cleanContent).not.toContain("Activate Your Account");
    expect(cleanContent).not.toContain("One-time access code");
    expect(cleanContent).toContain("https://propertystack.vercel.app/login");
    expect(cleanContent).toContain("Sign In to Your Account");
    expect(cleanContent).toContain("Temporary Password");
  });

  it("sendEmail dispatches safely in test mode without throwing", async () => {
    const result = await sendEmail(
      "tenant@example.com",
      "🚨 Welcome to PropertyStack! 🚀",
      "Visit http://localhost:3000 to get started with your new account.",
    );

    expect(result).toHaveProperty("messageId");
    expect(result).toHaveProperty("provider", "mock");
  });
});
