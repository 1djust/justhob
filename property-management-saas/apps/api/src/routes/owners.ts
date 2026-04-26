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
  fastify.post('/', { preHandler: verifyPropertyManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { name, email, password } = request.body as { name: string; email: string; password?: string };

    if (!name || !email) {
      return reply.status(400).send({ error: 'Name and email are required' });
    }

    try {
      // Limit enforcement logic
      const result = await prisma.$transaction(async (tx: any) => {
        // 1. Get workspace and lock it
        const workspace = await tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { id: true, plan: true }
        });

        if (!workspace) throw new Error('Workspace not found');

        // 2. Count current owners (LANDLORD role)
        const ownerCount = await tx.workspaceMember.count({
          where: { workspaceId, role: 'LANDLORD' }
        });

        if (workspace.plan === 'FREE' && ownerCount >= 1) {
          throw new Error('Owner limit reached for Free Plan. Maximum 1 owner allowed.');
        }

        if (workspace.plan === 'PRO' && ownerCount >= 3) {
          throw new Error('Owner limit reached for Pro Plan. Maximum 3 owners allowed.');
        }

        let user = await tx.user.findUnique({ where: { email } });
        if (user) {
          const existingMember = await tx.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId } }
          });
          
          if (existingMember) {
            throw new Error('User is already a member of this workspace');
          }
          
          const { payoutStrategy, bankCode, accountNumber, accountName } = request.body as any;

          const member = await tx.workspaceMember.create({
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
          return { user, member };
        }

        return { user: null, limitReached: false };
      });

      let user = result.user;
      let inviteLink = null;

      if (!user) {
        // User doesn't exist, need to create in Supabase then Prisma
        // Note: We do this outside the transaction to avoid long locks during network calls
        const tempPassword = password || 'TempPass123!';
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email,
          data: { name }
        });

        if (linkError || !linkData || !linkData.properties?.action_link) {
          return reply.status(400).send({ error: linkError?.message || 'Failed to generate invite link' });
        }

        user = await prisma.user.create({
          data: { id: linkData.user.id, email, name }
        });

        inviteLink = linkData.properties.action_link;

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
        owner: { id: user.id, name: user.name, email: user.email },
        inviteLink: inviteLink || null
      });
    } catch (error: any) {
      if (error.message && error.message.includes('Owner limit reached')) {
        return reply.status(402).send({ error: error.message });
      }
      return reply.status(500).send(error);
    }
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
