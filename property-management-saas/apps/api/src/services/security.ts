import { prisma } from "../lib/database";
import { sendEmail } from "../lib/mailer";

interface FailedLoginRecord {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

interface AttackStrikeRecord {
  strikes: number;
  firstStrikeAt: number;
}

interface AlertDebounceRecord {
  lastAlertAt: number;
  suppressedCount: number;
}

export class SecurityService {
  // Lockout parameters
  private static readonly MAX_FAILED_LOGINS = 5;
  private static readonly LOGIN_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours window
  private static readonly LOCKOUT_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours lockout
  private static readonly ALERT_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes debounce

  // Attack strike parameters
  private static readonly MAX_ATTACK_STRIKES = 3;
  private static readonly ATTACK_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
  private static readonly IP_BLACKLIST_DURATION_MS = 60 * 60 * 1000; // 1 hour blacklist

  // In-memory security tracking stores
  private static failedLogins = new Map<string, FailedLoginRecord>();
  private static activeLockouts = new Map<string, number>(); // key -> expiresAt (timestamp)
  private static attackStrikes = new Map<string, AttackStrikeRecord>(); // IP -> strikes
  private static blacklistedIps = new Map<string, number>(); // IP -> expiresAt (timestamp)
  private static alertDebounces = new Map<string, AlertDebounceRecord>(); // key -> alert record

  // Periodic garbage collection to maintain minimal memory footprint
  static {
    setInterval(() => {
      const now = Date.now();
      for (const [key, expiresAt] of this.activeLockouts.entries()) {
        if (expiresAt < now) this.activeLockouts.delete(key);
      }
      for (const [ip, expiresAt] of this.blacklistedIps.entries()) {
        if (expiresAt < now) this.blacklistedIps.delete(ip);
      }
      for (const [key, record] of this.failedLogins.entries()) {
        if (now - record.lastAttemptAt > this.LOGIN_WINDOW_MS) this.failedLogins.delete(key);
      }
      for (const [ip, record] of this.attackStrikes.entries()) {
        if (now - record.firstStrikeAt > this.ATTACK_WINDOW_MS) this.attackStrikes.delete(ip);
      }
      for (const [key, record] of this.alertDebounces.entries()) {
        if (now - record.lastAlertAt > this.ALERT_DEBOUNCE_MS) this.alertDebounces.delete(key);
      }
    }, 5 * 60 * 1000).unref();
  }

  /**
   * Returns active lockouts with remaining seconds for admin dashboard.
   */
  static getActiveLockouts(): Array<{ key: string; target: string; type: "ip" | "email"; expiresAt: number; remainingSeconds: number }> {
    const now = Date.now();
    const result: Array<{ key: string; target: string; type: "ip" | "email"; expiresAt: number; remainingSeconds: number }> = [];

    for (const [key, expiresAt] of this.activeLockouts.entries()) {
      if (expiresAt > now) {
        const isIp = key.startsWith("ip:");
        result.push({
          key,
          target: key.replace(/^(ip:|email:)/, ""),
          type: isIp ? "ip" : "email",
          expiresAt,
          remainingSeconds: Math.ceil((expiresAt - now) / 1000),
        });
      }
    }
    return result;
  }

  /**
   * Returns currently blacklisted IPs for admin dashboard.
   */
  static getBlacklistedIpsList(): Array<{ ip: string; expiresAt: number; remainingSeconds: number }> {
    const now = Date.now();
    const result: Array<{ ip: string; expiresAt: number; remainingSeconds: number }> = [];

    for (const [ip, expiresAt] of this.blacklistedIps.entries()) {
      if (expiresAt > now) {
        result.push({
          ip,
          expiresAt,
          remainingSeconds: Math.ceil((expiresAt - now) / 1000),
        });
      }
    }
    return result;
  }

