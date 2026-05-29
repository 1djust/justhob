import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, requireSuperAdmin } from '../lib/middleware';

export default async function adminRoutes(fastify: FastifyInstance) {
  // Common authentication for all admin routes
  fastify.addHook('preHandler', authenticate);

  // Verify Admin Security Key
  fastify.post('/verify', async (request, reply) => {
    const { securityKey } = request.body as { securityKey: string };
    const expectedKey = process.env.ADMIN_SECURITY_KEY;

    if (!expectedKey) {
      return reply.status(500).send({ error: 'Admin Security Key not configured on server' });
    }

    if (securityKey !== expectedKey) {
      return reply.status(401).send({ error: 'Invalid Admin Security Key' });
    }

    // Also verify the user is actually an admin
    if (request.globalUserRole !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'Forbidden: Admin role required' });
    }

    return { success: true };
  });

  // Protected data routes - require Super Admin role
  fastify.register(async (admin) => {
    admin.addHook('preHandler', requireSuperAdmin);

    // Get global platform statistics
    admin.get('/stats', async () => {
      const [
        totalUsers,
        totalWorkspaces,
        totalProperties,
        totalUnits,
        totalTenants,
        totalRevenue
      ] = await Promise.all([
        prisma.user.count(),
        prisma.workspace.count(),
        prisma.property.count(),
        prisma.unit.count(),
        prisma.tenant.count(),
        prisma.payment.aggregate({
          where: { status: 'PAID' },
          _sum: { amount: true }
        })
      ]);

      return {
        stats: {
          totalUsers,
          totalWorkspaces,
          totalProperties,
          totalUnits,
          totalTenants,
          totalRevenue: totalRevenue._sum.amount || 0
        }
      };
    });

    // Get all managers
    admin.get('/managers', async () => {
      const managers = await prisma.user.findMany({
        where: { role: 'PROPERTY_MANAGER' },
        include: {
          workspaces: {
            include: {
              workspace: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { managers };
    });

    // Get all tenants platform-wide
    admin.get('/tenants', async () => {
      const tenants = await prisma.tenant.findMany({
        include: {
          workspace: true,
          leases: {
            include: {
              property: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { tenants };
    });

    // Manually trigger cron jobs for testing
    admin.post('/trigger-crons', async (request, reply) => {
      const results: any = { leaseExpiry: [], overdueChecker: [], leaseExpirations: [] };
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // --- LEASE EXPIRY REMINDERS ---
      const activeLeases = await prisma.lease.findMany({
        where: { status: 'ACTIVE', endDate: { not: null, gte: today } },
        include: { tenant: true, property: true, unit: true }
      });

      for (const lease of activeLeases) {
        if (!lease.endDate) continue;
        const daysUntilExpiry = Math.floor((lease.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let reminderType: string | null = null;
        if (daysUntilExpiry === 90) reminderType = 'EXPIRING_90';
        else if (daysUntilExpiry === 60) reminderType = 'EXPIRING_60';
        else if (daysUntilExpiry === 30) reminderType = 'EXPIRING_30';

        if (reminderType) {
          const tenantUser = await prisma.user.findUnique({ where: { email: lease.tenant.email || '' } });
          if (tenantUser) {
            const existingNotif = await prisma.notification.findFirst({
              where: { userId: tenantUser.id, type: 'LEASE_EXPIRING', message: { contains: `${daysUntilExpiry} days` } }
            });
            if (!existingNotif) {
              await prisma.notification.create({
                data: {
                  userId: tenantUser.id,
                  title: 'Lease Expiring Soon',
                  message: `Your lease for ${lease.property.name}${lease.unit ? ' ' + lease.unit.unitNumber : ''} will expire in ${daysUntilExpiry} days. Please prepare for renewal.`,
                  type: 'LEASE_EXPIRING'
                }
              });
              results.leaseExpiry.push({ tenant: lease.tenant.name, property: lease.property.name, daysLeft: daysUntilExpiry, notified: 'tenant' });
            }
          }

          if (reminderType === 'EXPIRING_90') {
            const managers = await prisma.workspaceMember.findMany({
              where: { workspaceId: lease.tenant.workspaceId, role: 'PROPERTY_MANAGER' },
              include: { user: true }
            });
            for (const manager of managers) {
              const existingNotif = await prisma.notification.findFirst({
                where: { userId: manager.userId, type: 'TENANT_LEASE_EXPIRING', message: { contains: lease.tenant.name } }
              });
              if (!existingNotif) {
                await prisma.notification.create({
                  data: {
                    userId: manager.userId,
                    title: 'Tenant Lease Expiring',
                    message: `Tenant ${lease.tenant.name}'s lease at ${lease.property.name} expires in 90 days. Consider sending a renewal offer.`,
                    type: 'TENANT_LEASE_EXPIRING'
                  }
                });
                results.leaseExpiry.push({ tenant: lease.tenant.name, property: lease.property.name, daysLeft: 90, notified: `manager (${manager.user.email})` });
              }
            }
          }
        }
      }

      // --- OVERDUE CHECKER ---
      // Pre-due reminders
      const futurePayments = await prisma.payment.findMany({
        where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] }, dueDate: { gte: today } },
        include: { lease: { include: { tenant: true } } }
      });

      for (const payment of futurePayments) {
        const daysUntilDue = Math.floor((payment.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let reminderType: string | null = null;
        if (daysUntilDue === 7) reminderType = 'PRE_DUE_7';
        else if (daysUntilDue === 3) reminderType = 'PRE_DUE_3';
        else if (daysUntilDue === 0) reminderType = 'DUE_DAY';

        if (reminderType) {
          const existing = await prisma.rentReminder.findFirst({ where: { paymentId: payment.id, type: reminderType } });
          if (!existing) {
            await prisma.rentReminder.create({ data: { paymentId: payment.id, type: reminderType, channel: 'IN_APP' } });
            const tenantUser = await prisma.user.findUnique({ where: { email: payment.lease.tenant.email || '' } });
            if (tenantUser) {
              await prisma.notification.create({
                data: {
                  userId: tenantUser.id,
                  title: reminderType === 'DUE_DAY' ? 'Rent Due Today' : 'Rent Due Soon',
                  message: `Your rent of ₦${payment.amount} is due ${daysUntilDue === 0 ? 'today' : 'in ' + daysUntilDue + ' days'}.`,
                  type: 'PAYMENT_REMINDER'
                }
              });
              results.overdueChecker.push({ tenant: payment.lease.tenant.name, type: reminderType, amount: payment.amount, daysUntilDue });
            }
          }
        }
      }

      // Overdue payments
      const overduePayments = await prisma.payment.findMany({
        where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] }, dueDate: { lt: today } },
        include: { lease: { include: { tenant: true, property: true } } }
      });

      for (const payment of overduePayments) {
        const gracePeriodEnd = new Date(payment.dueDate);
        gracePeriodEnd.setMonth(gracePeriodEnd.getMonth() + 3);
        const daysOverdue = Math.floor((today.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24));

        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: payment.status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : 'OVERDUE', gracePeriodEnd }
        });

        let reminderType: string | null = null;
        let notifTitle = '';
        let notifMsg = '';

        if (daysOverdue === 1) {
          reminderType = 'OVERDUE_1'; notifTitle = 'Rent is Overdue'; notifMsg = `Your rent of ₦${payment.amount} was due yesterday. Please make your payment.`;
        } else if (daysOverdue === 30) {
          reminderType = 'OVERDUE_30'; notifTitle = 'Rent 1 Month Overdue'; notifMsg = `Your rent is now 1 month overdue. Please contact your property manager immediately.`;
        } else if (daysOverdue === 60) {
          reminderType = 'OVERDUE_60'; notifTitle = 'Rent 2 Months Overdue'; notifMsg = `Your rent is 2 months overdue. Your 3-month grace period is ending soon.`;
        } else if (today >= gracePeriodEnd) {
          reminderType = 'FINAL_NOTICE'; notifTitle = 'Grace Period Ended'; notifMsg = `Your 3-month grace period has ended. Your property manager may now take action to end your tenancy.`;
        }

        if (reminderType) {
          const existingReminder = await prisma.rentReminder.findFirst({ where: { paymentId: payment.id, type: reminderType } });
          if (!existingReminder) {
            await prisma.rentReminder.create({ data: { paymentId: payment.id, type: reminderType, channel: 'IN_APP' } });
            const tenantUser = await prisma.user.findUnique({ where: { email: payment.lease.tenant.email || '' } });
            if (tenantUser) {
              await prisma.notification.create({ data: { userId: tenantUser.id, title: notifTitle, message: notifMsg, type: 'PAYMENT_OVERDUE' } });
            }
            // Emit socket event
            if (payment.workspaceId) {
              (fastify as any).io?.to(`workspace:${payment.workspaceId}`).emit('TENANT_OVERDUE', {
                tenantId: payment.lease.tenantId, paymentId: payment.id, daysOverdue,
                message: `Tenant ${payment.lease.tenant.name} is ${daysOverdue} days overdue.`
              });
            }
            results.overdueChecker.push({ tenant: payment.lease.tenant.name, type: reminderType, amount: payment.amount, daysOverdue });
          }
        }
      }

      // Mark expired leases
      const expiredLeases = await prisma.lease.findMany({ where: { status: 'ACTIVE', endDate: { lt: today } } });
      for (const lease of expiredLeases) {
        await prisma.lease.update({ where: { id: lease.id }, data: { status: 'EXPIRED' } });
        results.leaseExpirations.push({ leaseId: lease.id });
      }

      return {
        success: true,
        message: 'Cron jobs executed successfully.',
        results
      };
    });
  });
}
