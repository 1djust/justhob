import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { supabaseAdmin } from '../lib/supabase';

export default async function authRoutes(fastify: FastifyInstance) {
  // Sync Supabase user to Prisma (called after frontend login/register)
  fastify.post('/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    // console.log('[Sync] Token present:', !!token);
    if (!token) {
      console.error('[Sync] No token in request headers');
      return reply.status(401).send({ error: 'Authentication required. Please sign in.' });
    }
    try {
      console.log('[Sync] Starting sync for token...');
      
      if (!prisma) {
        console.error('[Sync] CRITICAL: Prisma is UNDEFINED at start of sync!');
        return reply.status(500).send({ 
          error: "Database configuration error.", 
          details: "The database client (Prisma) failed to initialize on the server." 
        });
      }

      const { data: supaData, error: supaError } = await supabaseAdmin.auth.getUser(token);
      
      if (supaError || !supaData || !supaData.user) {
        console.error('[Sync] Supabase Auth Error:', supaError?.message || 'No user data returned from Supabase');
        return reply.status(401).send({ error: supaError?.message || 'Invalid or expired session from Supabase.' });
      }

      const supaUser = supaData.user;
      console.log('[Sync] Valid user found in Supabase:', supaUser.id);

      const { name } = (request.body as any) || {};

      // Check if Prisma user already exists
      let user;
      try {
        if (!prisma.user) {
          throw new Error('prisma.user is undefined. Prisma Client models may not be generated.');
        }
        user = await prisma.user.findUnique({ 
          where: { id: supaUser.id },
          include: {
            workspaces: {
              include: { workspace: true }
            }
          }
        });
      } catch (dbErr: any) {
        console.error('[Sync] Database Query Error:', dbErr.message);
        return reply.status(500).send({ 
          error: "Database connectivity error.", 
          details: dbErr.message || "Failed to reach the database to check for existing user." 
        });
      }

      if (!user) {
        console.log('[Sync] Creating new user in database:', supaUser.email);
        try {
          const userMetadata: any = supaUser.user_metadata || {};
          const userName = name || userMetadata.name || null;
          
          user = await prisma.user.create({
            data: {
              id: supaUser.id,
              email: supaUser.email || '', // Fallback to empty string if email is missing
              name: userName,
              workspaces: {
                create: {
                  role: 'PROPERTY_MANAGER',
                  workspace: { create: { name: 'My Properties' } }
                }
              }
            },
            include: {
              workspaces: {
                include: { workspace: true }
              }
            }
          });
          console.log('[Sync] Successfully created user and default workspace.');
        } catch (createErr: any) {
          console.error('[Sync] User Creation Error:', createErr.message);
          return reply.status(500).send({ 
            error: "Database profile setup failed.", 
            details: createErr.message || "Failed to create your user profile in the database."
          });
        }
      }

      const userWithWorkspaces = {
        ...user,
        role: user.workspaces?.[0]?.role || 'USER',
        workspaceId: user.workspaces?.[0]?.workspaceId || null
      };

      console.log('[Sync] Sync completed successfully for:', user.email);
      return reply.send({ user: userWithWorkspaces });

    } catch (e: any) {
      console.error('[Sync] UNCAUGHT CRASH:', e.message, e.stack);
      return reply.status(500).send({ 
        error: "Internal Server Error during sync.", 
        details: e.message || "An unexpected crash occurred on the server."
      });
    }
  });

  // Get current user
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const { data: supaData, error: supaError } = await supabaseAdmin.auth.getUser(token);
    const supaUser = supaData?.user;
    if (supaError || !supaUser) return reply.status(401).send({ error: 'Invalid token' });

    const user = await prisma.user.findUnique({
      where: { id: supaUser.id },
      select: { id: true, email: true, name: true, workspaces: { include: { workspace: true } } }
    });

    if (!user) return reply.status(401).send({ error: 'User not synced' });
    return reply.send({ user });
  });

  // Logout (no-op since Supabase handles sessions, but kept for compatibility)
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });
}
