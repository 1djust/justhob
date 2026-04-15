import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './database';
import { supabaseAdmin } from './supabase';

// Shared authenticate middleware — verifies Supabase JWT and attaches userId
export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) return reply.status(401).send({ error: 'Unauthorized' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return reply.status(401).send({ error: 'Invalid token' });

  (request as any).userId = user.id;
};

// Verify workspace access and attach role
export const verifyWorkspaceAccess = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = (request as any).userId;
  const { workspaceId } = request.params as any;

  if (!workspaceId) return reply.status(400).send({ error: 'Workspace ID required' });

  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } }
  });

  if (!member) return reply.status(403).send({ error: 'Forbidden' });
  (request as any).userRole = member.role;
};

// Middleware to require PROPERTY_MANAGER role
export const requireManager = async (request: FastifyRequest, reply: FastifyReply) => {
  const userRole = (request as any).userRole;
  if (userRole !== 'PROPERTY_MANAGER') {
    return reply.status(403).send({ error: 'Only property managers can perform this action' });
  }
};

// Middleware to require either PROPERTY_MANAGER or LANDLORD role
export const requireManagement = async (request: FastifyRequest, reply: FastifyReply) => {
  const userRole = (request as any).userRole;
  if (userRole !== 'PROPERTY_MANAGER' && userRole !== 'LANDLORD') {
    return reply.status(403).send({ error: 'Management role required' });
  }
};
