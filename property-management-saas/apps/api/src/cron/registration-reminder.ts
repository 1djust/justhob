import cron from "node-cron";
import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase";
import { prisma } from "../lib/database";
import { sendEmail } from "../lib/mailer";
import { renderEmailLayout, escapeHtml } from "../lib/email-template";

export interface ReminderDetail {
  email: string;
  stage?: 1 | 2 | "onboarding";
  action: "sent" | "skipped" | "error";
  reason?: string;
}

export interface ReminderExecutionResult {
  totalUnconfirmedEvaluated: number;
  stage1Sent: number;
  stage2Sent: number;
  skippedCount: number;
  errors: string[];
  details: ReminderDetail[];
}

export interface ReminderProcessOptions {
  dryRun?: boolean;
  force?: boolean;
  maxAgeDays?: number;
  minStage1Hours?: number;
  minStage2Hours?: number;
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
}

const TEST_DOMAINS = [
  "@example.com",
  "@test.com",
  "@security.com",
  "@limits.com",
  "@audittest.com",
  "@test-gatekeeper.com",
  "@justhob.com",
  "@ehwit.com",
  "@legaltest.com",
  "@logstest.com",
  ".test",
  ".invalid",
  ".localhost",
];

export function isTestEmail(email?: string | null): boolean {
  if (!email) return true;
  const lower = email.toLowerCase().trim();
  if (TEST_DOMAINS.some((domain) => lower.endsWith(domain))) return true;
  if (
    lower.startsWith("test_") ||
    lower.startsWith("e2e-") ||
    lower.startsWith("super-admin-shield-") ||
    lower.startsWith("realtime-test-") ||
    lower.startsWith("unit_mgr_") ||
    lower.startsWith("ent_mgr_") ||
    lower.startsWith("pro_mgr_") ||
    lower.startsWith("free_mgr_")
  ) {
    return true;
  }
  return false;
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

  if (stage === 1) {
    const subject = "PropertyStack: Please confirm your email address";
    const text = `Hi ${displayName},\n\nThank you for signing up for PropertyStack.\n\nPlease confirm your email address to complete your registration and activate your workspace:\n\n${actionUrl}\n\nIf you did not create this account, you can safely ignore this email.\n\nBest regards,\nThe PropertyStack Team`;

    const bodyHtml = `
      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">Confirm your email address</h2>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
        Hi ${escapeHtml(displayName)},
      </p>
      <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
        Thank you for creating an account on PropertyStack. To complete your setup and access your dashboard, please confirm your email address.
      </p>
      <div style="margin: 0 0 28px 0;">
        <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px;">
          Confirm Email Address
        </a>
      </div>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        Or use this link directly in your browser:<br/>
        <a href="${actionUrl}" style="color: #0066FF; word-break: break-all;">${actionUrl}</a>
      </p>
    `;

    const html = renderEmailLayout({
      title: subject,
      badge: "ACCOUNT VERIFICATION",
      bodyHtml,
      recipientEmail: email,
    });

    return { subject, text, html };
  }

  // Stage 2: Follow-up Reminder (72 hours)
  const subject = "Reminder: Complete your PropertyStack account setup";
  const text = `Hi ${displayName},\n\nA quick reminder to complete your PropertyStack registration.\n\nConfirming your email gives you immediate access to your property management workspace:\n\n${actionUrl}\n\nNeed assistance? Reply to this email anytime and our team will be glad to help.\n\nBest regards,\nThe PropertyStack Team`;

  const bodyHtml = `
    <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">Complete your account setup</h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Hi ${escapeHtml(displayName)},
    </p>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
      Your PropertyStack workspace is waiting for you. Take a minute to finish verifying your email so you can start managing properties and leases.
    </p>
    <div style="margin: 0 0 28px 0;">
      <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px;">
        Complete Setup
      </a>
    </div>
    <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
      Or use this link directly in your browser:<br/>
      <a href="${actionUrl}" style="color: #0066FF; word-break: break-all;">${actionUrl}</a>
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    badge: "ACCOUNT SETUP",
    bodyHtml,
    recipientEmail: email,
  });

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
    force = false,
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
    details: [],
  };

  const now = new Date();
  const maxAgeCutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

  logger.info(
    `[REGISTRATION_REMINDER] Starting scan (dryRun=${dryRun}, force=${force}, maxAgeDays=${maxAgeDays})...`,
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
    if (isTestEmail(userEmail)) {
      result.skippedCount++;
      result.details.push({
        email: userEmail,
        action: "skipped",
        reason: "Test or internal development email ignored",
      });
      continue;
    }
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

    if (force) {
      targetStage = reminderCount >= 1 ? 2 : 1;
    } else {
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
    }

    if (!targetStage) {
      result.skippedCount++;
      result.details.push({
        email: userEmail,
        action: "skipped",
        reason: `Not eligible (age: ${ageHours.toFixed(1)}h, count: ${reminderCount}, hoursSinceLast: ${hoursSinceLastReminder.toFixed(1)}h)`,
      });
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
      result.details.push({
        email: userEmail,
        stage: targetStage,
        action: "sent",
        reason: "Simulated send (dryRun)",
      });
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

      result.details.push({
        email: userEmail,
        stage: targetStage,
        action: "sent",
        reason: "Email dispatched successfully",
      });

      logger.info(
        `[REGISTRATION_REMINDER] Successfully sent Stage ${targetStage} reminder to ${userEmail}`,
      );
    } catch (err) {
      const msg = `Failed to process reminder for ${userEmail}: ${(err as Error).message}`;
      logger.error(`[REGISTRATION_REMINDER] ${msg}`);
      result.errors.push(msg);
      result.details.push({
        email: userEmail,
        stage: targetStage,
        action: "error",
        reason: msg,
      });
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
  const { name, frontendUrl, email } = params;
  const displayName = name && name.trim().length > 0 ? name.trim() : "there";
  const actionUrl = `${frontendUrl.replace(/\/$/, "")}/link?action=dashboard`;

  const subject = "Welcome to PropertyStack: Next steps for your account";
  const text = `Hi ${displayName},\n\nWelcome to PropertyStack! Your manager account is verified and ready.\n\nTo begin managing your rental portfolio, the next step is adding your first property.\n\nOpen your dashboard to get started:\n${actionUrl}\n\nNeed assistance? Reply to this email anytime and our team will be glad to help.\n\nBest regards,\nThe PropertyStack Team`;

  const bodyHtml = `
    <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">Welcome to your new workspace</h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Hi ${escapeHtml(displayName)},
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
      Your manager account is verified and ready. To get started with managing leases, tracking tenants, and organizing units, add your first property to the workspace.
    </p>
    <div style="margin: 0 0 28px 0;">
      <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px;">
        Add Your First Property
      </a>
    </div>
    <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
      Or visit your dashboard directly in your browser:<br/>
      <a href="${actionUrl}" style="color: #0066FF; word-break: break-all;">${actionUrl}</a>
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    badge: "MANAGER ONBOARDING",
    bodyHtml,
    recipientEmail: email,
  });

  return { subject, text, html };
}

