import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { supabaseAdmin } from '../lib/supabase';
import { AppError, UnauthorizedError, ValidationError, NotFoundError } from '../lib/errors';

export default async function authRoutes(fastify: FastifyInstance) {
  // Sync Supabase user to Prisma (called after frontend login/register)
  fastify.post('/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedError('Authentication required. Please sign in.');
    }

    if (!prisma) {
      throw new AppError("Database client failed to initialize.", 500);
    }

    const { data: supaData, error: supaError } = await supabaseAdmin.auth.getUser(token);
    
    if (supaError || !supaData || !supaData.user) {
      throw new UnauthorizedError(supaError?.message || 'Invalid session.');
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
          throw new AppError("Database profile setup failed.", 500, "SYNC_DB_ERROR", createErr.message);
        }
      }

      const mustChange = supaUser?.user_metadata?.mustChangePassword === true;
      const userWithWorkspaces = {
        ...user,
        role: (user as any).workspaces?.[0]?.role || 'USER',
        workspaceId: (user as any).workspaces?.[0]?.workspaceId || null,
        mustChangePassword: mustChange
      };

      return { user: userWithWorkspaces };
  });

  // Get current user
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedError();
 
    // First verify the token is valid
    const { data: supaData, error: supaError } = await supabaseAdmin.auth.getUser(token);
    const supaUser = supaData?.user;
    if (supaError || !supaUser) throw new UnauthorizedError('Invalid token');

    // Run both the Prisma query and the Admin API query concurrently to save time
    const [freshDataResponse, user] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(supaUser.id),
      prisma.user.findUnique({
        where: { id: supaUser.id },
        include: { workspaces: { include: { workspace: true } } }
      })
    ]);

    const freshMeta = freshDataResponse.data?.user?.user_metadata || supaUser.user_metadata;

    const mustChange = freshMeta?.mustChangePassword === true;
    const role = user?.workspaces?.[0]?.role || freshMeta.role || 'TENANT';

    return reply.send({ user: user ? { ...user, role, mustChangePassword: mustChange } : null });
  });

  // Login (called by mobile app)
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as any;
    if (!email || !password) {
      throw new ValidationError('Email and password required');
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      throw new UnauthorizedError(error?.message || 'Invalid credentials', 'AUTH_INVALID_CREDENTIALS');
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
      const mustChange = data.user.user_metadata?.mustChangePassword === true;
      return reply.send({
        access_token: data.session.access_token,
        user: { ...newUser, role, mustChangePassword: mustChange }
      });
    }

    const mustChange = data.user.user_metadata?.mustChangePassword === true;
    const role = user.workspaces?.[0]?.role || data.user.user_metadata.role || 'USER';

    return reply.send({
      access_token: data.session.access_token,
      user: { ...user, role, mustChangePassword: mustChange }
    });
  });

  // Change password (for first-login forced password change)
  fastify.post('/change-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedError();

    const { newPassword } = request.body as { newPassword?: string };
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    // Verify the token and get the user
    const { data: supaData, error: supaError } = await supabaseAdmin.auth.getUser(token);
    if (supaError || !supaData?.user) {
      throw new UnauthorizedError('Invalid session');
    }

    const userEmail = supaData.user.email;

    // Update the password and clear the mustChangePassword flag
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(supaData.user.id, {
      password: newPassword,
      user_metadata: { ...supaData.user.user_metadata, mustChangePassword: false }
    });

    if (updateError) {
      throw new AppError(updateError.message, 500);
    }

    // Re-authenticate with the new password to get a fresh token
    const { data: loginData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
      email: userEmail!,
      password: newPassword,
    });

    if (loginError || !loginData.session) {
      // Password was changed but re-login failed — user will need to log in manually
      return reply.send({ success: true, message: 'Password updated. Please log in again.' });
    }

    // Get user profile from Prisma
    const user = await prisma.user.findUnique({
      where: { id: supaData.user.id },
      include: { workspaces: { include: { workspace: true } } }
    });

    const role = user?.workspaces?.[0]?.role || supaData.user.user_metadata.role || 'TENANT';

    return reply.send({
      success: true,
      access_token: loginData.session.access_token,
      user: { ...user, role, mustChangePassword: false }
    });
  });

  // Trigger password reset email
  fastify.post('/reset-password-request', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as { email?: string };
    if (!email) {
      throw new ValidationError('Email is required');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${frontendUrl}/reset-password`,
    });

    if (error) {
      throw new AppError(error.message, 500);
    }

    return reply.send({ success: true, message: 'Reset link sent to your email.' });
  });

  // Logout (no-op since Supabase handles sessions, but kept for compatibility)
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });
}
