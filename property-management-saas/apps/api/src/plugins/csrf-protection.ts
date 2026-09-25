import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import crypto from "crypto";
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  getCsrfCookieOptions,
  generateCsrfToken,
} from "../lib/session";
import { SecurityService } from "../services/security";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Public machine-to-machine webhooks that authenticate via cryptographic signatures/secrets
const EXEMPT_PREFIXES = [
  "/api/public/webhooks",
  "/api/public/logs",
];

function isOriginAllowed(origin: string, isProd: boolean, allowedOrigins: string[]): boolean {
  if (!origin) return false;

  const normalized = origin.toLowerCase().trim();

  // Development: allow localhost, 127.0.0.1, Android emulator aliases
  if (!isProd) {
    if (
      normalized.startsWith("http://localhost:") ||
      normalized === "http://localhost" ||
      normalized.startsWith("http://127.0.0.1:") ||
      normalized === "http://127.0.0.1" ||
      normalized.startsWith("http://10.0.2.2:")
    ) {
      return true;
    }
  }

  // Production / Configured Allowed Origins
  return allowedOrigins.some((allowed) => {
    if (!allowed) return false;
    return normalized === allowed.toLowerCase().trim();
  });
}

export const csrfProtectionPlugin: FastifyPluginAsync = async (fastify) => {
  const isProd = process.env.NODE_ENV === "production";

  const configuredAllowedOrigins = [
    ...(isProd ? [] : ["http://localhost:3000", "http://127.0.0.1:3000"]),
    "https://justhob.vercel.app",
    "https://propertystack.vercel.app",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  // Endpoint for single-page apps / clients to obtain or refresh an anti-CSRF token
  fastify.get("/api/csrf-token", { schema: {} }, async (request, reply) => {
    let token = request.cookies?.[CSRF_COOKIE_NAME];
    if (!token) {
      token = generateCsrfToken();
      reply.setCookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions(isProd));
    }
    return reply.send({ csrfToken: token });
  });

  // Global preHandler hook enforcing CSRF checks on all state-changing routes
  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();

    // 1. Safe HTTP methods (GET, HEAD, OPTIONS) do not alter server state
    if (!STATE_CHANGING_METHODS.has(method)) {
      // Opportunistically issue a CSRF cookie on safe GET requests if missing
      if (method === "GET" && !request.cookies?.[CSRF_COOKIE_NAME]) {
        const token = generateCsrfToken();
        reply.setCookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions(isProd));
      }
      return;
    }

    const rawUrl = request.raw.url || request.url;

    // 2. Exempt machine-to-machine webhook endpoints
    if (EXEMPT_PREFIXES.some((prefix) => rawUrl.startsWith(prefix))) {
      return;
    }

    // 3. Origin & Referer Verification (OWASP First Line of Defense)
    const originHeader = request.headers.origin;
    if (originHeader) {
      if (!isOriginAllowed(originHeader, isProd, configuredAllowedOrigins)) {
        await SecurityService.logEvent(request.ip, "CSRF_ORIGIN_BLOCKED", {
          origin: originHeader,
          url: rawUrl,
          method,
        }).catch(() => {});

        return reply.status(403).send({
          success: false,
          error: {
            message: "Cross-site request blocked: Origin not authorized.",
            code: "CSRF_ORIGIN_INVALID",
          },
        });
      }
    } else if (request.headers.referer) {
      try {
        const refererUrl = new URL(request.headers.referer);
        const refererOrigin = refererUrl.origin;
        if (!isOriginAllowed(refererOrigin, isProd, configuredAllowedOrigins)) {
          await SecurityService.logEvent(request.ip, "CSRF_REFERER_BLOCKED", {
            referer: request.headers.referer,
            url: rawUrl,
            method,
          }).catch(() => {});

          return reply.status(403).send({
            success: false,
            error: {
              message: "Cross-site request blocked: Referer not authorized.",
              code: "CSRF_REFERER_INVALID",
            },
          });
        }
      } catch {
        // Invalid referer URL string
        return reply.status(403).send({
          success: false,
          error: {
            message: "Cross-site request blocked: Malformed Referer header.",
            code: "CSRF_REFERER_MALFORMED",
          },
        });
      }
    }

    // 4. Double-Submit Cookie Anti-CSRF Token Validation
    const hasSessionCookie = Boolean(request.cookies?.[SESSION_COOKIE_NAME]);
    const cookieCsrfToken = request.cookies?.[CSRF_COOKIE_NAME];

    // If request carries a session cookie OR a CSRF cookie, validate the anti-CSRF token
    if (hasSessionCookie || cookieCsrfToken) {
      const headerCsrfToken = (
        request.headers["x-csrf-token"] ||
        request.headers["x-xsrf-token"] ||
        request.headers["csrf-token"]
      ) as string | undefined;

      if (!headerCsrfToken || !cookieCsrfToken) {
        await SecurityService.logEvent(request.ip, "CSRF_TOKEN_MISSING", {
          url: rawUrl,
          method,
          hasSessionCookie,
          hasCookieToken: Boolean(cookieCsrfToken),
          hasHeaderToken: Boolean(headerCsrfToken),
        }).catch(() => {});

        return reply.status(403).send({
          success: false,
          error: {
            message: "CSRF verification failed: Anti-CSRF token missing.",
            code: "CSRF_TOKEN_MISSING",
          },
        });
      }

      const headerBuf = Buffer.from(headerCsrfToken);
      const cookieBuf = Buffer.from(cookieCsrfToken);

      const isMatch =
        headerBuf.length === cookieBuf.length &&
        crypto.timingSafeEqual(headerBuf, cookieBuf);

      if (!isMatch) {
        await SecurityService.logEvent(request.ip, "CSRF_TOKEN_MISMATCH", {
          url: rawUrl,
          method,
        }).catch(() => {});

        return reply.status(403).send({
          success: false,
          error: {
            message: "CSRF verification failed: Anti-CSRF token mismatch.",
            code: "CSRF_TOKEN_MISMATCH",
          },
        });
      }
    }
  });
};

export default fp(csrfProtectionPlugin, {
  name: "csrf-protection",
});
