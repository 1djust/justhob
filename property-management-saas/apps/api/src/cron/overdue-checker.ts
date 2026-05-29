import cron from 'node-cron';
import { prisma } from '../lib/database';
import { sendEmail } from '../lib/mailer';
import { FastifyInstance } from 'fastify';

export function setupOverdueChecker(fastify: FastifyInstance) {
  // Run every day at 00:01
  cron.schedule('1 0 * * *', async () => {
    console.log('[CRON] Running overdue checker...');
    
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // 1. Mark PENDING/PARTIALLY_PAID payments as OVERDUE if past dueDate
      const overduePayments = await prisma.payment.findMany({
        where: {
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          dueDate: { lt: today }
        },
        include: {
          lease: { include: { tenant: true, property: true } }
        }
      });

      for (const payment of overduePayments) {
        // Calculate grace period (3 months from due date)
        const gracePeriodEnd = new Date(payment.dueDate);
        gracePeriodEnd.setMonth(gracePeriodEnd.getMonth() + 3);

        const daysOverdue = Math.floor((today.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let reminderType = null;
        let notificationTitle = '';
        let notificationMessage = '';

        if (daysOverdue === 1) {
          reminderType = 'OVERDUE_1';
          notificationTitle = 'Rent is Overdue';
          notificationMessage = `Your rent of ₦${payment.amount} was due yesterday. Please make your payment.`;
        } else if (daysOverdue === 30) {
          reminderType = 'OVERDUE_30';
          notificationTitle = 'Rent 1 Month Overdue';
          notificationMessage = `Your rent is now 1 month overdue. Please contact your property manager immediately.`;
        } else if (daysOverdue === 60) {
          reminderType = 'OVERDUE_60';
          notificationTitle = 'Rent 2 Months Overdue';
          notificationMessage = `Your rent is 2 months overdue. Your 3-month grace period is ending soon.`;
        } else if (today >= gracePeriodEnd) {
          reminderType = 'FINAL_NOTICE';
          notificationTitle = 'Grace Period Ended';
          notificationMessage = `Your 3-month grace period has ended. Your property manager may now take action to end your tenancy.`;
        }

        // Only update if not already OVERDUE or to set gracePeriodEnd if not set
        await prisma.payment.update({
          where: { id: payment.id },
          data: { 
            status: payment.status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : 'OVERDUE',
            gracePeriodEnd
          }
        });

        // Send notifications if applicable and not already sent
        if (reminderType) {
          const existingReminder = await prisma.rentReminder.findFirst({
            where: { paymentId: payment.id, type: reminderType }
          });

          if (!existingReminder) {
            // Log reminder
            await prisma.rentReminder.create({
              data: { paymentId: payment.id, type: reminderType, channel: 'IN_APP' }
            });

            // Notify Tenant
            const tenantUser = await prisma.user.findUnique({ where: { email: payment.lease.tenant.email || '' } });
            if (tenantUser) {
              await prisma.notification.create({
                data: {
                  userId: tenantUser.id,
                  title: notificationTitle,
                  message: notificationMessage,
                  type: 'PAYMENT_OVERDUE'
                }
              });
            }

            // Emit socket event to workspace
            if (payment.workspaceId) {
               (fastify as any).io.to(`workspace:${payment.workspaceId}`).emit('TENANT_OVERDUE', {
                 tenantId: payment.lease.tenantId,
                 paymentId: payment.id,
                 daysOverdue,
                 message: `Tenant ${payment.lease.tenant.name} is ${daysOverdue} days overdue.`
               });
            }
          }
        }
      }

      // 2. Pre-Due Reminders (7 days and 3 days before)
      const futurePayments = await prisma.payment.findMany({
        where: {
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          dueDate: { gte: today }
        },
        include: { lease: { include: { tenant: true } } }
      });

      for (const payment of futurePayments) {
        const daysUntilDue = Math.floor((payment.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let reminderType = null;
        if (daysUntilDue === 7) reminderType = 'PRE_DUE_7';
        else if (daysUntilDue === 3) reminderType = 'PRE_DUE_3';
        else if (daysUntilDue === 0) reminderType = 'DUE_DAY';

        if (reminderType) {
          const existing = await prisma.rentReminder.findFirst({
            where: { paymentId: payment.id, type: reminderType }
          });

          if (!existing) {
            await prisma.rentReminder.create({
              data: { paymentId: payment.id, type: reminderType, channel: 'IN_APP' }
            });

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
            }
          }
        }
      }

      // 3. Mark EXPIRED leases
      const expiredLeases = await prisma.lease.findMany({
        where: {
          status: 'ACTIVE',
          endDate: { lt: today }
        }
      });

      for (const lease of expiredLeases) {
        await prisma.lease.update({
          where: { id: lease.id },
          data: { status: 'EXPIRED' }
        });
      }

      console.log('[CRON] Overdue checker completed successfully.');
    } catch (error) {
      console.error('[CRON] Overdue checker failed:', error);
    }
  });
}
