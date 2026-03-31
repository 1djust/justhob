import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@property-management/database';
import { authenticate, verifyWorkspaceAccess } from '../lib/middleware';

export default async function paymentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', verifyWorkspaceAccess);

  // List all payments for a workspace (across all leases)
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { status } = request.query as { status?: string };

    const payments = await prisma.payment.findMany({
      where: {
        lease: {
          tenant: { workspaceId, deletedAt: null },
          ...(status ? {} : {})
        },
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
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
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

    const payment = await prisma.payment.create({
      data: {
        leaseId,
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

    return reply.status(201).send({ payment });
  });

  // Mark payment as paid
  fastify.put('/:id/pay', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };

    try {
      const payment = await prisma.payment.update({
        where: { id },
        data: { status: 'PAID', paidDate: new Date() }
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
}
