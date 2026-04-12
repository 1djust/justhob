import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate } from '../lib/middleware';

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Get notifications for the user
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId;

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      return reply.send({ notifications });
    } catch (error: any) {
      console.error('[GetNotificationsError]', error);
      return reply.status(500).send({ error: 'Failed to fetch notifications: ' + error.message });
    }
  });

  // Mark all as read
  fastify.patch('/read-all', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });

    return reply.send({ success: true });
  });

  // Mark single as read
  fastify.patch('/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return reply.status(404).send({ error: 'Notification not found' });
    if (notification.userId !== userId) return reply.status(403).send({ error: 'Unauthorized' });

    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    return reply.send({ success: true });
  });
}