export interface OnboardingReminderResult {
  totalEvaluated: number;
  sentCount: number;
  skippedCount: number;
  errors: string[];
  details: ReminderDetail[];
}

/**
 * Scans confirmed Property Managers who have 0 properties and dispatches an onboarding guide email.
 */
export async function processOnboardingReminders(
  options: ReminderProcessOptions = {},
): Promise<OnboardingReminderResult> {
  const {
    dryRun = false,
    force = false,
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
    details: [],
  };

  const now = new Date();
  const maxAgeCutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
  const minAgeCutoff = new Date(now.getTime() - minStage1Hours * 60 * 60 * 1000);

  logger.info(
    `[ONBOARDING_REMINDER] Starting manager onboarding scan (dryRun=${dryRun}, force=${force})...`,
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
      if (isTestEmail(manager.email)) {
        logger.info(
          `[ONBOARDING_REMINDER] Skipped test email: ${manager.email}`,
        );
        result.skippedCount++;
        result.details.push({
          email: manager.email,
          stage: "onboarding",
          action: "skipped",
          reason: "Test or internal development email ignored",
        });
        continue;
      }

      // Check Supabase Auth metadata to verify if reminder was already sent
      const { data: supaUserData, error: supaUserError } =
        await supabaseAdmin.auth.admin.getUserById(manager.id);

      if (supaUserError || !supaUserData?.user) {
        const reason = `Supabase user not found or error (${supaUserError?.message || "No user"})`;
        logger.info(
          `[ONBOARDING_REMINDER] Skipped ${manager.email}: ${reason}`,
        );
        result.skippedCount++;
        result.details.push({
          email: manager.email,
          stage: "onboarding",
          action: "skipped",
          reason,
        });
        continue;
      }

      const meta = supaUserData.user.user_metadata || {};
      if (meta.onboarding_reminder_sent_at && !force) {
        const reason = `reminder already sent at ${meta.onboarding_reminder_sent_at}`;
        logger.info(
          `[ONBOARDING_REMINDER] Skipped ${manager.email}: ${reason}`,
        );
        result.skippedCount++;
        result.details.push({
          email: manager.email,
          stage: "onboarding",
          action: "skipped",
          reason,
        });
        continue;
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
        result.details.push({
          email: manager.email,
          stage: "onboarding",
          action: "sent",
          reason: "Simulated send (dryRun)",
        });
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
        result.details.push({
          email: manager.email,
          stage: "onboarding",
          action: "sent",
          reason: "Email dispatched successfully",
        });
        logger.info(
          `[ONBOARDING_REMINDER] Successfully sent onboarding reminder to ${manager.email}`,
        );
      } catch (err) {
        const msg = `Failed to send onboarding reminder to ${manager.email}: ${(err as Error).message}`;
        logger.error(`[ONBOARDING_REMINDER] ${msg}`);
        result.errors.push(msg);
        result.details.push({
          email: manager.email,
          stage: "onboarding",
          action: "error",
          reason: msg,
        });
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
 * Composite runner executing both unconfirmed registration reminders and onboarding setup reminders.
 */
export async function runAllReminders(
  options: ReminderProcessOptions = {},
): Promise<{
  registration: ReminderExecutionResult;
  onboarding: OnboardingReminderResult;
  timestamp: string;
}> {
  const { logger = console } = options;
  logger.info("[REMINDER_SERVICE] Running all automated reminders (registration + onboarding)...");
  const registration = await processRegistrationReminders(options);
  const onboarding = await processOnboardingReminders(options);
  return {
    registration,
    onboarding,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Initializes the background cron schedule inside the Fastify server.
 */
export function setupRegistrationReminder(fastify: FastifyInstance): void {
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

  // Run automatically every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    fastify.log.info(
      "[CRON/REGISTRATION_REMINDER] Starting hourly follow-up reminder check...",
    );
    try {
      await runAllReminders({ logger });
    } catch (err) {
      fastify.log.error(
        { err },
        "[CRON/REGISTRATION_REMINDER] Unhandled error during hourly cron run",
      );
    }
  });

  // Initial startup execution: check for pending reminders shortly after server launch
  setTimeout(async () => {
    fastify.log.info(
      "[CRON/REGISTRATION_REMINDER] Initial startup check for pending reminders...",
    );
    try {
      await runAllReminders({ logger });
    } catch (err) {
      fastify.log.error(
        { err },
        "[CRON/REGISTRATION_REMINDER] Initial startup reminder execution failed",
      );
    }
  }, 20000);
}
