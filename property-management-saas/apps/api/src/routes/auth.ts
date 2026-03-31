import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@property-management/database';
import { supabaseAdmin } from '../lib/supabase';

export default async function authRoutes(fastify: FastifyInstance) {
  // Sync Supabase user to Prisma (called after frontend login/register)
  fastify.post('/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'No token provided' });

    const { data: { user: supaUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !supaUser) return reply.status(401).send({ error: 'Invalid token' });

    const { name } = (request.body as any) || {};

    // Upsert: create Prisma user if first login, or return existing
    let user = await prisma.user.findUnique({ where: { id: supaUser.id } });

    if (!user) {
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
  });

  // Get current user
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    const { data: { user: supaUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !supaUser) return reply.status(401).send({ error: 'Invalid token' });

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
