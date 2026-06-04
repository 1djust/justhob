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

        await prisma.payment.update({
          where: { id: payment.id },
          data: { 
            status: payment.status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : 'OVERDUE',
            gracePeriodEnd
          }
        });

        let reminderType: string | null = null;
        let notifTitle = '';
        let notifMsg = '';

        if (daysOverdue === 1) {
          reminderType = 'OVERDUE_1';
          notifTitle = 'Rent is Overdue';
          notifMsg = `Your rent of ₦${payment.amount} was due yesterday. Please make your payment.`;
        } else if (daysOverdue === 14) {
          reminderType = 'RESTRICTION_APPLIED';
          notifTitle = 'Features Restricted';
          notifMsg = `Your rent is 14 days overdue. Non-essential app features are now restricted.`;
        } else if (daysOverdue === 21) {
          reminderType = 'FINAL_WARNING';
          notifTitle = 'Final Warning: Impending Lockout';
          notifMsg = `Your rent is 21 days overdue. Your account will be locked and an eviction notice served in 9 days.`;
        } else if (daysOverdue >= 30 && !(payment as unknown as { evictionNoticeSent?: boolean }).evictionNoticeSent) {
          reminderType = 'ACCOUNT_LOCKED';
          notifTitle = 'Account Locked & Notice Served';
          notifMsg = `Your account is locked and an eviction notice has been emailed to you.`;
        }

        if (reminderType) {
          const existingReminder = await prisma.rentReminder.findFirst({
            where: { paymentId: payment.id, type: reminderType }
          });

          if (!existingReminder) {
            await prisma.rentReminder.create({
              data: { paymentId: payment.id, type: reminderType, channel: 'IN_APP' }
            });

            const tenantUser = await prisma.user.findUnique({ where: { email: payment.lease.tenant.email || '' } });
            
            if (tenantUser) {
              const notification = await prisma.notification.create({
                data: {
                  userId: tenantUser.id,
                  title: notifTitle,
                  message: notifMsg,
                  type: reminderType
                }
              });

              if (payment.workspaceId) {
                (fastify as unknown as { io?: import('socket.io').Server }).io?.to(`workspace:${payment.workspaceId}`).emit('NOTIFICATION_CREATED', notification);
                (fastify as unknown as { io?: import('socket.io').Server }).io?.to(`workspace:${payment.workspaceId}`).emit(reminderType, { paymentId: payment.id });
              }
            }

            if (reminderType === 'ACCOUNT_LOCKED') {
              const evictionDate = new Date(today);
              evictionDate.setDate(evictionDate.getDate() + 7);
              
              await prisma.payment.update({
                where: { id: payment.id },
                data: { 
                  evictionNoticeSent: true,
                  evictionDate
                }
              });
              console.log(`[Email] Eviction Notice sent to ${payment.lease.tenant.email} for ${payment.lease.tenant.name}`);
            }

            if (payment.workspaceId) {
              (fastify as unknown as { io?: import('socket.io').Server }).io?.to(`workspace:${payment.workspaceId}`).emit('TENANT_OVERDUE', {
                tenantId: payment.lease.tenantId,
                paymentId: payment.id,
                daysOverdue,
                message: `Tenant ${payment.lease.tenant.name} is ${daysOverdue} days overdue.`
              });
              
              (fastify as unknown as { io?: import('socket.io').Server }).io?.to(`workspace:${payment.workspaceId}`).emit('PAYMENT_UPDATED', {
                paymentId: payment.id,
                status: 'OVERDUE'
              });
              
              const managers = await prisma.workspaceMember.findMany({
                where: { workspaceId: payment.workspaceId, role: 'PROPERTY_MANAGER' },
                include: { user: true }
              });
              
              for (const manager of managers) {
                const managerNotif = await prisma.notification.create({
                  data: {
                    userId: manager.userId,
                    title: notifTitle,
                    message: `Tenant ${payment.lease.tenant.name} is ${daysOverdue} days overdue on their ₦${payment.amount} rent.`,
                    type: 'PAYMENT_OVERDUE'
                  }
                });
                if (manager.userId) {
                  (fastify as unknown as { io?: import('socket.io').Server }).io?.to(`user:${manager.userId}`).emit('NOTIFICATION_CREATED', managerNotif);
                  (fastify as unknown as { io?: import('socket.io').Server }).io?.to(`workspace:${payment.workspaceId}`).emit('NOTIFICATION_CREATED', managerNotif);
                }
              }
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
