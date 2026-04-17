import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess, requireManager } from '../lib/middleware';
import { Prisma } from '@prisma/client';

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
    const { leaseId, amount, dueDate, paidDate, status, note } = request.body as any;

    if (!leaseId || !amount || !dueDate) {
      return reply.status(400).send({ error: 'Lease ID, amount, and due date are required' });
    }

    // Verify lease belongs to this workspace
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, tenant: { workspaceId } }
    });
    if (!lease) return reply.status(404).send({ error: 'Lease not found in this workspace' });

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Lock the workspace record to prevent race conditions on limit checks
      await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;

      const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } });
      if (workspace?.plan === 'FREE') {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const paymentCount = await tx.payment.count({
          where: { 
            workspaceId, 
            createdAt: { gte: startOfMonth }
          }
        });
        
        if (paymentCount >= 5) {
          throw new Error('LIMIT_INVOICES');
        }
      }

      return await tx.payment.create({
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
    }).catch((err: any) => {
      if (err.message === 'LIMIT_INVOICES') {
        throw { statusCode: 402, message: 'Free plan limit reached: Maximum 5 invoices per month. Please upgrade your plan.' };
      }
      throw err;
    });

    return reply.status(201).send({ payment: result });
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

  // Review a submitted proof of payment (Manager only)
  fastify.patch('/:id/review', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const { status, rejectionReason } = request.body as any; // status expected: 'PAID' or 'REJECTED'

    if (status !== 'PAID' && status !== 'REJECTED') {
      return reply.status(400).send({ error: 'Status must be PAID or REJECTED' });
    }

    const payment = await prisma.payment.findUnique({
      where: { payment_workspace_id: { id, workspaceId } },
      include: { lease: { include: { tenant: { select: { id: true, email: true } } } } }
    });

    if (!payment) return reply.status(404).send({ error: 'Payment not found' });
    
    const tenantEmail = payment?.lease?.tenant?.email;
    const tenantUser = tenantEmail 
      ? await prisma.user.findUnique({ where: { email: tenantEmail } })
      : null;

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
}
