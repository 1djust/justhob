import cron from "node-cron";
import { prisma } from "../lib/database";
import { sendEmail } from "../lib/mailer";
import { FastifyInstance } from "fastify";

export function setupLeaseExpiryReminder(fastify: FastifyInstance) {
  // Run every day at 00:30
  cron.schedule("30 0 * * *", async () => {
    console.log("[CRON] Running lease expiry reminder...");

    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Find active leases with an end date in the future
      const activeLeases = await prisma.lease.findMany({
        where: {
          status: "ACTIVE",
          endDate: { not: null, gte: today },
        },
        include: { tenant: true, property: true, unit: true },
      });

      for (const lease of activeLeases) {
        if (!lease.endDate) continue;

        const daysUntilExpiry = Math.floor(
          (lease.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        let reminderType = null;
        if (daysUntilExpiry === 90) reminderType = "EXPIRING_90";
        else if (daysUntilExpiry === 60) reminderType = "EXPIRING_60";
        else if (daysUntilExpiry === 30) reminderType = "EXPIRING_30";

        if (reminderType) {
          // Check if we already notified the tenant for this threshold (using a generic notification query or adding a new field, but let's just create a notification if it doesn't exist within the last day)
          // For simplicity, we just send a notification
          const tenantUser = await prisma.user.findUnique({
            where: { email: lease.tenant.email || "" },
          });
          if (tenantUser) {
            const existingNotif = await prisma.notification.findFirst({
              where: {
                userId: tenantUser.id,
                type: "LEASE_EXPIRING",
                message: { contains: `${daysUntilExpiry} days` },
              },
            });

            if (!existingNotif) {
              await prisma.notification.create({
                data: {
                  userId: tenantUser.id,
                  title: "Lease Expiring Soon",
                  message: `Your lease for ${lease.property.name}${lease.unit ? " " + lease.unit.unitNumber : ""} will expire in ${daysUntilExpiry} days. Please prepare for renewal.`,
                  type: "LEASE_EXPIRING",
                },
              });
            }
          }

          // Notify property managers in the workspace
          if (reminderType === "EXPIRING_90") {
            const managers = await prisma.workspaceMember.findMany({
              where: {
                workspaceId: lease.tenant.workspaceId,
                role: "PROPERTY_MANAGER",
              },
              include: { user: true },
            });

            for (const manager of managers) {
              const existingNotif = await prisma.notification.findFirst({
                where: {
                  userId: manager.userId,
                  type: "TENANT_LEASE_EXPIRING",
                  message: { contains: lease.tenant.name },
                },
              });

              if (!existingNotif) {
                await prisma.notification.create({
                  data: {
                    userId: manager.userId,
                    title: "Tenant Lease Expiring",
                    message: `Tenant ${lease.tenant.name}'s lease at ${lease.property.name} expires in 90 days. Consider sending a renewal offer.`,
                    type: "TENANT_LEASE_EXPIRING",
                  },
                });
              }
            }
          }
        }
      }

      console.log("[CRON] Lease expiry reminder completed successfully.");
    } catch (error) {
      console.error("[CRON] Lease expiry reminder failed:", error);
    }
  });
}
