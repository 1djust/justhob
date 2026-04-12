import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess } from '../lib/middleware';

export default async function leaseRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', verifyWorkspaceAccess);

  // List all leases in a workspace
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    
    const leases = await prisma.lease.findMany({
      where: { 
        property: { workspaceId }
      },
      include: {
        tenant: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ leases });
  });
}
