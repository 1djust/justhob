/**
 * Security: Sanitize user-supplied URLs to prevent XSS via javascript: or data: URI injection.
 *
 * Only allows http:, https:, blob:, safe relative paths, and safe raster image / document data: URIs.
 * Returns empty string for any dangerous or malformed URL — safe to use in src, href, window.open.
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";

  const trimmed = url.trim();
  if (trimmed.length === 0) return "";

  // Strip control characters and whitespace to detect obfuscated protocols
  const sanitizedScheme = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s+]/g, "").toLowerCase();
  if (
    sanitizedScheme.startsWith("javascript:") ||
    sanitizedScheme.startsWith("vbscript:") ||
    sanitizedScheme.startsWith("data:text/html") ||
    sanitizedScheme.startsWith("data:image/svg+xml")
  ) {
    return "";
  }

  // Allow safe absolute URLs (http, https)
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Allow safe relative paths (starts with single /, not protocol-relative //)
  if (/^\/(?!\/)/.test(trimmed)) return trimmed;

  // Allow blob: URLs (used for client-side file previews)
  if (/^blob:/i.test(trimmed)) return trimmed;

  // Allow safe image data URIs (PNG, JPEG, GIF, WEBP)
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) return trimmed;

  // Allow PDF data URIs
  if (/^data:application\/pdf;base64,/i.test(trimmed)) return trimmed;

  // Block everything else
  return "";
}

/**
 * Security: Escape HTML characters in strings to prevent raw HTML rendering.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
