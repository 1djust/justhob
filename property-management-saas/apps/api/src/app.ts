import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import errorLoggerPlugin from "./plugins/error-logger";
import securityFirewallPlugin from "./plugins/security-firewall";
import publicLogRoutes from "./routes/public-logs";
import { SecurityService } from "./services/security";

import authRoutes from "./routes/auth";
import workspaceRoutes from "./routes/workspaces";
import propertiesRoutes from "./routes/properties";
import timelineRoutes from "./routes/timeline";
import tenantRoutes from "./routes/tenants";
import paymentRoutes from "./routes/payments";
import maintenanceRoutes from "./routes/maintenance";
import publicRoutes from "./routes/public";
import tenantProfileRoutes from "./routes/tenant-profile";
import webhookRoutes from "./routes/webhooks";
import ownerRoutes from "./routes/owners";
import notificationRoutes from "./routes/notifications";
import bankVerificationRoutes from "./routes/bank-verification";
import leaseRoutes from "./routes/leases";
import exportRoutes from "./routes/exports";
import leaseRenewalRoutes from "./routes/lease-renewals";
import adminRoutes from "./routes/admin";
import superAdminRoutes from "./routes/super-admin";
import uploadRoutes from "./routes/upload";
import socketPlugin from "./plugins/socket";
import { setupOverdueChecker } from "./cron/overdue-checker";
import { setupLeaseExpiryReminder } from "./cron/lease-expiry-reminder";
import { setupIntegrityChecker } from "./cron/integrity-checker";

interface FastifyErrorWithMeta extends Error {
  statusCode?: number;
  status?: number;
  code?: string;
  details?: Record<string, unknown> | unknown;
}

