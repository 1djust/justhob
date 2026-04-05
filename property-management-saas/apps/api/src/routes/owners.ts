import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate } from '../lib/middleware';
import { supabaseAdmin } from '../lib/supabase';

const verifyPropertyManager = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = (request as any).userId;
  const { workspaceId } = request.params as any;

  if (!workspaceId) return reply.status(400).send({ error: 'Workspace ID required' });

  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } }
  });

  if (!member || member.role !== 'PROPERTY_MANAGER') {
    return reply.status(403).send({ error: 'Only Property Managers can manage owners' });
  }
};

export default async function ownerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', verifyPropertyManager);

  // List all Landlords (Owners) in a workspace
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };

    const owners = await prisma.workspaceMember.findMany({
      where: { workspaceId, role: 'LANDLORD' },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = owners.map((o: any) => ({
      id: o.user.id,
      name: o.user.name,
      email: o.user.email,
      joinedAt: o.createdAt,
      memberId: o.id,
      payoutStrategy: o.payoutStrategy,
      bankCode: o.bankCode,
      accountNumber: o.accountNumber,
      accountName: o.accountName
    }));

    return reply.send({ owners: formatted });
  });

  // Add a new Landlord (Owner) to the workspace
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { name, email, password } = request.body as { name: string; email: string; password?: string };

    if (!name || !email) {
      return reply.status(400).send({ error: 'Name and email are required' });
    }

    // Check if Prisma user already exists
    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId } }
      });
      if (existingMember) {
        return reply.status(400).send({ error: 'This user is already a member of this workspace' });
      }

      const { payoutStrategy, bankCode, accountNumber, accountName } = request.body as any;

      await prisma.workspaceMember.create({
        data: { 
          userId: user.id, 
          workspaceId, 
          role: 'LANDLORD',
          payoutStrategy,
          bankCode,
          accountNumber,
          accountName
        }
      });
    } else {
      // Invite user to Supabase Auth (This sends the email)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        { 
          data: { name },
          redirectTo: process.env.FRONTEND_URL 
            ? `${process.env.FRONTEND_URL}/login` 
            : 'https://justhob.vercel.app/login'
        }
      );

      if (authError || !authData.user) {
        return reply.status(400).send({ error: authError?.message || 'Failed to send invitation' });
      }

      // Create Prisma user linked to Supabase Auth UID
      user = await prisma.user.create({
        data: { id: authData.user.id, email, name }
      });

      const { payoutStrategy, bankCode, accountNumber, accountName } = request.body as any;

      await prisma.workspaceMember.create({
        data: { 
          userId: user.id, 
          workspaceId, 
          role: 'LANDLORD',
          payoutStrategy,
          bankCode,
          accountNumber,
          accountName
        }
      });
    }

    return reply.status(201).send({
      owner: { id: user.id, name: user.name, email: user.email }
    });
  });

  // Remove a Landlord from the workspace
  fastify.delete('/:ownerId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, ownerId } = request.params as { workspaceId: string; ownerId: string };

    try {
      await prisma.workspaceMember.deleteMany({
        where: { userId: ownerId, workspaceId, role: 'LANDLORD' }
      });
      await prisma.property.updateMany({
        where: { workspaceId, ownerId },
        data: { ownerId: null }
      });
      return reply.send({ success: true });
    } catch (e) {
      return reply.status(404).send({ error: 'Owner not found' });
    }
  });
}
