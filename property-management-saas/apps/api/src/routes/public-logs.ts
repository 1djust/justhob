import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/database';

/**
 * Public Log Ingestion Routes.
 *
 * Allows the Web frontend and Mobile app to report errors to the database.
 */
export default async function publicLogRoutes(fastify: FastifyInstance) {
  fastify.post('/logs', async (request, reply) => {
    try {
      const { message, stack, context, source, level } = request.body as {
        message: string;
        stack?: string;
        context?: any;
        source: 'web' | 'mobile';
        level?: 'error' | 'warn' | 'info';
      };

      if (!message || !source) {
        return reply.status(400).send({ error: 'Message and source are required' });
      }

      const log = await prisma.errorLog.create({
        data: {
          level: level || 'error',
          message,
          stack,
          source,
          context: {
            ...(context || {}),
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          } as any,
        },
      });

      return reply.status(201).send({ success: true, id: log.id });
    } catch (error) {
      fastify.log.error({ err: error }, 'Log ingestion failed');
      return reply.status(500).send({ error: 'Failed to save log' });
    }
  });
}
