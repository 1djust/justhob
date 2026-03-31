import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@property-management/database';

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

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null }
    });

    if (!tenant) {
      return reply.status(404).send({ error: 'Tenant not found' });
    }

    // Determine the workspace
    const workspaceId = tenant.workspaceId;

    const maintenanceRequest = await prisma.maintenanceRequest.create({
      data: {
        tenantId,
        propertyId,
        workspaceId,
        description,
        imageUrl,
        status: 'PENDING'
      }
    });

    return reply.status(201).send({ request: maintenanceRequest });
  });
}
