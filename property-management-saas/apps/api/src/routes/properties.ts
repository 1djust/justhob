import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess } from '../lib/middleware';

export default async function propertiesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', verifyWorkspaceAccess);

  // List Properties
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userRole = (request as any).userRole;
    const userId = (request as any).userId;

    const whereClause: any = { workspaceId, deletedAt: null };
    if (userRole === 'LANDLORD') {
      whereClause.ownerId = userId;
    }

    const properties = await prisma.property.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: { 
        owner: { select: { id: true, name: true, email: true } },
        units: { orderBy: { unitNumber: 'asc' } }
      }
    });
    return reply.send({ properties });
  });

  // Create Property
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userRole = (request as any).userRole;
    
    if (userRole === 'LANDLORD') {
      return reply.status(403).send({ error: 'Only Property Managers can create properties' });
    }

    const { name, address, ownerId, units } = request.body as any;

    if (!name || !address) {
      return reply.status(400).send({ error: 'Name and address are required' });
    }

    const property = await prisma.property.create({
      data: {
        name,
        address,
        ownerId: ownerId || null,
        workspaceId,
        units: {
          create: (units || []).map((u: any) => ({
            unitNumber: u.unitNumber,
            type: u.type,
            workspaceId
          }))
        }
      },
      include: { units: true }
    });

    return reply.status(201).send({ property });
  });

  // Update Property
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string, id: string };
    const userRole = (request as any).userRole;
    
    if (userRole === 'LANDLORD') {
      return reply.status(403).send({ error: 'Only Property Managers can update properties' });
    }

    const { name, address, ownerId } = request.body as any;

    try {
      const property = await prisma.property.update({
        where: { id, workspaceId },
        data: { 
          name, 
          address, 
          ...(ownerId !== undefined ? { ownerId: ownerId || null } : {})
        }
      });
      return reply.send({ property });
    } catch (e) {
      return reply.status(404).send({ error: 'Property not found' });
    }
  });

  // Delete Property (Soft Delete)
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string, id: string };
    const userRole = (request as any).userRole;
    
    if (userRole === 'LANDLORD') {
      return reply.status(403).send({ error: 'Only Property Managers can delete properties' });
    }

    try {
      await prisma.property.update({
        where: { id, workspaceId },
        data: { deletedAt: new Date() }
      });
      return reply.send({ success: true });
    } catch (e) {
      return reply.status(404).send({ error: 'Property not found' });
    }
  });
}
