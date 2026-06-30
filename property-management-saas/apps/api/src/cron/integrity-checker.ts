import cron from "node-cron";
import { prisma } from "../lib/database";
import { sendEmail } from "../lib/mailer";
import { FastifyInstance } from "fastify";

export function setupIntegrityChecker(fastify: FastifyInstance) {
  // Run every day at midnight (00:00)
  cron.schedule("0 0 * * *", async () => {
    fastify.log.info("[CRON] Running database integrity audit...");

    try {
      const anomalies: string[] = [];

      // 1. Find Workspaces with properties but 0 members
      const orphanedWorkspaces = await prisma.workspace.findMany({
        where: {
          members: { none: {} },
          properties: { some: {} },
        },
        include: {
          properties: true,
        },
      });

      if (orphanedWorkspaces.length > 0) {
        for (const ws of orphanedWorkspaces) {
          const propertyList = ws.properties
            .map((p) => `"${p.name}" (${p.id})`)
            .join(", ");
          const msg = `Orphaned Workspace detected: "${ws.name}" (${ws.id}) has active properties [${propertyList}] but has 0 members in WorkspaceMember table.`;
          anomalies.push(msg);
          fastify.log.error(`[CRON/INTEGRITY] ${msg}`);
        }
      }

      // 2. Find Property Managers with 0 workspace memberships
      const orphanedManagers = await prisma.user.findMany({
        where: {
          role: "PROPERTY_MANAGER",
          workspaces: { none: {} },
        },
      });

      if (orphanedManagers.length > 0) {
        for (const user of orphanedManagers) {
          const msg = `Orphaned Property Manager detected: User "${user.name}" (${user.email}) has role PROPERTY_MANAGER but 0 memberships in WorkspaceMember table.`;
          anomalies.push(msg);
          fastify.log.error(`[CRON/INTEGRITY] ${msg}`);
        }
      }

      // 3. Send email notification if anomalies are found
      if (anomalies.length > 0) {
        const adminEmail =
          process.env.ADMIN_EMAIL || "support@propertystack.com";
        const subject = `[CRON/CRITICAL] Database Integrity Issues Detected`;

        let content = `The automated database integrity cron job has detected the following anomalies that require immediate attention:\n\n`;
        anomalies.forEach((anomaly, index) => {
          content += `${index + 1}. ${anomaly}\n\n`;
        });
        content += `Please investigate the database constraints and user workspace logs immediately.`;

        await sendEmail(adminEmail, subject, content);
        fastify.log.error(
          `[CRON] Database integrity anomalies found! Dispatched alert email to ${adminEmail}`,
        );
      } else {
        fastify.log.info(
          "[CRON] Database integrity audit passed: No anomalies found.",
        );
      }
    } catch (error) {
      fastify.log.error(
        error as Error,
        "[CRON] Database integrity audit failed",
      );
    }
  });
}
