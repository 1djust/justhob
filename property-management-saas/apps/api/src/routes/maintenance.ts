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

  // Get maintenance request conversation history
  fastify.get('/:id/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };

    const messages = await prisma.maintenanceMessage.findMany({
      where: { requestId: id, workspaceId },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return reply.send({ messages });
  });

  // Send a message in a maintenance request
  fastify.post('/:id/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const { content } = request.body as { content: string };
    const userId = (request as any).user.id;

    const message = await prisma.maintenanceMessage.create({
      data: {
        content,
        requestId: id,
        workspaceId,
        senderId: userId,
        type: 'USER'
      },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      }
    });

    // Broadcast to the maintenance room
    fastify.io.to(`maintenance:${id}`).emit('maintenance-message', message);
    
    // Also notify the workspace room for unread badges
    fastify.io.to(`workspace:${workspaceId}`).emit('maintenance-notification', {
      requestId: id,
      message: content
    });

    return reply.status(201).send({ message });
  });

  // Update maintenance request status
  fastify.put('/:id', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const { status } = request.body as { status: MaintenanceStatus };

    try {
      const oldRequest = await prisma.maintenanceRequest.findUnique({
        where: { id }
      });

      const maintenanceRequest = await prisma.maintenanceRequest.update({
        where: { maintenance_workspace_id: { id, workspaceId } },
        data: { status }
      });

      // Log SYSTEM message for hybrid timeline if status changed
      if (oldRequest && oldRequest.status !== status) {
        const systemMessage = await prisma.maintenanceMessage.create({
          data: {
            content: `Status updated to ${status.replace('_', ' ')}`,
            type: 'SYSTEM',
            requestId: id,
            workspaceId
          }
        });
        
        // Broadcast the system message
        fastify.io.to(`maintenance:${id}`).emit('maintenance-message', systemMessage);
      }

      // Broadcast status change to workspace
      fastify.io.to(`workspace:${workspaceId}`).emit('MAINTENANCE_UPDATED', maintenanceRequest);

      return reply.send({ request: maintenanceRequest });
    } catch (e) {
      return reply.status(404).send({ error: 'Maintenance request not found' });
    }
  });
}

import { MaintenanceStatus } from '@prisma/client';
