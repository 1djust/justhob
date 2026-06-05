import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess, requireManager } from '../lib/middleware';
import { sendEmail } from '../lib/mailer';
import { Type, Static } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { MaintenanceStatus } from '@prisma/client';

const WorkspaceParams = Type.Object({ workspaceId: Type.String() });
const MaintenanceQuery = Type.Object({ status: Type.Optional(Type.String()) });
const MaintenanceParams = Type.Object({ workspaceId: Type.String(), id: Type.String() });
const MessageBody = Type.Object({ content: Type.String() });
const UpdateStatusBody = Type.Object({ status: Type.Enum(MaintenanceStatus) });

export default async function maintenanceRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook('preHandler', authenticate);
  server.addHook('preHandler', verifyWorkspaceAccess);

  // List all maintenance requests for a workspace
  server.get<{ Params: Static<typeof WorkspaceParams>, Querystring: Static<typeof MaintenanceQuery> }>('/', {
    schema: { params: WorkspaceParams, querystring: MaintenanceQuery }
  }, async (request, reply) => {
    const { workspaceId } = request.params;
    const { status } = request.query;

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        workspaceId,
        ...(status ? { status: status as MaintenanceStatus } : {})
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
  server.get<{ Params: Static<typeof MaintenanceParams> }>('/:id/messages', {
    schema: { params: MaintenanceParams }
  }, async (request, reply) => {
    const { workspaceId, id } = request.params;

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
  server.post<{ Params: Static<typeof MaintenanceParams>, Body: Static<typeof MessageBody> }>('/:id/messages', {
    schema: { params: MaintenanceParams, body: MessageBody }
  }, async (request, reply) => {
    const { workspaceId, id } = request.params;
    const { content } = request.body;
    const userId = request.userId!;

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
    (fastify as unknown as { io?: import('socket.io').Server }).io?.to(`maintenance:${id}`).emit('maintenance-message', message);
    
    // Also notify the workspace room for unread badges
    (fastify as unknown as { io?: import('socket.io').Server }).io?.to(`workspace:${workspaceId}`).emit('maintenance-notification', {
      requestId: id,
      message: content
    });

    return reply.status(201).send({ message });
  });

  // Update maintenance request status
  server.put<{ Params: Static<typeof MaintenanceParams>, Body: Static<typeof UpdateStatusBody> }>('/:id', {
    preHandler: requireManager,
    schema: { params: MaintenanceParams, body: UpdateStatusBody }
  }, async (request, reply) => {
    const { workspaceId, id } = request.params;
    const { status } = request.body;

    try {
      const oldRequest = await prisma.maintenanceRequest.findUnique({
        where: { id },
        include: { 
          tenant: { select: { email: true, name: true } },
          workspace: { select: { plan: true } }
        }
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
        (fastify as unknown as { io?: import('socket.io').Server }).io?.to(`maintenance:${id}`).emit('maintenance-message', systemMessage);

        // Notify tenant via email ONLY for PRO/ENTERPRISE
        const isPro = oldRequest.workspace?.plan !== 'FREE';
        if (oldRequest.tenant.email && isPro) {
          await sendEmail(
            oldRequest.tenant.email,
            'Maintenance Request Update - PropertyStack',
            `Hi ${oldRequest.tenant.name},\n\nThe status of your maintenance request "${maintenanceRequest.description.substring(0, 50)}..." has been updated to: ${status.replace('_', ' ')}.`
          );
        }
      }

      // Broadcast status change to workspace
      (fastify as unknown as { io?: import('socket.io').Server }).io?.to(`workspace:${workspaceId}`).emit('MAINTENANCE_UPDATED', maintenanceRequest);

      return reply.send({ request: maintenanceRequest });
    } catch (e) {
      return reply.status(404).send({ error: 'Maintenance request not found' });
    }
  });
}

