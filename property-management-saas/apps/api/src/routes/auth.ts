import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@property-management/database';
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

    const { data: supaData, error: supaError } = await supabaseAdmin.auth.getUser(token);
    const supaUser = supaData?.user;

    if (supaError || !supaUser) {
      console.error('[Sync] Supabase auth error:', supaError?.message || 'User not found');
      return reply.status(401).send({ error: 'Invalid or expired session. Please sign in again.' });
    }

    console.log('[Sync] Synchronizing user:', supaUser.email);

    const { name } = (request.body as any) || {};

    try {
      // Upsert: create Prisma user if first login, or return existing
      let user = await prisma.user.findUnique({ where: { id: supaUser.id } });

      if (!user) {
        console.log('[Sync] Creating new user in database:', supaUser.email);
        user = await prisma.user.create({
          data: {
            id: supaUser.id,
            email: supaUser.email!,
            name: name || supaUser.user_metadata?.name || null,
            workspaces: {
              create: {
                role: 'PROPERTY_MANAGER',
                workspace: { create: { name: 'My Properties' } }
              }
            }
          }
        });
      }

      const userWithWorkspaces = await prisma.user.findUnique({
        where: { id: supaUser.id },
        select: { id: true, email: true, name: true, workspaces: { include: { workspace: true } } }
      });

      return reply.send({ user: userWithWorkspaces });
    } catch (err) {
      console.error('[Sync] Database synchronization failed:', err);
      return reply.status(500).send({ 
        error: 'Database error. Your registration succeeded in Supabase but we failed to setup your database profile.',
        details: (err as Error).message 
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
