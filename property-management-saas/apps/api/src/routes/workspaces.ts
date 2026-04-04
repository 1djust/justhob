import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate } from '../lib/middleware';

export default async function workspaceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Get all workspaces for the current user
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const workspaces = await prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true }
    });
    return reply.send({ workspaces });
  });

  // Create a new workspace (Current user becomes PROPERTY_MANAGER)
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { name } = request.body as { name: string };
    
    if (!name) return reply.status(400).send({ error: 'Workspace name is required' });

    // Ensure the default "Monthly" rent mapping doesn't conflict during workspace creation
    const workspace = await prisma.workspace.create({
      data: {
        name,
        members: {
          create: {
            userId,
            role: 'PROPERTY_MANAGER'
          }
        }
      }
    });

    return reply.status(201).send({ workspace });
  });

  // Update a workspace (e.g. Bank Payout Details)
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { bankCode, accountNumber, accountName } = request.body as any;

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId, role: 'PROPERTY_MANAGER' }
    });

    if (!membership) return reply.status(403).send({ error: 'Only owners can update workspace settings' });

    const workspace = await prisma.workspace.update({
      where: { id },
      data: {
        bankCode,
        accountNumber,
        accountName
      }
    });

    return reply.send({ workspace });
  });

  // Join a workspace (as TENANT)
  fastify.post('/:workspaceId/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { workspaceId } = request.params as { workspaceId: string };

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return reply.status(404).send({ error: 'Workspace not found' });

    const existingMember = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } }
    });

    if (existingMember) {
      return reply.status(400).send({ error: 'Already a member' });
    }

    const member = await prisma.workspaceMember.create({
      data: {
        userId,
        workspaceId,
        role: 'TENANT'
      }
    });

    return reply.status(201).send({ member });
  });

  // Get workspace stats
  fastify.get('/:workspaceId/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { workspaceId } = request.params as { workspaceId: string };

    const member = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } }
    });
    if (!member) return reply.status(403).send({ error: 'Forbidden' });

    let propertyWhere: any = { workspaceId };
    if (member.role === 'LANDLORD') {
      propertyWhere.ownerId = userId;
    }

    const totalProperties = await prisma.property.count({ where: propertyWhere });
    
    let tenantWhere: any = { workspaceId, deletedAt: null };
    if (member.role === 'LANDLORD') {
      // Find tenants that have leases in this landlord's properties
      tenantWhere.leases = { some: { property: { ownerId: userId } } };
    }
    const totalTenants = await prisma.tenant.count({ where: tenantWhere });
    
    let maintenanceWhere: any = { workspaceId, status: 'PENDING' };
    if (member.role === 'LANDLORD') {
      maintenanceWhere.property = { ownerId: userId };
    }
    const pendingMaintenance = await prisma.maintenanceRequest.count({ where: maintenanceWhere });

    let paymentWhere: any = {
      status: 'PAID',
      lease: { property: { workspaceId } }
    };
    if (member.role === 'LANDLORD') {
      paymentWhere.lease.property.ownerId = userId;
    }
    
    const paidPayments = await prisma.payment.findMany({
      where: paymentWhere,
      select: { amount: true, paidDate: true }
    });

    const rentCollected = paidPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

    // Simple revenue chart data: last 6 months
    const revenueByMonth: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.toLocaleString('default', { month: 'short' });
      revenueByMonth[month] = 0;
    }

    paidPayments.forEach((p: any) => {
      if (p.paidDate) {
        const month = new Date(p.paidDate).toLocaleString('default', { month: 'short' });
        if (revenueByMonth[month] !== undefined) {
          revenueByMonth[month] += p.amount;
        }
      }
    });

    const chartData = Object.keys(revenueByMonth).map(month => ({
      name: month,
      revenue: revenueByMonth[month]
    }));

    return reply.send({
      stats: {
        totalProperties,
        totalTenants,
        rentCollected,
        pendingMaintenance
      },
      chartData
    });
  });
}
