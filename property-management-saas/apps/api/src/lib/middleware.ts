import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './database';
import { supabaseAdmin } from './supabase';

// Shared authenticate middleware — verifies Supabase JWT and attaches userId and globalRole
export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) return reply.status(401).send({ error: 'Unauthorized' });

  // Verify the token via Supabase Auth — fail closed if verification fails for any reason
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }

  const userId = data.user.id;

  // Attach platform-level user data
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!dbUser) {
    return reply.status(401).send({ error: 'User setup incomplete' });
  }

  request.userId = dbUser.id;
  request.globalUserRole = dbUser.role as "SUPER_ADMIN" | "PROPERTY_MANAGER" | "LANDLORD" | "TENANT";
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
  const { workspaceId } = request.params as { workspaceId: string };

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
