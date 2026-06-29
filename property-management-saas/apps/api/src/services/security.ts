import { prisma } from "../lib/database";
import { sendEmail } from "../lib/mailer";

export class SecurityService {
  /**
   * Logs a security event to the database and checks thresholds.
   */
  static async logEvent(ipAddress: string, eventType: string, details?: any) {
    try {
      // 1. Record the event
      await prisma.securityAuditLog.create({
        data: {
          ipAddress,
          eventType,
          details: details ? details : null,
        },
      });

      // 2. Check threshold
      await this.checkThresholdAndAlert(ipAddress);
    } catch (err) {
      console.error("[SecurityService] Failed to log event:", err);
    }
  }

  /**
   * Checks if an IP has exceeded the threshold and triggers an alert.
   */
  static async checkThresholdAndAlert(ipAddress: string) {
    const timeLimit = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    const recentFailures = await prisma.securityAuditLog.count({
      where: {
        ipAddress,
        createdAt: {
          gte: timeLimit,
        },
        eventType: {
          in: [
            "FAILED_LOGIN",
            "UNAUTHORIZED_API_ACCESS",
            "RATE_LIMIT_EXCEEDED",
          ],
        },
      },
    });

    // Alert if threshold reached exactly (to avoid spamming an email on every subsequent failure)
    if (recentFailures === 10) {
      await this.sendAlertEmail(ipAddress, recentFailures);
    }
  }

  static async sendAlertEmail(ipAddress: string, count: number) {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || "admin@propertystack.com";

      const htmlContent = `
        <h2>Security Alert: Suspicious Activity Detected</h2>
        <p>The system has detected multiple failed security events from a single IP address.</p>
        <ul>
          <li><strong>IP Address:</strong> ${ipAddress}</li>
          <li><strong>Events count:</strong> ${count} in the last 5 minutes</li>
        </ul>
        <p>Please review the security audit logs in the admin dashboard for more details.</p>
      `;

      await sendEmail(
        adminEmail,
        "🚨 PropertyStack Security Alert: Multiple Failed Attempts",
        htmlContent,
      );

      console.log(`[SecurityService] Alert email sent for IP: ${ipAddress}`);
    } catch (err) {
      console.error("[SecurityService] Failed to send alert email:", err);
    }
  }
}
