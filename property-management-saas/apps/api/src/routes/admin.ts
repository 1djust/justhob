import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import {
  authenticate,
  requireSuperAdmin,
  verifiedAdminTokens,
  authCache,
} from "../lib/middleware";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { timingSafeEqual } from "crypto";

const VerifyAdminBody = Type.Object({ securityKey: Type.String() });

export default async function adminRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Common authentication for all admin routes
  server.addHook("preHandler", authenticate);

  // Verify Admin Security Key
  server.post<{ Body: Static<typeof VerifyAdminBody> }>(
    "/verify",
    {
      schema: { body: VerifyAdminBody },
    },
    async (request, reply) => {
      const { securityKey } = request.body;
      const expectedKey = process.env.ADMIN_SECURITY_KEY;

      if (!expectedKey) {
        return reply
          .status(500)
          .send({ error: "Admin Security Key not configured on server" });
      }

      // Security: Use timing-safe comparison to prevent timing side-channel attacks
      const keyBuffer = Buffer.from(securityKey);
      const expectedBuffer = Buffer.from(expectedKey);
      if (
        keyBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(keyBuffer, expectedBuffer)
      ) {
        return reply.status(401).send({ error: "Invalid Admin Security Key" });
      }

      // Also verify the user is actually an admin
      if (request.globalUserRole !== "SUPER_ADMIN") {
        return reply
          .status(403)
          .send({ error: "Forbidden: Admin role required" });
      }

      // Save verified state for this session token
      const token = request.headers.authorization?.replace("Bearer ", "");
      if (token) {
        verifiedAdminTokens.set(token, Date.now() + 2 * 60 * 60 * 1000); // 2 hours
        // Force update of in-memory authCache
        const cached = authCache.get(token);
        if (cached) {
          cached.isAdminVerified = true;
        }
      }

      return { success: true };
    },
  );

  // Protected data routes - require Super Admin role
  server.register(async (adminRaw) => {
    const admin = adminRaw.withTypeProvider<TypeBoxTypeProvider>();
    admin.addHook("preHandler", requireSuperAdmin);

    // Get global platform statistics
    admin.get("/stats", { schema: {} }, async () => {
      const [
        totalUsers,
        totalWorkspaces,
        totalProperties,
        totalUnits,
        totalTenants,
        totalRevenue,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.workspace.count(),
        prisma.property.count(),
        prisma.unit.count(),
        prisma.tenant.count(),
        prisma.payment.aggregate({
          where: { status: "PAID" },
          _sum: { amount: true },
        }),
      ]);

      return {
        stats: {
          totalUsers,
          totalWorkspaces,
          totalProperties,
          totalUnits,
          totalTenants,
          totalRevenue: totalRevenue._sum.amount || 0,
        },
      };
    });

    // Get all managers
    admin.get("/managers", { schema: {} }, async () => {
      const managers = await prisma.user.findMany({
        where: { role: "PROPERTY_MANAGER" },
        include: {
          workspaces: {
            include: {
              workspace: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return { managers };
    });

    // Get security audit logs
    admin.get("/audit-logs", { schema: {} }, async () => {
      const logs = await prisma.securityAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return { logs };
    });

    // Get all tenants platform-wide
    admin.get("/tenants", { schema: {} }, async () => {
      const tenants = await prisma.tenant.findMany({
        include: {
          workspace: true,
          leases: {
            include: {
              property: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return { tenants };
    });

    // Manually trigger cron jobs for testing
    admin.post("/trigger-crons", { schema: {} }, async (request, reply) => {
      const results: Record<string, unknown[]> = {
        leaseExpiry: [],
        overdueChecker: [],
        leaseExpirations: [],
      };
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // --- LEASE EXPIRY REMINDERS ---
      const activeLeases = await prisma.lease.findMany({
        where: { status: "ACTIVE", endDate: { not: null, gte: today } },
        include: { tenant: true, property: true, unit: true },
      });

      for (const lease of activeLeases) {
        if (!lease.endDate) continue;
        const daysUntilExpiry = Math.floor(
          (lease.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        let reminderType: string | null = null;
        if (daysUntilExpiry === 90 || daysUntilExpiry === 89)
          reminderType = "EXPIRING_90";
        else if (daysUntilExpiry === 60 || daysUntilExpiry === 59)
          reminderType = "EXPIRING_60";
        else if (daysUntilExpiry === 30 || daysUntilExpiry === 29)
          reminderType = "EXPIRING_30";

        if (reminderType) {
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
              const notification = await prisma.notification.create({
                data: {
                  userId: tenantUser.id,
                  title: "Lease Expiring Soon",
                  message: `Your lease for ${lease.property.name}${lease.unit ? " " + lease.unit.unitNumber : ""} will expire in ${daysUntilExpiry} days. Please prepare for renewal.`,
                  type: "LEASE_EXPIRING",
                },
              });

              if (tenantUser.id) {
                (fastify as unknown as { io?: import("socket.io").Server }).io
                  ?.to(`user:${tenantUser.id}`)
                  .emit("NOTIFICATION_CREATED", notification);
              }

              results.leaseExpiry.push({
                tenant: lease.tenant.name,
                property: lease.property.name,
                daysLeft: daysUntilExpiry,
                notified: "tenant",
              });
            }
          }

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
                message: { contains: `${daysUntilExpiry} days` },
              },
            });
            if (!existingNotif) {
              const managerNotif = await prisma.notification.create({
                data: {
                  userId: manager.userId,
                  title: "Tenant Lease Expiring",
                  message: `Tenant ${lease.tenant.name}'s lease at ${lease.property.name} expires in ${daysUntilExpiry} days. Consider sending a renewal offer.`,
                  type: "TENANT_LEASE_EXPIRING",
                },
              });
              if (manager.userId) {
                (fastify as unknown as { io?: import("socket.io").Server }).io
                  ?.to(`user:${manager.userId}`)
                  .emit("NOTIFICATION_CREATED", managerNotif);
                (fastify as unknown as { io?: import("socket.io").Server }).io
                  ?.to(`workspace:${lease.tenant.workspaceId}`)
                  .emit("NOTIFICATION_CREATED", managerNotif);
              }
              results.leaseExpiry.push({
                tenant: lease.tenant.name,
                property: lease.property.name,
                daysLeft: daysUntilExpiry,
                notified: `manager (${manager.user.email})`,
              });
            }
          }
        }
      }

      // --- OVERDUE CHECKER ---
      // Pre-due reminders
      const futurePayments = await prisma.payment.findMany({
        where: {
          status: { in: ["PENDING", "PARTIALLY_PAID"] },
          dueDate: { gte: today },
        },
        include: { lease: { include: { tenant: true } } },
      });

      for (const payment of futurePayments) {
        const daysUntilDue = Math.floor(
          (payment.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        let reminderType: string | null = null;
        if (daysUntilDue === 7 || daysUntilDue === 6)
          reminderType = "PRE_DUE_7";
        else if (daysUntilDue === 3 || daysUntilDue === 2)
          reminderType = "PRE_DUE_3";
        else if (daysUntilDue === 0 || daysUntilDue === -1)
          reminderType = "DUE_DAY";

        if (reminderType) {
          const existing = await prisma.rentReminder.findFirst({
            where: { paymentId: payment.id, type: reminderType },
          });
          if (!existing) {
            await prisma.rentReminder.create({
              data: {
                paymentId: payment.id,
                type: reminderType,
                channel: "IN_APP",
              },
            });
            const tenantUser = await prisma.user.findUnique({
              where: { email: payment.lease.tenant.email || "" },
            });
            if (tenantUser) {
              const notification = await prisma.notification.create({
                data: {
                  userId: tenantUser.id,
                  title:
                    reminderType === "DUE_DAY"
                      ? "Rent Due Today"
                      : "Rent Due Soon",
                  message: `Your rent of ₦${payment.amount} is due ${daysUntilDue === 0 ? "today" : "in " + daysUntilDue + " days"}.`,
                  type: "PAYMENT_REMINDER",
                },
              });
              if (tenantUser.id) {
                (fastify as unknown as { io?: import("socket.io").Server }).io
                  ?.to(`user:${tenantUser.id}`)
                  .emit("NOTIFICATION_CREATED", notification);
              }
              results.overdueChecker.push({
                tenant: payment.lease.tenant.name,
                type: reminderType,
                amount: payment.amount,
                daysUntilDue,
              });
            }

            // Notify Property Managers
            console.log(
              `[Admin Cron] Looking for managers for workspace: ${payment.lease.tenant.workspaceId}`,
            );
            const managers = await prisma.workspaceMember.findMany({
              where: {
                workspaceId: payment.lease.tenant.workspaceId,
                role: "PROPERTY_MANAGER",
              },
              include: { user: true },
            });
            console.log(`[Admin Cron] Found ${managers.length} managers`);

            for (const manager of managers) {
              const managerNotif = await prisma.notification.create({
                data: {
                  userId: manager.userId,
                  title:
                    reminderType === "DUE_DAY"
                      ? "Tenant Rent Due Today"
                      : "Tenant Rent Due Soon",
                  message: `Tenant ${payment.lease.tenant.name}'s rent of ₦${payment.amount} is due ${daysUntilDue === 0 ? "today" : "in " + daysUntilDue + " days"}.`,
                  type: "TENANT_PAYMENT_REMINDER",
                },
              });

              if (manager.userId) {
                (fastify as unknown as { io?: import("socket.io").Server }).io
                  ?.to(`user:${manager.userId}`)
                  .emit("NOTIFICATION_CREATED", managerNotif);
                (fastify as unknown as { io?: import("socket.io").Server }).io
                  ?.to(`workspace:${payment.lease.tenant.workspaceId}`)
                  .emit("NOTIFICATION_CREATED", managerNotif);
              }
            }

            // Emit PAYMENT_UPDATED so the mobile app fetches the new upcoming payment
            if (payment.lease.tenant.workspaceId) {
              (fastify as unknown as { io?: import("socket.io").Server }).io
                ?.to(`workspace:${payment.lease.tenant.workspaceId}`)
                .emit("PAYMENT_UPDATED", {
                  paymentId: payment.id,
                  status: payment.status,
                });
            }
          }
        }
      }

      // Overdue payments
      const overduePayments = await prisma.payment.findMany({
        where: {
          status: { in: ["PENDING", "PARTIALLY_PAID"] },
          dueDate: { lt: today },
        },
        include: { lease: { include: { tenant: true, property: true } } },
      });

      for (const payment of overduePayments) {
        const gracePeriodEnd = new Date(payment.dueDate);
        gracePeriodEnd.setMonth(gracePeriodEnd.getMonth() + 3);
        const daysOverdue = Math.floor(
          (today.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status:
              payment.status === "PARTIALLY_PAID"
                ? "PARTIALLY_PAID"
                : "OVERDUE",
            gracePeriodEnd,
          },
        });

        let reminderType: string | null = null;
        let notifTitle = "";
        let notifMsg = "";

        if (daysOverdue === 1) {
          reminderType = "OVERDUE_1";
          notifTitle = "Rent is Overdue";
          notifMsg = `Your rent of ₦${payment.amount} was due yesterday. Please make your payment.`;
        } else if (daysOverdue === 14) {
          reminderType = "RESTRICTION_APPLIED";
          notifTitle = "Features Restricted";
          notifMsg = `Your rent is 14 days overdue. Non-essential app features are now restricted.`;
        } else if (daysOverdue === 21) {
          reminderType = "FINAL_WARNING";
          notifTitle = "Final Warning: Impending Lockout";
          notifMsg = `Your rent is 21 days overdue. Your account will be locked and an eviction notice served in 9 days.`;
        } else if (
          daysOverdue >= 30 &&
          !(payment as unknown as { evictionNoticeSent?: boolean })
            .evictionNoticeSent
        ) {
          reminderType = "ACCOUNT_LOCKED";
          notifTitle = "Account Locked & Notice Served";
          notifMsg = `Your account is locked and an eviction notice has been emailed to you.`;
        }

        if (reminderType) {
          const existingReminder = await prisma.rentReminder.findFirst({
            where: { paymentId: payment.id, type: reminderType },
          });
          if (!existingReminder) {
            await prisma.rentReminder.create({
              data: {
                paymentId: payment.id,
                type: reminderType,
                channel: "IN_APP",
              },
            });
            const tenantUser = await prisma.user.findUnique({
              where: { email: payment.lease.tenant.email || "" },
            });
            if (tenantUser) {
              const notification = await prisma.notification.create({
                data: {
                  userId: tenantUser.id,
                  title: notifTitle,
                  message: notifMsg,
                  type: reminderType,
                },
              });
              if (payment.workspaceId) {
                (fastify as unknown as { io?: import("socket.io").Server }).io
                  ?.to(`workspace:${payment.workspaceId}`)
                  .emit("NOTIFICATION_CREATED", notification);
                (fastify as unknown as { io?: import("socket.io").Server }).io
                  ?.to(`workspace:${payment.workspaceId}`)
                  .emit(reminderType, { paymentId: payment.id });
              }
            }
            if (reminderType === "ACCOUNT_LOCKED") {
              await prisma.payment.update({
                where: { id: payment.id },
                data: { evictionNoticeSent: true },
              });
              console.log(
                `[Email] Eviction Notice sent to ${payment.lease.tenant.email} for ${payment.lease.tenant.name}`,
              );
            }
            // Emit socket event and notify managers
            if (payment.workspaceId) {
              (fastify as unknown as { io?: import("socket.io").Server }).io
                ?.to(`workspace:${payment.workspaceId}`)
                .emit("TENANT_OVERDUE", {
                  tenantId: payment.lease.tenantId,
                  paymentId: payment.id,
                  daysOverdue,
                  message: `Tenant ${payment.lease.tenant.name} is ${daysOverdue} days overdue.`,
                });

              (fastify as unknown as { io?: import("socket.io").Server }).io
                ?.to(`workspace:${payment.workspaceId}`)
                .emit("PAYMENT_UPDATED", {
                  paymentId: payment.id,
                  status: "OVERDUE",
                });

              const managers = await prisma.workspaceMember.findMany({
                where: {
                  workspaceId: payment.workspaceId,
                  role: "PROPERTY_MANAGER",
                },
              });
              for (const manager of managers) {
                const managerNotif = await prisma.notification.create({
                  data: {
                    userId: manager.userId,
                    title: notifTitle,
                    message: `Tenant ${payment.lease.tenant.name} is ${daysOverdue} days overdue on their ₦${payment.amount} rent.`,
                    type: "PAYMENT_OVERDUE",
                  },
                });
                if (manager.userId) {
                  (fastify as unknown as { io?: import("socket.io").Server }).io
                    ?.to(`user:${manager.userId}`)
                    .emit("NOTIFICATION_CREATED", managerNotif);
                  (fastify as unknown as { io?: import("socket.io").Server }).io
                    ?.to(`workspace:${payment.workspaceId}`)
                    .emit("NOTIFICATION_CREATED", managerNotif);
                }
              }
            }
            results.overdueChecker.push({
              tenant: payment.lease.tenant.name,
              type: reminderType,
              amount: payment.amount,
              daysOverdue,
            });
          }
        }
      }

      // Mark expired leases
      const expiredLeases = await prisma.lease.findMany({
        where: { status: "ACTIVE", endDate: { lt: today } },
        include: { tenant: true },
      });
      for (const lease of expiredLeases) {
        await prisma.lease.update({
          where: { id: lease.id },
          data: { status: "EXPIRED" },
        });

        if (lease.tenant.workspaceId) {
          (fastify as unknown as { io?: import("socket.io").Server }).io
            ?.to(`workspace:${lease.tenant.workspaceId}`)
            .emit("LEASE_UPDATED", {
              leaseId: lease.id,
              status: "EXPIRED",
            });
        }

        results.leaseExpirations.push({ leaseId: lease.id });
      }

      return {
        success: true,
        message: "Cron jobs executed successfully.",
        results,
      };
    });
  });
}
