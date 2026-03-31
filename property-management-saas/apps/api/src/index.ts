import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { prisma } from '@property-management/database';


const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: true,
  credentials: true,
});

fastify.register(cookie, {
  secret: process.env.COOKIE_SECRET || 'super-secret-cookie-key',
});

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
import bankVerificationRoutes from './routes/bank-verification';

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
fastify.register(publicRoutes, { prefix: '/api/public' });
fastify.register(webhookRoutes, { prefix: '/api/public/webhooks' });
fastify.register(bankVerificationRoutes, { prefix: '/api/workspaces/:workspaceId/bank' });

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('API running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
