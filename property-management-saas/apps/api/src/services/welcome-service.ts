import { prisma } from "../lib/database";
import { sendEmail } from "../lib/mailer";
import { renderEmailLayout, escapeHtml } from "./../lib/email-template";
import type { Server } from "socket.io";

export interface SendWelcomeParams {
  userId: string;
  workspaceName: string;
  io?: Server;
}

export class WelcomeService {
  /**
   * Delivers a friendly welcome notification and onboarding welcome email
   * upon completing initial portfolio/workspace setup.
   */
  static async sendWelcomeOnboarding({
    userId,
    workspaceName,
    io,
  }: SendWelcomeParams) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.email) {
        console.warn(`[WelcomeService] User ${userId} not found or has no email.`);
        return { success: false, reason: "USER_NOT_FOUND" };
      }

      // Check if welcome notification already exists to prevent duplicate messages
      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId,
          type: "WELCOME",
        },
      });

      let notification = existingNotif;

      // 1. In-App Notification Delivery
      if (!existingNotif) {
        const rawName = user.name?.trim() || "";
        const firstName = rawName ? rawName.split(" ")[0] : "there";

        notification = await prisma.notification.create({
          data: {
            userId: user.id,
            title: "Welcome to PropertyStack! 🎉",
            message: `Hi ${firstName}! Welcome to PropertyStack. Your workspace "${workspaceName}" is active and ready. You can now start adding properties, managing units, tracking rent, and inviting tenants.`,
            type: "WELCOME",
          },
        });

        // Real-time WebSocket emission to mobile and web clients
        if (io) {
          try {
            io.to(`user:${userId}`).emit("NOTIFICATION_CREATED", notification);
            console.log(`[WelcomeService] Real-time notification emitted to user:${userId}`);
          } catch (socketErr) {
            console.error("[WelcomeService] WebSocket emission error:", socketErr);
          }
        }
      }

      // 2. Friendly Welcome Email Delivery
      const rawName = user.name?.trim() || "";
      const firstName = rawName ? rawName.split(" ")[0] : "there";
      const subject = `Welcome to PropertyStack, ${firstName}!`;
      const dashboardUrl =
        process.env.FRONTEND_URL &&
        !process.env.FRONTEND_URL.includes("localhost") &&
        !process.env.FRONTEND_URL.includes("127.0.0.1")
          ? process.env.FRONTEND_URL.replace(/\/$/, "")
          : "https://propertystack.vercel.app";

      const bodyHtml = `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Welcome to PropertyStack, ${escapeHtml(firstName)}!</h2>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          We're thrilled to have you! Your workspace <strong>${escapeHtml(workspaceName)}</strong> has been successfully created and configured.
        </p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
          <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;">What you can do next:</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #475569;">
            <li><strong>Add Properties & Units:</strong> List your properties and set up unit details and rent amounts.</li>
            <li><strong>Onboard Tenants:</strong> Invite tenants, generate digital leases, and track signatures.</li>
            <li><strong>Automate Rent Collection:</strong> Receive payments, track overdue alerts, and issue instant receipts.</li>
            <li><strong>Manage Maintenance:</strong> Receive tenant repair requests with intelligent AI triage.</li>
          </ul>
        </div>
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          You can access your portfolio anytime from the web dashboard or directly inside the mobile app.
        </p>
        <div style="text-align: center; margin: 28px 0 12px 0;">
          <a href="${dashboardUrl}" style="background-color: #0066FF; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 15px;">Open Your Dashboard</a>
        </div>
      `;

      const styledHtml = renderEmailLayout({
        title: subject,
        badge: "WELCOME TO PROPERTYSTACK",
        bodyHtml,
        recipientEmail: user.email,
        footerNote: "Need help getting started? Simply reply to this email to reach our support team.",
      });

      const plainText = `Hi ${firstName},\n\nWelcome to PropertyStack! Your workspace "${workspaceName}" has been successfully created and configured.\n\nWhat you can do next:\n- Add Properties & Units: List your properties and configure rental units.\n- Onboard Tenants: Invite tenants and generate digital leases.\n- Automate Rent Collection: Track incoming payments and issue automated receipts.\n- Manage Maintenance: Receive and track repair requests.\n\nOpen your dashboard: ${dashboardUrl}\n\nBest regards,\nThe PropertyStack Team`;

      sendEmail(user.email, subject, plainText, styledHtml).catch((emailErr) => {
        console.error(`[WelcomeService] Welcome email delivery failed for ${user.email}:`, emailErr);
      });

      return {
        success: true,
        notification,
      };
    } catch (err) {
      console.error("[WelcomeService] sendWelcomeOnboarding error:", err);
      return { success: false, error: err };
    }
  }
}
