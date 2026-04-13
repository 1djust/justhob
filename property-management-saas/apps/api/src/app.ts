import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import errorLoggerPlugin from './plugins/error-logger';
import publicLogRoutes from './routes/public-logs';

import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspaces';
import propertiesRoutes from './routes/properties';
import tenantRoutes from './routes/tenants';
import paymentRoutes from './routes/payments';
import maintenanceRoutes from './routes/maintenance';
import publicRoutes from './routes/public';
import tenantProfileRoutes from './routes/tenant-profile';
import webhookRoutes from './routes/webhooks';
import ownerRoutes from './routes/owners';
import notificationRoutes from './routes/notifications';
import bankVerificationRoutes from './routes/bank-verification';
import leaseRoutes from './routes/leases';

export function buildApp() {
  const fastify = Fastify({ 
    logger: true,
    bodyLimit: 10 * 1024 * 1024 // 10MB for image uploads
  });

  fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'super-secret-cookie-key',
  });

  // Production monitoring — custom zero-cost logger using Supabase
  fastify.register(errorLoggerPlugin);

  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(workspaceRoutes, { prefix: '/api/workspaces' });
  fastify.register(propertiesRoutes, { prefix: '/api/workspaces/:workspaceId/properties' });
  fastify.register(tenantRoutes, { prefix: '/api/workspaces/:workspaceId/tenants' });
  fastify.register(paymentRoutes, { prefix: '/api/workspaces/:workspaceId/payments' });
  fastify.register(maintenanceRoutes, { prefix: '/api/workspaces/:workspaceId/maintenance' });
  fastify.register(ownerRoutes, { prefix: '/api/workspaces/:workspaceId/owners' });
  fastify.register(tenantProfileRoutes, { prefix: '/api/tenant' });
  fastify.register(notificationRoutes, { prefix: '/api/notifications' });
  fastify.register(publicRoutes, { prefix: '/api/public' });
  fastify.register(webhookRoutes, { prefix: '/api/public/webhooks' });
  fastify.register(publicLogRoutes, { prefix: '/api/public' });
  fastify.register(bankVerificationRoutes, { prefix: '/api/workspaces/:workspaceId/bank' });
  fastify.register(leaseRoutes, { prefix: '/api/workspaces/:workspaceId/leases' });

  return fastify;
}

export const app = buildApp();