  /**
   * Checks if an IP or Email account is currently locked out from logging in.
   */
  static isAccountOrIpLockedOut(
    email: string,
    ipAddress: string,
  ): { isLocked: boolean; remainingSeconds?: number; reason?: string } {
    const now = Date.now();
    const cleanEmail = email.toLowerCase().trim();

    // Check IP blacklist first
    const ipBlacklistExpiry = this.blacklistedIps.get(ipAddress);
    if (ipBlacklistExpiry && ipBlacklistExpiry > now) {
      const remainingSeconds = Math.ceil((ipBlacklistExpiry - now) / 1000);
      return {
        isLocked: true,
        remainingSeconds,
        reason: `IP address temporarily blacklisted due to multiple malicious exploit attempts. Try again in ${Math.ceil(remainingSeconds / 60)} minutes.`,
      };
    }

    // Check IP lockout
    const ipLockoutExpiry = this.activeLockouts.get(`ip:${ipAddress}`);
    if (ipLockoutExpiry && ipLockoutExpiry > now) {
      const remainingSeconds = Math.ceil((ipLockoutExpiry - now) / 1000);
      return {
        isLocked: true,
        remainingSeconds,
        reason: `Too many failed login attempts from this network. Access is locked for ${Math.ceil(remainingSeconds / 60)} minutes.`,
      };
    }

    // Check Account/Email lockout
    const emailLockoutExpiry = this.activeLockouts.get(`email:${cleanEmail}`);
    if (emailLockoutExpiry && emailLockoutExpiry > now) {
      const remainingSeconds = Math.ceil((emailLockoutExpiry - now) / 1000);
      return {
        isLocked: true,
        remainingSeconds,
        reason: `Account temporarily locked due to consecutive failed login attempts. Try again in ${Math.ceil(remainingSeconds / 60)} minutes or reset your password.`,
      };
    }

    return { isLocked: false };
  }

  /**
   * Checks if an IP is currently blacklisted.
   */
  static isIpBlacklisted(ipAddress: string): { isBlacklisted: boolean; remainingSeconds?: number } {
    const now = Date.now();
    const expiry = this.blacklistedIps.get(ipAddress);
    if (expiry && expiry > now) {
      return {
        isBlacklisted: true,
        remainingSeconds: Math.ceil((expiry - now) / 1000),
      };
    }
    return { isBlacklisted: false };
  }

