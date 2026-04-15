import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess, requireManager } from '../lib/middleware';

export default async function maintenanceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', verifyWorkspaceAccess);

  // List all maintenance requests for a workspace
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { status } = request.query as { status?: string };

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        workspaceId,
        ...(status ? { status: status as any } : {})
      },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
        property: { select: { id: true, name: true, address: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ requests });
  });

  // Update maintenance request status
  fastify.put('/:id', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const { status } = request.body as { status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' };

    try {
      const maintenanceRequest = await prisma.maintenanceRequest.update({
        where: { maintenance_workspace_id: { id, workspaceId } },
        data: { status }
      });
      return reply.send({ request: maintenanceRequest });
    } catch (e) {
      return reply.status(404).send({ error: 'Maintenance request not found' });
    }
  });
}
