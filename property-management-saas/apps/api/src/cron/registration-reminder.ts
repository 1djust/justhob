import cron from "node-cron";
import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase";
import { prisma } from "../lib/database";
import { sendEmail } from "../lib/mailer";

export interface ReminderExecutionResult {
  totalUnconfirmedEvaluated: number;
  stage1Sent: number;
  stage2Sent: number;
  skippedCount: number;
  errors: string[];
}

export interface ReminderProcessOptions {
  dryRun?: boolean;
  maxAgeDays?: number;
  minStage1Hours?: number;
  minStage2Hours?: number;
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
}

/**
 * Builds the HTML and plain-text email templates for registration follow-up.
 */
export function buildRegistrationReminderEmail(params: {
  email: string;
  name?: string;
  stage: 1 | 2;
  frontendUrl: string;
}): { subject: string; text: string; html: string } {
  const { email, name, stage, frontendUrl } = params;
  const displayName = name && name.trim().length > 0 ? name.trim() : "there";
  const actionUrl = `${frontendUrl.replace(/\/$/, "")}/link?action=register&step=otp&email=${encodeURIComponent(email)}`;
  const currentYear = new Date().getFullYear();

  const logoUrl = "https://raw.githubusercontent.com/1djust/justhob/main/property-management-saas/apps/web/public/images/assets/logo.png";

  if (stage === 1) {
    const subject = "👋 Complete Your Registration — PropertyStack";
    const text = `Hi ${displayName},\n\nWe noticed you recently started creating your PropertyStack account, but haven't finished verifying your email yet.\n\nYou're just one quick step away from unlocking your property management workspace:\n- Centralized property and lease management\n- Automated rent invoicing and instant receipts\n- Streamlined tenant maintenance requests\n\nComplete your registration now by visiting:\n${actionUrl}\n\nIf you have any questions or need help, simply reply to this email.\n\nBest regards,\nThe PropertyStack Team`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #eef2f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);">
          <!-- Header Banner with Logo -->
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
                    <p style="margin: 2px 0 0 0; color: #93C5FD; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">Next-Gen Property Management</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #0A192F; font-size: 20px; font-weight: 600;">Complete Your Account Setup</h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hi <strong>${displayName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                We noticed you recently started registering for <strong>PropertyStack</strong>, but haven't verified your email yet. You are only one step away from simplifying your property operations!
              </p>
              
              <!-- Value Highlights Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 28px 0;">
                <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #0A192F;">What awaits you inside:</p>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #334155; vertical-align: top; width: 24px;">✨</td>
                    <td style="padding: 6px 0 6px 8px; font-size: 14px; color: #334155;"><strong>Effortless Management:</strong> Organize units, tenants, and leases with ease.</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #334155; vertical-align: top; width: 24px;">💳</td>
                    <td style="padding: 6px 0 6px 8px; font-size: 14px; color: #334155;"><strong>Automated Rent:</strong> Automated invoicing, reminders, and payment tracking.</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #334155; vertical-align: top; width: 24px;">🔧</td>
                    <td style="padding: 6px 0 6px 8px; font-size: 14px; color: #334155;"><strong>Maintenance Hub:</strong> Real-time requests, chat, and resolution tracking.</td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 0 0 16px 0;">
                <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 36px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0, 102, 255, 0.3);">
                  Complete Your Registration →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                If you did not initiate this registration, you can safely ignore this message.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${currentYear} PropertyStack. All rights reserved.
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

    return { subject, text, html };
  }

  // Stage 2: Final Reminder (72 hours)
  const subject = "⏳ Final Reminder: Complete Your Registration on PropertyStack";
  const text = `Hi ${displayName},\n\nThis is a friendly final reminder that your PropertyStack account is waiting for you.\n\nVerifying your account takes less than 60 seconds and gives you immediate access to your property management dashboard.\n\nVerify and activate your account now:\n${actionUrl}\n\nNeed assistance? Feel free to reach out to our support team.\n\nBest regards,\nThe PropertyStack Team`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #eef2f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);">
          <!-- Header Banner with Logo -->
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
                    <p style="margin: 2px 0 0 0; color: #60A5FA; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">Final Reminder</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #0A192F; font-size: 20px; font-weight: 600;">Your Account is Ready to Activate</h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hi <strong>${displayName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                This is a final reminder that your PropertyStack registration is incomplete. Your workspace is set up and waiting for you to finish verification.
              </p>
              
              <!-- Callout Box -->
              <div style="background-color: #EFF6FF; border-left: 4px solid #0066FF; border-radius: 4px; padding: 16px 20px; margin: 0 0 28px 0;">
                <p style="margin: 0; font-size: 14px; color: #1E40AF; font-weight: 600;">
                  ⏱️ Takes less than 60 seconds
                </p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #1E3A8A; line-height: 1.5;">
                  Click the button below to complete verification and access your live property management workspace.
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 0 0 16px 0;">
                <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 36px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0, 102, 255, 0.3);">
                  Verify & Activate Account →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                This is the final automated reminder for this registration attempt.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${currentYear} PropertyStack. All rights reserved.
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

  return { subject, text, html };
}