  /**
   * Records a failed login attempt for an email and IP address.
   * Activates lockout if threshold (5 attempts) is reached.
   * Dispatches instant & debounced security alerts to Super Admins.
   */
  static async recordFailedLogin(
    email: string,
    ipAddress: string,
    reason: string = "Invalid credentials",
    details?: { userAgent?: string; client?: string },
  ): Promise<{ isLocked: boolean; attemptsRemaining: number }> {
    const now = Date.now();
    const cleanEmail = email.toLowerCase().trim();

    // 1. Update IP tracking
    const ipKey = `ip:${ipAddress}`;
    const ipRecord = this.failedLogins.get(ipKey) || { count: 0, firstAttemptAt: now, lastAttemptAt: now };
    if (now - ipRecord.firstAttemptAt > this.LOGIN_WINDOW_MS) {
      ipRecord.count = 1;
      ipRecord.firstAttemptAt = now;
    } else {
      ipRecord.count += 1;
    }
    ipRecord.lastAttemptAt = now;
    this.failedLogins.set(ipKey, ipRecord);

    // 2. Update Email tracking
    const emailKey = `email:${cleanEmail}`;
    const emailRecord = this.failedLogins.get(emailKey) || { count: 0, firstAttemptAt: now, lastAttemptAt: now };
    if (now - emailRecord.firstAttemptAt > this.LOGIN_WINDOW_MS) {
      emailRecord.count = 1;
      emailRecord.firstAttemptAt = now;
    } else {
      emailRecord.count += 1;
    }
    emailRecord.lastAttemptAt = now;
    this.failedLogins.set(emailKey, emailRecord);

    const maxCount = Math.max(ipRecord.count, emailRecord.count);
    const isLocked = maxCount >= this.MAX_FAILED_LOGINS;
    const attemptsRemaining = Math.max(0, this.MAX_FAILED_LOGINS - maxCount);

    // 3. Log event to database audit table
    await this.logEvent(ipAddress, isLocked ? "ACCOUNT_LOCKED_OUT" : "FAILED_LOGIN", {
      email: cleanEmail,
      ipAttempts: ipRecord.count,
      emailAttempts: emailRecord.count,
      reason,
      locked: isLocked,
      client: details?.client || "unknown",
      userAgent: details?.userAgent || "unknown",
    });

    // 4. Handle Lockout or Alert Dispatching
    if (isLocked) {
      const lockoutExpiry = now + this.LOCKOUT_DURATION_MS;
      if (ipRecord.count >= this.MAX_FAILED_LOGINS) {
        this.activeLockouts.set(ipKey, lockoutExpiry);
      }
      if (emailRecord.count >= this.MAX_FAILED_LOGINS) {
        this.activeLockouts.set(emailKey, lockoutExpiry);
      }

      // Send critical lockout alert email to Super Admins (non-blocking)
      this.sendLockoutAlertEmail(cleanEmail, ipAddress, maxCount).catch(() => {});

      // Create in-app notification for Super Admins
      await this.notifySuperAdmins(
        `🛑 Account/IP Locked Out: ${cleanEmail}`,
        `Account ${cleanEmail} and IP ${ipAddress} have been temporarily locked for 3 hours after ${maxCount} consecutive failed login attempts.`,
        "SECURITY_LOCKOUT",
      );

      // Clear alert debounce so next wave after lockout triggers fresh alerts
      this.alertDebounces.delete(emailKey);
      this.alertDebounces.delete(ipKey);
    } else {
      // Check debouncing for failed login alerts:
      // Alert immediately on the first attempt or if 5 minutes have elapsed since the last alert
      const alertKey = `alert:${cleanEmail}:${ipAddress}`;
      const debounceRecord = this.alertDebounces.get(alertKey);

      if (!debounceRecord || (now - debounceRecord.lastAlertAt > this.ALERT_DEBOUNCE_MS)) {
        this.alertDebounces.set(alertKey, {
          lastAlertAt: now,
          suppressedCount: 0,
        });

        // Send instant security alert email to Super Admins (non-blocking)
        this.sendFailedLoginAlertEmail(cleanEmail, ipAddress, maxCount, attemptsRemaining, reason, details?.userAgent).catch(() => {});

        // Create in-app notification for Super Admins
        await this.notifySuperAdmins(
          `🚨 Failed Login Attempt: ${cleanEmail}`,
          `Failed login attempt on account ${cleanEmail} from IP ${ipAddress}. Reason: ${reason}. (${attemptsRemaining} attempt(s) remaining before lockout).`,
          "SECURITY_ALERT",
        );
      } else {
        debounceRecord.suppressedCount += 1;
        this.alertDebounces.set(alertKey, debounceRecord);
      }
    }

    return {
      isLocked,
      attemptsRemaining,
    };
  }

  /**
   * Resets failed login counters upon successful authentication.
   */
  static recordSuccessfulLogin(email: string, ipAddress: string, details?: { userAgent?: string; client?: string }): void {
    const cleanEmail = email.toLowerCase().trim();
    this.failedLogins.delete(`ip:${ipAddress}`);
    this.failedLogins.delete(`email:${cleanEmail}`);
    this.activeLockouts.delete(`ip:${ipAddress}`);
    this.activeLockouts.delete(`email:${cleanEmail}`);
    this.alertDebounces.delete(`alert:${cleanEmail}:${ipAddress}`);

    // Fire and forget audit logging
    this.logEvent(ipAddress, "SUCCESSFUL_LOGIN", {
      email: cleanEmail,
      client: details?.client || "unknown",
      userAgent: details?.userAgent || "unknown",
    }).catch(() => {});
  }

