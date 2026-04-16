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
import socketPlugin from './plugins/socket';

export function buildApp() {
  const fastify = Fastify({ 
    logger: true,
    bodyLimit: 10 * 1024 * 1024 // 10MB for image uploads
  });

  fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // PRODUCTION HARDENING: Check for mandatory secrets
  const isProd = process.env.NODE_ENV === 'production';
  const cookieSecret = process.env.COOKIE_SECRET;
  
  if (isProd && (!cookieSecret || cookieSecret === 'super-secret-cookie-key')) {
    throw new Error('PRODUCTION ERROR: COOKIE_SECRET must be set to a secure unique value in production environments.');
  }

  fastify.register(cookie, {
    secret: cookieSecret || 'super-secret-cookie-key',
  });

  // Production monitoring — custom zero-cost logger using Supabase
  fastify.register(errorLoggerPlugin);

  // Real-time synchronization
  fastify.register(socketPlugin);

  // Global Error Handler
  fastify.setErrorHandler((error, request, reply) => {
    // Determine status code
    const statusCode = error.statusCode || (error as any).status || 500;
    
    // Extract error details safely
    const errorMessage = error.message || 'Internal Server Error';
    const errorCode = (error as any).code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
    
    // Safely handle details (ensure it's not nested if already structured)
    let errorDetails = (error as any).details || undefined;
    
    // Log the error
    request.log.error({ 
      err: error, 
      requestId: request.id,
      url: request.url,
      method: request.method
    });

    // Send structured response
    return reply.status(statusCode).send({
      success: false,
      error: {
        message: errorMessage,
        code: String(errorCode),
        details: errorDetails,
        requestId: request.id
      }
    });
  });

  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // Backward compatibility route for older mobile app clients (v0.1.3 and below).
  // These clients still look at onrender.com/downloads/version.json due to hardcoded logic.
  fastify.get('/downloads/version.json', async () => {
    return {
      latestVersion: "0.1.4",
      latestBuildNumber: 5,
      isMandatory: true,
      downloadUrl: "https://justhob.vercel.app/downloads/estateos-tenant.apk",
      releaseNotes: "• Fixed silent authentication failure on physical devices\n• Added precise login error messages\n• Enhanced hardware secure storage configuration\n• Fixed update system URL"
    };
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
