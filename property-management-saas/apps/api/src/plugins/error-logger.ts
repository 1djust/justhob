import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { prisma } from '../lib/database';

/**
 * Custom Error Logger Plugin for Fastify.
 *
 * Saves unhandled errors and slow response warnings to the ErrorLog table in Supabase.
 * This is a zero-cost alternative to Sentry.
 */
const errorLoggerPlugin: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts: Record<string, unknown>,
  done: (err?: Error) => void
) => {

  // Hook: Capture every error that Fastify encounters
  fastify.addHook('onError', async (request, _reply, error) => {
    try {
      const context = {
        url: request.url,
        method: request.method,
        ip: request.ip,
        params: request.params,
        query: request.query,
        headers: {
          'user-agent': request.headers['user-agent'],
          'content-type': request.headers['content-type'],
        },
      };

      const log = await prisma.errorLog.create({
        data: {
          level: 'error',
          message: error.message || 'Unknown API Error',
          stack: error.stack,
          source: 'api',
          context: context as any,
        },
      });

      fastify.log.info({ errorId: log.id }, 'Saved error to database');
    } catch (ingestError) {
      fastify.log.error({ err: ingestError }, 'Log ingestion failed');
      // Intentionally swallow ingestion error so we do not crash onError handler
    }
  });

  // Hook: Track slow responses (>3s)
  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = reply.elapsedTime;
    if (responseTime > 3000) {
      try {
        await prisma.errorLog.create({
          data: {
            level: 'warn',
            message: `Slow API response: ${Math.round(responseTime)}ms`,
            source: 'api',
            context: {
              url: request.url,
              method: request.method,
              responseTimeMs: Math.round(responseTime),
              statusCode: reply.statusCode,
            } as any,
          },
        });
      } catch (dbError) {
        fastify.log.warn({ err: dbError }, 'Failed to save performance warning to database');
      }
    }
  });

  done();
};

export default errorLoggerPlugin;