/**
 * Main logic to query unconfirmed Supabase users and dispatch staged follow-up emails.
 */
export async function processRegistrationReminders(
  options: ReminderProcessOptions = {},
): Promise<ReminderExecutionResult> {
  const {
    dryRun = false,
    maxAgeDays = 14,
    minStage1Hours = 24,
    minStage2Hours = 72,
    logger = console,
  } = options;

  const frontendUrl =
    process.env.FRONTEND_URL || "https://justhob.vercel.app";

  const result: ReminderExecutionResult = {
    totalUnconfirmedEvaluated: 0,
    stage1Sent: 0,
    stage2Sent: 0,
    skippedCount: 0,
    errors: [],
  };

  const now = new Date();
  const maxAgeCutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

  logger.info(
    `[REGISTRATION_REMINDER] Starting scan (dryRun=${dryRun}, maxAgeDays=${maxAgeDays})...`,
  );

  let page = 1;
  const perPage = 100;
  let allUsers: Array<{
    id: string;
    email?: string;
    created_at: string;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  }> = [];

  try {
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw new Error(`Failed to list Supabase users: ${error.message}`);
      }

      if (!data?.users || data.users.length === 0) {
        break;
      }

      allUsers = allUsers.concat(data.users);
      if (data.users.length < perPage) {
        break;
      }
      page++;
    }
  } catch (err) {
    const errorMsg = `Supabase listUsers query failed: ${(err as Error).message}`;
    logger.error(`[REGISTRATION_REMINDER] ${errorMsg}`);
    result.errors.push(errorMsg);
    return result;
  }

  // Filter for unconfirmed users created within the allowable maxAgeDays window
  const unconfirmedUsers = allUsers.filter((u) => {
    if (!u.email) return false;
    if (u.email_confirmed_at) return false; // Already verified

    const createdAt = new Date(u.created_at);
    if (isNaN(createdAt.getTime())) return false;
    if (createdAt < maxAgeCutoff) return false; // Too old, ignore

    return true;
  });

  result.totalUnconfirmedEvaluated = unconfirmedUsers.length;
  logger.info(
    `[REGISTRATION_REMINDER] Found ${unconfirmedUsers.length} unconfirmed users within ${maxAgeDays}-day window.`,
  );

  for (const user of unconfirmedUsers) {
    const userEmail = user.email!.toLowerCase().trim();
    const createdAt = new Date(user.created_at);
    const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    const metadata = user.user_metadata || {};
    const reminderCount = typeof metadata.registration_reminder_count === "number"
      ? metadata.registration_reminder_count
      : 0;
    const lastReminderAtStr = typeof metadata.last_registration_reminder_at === "string"
      ? metadata.last_registration_reminder_at
      : null;
    const lastReminderAt = lastReminderAtStr ? new Date(lastReminderAtStr) : null;
    const hoursSinceLastReminder = lastReminderAt
      ? (now.getTime() - lastReminderAt.getTime()) / (1000 * 60 * 60)
      : Infinity;

    const userName = typeof metadata.name === "string" ? metadata.name : undefined;

    let targetStage: (1 | 2) | null = null;

    // Stage 1: Account age >= 24 hours, 0 reminders sent so far
    if (reminderCount === 0 && ageHours >= minStage1Hours) {
      targetStage = 1;
    }
    // Stage 2: Account age >= 72 hours, 1 reminder sent so far, at least 24h since previous reminder
    else if (
      reminderCount === 1 &&
      ageHours >= minStage2Hours &&
      hoursSinceLastReminder >= 24
    ) {
      targetStage = 2;
    }

    if (!targetStage) {
      result.skippedCount++;
      continue;
    }

    const emailContent = buildRegistrationReminderEmail({
      email: userEmail,
      name: userName,
      stage: targetStage,
      frontendUrl,
    });

    if (dryRun) {
      logger.info(
        `[DRY_RUN] Would send Stage ${targetStage} reminder to ${userEmail} (age: ${ageHours.toFixed(1)}h, count: ${reminderCount})`,
      );
      if (targetStage === 1) result.stage1Sent++;
      else result.stage2Sent++;
      continue;
    }

    try {
      // 1. Dispatch Email
      await sendEmail(
        userEmail,
        emailContent.subject,
        emailContent.text,
        emailContent.html,
      );

      // 2. Update Supabase user_metadata to track delivery state
      const updatedMetadata = {
        ...metadata,
        registration_reminder_count: reminderCount + 1,
        last_registration_reminder_at: now.toISOString(),
      };

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { user_metadata: updatedMetadata },
      );

      if (updateError) {
        logger.warn(
          `[REGISTRATION_REMINDER] Email sent to ${userEmail} but metadata update failed: ${updateError.message}`,
        );
      }

      if (targetStage === 1) {
        result.stage1Sent++;
      } else {
        result.stage2Sent++;
      }

      logger.info(
        `[REGISTRATION_REMINDER] Successfully sent Stage ${targetStage} reminder to ${userEmail}`,
      );
    } catch (err) {
      const msg = `Failed to process reminder for ${userEmail}: ${(err as Error).message}`;
      logger.error(`[REGISTRATION_REMINDER] ${msg}`);
      result.errors.push(msg);
    }
  }

  logger.info(
    `[REGISTRATION_REMINDER] Completed run. Summary: Stage1=${result.stage1Sent}, Stage2=${result.stage2Sent}, Skipped=${result.skippedCount}, Errors=${result.errors.length}`,
  );

  return result;
}

