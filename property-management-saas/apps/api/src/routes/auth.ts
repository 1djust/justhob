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
      if (!prisma) {
        return reply.status(500).send({ error: "Database client failed to initialize." });
      }

      const { data: supaData, error: supaError } = await supabaseAdmin.auth.getUser(token);
      
      if (supaError || !supaData || !supaData.user) {
        return reply.status(401).send({ error: supaError?.message || 'Invalid session.' });
      }

      const supaUser = supaData.user;
      const { name } = (request.body as any) || {};

      // Check if Prisma user already exists
      let user = await prisma.user.findUnique({ 
        where: { id: supaUser.id },
        include: {
          workspaces: {
            include: { workspace: true }
          }
        }
      });

      if (!user) {
        // Auto-Healing: Check if email already exists with different ID
        const existingByEmail = await prisma.user.findUnique({
          where: { email: supaUser.email || '' }
        });

        if (existingByEmail) {
          await prisma.user.delete({ where: { id: existingByEmail.id } });
        }

        try {
          const userMetadata: any = supaUser.user_metadata || {};
          const userName = name || userMetadata.name || null;
          
          user = await prisma.user.create({
            data: {
              id: supaUser.id,
              email: supaUser.email || '', 
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
        } catch (createErr: any) {
          return reply.status(500).send({ 
            error: "Database profile setup failed.", 
            details: createErr.message 
          });
        }
      }

      const userWithWorkspaces = {
        ...user,
        role: user.workspaces?.[0]?.role || 'USER',
        workspaceId: user.workspaces?.[0]?.workspaceId || null
      };

      return reply.send({ user: userWithWorkspaces });

    } catch (e: any) {
      return reply.status(500).send({ 
        error: "Internal Server Error during sync.", 
        details: e.message 
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
