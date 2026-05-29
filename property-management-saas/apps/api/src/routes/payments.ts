import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess, requireManager } from '../lib/middleware';
import { Prisma } from '@prisma/client';
import { generateReceiptPDF } from '../lib/pdf';
import { sendEmail } from '../lib/mailer';

export default async function paymentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', verifyWorkspaceAccess);

  // List all payments for a workspace (across all leases)
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { status } = request.query as { status?: string };

    const payments = await prisma.payment.findMany({
      where: {
        OR: [
          { workspaceId },
          { lease: { tenant: { workspaceId } } }
        ],
        ...(status ? { status: status as any } : {})
      },
      include: {
        lease: {
          include: {
            tenant: { select: { id: true, name: true } },
            property: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { dueDate: 'desc' }
    });

    return reply.send({ payments });
  });

  // Record a payment for a specific lease
  fastify.post('/', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { leaseId, amount, dueDate, paidDate, status, note } = request.body as { leaseId?: any; amount?: any; dueDate?: any; paidDate?: any; status?: any; note?: any };

    if (!leaseId || !amount || !dueDate) {
      return reply.status(400).send({ error: 'Lease ID, amount, and due date are required' });
    }

    // Verify lease belongs to this workspace
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, tenant: { workspaceId } }
    });
    if (!lease) return reply.status(404).send({ error: 'Lease not found in this workspace' });

    try {
      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (workspace?.plan === 'FREE') {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const paymentCount = await prisma.payment.count({
          where: { 
            workspaceId, 
            createdAt: { gte: startOfMonth }
          }
        });
        
        if (paymentCount >= 5) {
          throw { statusCode: 402, message: 'Free plan limit reached: Maximum 5 invoices per month. Please upgrade your plan.' };
        }
      }

      const result = await prisma.payment.create({
        data: {
          leaseId,
          workspaceId,
          amount: parseFloat(amount),
          dueDate: new Date(dueDate),
          paidDate: paidDate ? new Date(paidDate) : null,
          status: status || 'PENDING',
          note
        },
        include: {
          lease: {
            include: {
               tenant: { select: { id: true, name: true } },
               property: { select: { id: true, name: true } }
            }
          }
        }
      });

      return reply.status(201).send({ payment: result });
    } catch (err: any) {
      if (err.statusCode === 402) throw err;
      throw err;
    }
  });

  // Mark payment as paid
  fastify.put('/:id/pay', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };

    try {
      const payment = await prisma.payment.update({
        where: { payment_workspace_id: { id, workspaceId } },
        data: { status: 'PAID', paidDate: new Date() }
      });

      // Emit real-time update to all members in the workspace room
      (fastify as any).io.to(`workspace:${workspaceId}`).emit('PAYMENT_UPDATED', {
        paymentId: id,
        status: 'PAID',
        message: 'A payment has been marked as settled.'
      });

      return reply.send({ payment });
    } catch (e) {
      return reply.status(404).send({ error: 'Payment not found' });
    }
  });

  // Get payment history for a specific lease
  fastify.get('/lease/:leaseId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, leaseId } = request.params as { workspaceId: string; leaseId: string };

    const payments = await prisma.payment.findMany({
      where: { leaseId },
      orderBy: { dueDate: 'desc' }
    });

    return reply.send({ payments });
  });

  // Get overdue summary for a workspace
  fastify.get('/overdue-summary', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const now = new Date();
    
    const overduePayments = await prisma.payment.findMany({
      where: {
        workspaceId,
        status: { in: ['OVERDUE', 'PARTIALLY_PAID'] }
      }
    });

    const summary = {
      totalOverdueCount: overduePayments.length,
      totalOverdueAmount: 0,
      brackets: {
        '0-30': { count: 0, amount: 0 },
        '30-60': { count: 0, amount: 0 },
        '60-90': { count: 0, amount: 0 },
        '90+': { count: 0, amount: 0 }
      }
    };

    overduePayments.forEach((payment: any) => {
      // Determine what constitutes an overdue payment. If not overdue yet but partially paid, should it count?
      // Since we query OVERDUE and PARTIALLY_PAID, let's include if dueDate < now.
      if (payment.dueDate > now && payment.status === 'PARTIALLY_PAID') return;
      
      const remainingAmount = payment.amount - (payment.amountPaid || 0);
      summary.totalOverdueAmount += remainingAmount;
      
      const daysOverdue = Math.floor((now.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue <= 30) {
        summary.brackets['0-30'].count++;
        summary.brackets['0-30'].amount += remainingAmount;
      } else if (daysOverdue <= 60) {
        summary.brackets['30-60'].count++;
        summary.brackets['30-60'].amount += remainingAmount;
      } else if (daysOverdue <= 90) {
        summary.brackets['60-90'].count++;
        summary.brackets['60-90'].amount += remainingAmount;
      } else {
        summary.brackets['90+'].count++;
        summary.brackets['90+'].amount += remainingAmount;
      }
    });

    return reply.send({ summary });
  });

  // Record a partial payment
  fastify.post('/:id/partial-pay', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const { amountPaid, balancePromise, balanceNote } = request.body as { amountPaid: number, balancePromise?: string, balanceNote?: string };

    if (!amountPaid || amountPaid <= 0) {
      return reply.status(400).send({ error: 'Valid partial amount is required' });
    }

    const payment = await prisma.payment.findUnique({
      where: { payment_workspace_id: { id, workspaceId } },
      include: { lease: { include: { tenant: true } } }
    });

    if (!payment) return reply.status(404).send({ error: 'Payment not found' });
    
    const newAmountPaid = (payment.amountPaid || 0) + parseFloat(amountPaid.toString());
    
    if (newAmountPaid >= payment.amount) {
      const updated = await prisma.payment.update({
        where: { id },
        data: { status: 'PAID', amountPaid: payment.amount, paidDate: new Date() }
      });
      return reply.send({ payment: updated, fullyPaid: true });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: 'PARTIALLY_PAID',
        amountPaid: newAmountPaid,
        balancePromise: balancePromise ? new Date(balancePromise) : null,
        balanceNote
      }
    });

    (fastify as any).io.to(`workspace:${workspaceId}`).emit('PAYMENT_UPDATED', {
      paymentId: id,
      status: 'PARTIALLY_PAID',
      message: `A partial payment of ₦${amountPaid} was recorded.`
    });

    return reply.send({ payment: updated, fullyPaid: false });
  });

  // Review a submitted proof of payment (Manager only)
  fastify.patch('/:id/review', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const { status, rejectionReason } = request.body as { status?: any; rejectionReason?: any }; // status expected: 'PAID' or 'REJECTED'

    if (status !== 'PAID' && status !== 'REJECTED') {
      return reply.status(400).send({ error: 'Status must be PAID or REJECTED' });
    }

    const payment = await prisma.payment.findUnique({
      where: { payment_workspace_id: { id, workspaceId } },
      include: { 
        lease: { include: { tenant: { select: { id: true, email: true } } } },
        workspace: { select: { plan: true } }
      }
    });

    if (!payment) return reply.status(404).send({ error: 'Payment not found' });
    
    const tenantEmail = payment?.lease?.tenant?.email;
    const tenantUser = tenantEmail 
      ? await prisma.user.findUnique({ where: { email: tenantEmail } })
      : null;

    const isPro = payment.workspace?.plan !== 'FREE';

    let updatedPayment;

    if (status === 'PAID') {
      const receiptId = `RCPT-${Date.now()}-${id.substring(0, 4)}`.toUpperCase();
      updatedPayment = await prisma.payment.update({
        where: { payment_workspace_id: { id, workspaceId } },
        data: {
          status: 'PAID',
          paidDate: new Date(),
          receiptId,
        }
      });
      
      if (tenantUser) {
        await prisma.notification.create({
          data: {
            userId: tenantUser.id,
            title: 'Payment Approved',
            message: `Your payment of ₦${updatedPayment.amount} has been approved. Receipt ID: ${receiptId}`,
            type: 'PAYMENT_APPROVED'
          }
        });

        // Trigger email notification ONLY for PRO/ENTERPRISE
        if (isPro) {
          await sendEmail(
            tenantEmail!,
            'Payment Approved - EstateOS',
            `Your payment of ₦${updatedPayment.amount.toLocaleString()} has been approved. Your Receipt ID is ${receiptId}. You can download your official receipt from the tenant portal.`
          );
        }
      }
    } else {
      // REJECTED
      if (!rejectionReason) {
        return reply.status(400).send({ error: 'Rejection reason is required' });
      }
      updatedPayment = await prisma.payment.update({
        where: { payment_workspace_id: { id, workspaceId } },
        data: {
          status: 'REJECTED',
          rejectionReason,
        }
      });
      
      if (tenantUser) {
        await prisma.notification.create({
          data: {
            userId: tenantUser.id,
            title: 'Payment Proof Rejected',
            message: `Your submitted proof of payment was rejected. Reason: ${rejectionReason}`,
            type: 'PAYMENT_REJECTED'
          }
        });

        // Trigger email notification ONLY for PRO/ENTERPRISE
        if (isPro) {
          await sendEmail(
            tenantEmail!,
            'Payment Proof Rejected - EstateOS',
            `Your submitted proof of payment for your rent has been rejected. \n\nReason: ${rejectionReason}\n\nPlease review the feedback and upload a valid proof of payment from the portal.`
          );
        }
      }
    }

    // Emit real-time update to all members in the workspace room (Manager, Tenant, Landlord)
    (fastify as any).io.to(`workspace:${workspaceId}`).emit('PAYMENT_UPDATED', {
      paymentId: id,
      status: updatedPayment.status,
      message: status === 'PAID' ? 'Payment approved' : 'Payment proof rejected'
    });

    return reply.send({ payment: updatedPayment });
  });

  // Download PDF Receipt
  fastify.get('/:id/receipt', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };

    const payment = await prisma.payment.findUnique({
      where: { payment_workspace_id: { id, workspaceId } },
      include: {
        lease: {
          include: {
            tenant: true,
            property: true,
          }
        },
        workspace: true
      }
    });

    if (!payment || !payment.receiptId || !payment.paidDate) {
      return reply.status(404).send({ error: 'Receipt not found or payment not settled' });
    }

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=receipt-${payment.receiptId}.pdf`);

    generateReceiptPDF({
      receiptId: payment.receiptId,
      amount: payment.amount,
      paidDate: payment.paidDate,
      tenantName: payment.lease.tenant.name,
      propertyName: payment.lease.property.name,
      workspaceName: payment.workspace?.name || 'EstateOS Workspace',
      note: payment.note || undefined
    }, (reply as any).raw);

    return reply;
  });
}