/**
 * Builds the HTML and plain-text email templates for onboarding follow-up (0 properties).
 */
export function buildOnboardingReminderEmail(params: {
  email: string;
  name?: string;
  frontendUrl: string;
}): { subject: string; text: string; html: string } {
  const { name, frontendUrl } = params;
  const displayName = name && name.trim().length > 0 ? name.trim() : "there";
  const actionUrl = `${frontendUrl.replace(/\/$/, "")}/link?action=dashboard`;
  const logoUrl = "https://raw.githubusercontent.com/1djust/justhob/main/property-management-saas/apps/web/public/images/assets/logo.png";
  const currentYear = new Date().getFullYear();

  const subject = "🏢 Complete Your Setup: Add Your First Property on PropertyStack";
  const text = `Hi ${displayName},\n\nWelcome to PropertyStack! Your manager account is verified and ready for action.\n\nTo begin automating rent collection, generating lease agreements, and tracking maintenance requests, the next step is adding your first property.\n\nGet started now by adding your property:\n${actionUrl}\n\nNeed assistance? Reply to this email anytime and our team will be glad to assist.\n\nBest regards,\nThe PropertyStack Team`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef2f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #eef2f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);">
          <!-- Header Banner with Logo -->
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
                    <p style="margin: 2px 0 0 0; color: #93C5FD; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">Manager Onboarding</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #0A192F; font-size: 20px; font-weight: 600;">Welcome! Let's Add Your First Property</h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hi <strong>${displayName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Your PropertyStack account is activated and ready. To start managing units, automating rent collection, and tracking tenant leases, simply add your first property.
              </p>
              
              <!-- 3-Step Guide Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 28px 0;">
                <p style="margin: 0 0 14px 0; font-size: 14px; font-weight: 600; color: #0A192F;">3 Easy Steps to Get Started:</p>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #0066FF; font-weight: 700; vertical-align: top; width: 24px;">1.</td>
                    <td style="padding: 6px 0 6px 8px; font-size: 14px; color: #334155;"><strong>Add Property:</strong> Enter building name, address, and rental units.</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #0066FF; font-weight: 700; vertical-align: top; width: 24px;">2.</td>
                    <td style="padding: 6px 0 6px 8px; font-size: 14px; color: #334155;"><strong>Invite Tenants:</strong> Send digital leases or welcome invites.</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #0066FF; font-weight: 700; vertical-align: top; width: 24px;">3.</td>
                    <td style="padding: 6px 0 6px 8px; font-size: 14px; color: #334155;"><strong>Collect Rent:</strong> Sit back as payments, receipts, and logs run automatically.</td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 0 0 16px 0;">
                <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 36px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0, 102, 255, 0.3);">
                  Add Your First Property →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                You received this email because you signed up as a Property Manager on PropertyStack.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${currentYear} PropertyStack. All rights reserved.
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

  return { subject, text, html };
}

