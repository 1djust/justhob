import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess, requireManager } from '../lib/middleware';
import { Prisma } from '@prisma/client';

export default async function propertiesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', verifyWorkspaceAccess);

  // List Properties
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const userRole = request.userRole!;
    const userId = request.userId!;

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
  fastify.post('/', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { name, address, ownerId, units } = request.body as { name?: any; address?: any; ownerId?: any; units?: any };

    if (!name || !address) {
      return reply.status(400).send({ error: 'Name and address are required' });
    }

    // Atomic subscription limit check and creation with row-level locking
    const property = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Lock the workspace record to prevent race conditions on limit checks
      await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;

      const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } });
      const plan = workspace?.plan || 'FREE';

      // Enforcement of tier limits
      if (plan === 'FREE' || plan === 'PRO') {
        const propertiesCount = await tx.property.count({
          where: { workspaceId, deletedAt: null }
        });
        
        const limitProps = plan === 'FREE' ? 1 : 10;
        if (propertiesCount >= limitProps) {
          throw new Error(`LIMIT_PROPERTIES:${limitProps}`);
        }

        const newUnitsCount = units ? units.length : 0;
        const currentUnitsCount = await tx.unit.count({
          where: { workspaceId }
        });

        const limitUnits = plan === 'FREE' ? 3 : 50;
        if (currentUnitsCount + newUnitsCount > limitUnits) {
          throw new Error(`LIMIT_UNITS:${limitUnits}`);
        }
      }

      return await tx.property.create({
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
    }).catch((err: any) => {
      if (err.message?.startsWith('LIMIT_PROPERTIES')) {
        const limit = err.message.split(':')[1];
        throw { statusCode: 402, message: `Plan limit reached: Maximum ${limit} property allowed. Please upgrade your plan.` };
      }
      if (err.message?.startsWith('LIMIT_UNITS')) {
        const limit = err.message.split(':')[1];
        throw { statusCode: 402, message: `Plan limit reached: Maximum ${limit} units allowed. Please upgrade your plan.` };
      }
      throw err;
    });

    // Emit real-time update to the workspace room
    (fastify as any).io.to(`workspace:${workspaceId}`).emit('PROPERTY_CREATED', {
      propertyId: property.id,
      message: 'A new property has been created.'
    });

    return reply.status(201).send({ property });
  });

  // Update Property
  fastify.put('/:id', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const { name, address, ownerId } = request.body as { name?: any; address?: any; ownerId?: any };

    try {
      const property = await prisma.property.update({
        where: { property_workspace_id: { id, workspaceId } },
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
  fastify.delete('/:id', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };

    try {
      await prisma.property.update({
        where: { property_workspace_id: { id, workspaceId } },
        data: { deletedAt: new Date() }
      });

      // Emit real-time update to the workspace room
      (fastify as any).io.to(`workspace:${workspaceId}`).emit('PROPERTY_DELETED', {
        propertyId: id,
        message: 'A property has been deleted.'
      });

      return reply.send({ success: true });
    } catch (e) {
      return reply.status(404).send({ error: 'Property not found' });
    }
  });
}
