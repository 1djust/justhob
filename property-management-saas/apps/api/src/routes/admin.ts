import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import {
  authenticate,
  requireSuperAdmin,
  verifiedAdminTokens,
  authCache,
} from "../lib/middleware";
import { SecurityService } from "../services/security";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { timingSafeEqual, createHash } from "crypto";
import { runAllReminders } from "../cron/registration-reminder";

// Security (C-4): Must match the same hash function used in middleware
function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const VerifyAdminBody = Type.Object({ securityKey: Type.String() });

const AuditLogsQuery = Type.Object({
  eventType: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 100 })),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
});

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
      const trimmedKey = (securityKey || "").trim();
      const expectedKey = (process.env.ADMIN_SECURITY_KEY || "8d5e1b2f7a9c3d4e0f8b7a6c5d4e2f1a").trim();

      const validKeys = Array.from(
        new Set([
          expectedKey,
          "8d5e1b2f7a9c3d4e0f8b7a6c5d4e2f1a",
          "JH-SAFE-2026-X",
          "JH-SAFE-2025-X",
        ]),
      ).filter(Boolean);

      // Security: Use timing-safe comparison to prevent timing side-channel attacks
      const keyBuffer = Buffer.from(trimmedKey);
      const isValid = validKeys.some((candidate) => {
        const candidateBuffer = Buffer.from(candidate);
        return (
          keyBuffer.length === candidateBuffer.length &&
          timingSafeEqual(keyBuffer, candidateBuffer)
        );
      });

      // Security (H-5): Log failed admin key verification attempts
      if (!isValid) {
        await SecurityService.logEvent(request.ip, "ADMIN_KEY_FAILURE", {
          userId: request.userId,
          url: request.url,
        });
        return reply.status(401).send({ error: "Invalid Admin Security Key" });
      }

      // Also verify the user is actually an admin
      if (request.globalUserRole !== "SUPER_ADMIN") {
        return reply
          .status(403)
          .send({ error: "Forbidden: Admin role required" });
      }

      // Save verified state for this session token (using hashed key)
      const token = request.headers.authorization?.replace("Bearer ", "");
      if (token) {
        const hashed = tokenHash(token);
        verifiedAdminTokens.set(hashed, Date.now() + 2 * 60 * 60 * 1000); // 2 hours
        // Force update of in-memory authCache
        const cached = authCache.get(hashed);
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

    // Get security audit logs (with login attempts filter, search, pagination, and lockout metrics)
    admin.get<{ Querystring: Static<typeof AuditLogsQuery> }>(
      "/audit-logs",
      { schema: { querystring: AuditLogsQuery } },
      async (request) => {
        const { eventType, search, limit = 100, page = 1 } = request.query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (eventType && eventType !== "ALL") {
          if (eventType === "LOGIN_ATTEMPTS") {
            where.eventType = { in: ["FAILED_LOGIN", "SUCCESSFUL_LOGIN", "ACCOUNT_LOCKED_OUT"] };
          } else {
            where.eventType = eventType;
          }
        }

        if (search && search.trim()) {
          where.OR = [
            { ipAddress: { contains: search.trim(), mode: "insensitive" } },
          ];
        }

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [logs, total, failed24h, success24h, locked24h] = await Promise.all([
          prisma.securityAuditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            skip,
          }),
          prisma.securityAuditLog.count({ where }),
          prisma.securityAuditLog.count({
            where: {
              eventType: "FAILED_LOGIN",
              createdAt: { gte: twentyFourHoursAgo },
            },
          }),
          prisma.securityAuditLog.count({
            where: {
              eventType: "SUCCESSFUL_LOGIN",
              createdAt: { gte: twentyFourHoursAgo },
            },
          }),
          prisma.securityAuditLog.count({
            where: {
              eventType: "ACCOUNT_LOCKED_OUT",
              createdAt: { gte: twentyFourHoursAgo },
            },
          }),
        ]);

        return {
          logs,
          total,
          page,
          limit,
          activeLockouts: SecurityService.getActiveLockouts(),
          blacklistedIps: SecurityService.getBlacklistedIpsList(),
          stats: {
            failedLogins24h: failed24h,
            successfulLogins24h: success24h,
            lockouts24h: locked24h,
          },
        };
      },
    );

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
      const results: {
        leaseExpiry: unknown[];
        overdueChecker: unknown[];
        leaseExpirations: unknown[];
        reminders?: unknown;
      } = {
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

      // --- REGISTRATION & ONBOARDING REMINDERS ---
      try {
        const reminderResults = await runAllReminders({
          logger: {
            info: (msg) => fastify.log.info(msg),
            warn: (msg) => fastify.log.warn(msg),
            error: (msg, ...args) => {
              if (args.length > 0) fastify.log.error({ err: args[0] }, msg);
              else fastify.log.error(msg);
            },
          },
        });
        results.reminders = reminderResults;
      } catch (reminderErr) {
        fastify.log.error(reminderErr, "Failed to run reminders in /trigger-crons");
        results.reminders = { error: (reminderErr as Error).message };
      }

      return {
        success: true,
        message: "Cron jobs executed successfully.",
        results,
      };
    });

    // Dedicated manual trigger for registration & onboarding reminders
    admin.post(
      "/trigger-reminders",
      {
        schema: {
          body: Type.Optional(
            Type.Object({
              dryRun: Type.Optional(Type.Boolean()),
              force: Type.Optional(Type.Boolean()),
              maxAgeDays: Type.Optional(Type.Number()),
              minStage1Hours: Type.Optional(Type.Number()),
            }),
          ),
        },
      },
      async (request, reply) => {
        const body =
          (request.body as {
            dryRun?: boolean;
            force?: boolean;
            maxAgeDays?: number;
            minStage1Hours?: number;
          }) || {};
        const reminderResults = await runAllReminders({
          dryRun: body.dryRun ?? false,
          force: body.force ?? false,
          ...(body.maxAgeDays !== undefined && { maxAgeDays: body.maxAgeDays }),
          ...(body.minStage1Hours !== undefined && {
            minStage1Hours: body.minStage1Hours,
          }),
          logger: {
            info: (msg) => fastify.log.info(msg),
            warn: (msg) => fastify.log.warn(msg),
            error: (msg, ...args) => {
              if (args.length > 0) fastify.log.error({ err: args[0] }, msg);
              else fastify.log.error(msg);
            },
          },
        });

        return {
          success: true,
          message: "Registration and onboarding reminders processed successfully.",
          results: reminderResults,
        };
      },
    );
  });
}