export function buildApp() {
  const fastify = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB for image uploads
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Security: Restrict CORS to known frontend origins only
  // M-1 fix: Only include localhost in development to prevent CORS abuse in production
  const isProd = process.env.NODE_ENV === "production";
  const allowedOrigins = [
    ...(isProd ? [] : ["http://localhost:3000"]),
    "https://justhob.vercel.app",
    "https://propertystack.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  fastify.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });

  // PRODUCTION HARDENING: Check for mandatory secrets
  const cookieSecret = process.env.COOKIE_SECRET;

  if (isProd && (!cookieSecret || cookieSecret === "super-secret-cookie-key")) {
    throw new Error(
      "PRODUCTION ERROR: COOKIE_SECRET must be set to a secure unique value in production environments.",
    );
  }

  fastify.register(cookie, {
    // L-4 fix: Dev-only fallback is clearly scoped; production enforced above
    secret: cookieSecret || (isProd ? undefined : "dev-only-cookie-secret"),
    parseOptions: {
      secure: isProd,
      sameSite: "strict",
      httpOnly: true,
    },
  });

  // Security: Bank-Grade HTTP security headers (CSP, X-Frame-Options, HSTS, Anti-Sniffing)
  fastify.register(helmet, {
    contentSecurityPolicy: false, // Disabled — API-only server, no HTML rendering
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" }, // Anti-Clickjacking: DENY iframe framing
    hidePoweredBy: true, // Strips X-Powered-By header
    hsts: {
      maxAge: 31536000, // 1 Year HSTS preload
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true, // Anti-MIME Sniffing: X-Content-Type-Options: nosniff
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true, // X-XSS-Protection: 1; mode=block
  });

  // Security: Global Web Application Firewall (WAF) & Exploit Blocker
  fastify.register(securityFirewallPlugin);

  // Security: Rate limiting — prevents brute force and DDoS
  fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Production monitoring — custom zero-cost logger using Supabase
  fastify.register(errorLoggerPlugin);

  // Real-time synchronization
  fastify.register(socketPlugin);

  // Initialize background cron jobs
  setupOverdueChecker(
    fastify as unknown as Parameters<typeof setupOverdueChecker>[0],
  );
  setupLeaseExpiryReminder(
    fastify as unknown as Parameters<typeof setupLeaseExpiryReminder>[0],
  );
  setupIntegrityChecker(
    fastify as unknown as Parameters<typeof setupIntegrityChecker>[0],
  );

  // Global Security & Cache-Control Hook
  fastify.addHook("onSend", async (request, reply, payload) => {
    // Defense-in-depth: Permissions-Policy header
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );

    // Defense-in-depth: Prevent caching of sensitive authenticated endpoints
    const rawUrl = request.raw.url || request.url;
    if (
      rawUrl.startsWith("/api/workspaces") ||
      rawUrl.startsWith("/api/tenant") ||
      rawUrl.startsWith("/api/admin") ||
      rawUrl.startsWith("/api/super-admin") ||
      rawUrl.startsWith("/api/auth")
    ) {
      reply.header(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      reply.header("Pragma", "no-cache");
      reply.header("Expires", "0");
    }

    const code = reply.statusCode;
    if (code === 401 || code === 403 || code === 429) {
      let eventType = "UNAUTHORIZED_API_ACCESS";
      if (code === 429) eventType = "RATE_LIMIT_EXCEEDED";

      SecurityService.logEvent(request.ip, eventType, {
        url: request.url,
        method: request.method,
        userAgent: request.headers["user-agent"],
      }).catch((err) => request.log.error({ err }, "[Security Hook Error]"));
    }
  });

  // Global Error Handler
  fastify.setErrorHandler((error, request, reply) => {
    const err = error as FastifyErrorWithMeta;
    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Extract error details safely
    let errorMessage = error.message || "Internal Server Error";

    // Sanitize raw Prisma and database connection errors for the frontend
    if (
      errorMessage.includes("Can't reach database server") ||
      errorMessage.includes("PrismaClientInitializationError") ||
      errorMessage.includes("PrismaClientKnownRequestError") ||
      errorMessage.includes("PrismaClientUnknownRequestError") ||
      errorMessage.includes("PrismaClientRustPanicError") ||
      errorMessage.includes("ConnectorError")
    ) {
      errorMessage =
        "Unable to connect to the database. Please check your internet connection and try again.";
    } else if (
      (errorMessage.includes("\n") && errorMessage.includes("invocation in")) ||
      errorMessage.includes("Raw query failed") ||
      errorMessage.includes("syntax error at or near")
    ) {
      // Hide raw Prisma stack traces and database schema details
      errorMessage =
        "An unexpected database error occurred. Please try again later.";
    } else if (
      errorMessage.includes("must match pattern") &&
      errorMessage.includes("newPassword")
    ) {
      errorMessage =
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.";
    } else if (statusCode >= 500 && process.env.NODE_ENV === "production") {
      // In production, mask unhandled 500 errors to prevent system information disclosure
      errorMessage =
        "An unexpected server error occurred. Please contact support if the issue persists.";
    }

    const errorCode =
      err.code || (statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST");

    // Mask internal error details for 500s to avoid leaking server internals
    const errorDetails =
      statusCode >= 500 ? undefined : err.details || undefined;

    // Log the error safely
    if (statusCode === 400) {
      const sanitizedBody =
        request.body && typeof request.body === "object"
          ? { ...(request.body as Record<string, unknown>) }
          : request.body;

      if (sanitizedBody && typeof sanitizedBody === "object") {
        delete (sanitizedBody as Record<string, unknown>).password;
        delete (sanitizedBody as Record<string, unknown>).newPassword;
        delete (sanitizedBody as Record<string, unknown>).securityKey;
        delete (sanitizedBody as Record<string, unknown>).secretKey;
      }

      console.error(`[400 Error] ${request.method} ${request.url}:`, {
        message: error.message,
        body: sanitizedBody,
        params: request.params,
        query: request.query,
      });
    } else {
      console.error({
        err: error,
        requestId: request.id,
        url: request.url,
        method: request.method,
      });
    }

    // Send structured response
    return reply.status(statusCode).send({
      success: false,
      error: {
        message: errorMessage,
        code: String(errorCode),
        details: errorDetails,
        requestId: request.id,
      },
    });
  });

  fastify.get("/health", { schema: {} }, async () => {
    return { status: "ok" };
  });

  // Backward compatibility route for older mobile app clients (v0.1.3 and below).
  // These clients still look at onrender.com/downloads/version.json due to hardcoded logic.
  fastify.get("/downloads/version.json", { schema: {} }, async () => {
    return {
      latestVersion: "0.3.1",
      latestBuildNumber: 19,
      isMandatory: true,
      downloadUrl:
        "https://justhob.vercel.app/downloads/justhub-tenant.apk",
      releaseNotes:
        "• Fixed Property Manager login workspace auto-assignment\n• Production release API routing enabled\n• Security & authentication reliability improvements",
    };
  });

  // Security: Stricter rate limit for auth endpoints (brute force prevention)
  fastify.register(
    async (scope) => {
      scope.register(rateLimit, {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: (request) => request.ip,
      });
      scope.register(authRoutes);
    },
    { prefix: "/api/auth" },
  );
  fastify.register(workspaceRoutes, { prefix: "/api/workspaces" });
  fastify.register(propertiesRoutes, {
    prefix: "/api/workspaces/:workspaceId/properties",
  });
  fastify.register(timelineRoutes, {
    prefix: "/api/workspaces/:workspaceId/timeline",
  });
  fastify.register(tenantRoutes, {
    prefix: "/api/workspaces/:workspaceId/tenants",
  });
  fastify.register(paymentRoutes, {
    prefix: "/api/workspaces/:workspaceId/payments",
  });
  fastify.register(maintenanceRoutes, {
    prefix: "/api/workspaces/:workspaceId/maintenance",
  });
  fastify.register(ownerRoutes, {
    prefix: "/api/workspaces/:workspaceId/owners",
  });
  fastify.register(tenantProfileRoutes, { prefix: "/api/tenant" });
  fastify.register(notificationRoutes, { prefix: "/api/notifications" });
  fastify.register(publicRoutes, { prefix: "/api/public" });
  fastify.register(webhookRoutes, { prefix: "/api/public/webhooks" });

  // Security: Extremely strict rate limit for public logs to prevent DB exhaustion
  fastify.register(
    async (scope) => {
      scope.register(rateLimit, {
        max: 5,
        timeWindow: "1 minute",
        keyGenerator: (request) => request.ip,
      });
      scope.register(publicLogRoutes);
    },
    { prefix: "/api/public" },
  );

  // Security: Bank account resolution rate limit (anti-enumeration: 15 req/min)
  fastify.register(
    async (scope) => {
      scope.register(rateLimit, {
        max: 15,
        timeWindow: "1 minute",
        keyGenerator: (request) => request.ip,
      });
      scope.register(bankVerificationRoutes);
    },
    { prefix: "/api/workspaces/:workspaceId/bank" },
  );

  fastify.register(leaseRoutes, {
    prefix: "/api/workspaces/:workspaceId/leases",
  });
  fastify.register(leaseRenewalRoutes, {
    prefix: "/api/workspaces/:workspaceId",
  });

  // Security: Document and PDF/CSV exports rate limit (DoS prevention: 10 req/min)
  fastify.register(
    async (scope) => {
      scope.register(rateLimit, {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: (request) => request.ip,
      });
      scope.register(exportRoutes);
    },
    { prefix: "/api/workspaces/:workspaceId/export" },
  );

  fastify.register(adminRoutes, { prefix: "/api/admin" });

  // Security: Stricter rate limit for super-admin routes (data exfiltration prevention)
  fastify.register(
    async (scope) => {
      scope.register(rateLimit, {
        max: 20,
        timeWindow: "1 minute",
        keyGenerator: (request) => request.ip,
      });
      scope.register(superAdminRoutes);
    },
    { prefix: "/api/super-admin" },
  );

  // Security: Uploads presigned URL generation rate limit (storage abuse prevention: 20 req/min)
  fastify.register(
    async (scope) => {
      scope.register(rateLimit, {
        max: 20,
        timeWindow: "1 minute",
        keyGenerator: (request) => request.ip,
      });
      scope.register(uploadRoutes);
    },
    { prefix: "/api/uploads" },
  );

  return fastify;
}

export const app = buildApp();
