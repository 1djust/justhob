import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/app";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, generateCsrfToken } from "../src/lib/session";

describe("Security: CSRF Protection & SameSite Session Cookies", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("CSRF Token Issuance & Cookie Attributes", () => {
    it("issues a CSRF token and sets SameSite=Strict cookie on GET /api/csrf-token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/csrf-token",
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.csrfToken).toBeDefined();
      expect(typeof json.csrfToken).toBe("string");
      expect(json.csrfToken.length).toBe(64); // 32 bytes hex = 64 chars

      const setCookieHeader = response.headers["set-cookie"];
      expect(setCookieHeader).toBeDefined();

      const cookieStr = Array.isArray(setCookieHeader)
        ? setCookieHeader.join("; ")
        : (setCookieHeader as string);

      expect(cookieStr).toContain(`${CSRF_COOKIE_NAME}=`);
      expect(cookieStr.toLowerCase()).toContain("samesite=strict");
      expect(cookieStr.toLowerCase()).toContain("path=/");
    });

    it("opportunistically sets csrf_token cookie on safe GET requests if missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const setCookieHeader = response.headers["set-cookie"];
      expect(setCookieHeader).toBeDefined();
      const cookieStr = Array.isArray(setCookieHeader)
        ? setCookieHeader.join("; ")
        : (setCookieHeader as string);

      expect(cookieStr).toContain(`${CSRF_COOKIE_NAME}=`);
      expect(cookieStr.toLowerCase()).toContain("samesite=strict");
    });
  });

  describe("State-Changing Route Protection (POST, PUT, PATCH, DELETE)", () => {
    const testToken = generateCsrfToken();

    it("blocks state-changing POST when session/csrf cookie is present but anti-CSRF token header is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/workspaces/test-ws/properties",
        headers: {
          cookie: `${CSRF_COOKIE_NAME}=${testToken}; ${SESSION_COOKIE_NAME}=mock-session-token`,
        },
        payload: { name: "Attacker Property" },
      });

      expect(response.statusCode).toBe(403);
      const json = JSON.parse(response.body);
      expect(json.error.code).toBe("CSRF_TOKEN_MISSING");
    });

    it("blocks state-changing POST when anti-CSRF token header does not match cookie", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/workspaces/test-ws/properties",
        headers: {
          cookie: `${CSRF_COOKIE_NAME}=${testToken}; ${SESSION_COOKIE_NAME}=mock-session-token`,
          "x-csrf-token": "wrong-token-value-0000000000000000000000000000000000000000000000000000",
        },
        payload: { name: "Attacker Property" },
      });

      expect(response.statusCode).toBe(403);
      const json = JSON.parse(response.body);
      expect(json.error.code).toBe("CSRF_TOKEN_MISMATCH");
    });

    it("blocks state-changing POST from an unauthorized Origin", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          origin: "https://evil-hacker-site.com",
        },
        payload: { email: "test@example.com", password: "password123" },
      });

      expect(response.statusCode).toBe(403);
      const json = JSON.parse(response.body);
      expect(json.error.code).toBe("CSRF_ORIGIN_INVALID");
    });

    it("blocks state-changing POST with an unauthorized Referer origin", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: {
          referer: "https://malicious-phishing.org/steal-session",
        },
        payload: { email: "test@example.com", password: "password123" },
      });

      expect(response.statusCode).toBe(403);
      const json = JSON.parse(response.body);
      expect(json.error.code).toBe("CSRF_REFERER_INVALID");
    });

    it("allows state-changing POST when valid matching CSRF token and cookie are provided", async () => {
      const validToken = generateCsrfToken();

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/check-name",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${CSRF_COOKIE_NAME}=${validToken}`,
          "x-csrf-token": validToken,
        },
        payload: { name: "Unique Brand New Name" },
      });

      // Should not be blocked by CSRF (will proceed to route handler)
      expect(response.statusCode).not.toBe(403);
      expect(response.statusCode).toBe(200);
    });

    it("exempts webhook endpoints from CSRF token checks", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/public/webhooks/remita",
        payload: { event: "ping" },
      });

      // Webhook should reject with 401 (missing signature) but NEVER 403 CSRF blocked
      expect(response.statusCode).toBe(401);
      const json = JSON.parse(response.body);
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("Logout Cookie Clearing", () => {
    it("clears session and CSRF cookies on POST /api/auth/logout with SameSite=Strict", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
      });

      expect(response.statusCode).toBe(200);
      const setCookieHeader = response.headers["set-cookie"];
      expect(setCookieHeader).toBeDefined();

      const cookieStr = Array.isArray(setCookieHeader)
        ? setCookieHeader.join("; ")
        : (setCookieHeader as string);

      expect(cookieStr).toContain(`${SESSION_COOKIE_NAME}=;`);
      expect(cookieStr).toContain(`${CSRF_COOKIE_NAME}=;`);
      expect(cookieStr.toLowerCase()).toContain("samesite=strict");
    });
  });
});
