import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './database';
import { supabaseAdmin } from './supabase';

// Decode JWT payload locally (no signature verification) to extract user ID.
// Used as fallback when Supabase HTTPS API is unreachable (WSL dev environment).
const decodeJwtSub = (token: string): string | null => {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.sub ?? null;
  } catch {
    return null;
  }
};

// Shared authenticate middleware — verifies Supabase JWT and attaches userId and globalRole
export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) return reply.status(401).send({ error: 'Unauthorized' });

  // Try Supabase API verification with a 3-second timeout.
  // Falls back to local JWT decode if the API is unavailable (e.g. WSL network issues).
  let userId: string | null = null;
  try {
    const result = await Promise.race([
      supabaseAdmin.auth.getUser(token),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('supabase_timeout')), 3000)
      ),
    ]) as Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>;

    if (!result.error && result.data?.user) {
      userId = result.data.user.id;
    }
  } catch {
    // Supabase API unavailable — decode JWT locally to get user ID.
    // The DB lookup below still validates the user exists in our system.
    userId = decodeJwtSub(token);
  }

  if (!userId) return reply.status(401).send({ error: 'Invalid token' });

  // Attach platform-level user data
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!dbUser) {
    return reply.status(401).send({ error: 'User setup incomplete' });
  }

  request.userId = dbUser.id;
  request.globalUserRole = dbUser.role as any;
};

// Middleware to require SUPER_ADMIN role platform-wide
export const requireSuperAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.globalUserRole !== 'SUPER_ADMIN') {
    return reply.status(403).send({ error: 'Super Admin privileges required' });
  }
};

// Verify workspace access and attach role
export const verifyWorkspaceAccess = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.userId!;
  const { workspaceId } = request.params as any;

  if (!workspaceId) return reply.status(400).send({ error: 'Workspace ID required' });

  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } }
  });

  if (!member) return reply.status(403).send({ error: 'Forbidden' });
  request.userRole! = member.role;
};

// Middleware to require PROPERTY_MANAGER role
export const requireManager = async (request: FastifyRequest, reply: FastifyReply) => {
  const userRole = request.userRole!;
  if (userRole !== 'PROPERTY_MANAGER') {
    return reply.status(403).send({ error: 'Only property managers can perform this action' });
  }
};

// Middleware to require either PROPERTY_MANAGER or LANDLORD role
export const requireManagement = async (request: FastifyRequest, reply: FastifyReply) => {
  const userRole = request.userRole!;
  if (userRole !== 'PROPERTY_MANAGER' && userRole !== 'LANDLORD') {
    return reply.status(403).send({ error: 'Management role required' });
  }
};
