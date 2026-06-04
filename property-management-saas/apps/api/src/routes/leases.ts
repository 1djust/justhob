import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess } from '../lib/middleware';
import { Type, Static } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

const WorkspaceParams = Type.Object({ workspaceId: Type.String() });

export default async function leaseRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook('preHandler', authenticate);
  server.addHook('preHandler', verifyWorkspaceAccess);

  // List all leases in a workspace
  server.get<{ Params: Static<typeof WorkspaceParams> }>('/', {
    schema: { params: WorkspaceParams }
  }, async (request, reply) => {
    const { workspaceId } = request.params;
    
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
