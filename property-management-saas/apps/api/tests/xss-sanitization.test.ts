import { describe, it, expect } from "vitest";
import { escapeHtml, renderEmailLayout } from "../src/lib/email-template";
import { sanitizeUrl } from "../../web/src/lib/sanitize-url";

describe("Security: XSS Prevention & HTML Escaping", () => {
  describe("escapeHtml", () => {
    it("escapes special HTML characters properly", () => {
      const input = '<script>alert("xss")</script> & \'test\'';
      const output = escapeHtml(input);
      expect(output).toBe(
        "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#039;test&#039;"
      );
    });

    it("returns empty string for null, undefined, or empty values", () => {
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
      expect(escapeHtml("")).toBe("");
    });

    it("leaves safe text unchanged", () => {
      const text = "Hello world 123 - payment verification complete";
      expect(escapeHtml(text)).toBe(text);
    });
  });

  describe("renderEmailLayout", () => {
    it("escapes title, badge, and recipient in email layout", () => {
      const html = renderEmailLayout({
        title: '<script>alert("xss")</script>',
        badge: '<b>ALERT</b>',
        recipientEmail: 'victim<img src=x onerror=alert(1)>@test.com',
        bodyHtml: "<p>Safe content</p>",
      });

      expect(html).not.toContain('<title><script>');
      expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
      expect(html).toContain("&lt;b&gt;ALERT&lt;/b&gt;");
      expect(html).toContain("victim&lt;img src=x onerror=alert(1)&gt;@test.com");
    });
  });

  describe("sanitizeUrl", () => {
    it("blocks javascript: schemes (including with whitespace or uppercase)", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBe("");
      expect(sanitizeUrl("JAVASCRIPT:alert(1)")).toBe("");
      expect(sanitizeUrl("  javascript:alert(1)  ")).toBe("");
      expect(sanitizeUrl("java\u0000script:alert(1)")).toBe("");
    });

    it("blocks vbscript: schemes", () => {
      expect(sanitizeUrl("vbscript:msgbox(1)")).toBe("");
    });

    it("blocks dangerous data URIs like data:text/html or data:image/svg+xml", () => {
      expect(
        sanitizeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")
      ).toBe("");
      expect(
        sanitizeUrl("data:image/svg+xml;utf8,<svg onload=alert(1)>")
      ).toBe("");
    });

    it("allows valid http and https URLs", () => {
      expect(sanitizeUrl("https://example.com/receipt.pdf")).toBe(
        "https://example.com/receipt.pdf"
      );
      expect(sanitizeUrl("http://example.com/image.png")).toBe(
        "http://example.com/image.png"
      );
    });

    it("allows safe relative paths", () => {
      expect(sanitizeUrl("/dashboard")).toBe("/dashboard");
      expect(sanitizeUrl("/images/logo.png")).toBe("/images/logo.png");
    });

    it("blocks protocol-relative URLs", () => {
      expect(sanitizeUrl("//evil.com/phish")).toBe("");
    });

    it("allows safe raster image data URIs", () => {
      const pngData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      expect(sanitizeUrl(pngData)).toBe(pngData);

      const jpegData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/";
      expect(sanitizeUrl(jpegData)).toBe(jpegData);
    });

    it("allows safe blob: URLs", () => {
      const blobUrl = "blob:https://app.propertystack.com/1234-5678";
      expect(sanitizeUrl(blobUrl)).toBe(blobUrl);
    });

    it("allows safe PDF data URIs", () => {
      const pdfData = "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOf";
      expect(sanitizeUrl(pdfData)).toBe(pdfData);
    });

    it("returns empty string for null, undefined, or empty values", () => {
      expect(sanitizeUrl(null)).toBe("");
      expect(sanitizeUrl(undefined)).toBe("");
      expect(sanitizeUrl("")).toBe("");
      expect(sanitizeUrl("   ")).toBe("");
    });
  });
});