export interface OnboardingReminderResult {
  totalEvaluated: number;
  sentCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Scans confirmed Property Managers who have 0 properties and dispatches an onboarding guide email.
 */
export async function processOnboardingReminders(
  options: ReminderProcessOptions = {},
): Promise<OnboardingReminderResult> {
  const {
    dryRun = false,
    maxAgeDays = 14,
    minStage1Hours = 24,
    logger = console,
  } = options;

  const frontendUrl =
    process.env.PUBLIC_FRONTEND_URL ||
    (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes("localhost")
      ? process.env.FRONTEND_URL
      : "https://justhob.vercel.app");

  const result: OnboardingReminderResult = {
    totalEvaluated: 0,
    sentCount: 0,
    skippedCount: 0,
    errors: [],
  };

  const now = new Date();
  const maxAgeCutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
  const minAgeCutoff = new Date(now.getTime() - minStage1Hours * 60 * 60 * 1000);

  logger.info(
    `[ONBOARDING_REMINDER] Starting manager onboarding scan (dryRun=${dryRun})...`,
  );

  try {
    // Find confirmed PROPERTY_MANAGER accounts created between minStage1Hours and maxAgeDays ago
    const managers = await prisma.user.findMany({
      where: {
        role: "PROPERTY_MANAGER",
        isActive: true,
        createdAt: {
          gte: maxAgeCutoff,
          lte: minAgeCutoff,
        },
      },
      include: {
        workspaces: {
          include: {
            workspace: {
              include: {
                properties: true,
              },
            },
          },
        },
      },
    });

    // Filter managers who have 0 properties across all workspaces
    const incompleteManagers = managers.filter((m) => {
      const totalProperties = m.workspaces.reduce(
        (acc, w) => acc + (w.workspace?.properties?.length || 0),
        0,
      );
      return totalProperties === 0;
    });

    result.totalEvaluated = incompleteManagers.length;
    logger.info(
      `[ONBOARDING_REMINDER] Found ${incompleteManagers.length} managers with 0 properties created.`,
    );

    for (const manager of incompleteManagers) {
      // Check Supabase Auth metadata to verify if reminder was already sent
      const { data: supaUserData, error: supaUserError } =
        await supabaseAdmin.auth.admin.getUserById(manager.id);

      if (supaUserError || !supaUserData?.user) {
        result.skippedCount++;
        continue;
      }

      const meta = supaUserData.user.user_metadata || {};
      if (meta.onboarding_reminder_sent_at) {
        result.skippedCount++;
        continue; // Already sent
      }

      const emailContent = buildOnboardingReminderEmail({
        email: manager.email,
        name: manager.name || undefined,
        frontendUrl,
      });

      if (dryRun) {
        logger.info(
          `[DRY_RUN] Would send Onboarding Setup reminder to ${manager.email} (${manager.name})`,
        );
        result.sentCount++;
        continue;
      }

      try {
        await sendEmail(
          manager.email,
          emailContent.subject,
          emailContent.text,
          emailContent.html,
        );

        // Record delivery timestamp in Supabase Auth user_metadata
        await supabaseAdmin.auth.admin.updateUserById(manager.id, {
          user_metadata: {
            ...meta,
            onboarding_reminder_sent_at: now.toISOString(),
          },
        });

        result.sentCount++;
        logger.info(
          `[ONBOARDING_REMINDER] Successfully sent onboarding reminder to ${manager.email}`,
        );
      } catch (err) {
        const msg = `Failed to send onboarding reminder to ${manager.email}: ${(err as Error).message}`;
        logger.error(`[ONBOARDING_REMINDER] ${msg}`);
        result.errors.push(msg);
      }
    }
  } catch (err) {
    const errorMsg = `Onboarding query error: ${(err as Error).message}`;
    logger.error(`[ONBOARDING_REMINDER] ${errorMsg}`);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Initializes the background cron schedule inside the Fastify server.
 */
export function setupRegistrationReminder(fastify: FastifyInstance): void {
  // Run daily at 03:00 AM (after 02:00 AM retention cleanup)
  cron.schedule("0 3 * * *", async () => {
    fastify.log.info(
      "[CRON/REGISTRATION_REMINDER] Starting scheduled follow-up reminder job...",
    );
    try {
      const logger = {
        info: (msg: string) => fastify.log.info(msg),
        warn: (msg: string) => fastify.log.warn(msg),
        error: (msg: string, ...args: unknown[]) => {
          if (args.length > 0) {
            fastify.log.error({ err: args[0] }, msg);
          } else {
            fastify.log.error(msg);
          }
        },
      };

      // 1. Process unconfirmed registration reminders
      await processRegistrationReminders({ logger });

      // 2. Process onboarding property setup reminders
      await processOnboardingReminders({ logger });
    } catch (err) {
      fastify.log.error(
        { err },
        "[CRON/REGISTRATION_REMINDER] Unhandled error during cron run",
      );
    }
  });
}
