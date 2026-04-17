import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { Prisma } from '@prisma/client';

export default async function publicRoutes(fastify: FastifyInstance) {
  // Get tenant public profile (for the portal)
  fastify.get('/tenants/:tenantId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        leases: {
          where: { status: 'ACTIVE' },
          include: { property: { select: { id: true, name: true, address: true } } }
        },
        workspace: { select: { name: true } },
        maintenanceRequests: {
          orderBy: { createdAt: 'desc' },
          include: { property: { select: { id: true, name: true } } }
        }
      }
    });

    if (!tenant) {
      return reply.status(404).send({ error: 'Tenant not found or has been deactivated' });
    }

    return reply.send({ tenant });
  });

  // Submit a new maintenance request from the tenant portal
  fastify.post('/tenants/:tenantId/maintenance', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.params as { tenantId: string };
    const { propertyId, description, imageUrl } = request.body as any;

    if (!propertyId || !description) {
      return reply.status(400).send({ error: 'Property ID and description are required' });
    }

    if (description.length > 2000) {
      return reply.status(400).send({ error: 'Description is too long' });
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null }
    });

    if (!tenant) {
      return reply.status(404).send({ error: 'Tenant not found' });
    }

    // Determine the workspace
    const workspaceId = tenant.workspaceId;

    const maintenanceRequest = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Lock the workspace record to prevent race conditions on limit checks
      await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;

      const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } });
      if (workspace?.plan === 'FREE') {
        const activeCount = await tx.maintenanceRequest.count({
          where: { 
            workspaceId, 
            status: { in: ['PENDING', 'IN_PROGRESS'] } 
          }
        });
        
        if (activeCount >= 3) {
          throw new Error('LIMIT_MAINTENANCE');
        }
      }

      return await tx.maintenanceRequest.create({
        data: {
          tenantId,
          propertyId,
          workspaceId,
          description,
          imageUrl,
          status: 'PENDING'
        }
      });
    }).catch((err: any) => {
      if (err.message === 'LIMIT_MAINTENANCE') {
        throw { statusCode: 402, message: 'Free plan limit reached: Maximum 3 active maintenance tickets allowed. Please upgrade your plan.' };
      }
      throw err;
    });

    return reply.status(201).send({ request: maintenanceRequest });
  });
}