  /**
   * Records a blocked malicious exploit attempt (SQLi, XSS, Scanner, Path traversal).
   * Strikes the IP and blacklists for 1 hour on 3 strikes.
   */
  static async recordBlockedAttack(
    ipAddress: string,
    attackType: string,
    details?: any,
  ): Promise<void> {
    const now = Date.now();
    const strike = this.attackStrikes.get(ipAddress) || { strikes: 0, firstStrikeAt: now };

    if (now - strike.firstStrikeAt > this.ATTACK_WINDOW_MS) {
      strike.strikes = 1;
      strike.firstStrikeAt = now;
    } else {
      strike.strikes += 1;
    }
    this.attackStrikes.set(ipAddress, strike);

    const isBlacklisted = strike.strikes >= this.MAX_ATTACK_STRIKES;
    if (isBlacklisted) {
      this.blacklistedIps.set(ipAddress, now + this.IP_BLACKLIST_DURATION_MS);
    }

    // Log to DB
    await this.logEvent(ipAddress, isBlacklisted ? "IP_BLACKLISTED_EXPLOIT_ATTACK" : "SECURITY_EXPLOIT_BLOCKED", {
      attackType,
      strikes: strike.strikes,
      blacklisted: isBlacklisted,
      details,
    });

    if (isBlacklisted) {
      await this.sendBlacklistAlertEmail(ipAddress, strike.strikes, attackType);
      await this.notifySuperAdmins(
        `🛑 IP Address Blacklisted: ${ipAddress}`,
        `IP ${ipAddress} blacklisted for 1 hour after ${strike.strikes} malicious attack attempts (${attackType}).`,
        "SECURITY_BLACKLIST",
      );
    }
  }

  /**
   * Logs a security event to the database.
   */
  static async logEvent(ipAddress: string, eventType: string, details?: any): Promise<void> {
    try {
      await prisma.securityAuditLog.create({
        data: {
          ipAddress,
          eventType,
          details: details || null,
        },
      });
    } catch (err) {
      console.error("[SecurityService] Failed to log event:", err);
    }
  }

  /**
   * Retrieves all Super Admin user records and email addresses for alerting.
   */
  private static async getSuperAdmins(): Promise<Array<{ id: string; email: string }>> {
    try {
      const admins = await prisma.user.findMany({
        where: { role: "SUPER_ADMIN", isActive: true },
        select: { id: true, email: true },
      });

      const emailsSet = new Set(admins.map((a) => a.email.toLowerCase()));
      const adminEmailEnv = process.env.ADMIN_EMAIL || "propertystackapp@gmail.com";

      if (!emailsSet.has(adminEmailEnv.toLowerCase())) {
        admins.push({ id: "system-admin-env", email: adminEmailEnv });
      }

      return admins;
    } catch {
      const fallback = process.env.ADMIN_EMAIL || "propertystackapp@gmail.com";
      return [{ id: "system-admin-env", email: fallback }];
    }
  }

  /**
   * Dispatches an in-app notification to all active Super Admins.
   */
  private static async notifySuperAdmins(title: string, message: string, type: string = "SECURITY_ALERT"): Promise<void> {
    try {
      const admins = await this.getSuperAdmins();
      const realAdmins = admins.filter((a) => a.id !== "system-admin-env");

      if (realAdmins.length === 0) return;

      await prisma.notification.createMany({
        data: realAdmins.map((admin) => ({
          userId: admin.id,
          title,
          message,
          type,
        })),
      });
    } catch (err) {
      console.error("[SecurityService] Failed to create in-app notification for super admins:", err);
    }
  }

