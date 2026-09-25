import { describe, it, expect, beforeAll } from "vitest";
import dns from "dns/promises";

// Resolve DB hostname to IPv4 BEFORE importing app/prisma (mirrors legal-lease.test.ts)
const DB_HOST = "aws-1-eu-north-1.pooler.supabase.com";
try {
  const ips = await dns.resolve4(DB_HOST);
  if (ips && ips.length > 0) {
    const dbIp = ips.includes("51.21.18.29") ? "51.21.18.29" : ips[0];
    const directIp = "51.21.189.77";
    if (process.env.DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace(DB_HOST, dbIp);
    }
    if (process.env.DIRECT_URL) {
      process.env.DIRECT_URL = process.env.DIRECT_URL.replace(DB_HOST, directIp);
    }
  }
} catch {
  // Fall through
}

const { app } = await import("../src/app");
const { prisma } = await import("../src/lib/database");
const { SecurityService } = await import("../src/services/security");

describe("Centralized Login Security, Attack Alerts & Lockout Shield", () => {
  const timestamp = Date.now();
  const testEmail = `attack-victim-${timestamp}@example.com`;
  const superAdminEmail = `super-admin-shield-${timestamp}@example.com`;
  const superAdminId = `admin-shield-id-${timestamp}`;
  const attackerIp = `198.51.100.${(timestamp % 200) + 10}`;

  beforeAll(async () => {
    // Create a Super Admin user to verify in-app notification dispatching
    await prisma.user.create({
      data: {
        id: superAdminId,
        email: superAdminEmail,
        name: "Security Admin",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
  });

  it("should record failed login, decrement remaining attempts, and log to SecurityAuditLog", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        "x-forwarded-for": attackerIp,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      payload: {
        email: testEmail,
        password: "WrongPassword123!",
        client: "web",
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.details).toBe("AUTH_INVALID_CREDENTIALS");
    expect(body.error.message).toContain("attempts remaining");

    // Verify audit log in database
    const auditEntry = await prisma.securityAuditLog.findFirst({
      where: {
        eventType: "FAILED_LOGIN",
        ipAddress: attackerIp,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(auditEntry).toBeDefined();
    const details = auditEntry?.details as any;
    expect(details.email).toBe(testEmail.toLowerCase());
    expect(details.client).toBe("web");
    expect(details.locked).toBe(false);

    // Verify in-app notification was dispatched to the Super Admin
    const notification = await prisma.notification.findFirst({
      where: {
        userId: superAdminId,
        type: "SECURITY_ALERT",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(notification).toBeDefined();
    expect(notification?.title).toContain("Failed Login Attempt");
    expect(notification?.message).toContain(testEmail.toLowerCase());
  });

  it("should trigger lockout on 5th consecutive failed attempt and return HTTP 429", async () => {
    // Fire remaining attempts (2, 3, 4, 5)
    for (let i = 2; i <= 4; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { "x-forwarded-for": attackerIp },
        payload: { email: testEmail, password: `WrongPassword${i}!`, client: "web" },
      });
      expect(res.statusCode).toBe(401);
    }

    // 5th attempt: should trigger lockout
    const lockRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "x-forwarded-for": attackerIp },
      payload: { email: testEmail, password: "FinalWrongPassword!", client: "web" },
    });

    expect(lockRes.statusCode).toBe(429);
    const lockBody = JSON.parse(lockRes.body);
    expect(lockBody.code).toBe("ACCOUNT_LOCKED_OUT");
    expect(lockBody.remainingSeconds).toBeGreaterThan(0);

    // Verify database has ACCOUNT_LOCKED_OUT event
    const lockoutEntry = await prisma.securityAuditLog.findFirst({
      where: {
        eventType: "ACCOUNT_LOCKED_OUT",
        ipAddress: attackerIp,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(lockoutEntry).toBeDefined();

    // Verify lockout notification created for Super Admin
    const lockoutNotif = await prisma.notification.findFirst({
      where: {
        userId: superAdminId,
        type: "SECURITY_LOCKOUT",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(lockoutNotif).toBeDefined();
    expect(lockoutNotif?.title).toContain("Locked Out");
  });

  it("should immediately reject subsequent login requests when account/IP is locked out", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "x-forwarded-for": attackerIp },
      payload: { email: testEmail, password: "AnyPassword123!", client: "web" },
    });

    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("ACCOUNT_LOCKED_OUT");
  });

  it("should expose active lockouts and metrics via SecurityService", () => {
    const lockouts = SecurityService.getActiveLockouts();
    expect(lockouts.length).toBeGreaterThan(0);
    const hasVictimLockout = lockouts.some(
      (l) => l.target === testEmail.toLowerCase() || l.target === attackerIp
    );
    expect(hasVictimLockout).toBe(true);
  });

  it("should reset counters and active lockout on successful login reset", () => {
    SecurityService.recordSuccessfulLogin(testEmail, attackerIp);
    const check = SecurityService.isAccountOrIpLockedOut(testEmail, attackerIp);
    expect(check.isLocked).toBe(false);
  });
});
