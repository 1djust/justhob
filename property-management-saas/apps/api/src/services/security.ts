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

export class SecurityService {
  // Lockout parameters
  private static readonly MAX_FAILED_LOGINS = 5;
  private static readonly LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
  private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

  // Attack strike parameters
  private static readonly MAX_ATTACK_STRIKES = 3;
  private static readonly ATTACK_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
  private static readonly IP_BLACKLIST_DURATION_MS = 60 * 60 * 1000; // 1 hour blacklist

  // In-memory security tracking stores
  private static failedLogins = new Map<string, FailedLoginRecord>();
  private static activeLockouts = new Map<string, number>(); // key -> expiresAt (timestamp)
  private static attackStrikes = new Map<string, AttackStrikeRecord>(); // IP -> strikes
  private static blacklistedIps = new Map<string, number>(); // IP -> expiresAt (timestamp)

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
    }, 5 * 60 * 1000).unref();
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
   */
  static async recordFailedLogin(
    email: string,
    ipAddress: string,
    reason: string = "Invalid credentials",
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

    // 3. Log event to database audit table
    await this.logEvent(ipAddress, isLocked ? "ACCOUNT_LOCKED_OUT" : "FAILED_LOGIN", {
      email: cleanEmail,
      ipAttempts: ipRecord.count,
      emailAttempts: emailRecord.count,
      reason,
      locked: isLocked,
    });

    // 4. If threshold reached, enforce lockout and send immediate security alert
    if (isLocked) {
      const lockoutExpiry = now + this.LOCKOUT_DURATION_MS;
      if (ipRecord.count >= this.MAX_FAILED_LOGINS) {
        this.activeLockouts.set(ipKey, lockoutExpiry);
      }
      if (emailRecord.count >= this.MAX_FAILED_LOGINS) {
        this.activeLockouts.set(emailKey, lockoutExpiry);
      }

      await this.sendLockoutAlertEmail(cleanEmail, ipAddress, maxCount);
    }

    return {
      isLocked,
      attemptsRemaining: Math.max(0, this.MAX_FAILED_LOGINS - maxCount),
    };
  }

  /**
   * Resets failed login counters upon successful authentication.
   */
  static recordSuccessfulLogin(email: string, ipAddress: string): void {
    const cleanEmail = email.toLowerCase().trim();
    this.failedLogins.delete(`ip:${ipAddress}`);
    this.failedLogins.delete(`email:${cleanEmail}`);
    this.activeLockouts.delete(`ip:${ipAddress}`);
    this.activeLockouts.delete(`email:${cleanEmail}`);

    // Fire and forget audit logging
    this.logEvent(ipAddress, "SUCCESSFUL_LOGIN", { email: cleanEmail }).catch(() => {});
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

  private static async sendLockoutAlertEmail(email: string, ipAddress: string, count: number): Promise<void> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || "admin@propertystack.com";
      const safeIp = String(ipAddress).replace(/[&<>"']/g, "");
      const safeEmail = String(email).replace(/[&<>"']/g, "");

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; color: #1e293b;">
          <h2 style="color: #dc2626;">🚨 Security Alert: Account/IP Lockout Activated</h2>
          <p>The PropertyStack Security Shield has locked out an account/IP due to multiple consecutive failed login attempts.</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Target Account:</strong> ${safeEmail}</p>
            <p style="margin: 4px 0;"><strong>IP Address:</strong> ${safeIp}</p>
            <p style="margin: 4px 0;"><strong>Consecutive Failures:</strong> ${count}</p>
            <p style="margin: 4px 0;"><strong>Lockout Duration:</strong> 15 Minutes</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">This automated security measure prevents brute-force credential attacks.</p>
        </div>
      `;

      await sendEmail(adminEmail, "🚨 PropertyStack Security Alert: Account Locked Out", htmlContent);
    } catch (err) {
      console.error("[SecurityService] Failed to send lockout alert email:", err);
    }
  }

  private static async sendBlacklistAlertEmail(ipAddress: string, strikes: number, lastAttackType: string): Promise<void> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || "admin@propertystack.com";
      const safeIp = String(ipAddress).replace(/[&<>"']/g, "");

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; color: #1e293b;">
          <h2 style="color: #991b1b;">🛑 Critical Security Alert: IP Address Blacklisted</h2>
          <p>An IP address has been automatically blacklisted for 1 hour after triggering multiple malicious exploit signatures.</p>
          <div style="background-color: #fef2f2; border-left: 4px solid #991b1b; padding: 15px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Blacklisted IP:</strong> ${safeIp}</p>
            <p style="margin: 4px 0;"><strong>Total Exploit Strikes:</strong> ${strikes}</p>
            <p style="margin: 4px 0;"><strong>Triggering Attack:</strong> ${lastAttackType}</p>
            <p style="margin: 4px 0;"><strong>Blacklist Duration:</strong> 1 Hour (All API requests blocked)</p>
          </div>
        </div>
      `;

      await sendEmail(adminEmail, "🛑 PropertyStack Critical Alert: Malicious IP Blacklisted", htmlContent);
    } catch (err) {
      console.error("[SecurityService] Failed to send blacklist alert email:", err);
    }
  }
}
