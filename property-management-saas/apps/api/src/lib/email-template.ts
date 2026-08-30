/**
 * Official PropertyStack Brand Email Layout Engine.
 * Ensures consistent dark navy header (#0A192F), logo, badge, and standardized footer across all application emails.
 */

export interface EmailLayoutOptions {
  title?: string;
  badge?: string; // e.g. "ACCOUNT SETUP", "PAYMENT NOTIFICATION", "MAINTENANCE UPDATE"
  bodyHtml: string;
  recipientEmail?: string;
  footerNote?: string;
}

export function renderEmailLayout(options: EmailLayoutOptions): string {
  const {
    title = "PropertyStack Notification",
    badge = "NOTIFICATION",
    bodyHtml,
    recipientEmail,
    footerNote,
  } = options;

  const currentYear = new Date().getFullYear();
  const logoUrl =
    "https://raw.githubusercontent.com/1djust/justhob/main/property-management-saas/apps/web/public/images/assets/logo.png";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #eef2f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);">
          <!-- Consistent Official Brand Header with Logo & Accent Line -->
          <tr>
            <td style="background-color: #0A192F; padding: 26px 28px; text-align: center; border-bottom: 3px solid #0066FF;">
              <table border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <img
                      src="${logoUrl}"
                      alt="PropertyStack Logo"
                      width="42"
                      height="42"
                      style="display: block; width: 42px; height: 42px; border-radius: 10px; object-fit: contain; background-color: #ffffff; padding: 2px;"
                    />
                  </td>
                  <td style="vertical-align: middle; text-align: left;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2;">PropertyStack</h1>
                    <p style="margin: 2px 0 0 0; color: #60A5FA; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;">${badge}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Consistent Brand Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                ${
                  footerNote ||
                  (recipientEmail
                    ? `You received this email because an account is registered with ${recipientEmail} on PropertyStack.`
                    : "This is an automated notification from PropertyStack.")
                }
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${currentYear} PropertyStack Inc. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
