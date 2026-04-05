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

    return reply.send({ user });
  });

  // Login (called by mobile app)
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as any;
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password required' });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      return reply.status(401).send({ error: error?.message || 'Invalid credentials' });
    }

    // Get the user profile from Prisma to include roles/workspaces
    const user = await prisma.user.findUnique({
      where: { id: data.user.id },
      include: {
        workspaces: {
          include: { workspace: true }
        }
      }
    });

    if (!user) {
      // If the user exists in Supabase but not Prisma, sync it now
      // This can happen if they were invited/created via admin but never synced
      const newUser = await prisma.user.create({
        data: {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata.name || null,
        },
        include: {
          workspaces: {
            include: { workspace: true }
          }
        }
      });
      
      const role = data.user.user_metadata.role || 'TENANT';
      return reply.send({
        access_token: data.session.access_token,
        user: { ...newUser, role }
      });
    }

    const role = user.workspaces?.[0]?.role || data.user.user_metadata.role || 'USER';

    return reply.send({
      access_token: data.session.access_token,
      user: { ...user, role }
    });
  });

  // Logout (no-op since Supabase handles sessions, but kept for compatibility)
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });
}