  /**
   * Sends an immediate email alert for a failed login attempt to Super Admins.
   */
  private static async sendFailedLoginAlertEmail(
    email: string,
    ipAddress: string,
    attemptCount: number,
    attemptsRemaining: number,
    reason: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      const admins = await this.getSuperAdmins();
      const safeIp = String(ipAddress).replace(/[&<>"']/g, "");
      const safeEmail = String(email).replace(/[&<>"']/g, "");
      const safeReason = String(reason).replace(/[&<>"']/g, "");
      const safeUa = String(userAgent || "Unknown Device").replace(/[&<>"']/g, "");

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 600px; color: #1e293b; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <h2 style="color: #d97706; margin: 0; font-size: 20px; font-weight: 700;">🚨 Security Warning: Failed Login Attempt</h2>
          </div>
          <p style="font-size: 14px; line-height: 1.5; color: #475569;">An unauthorized login attempt with an incorrect password was detected on PropertyStack. Super Admins are notified for immediate awareness.</p>
          
          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 6px 0; font-size: 14px;"><strong>Target Account:</strong> <span style="font-family: monospace; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">${safeEmail}</span></p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Attacker IP:</strong> <span style="font-family: monospace; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">${safeIp}</span></p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Failure Reason:</strong> ${safeReason}</p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Attempt Count:</strong> ${attemptCount} (Attempts remaining before lockout: <strong>${attemptsRemaining}</strong>)</p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Device / Client:</strong> <span style="font-size: 12px; color: #64748b;">${safeUa}</span></p>
          </div>

          <p style="color: #64748b; font-size: 12px; line-height: 1.4;">
            Automated defensive measures are active. If 5 failed attempts occur within 3 hours, the source IP and target email will be automatically locked out.
          </p>
        </div>
      `;

      for (const admin of admins) {
        sendEmail(admin.email, `🚨 [Security Alert] Failed Login Attempt: ${safeEmail}`, htmlContent).catch(() => {});
      }
    } catch (err) {
      console.error("[SecurityService] Failed to send failed login alert email:", err);
    }
  }

  private static async sendLockoutAlertEmail(email: string, ipAddress: string, count: number): Promise<void> {
    try {
      const admins = await this.getSuperAdmins();
      const safeIp = String(ipAddress).replace(/[&<>"']/g, "");
      const safeEmail = String(email).replace(/[&<>"']/g, "");

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 600px; color: #1e293b; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
          <h2 style="color: #dc2626; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">🛑 Critical Security Alert: Account & IP Lockout Activated</h2>
          <p style="font-size: 14px; line-height: 1.5; color: #475569;">The PropertyStack Security Shield has locked out an account/IP after exceeding the maximum failed login threshold.</p>
          <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #dc2626; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 6px 0; font-size: 14px;"><strong>Target Account:</strong> <span style="font-family: monospace; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">${safeEmail}</span></p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>IP Address:</strong> <span style="font-family: monospace; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">${safeIp}</span></p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Consecutive Failures:</strong> ${count}</p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Lockout Duration:</strong> 3 Hours (All access blocked)</p>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.4;">This automated defensive barrier prevents brute-force credential stuffing attacks.</p>
        </div>
      `;

      for (const admin of admins) {
        sendEmail(admin.email, `🛑 [Critical Alert] Account Locked Out: ${safeEmail}`, htmlContent).catch(() => {});
      }
    } catch (err) {
      console.error("[SecurityService] Failed to send lockout alert email:", err);
    }
  }

  private static async sendBlacklistAlertEmail(ipAddress: string, strikes: number, lastAttackType: string): Promise<void> {
    try {
      const admins = await this.getSuperAdmins();
      const safeIp = String(ipAddress).replace(/[&<>"']/g, "");

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 600px; color: #1e293b; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
          <h2 style="color: #991b1b; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">🛑 Critical Security Alert: IP Address Blacklisted</h2>
          <p style="font-size: 14px; line-height: 1.5; color: #475569;">An IP address has been automatically blacklisted for 1 hour after triggering multiple malicious exploit signatures.</p>
          <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #991b1b; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 6px 0; font-size: 14px;"><strong>Blacklisted IP:</strong> <span style="font-family: monospace; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">${safeIp}</span></p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Total Exploit Strikes:</strong> ${strikes}</p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Triggering Attack:</strong> ${lastAttackType}</p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>Blacklist Duration:</strong> 1 Hour (All API requests blocked)</p>
          </div>
        </div>
      `;

      for (const admin of admins) {
        await sendEmail(admin.email, `🛑 [Critical Alert] Malicious IP Blacklisted: ${safeIp}`, htmlContent);
      }
    } catch (err) {
      console.error("[SecurityService] Failed to send blacklist alert email:", err);
    }
  }
}
