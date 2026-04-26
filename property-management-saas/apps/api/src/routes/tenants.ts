import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess, requireManager } from '../lib/middleware';
import { supabaseAdmin } from '../lib/supabase';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

export default async function tenantRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', verifyWorkspaceAccess);

  // List tenants with active lease info
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const tenants = await prisma.tenant.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        leases: {
          include: { 
            property: { select: { id: true, name: true } },
            unit: { select: { id: true, unitNumber: true, type: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return reply.send({ tenants });
  });

  // Get single tenant profile
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const tenant = await prisma.tenant.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        leases: {
          include: { 
            property: { select: { id: true, name: true, address: true } },
            unit: { select: { id: true, unitNumber: true, type: true } }
          },
          orderBy: { startDate: 'desc' }
        }
      }
    });
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });
    return reply.send({ tenant });
  });

  // Create tenant
  fastify.post('/', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { name, email, phone, password } = request.body as any;
    if (!name) return reply.status(400).send({ error: 'Tenant name is required' });

    // Subscription Limits and Tenant Creation in Transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Lock the workspace record to prevent race conditions on limit checks
      await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;

      const workspace = await tx.workspace.findUnique({ where: { id: workspaceId } });
      const plan = workspace?.plan || 'FREE';

      if (plan === 'FREE' || plan === 'PRO') {
        const tenantCount = await tx.tenant.count({
          where: { workspaceId, deletedAt: null }
        });
        const limit = plan === 'FREE' ? 3 : 50;
        if (tenantCount >= limit) {
          throw new Error(`LIMIT_REACHED:${limit}`);
        }
      }

      let supabaseUserId = null;
      let inviteLink = null;
      const tempPassword = password || randomBytes(12).toString('hex') + 'A!1';

      // If email is provided, create a Supabase Auth account for the mobile app
      if (email) {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email,
          options: { data: { name, role: 'TENANT', mustChangePassword: true }, redirectTo: 'https://justhob.vercel.app/login' }
        });

        const linkDataAny = linkData as any;
        if (linkError || !linkDataAny || !linkDataAny.properties?.action_link) {
          const authError = linkError || new Error('Failed to generate invite link');
          if (authError.message.includes('already') && authError.message.includes('registered')) {
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = listData.users.find(u => u.email === email);
            supabaseUserId = existingUser?.id || null;
            if (!supabaseUserId) {
              throw new Error('AUTH_ERR:Could not find existing account');
            }
          } else {
            throw new Error(`AUTH_ERR:${authError.message}`);
          }
        } else {
          supabaseUserId = linkDataAny.user.id;
          inviteLink = linkDataAny.properties.action_link;
        }

        // Actually set the temp password on the Supabase account so the tenant can log in
        if (supabaseUserId) {
          await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
            password: tempPassword,
            email_confirm: true
          });
        }

        if (supabaseUserId) {
          const existingDbUser = await tx.user.findUnique({ where: { email } });
          if (existingDbUser && existingDbUser.id !== supabaseUserId) {
            await tx.workspaceMember.deleteMany({ where: { userId: existingDbUser.id } });
            await tx.user.delete({ where: { id: existingDbUser.id } });
            await tx.user.create({ data: { id: supabaseUserId, email, name } });
          } else if (!existingDbUser) {
            await tx.user.create({ data: { id: supabaseUserId, email, name } });
          } else {
            await tx.user.update({ where: { id: supabaseUserId }, data: { email, name } });
          }

          await tx.workspaceMember.upsert({
            where: { userId_workspaceId: { userId: supabaseUserId, workspaceId } },
            update: { role: 'TENANT' },
            create: { userId: supabaseUserId, workspaceId, role: 'TENANT' }
          });
        }
      }

      const tenantId = supabaseUserId || undefined;
      const tenant = tenantId 
        ? await tx.tenant.upsert({
            where: { tenant_workspace_id: { id: tenantId, workspaceId } },
            update: { name, email, phone, workspaceId, deletedAt: null },
            create: { id: tenantId, name, email, phone, workspaceId }
          })
        : await tx.tenant.create({
            data: { name, email, phone, workspaceId }
          });

      return { tenant, tempPassword, inviteLink };
    }).catch((err: any) => {
      if (err.message?.startsWith('LIMIT_REACHED')) {
        const limit = err.message.split(':')[1];
        throw { statusCode: 402, message: `Plan limit reached: Maximum ${limit} tenants allowed. Please upgrade your plan.` };
      }
      if (err.message?.startsWith('AUTH_ERR:')) {
        throw { statusCode: 400, message: err.message.split(':')[1] };
      }
      throw err;
    });

    return reply.status(201).send({ 
      tenant: (result as any).tenant,
      credentials: email ? { email, tempPassword: (result as any).tempPassword, inviteLink: (result as any).inviteLink } : null
    });
  });

  // Update tenant
  fastify.put('/:id', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const { name, email, phone } = request.body as any;

    try {
      const tenant = await prisma.tenant.update({
        where: { tenant_workspace_id: { id, workspaceId } },
        data: { name, email, phone }
      });
      return reply.send({ tenant });
    } catch (e) {
      return reply.status(404).send({ error: 'Tenant not found' });
    }
  });

  // Delete tenant (full cleanup including Supabase Auth)
  fastify.delete('/:id', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    try {
      // Find the tenant first to get their details
      const tenant = await prisma.tenant.findUnique({
        where: { tenant_workspace_id: { id, workspaceId } }
      });
      if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

      // Clean up Supabase Auth user so the email can be reused
      try {
        await supabaseAdmin.auth.admin.deleteUser(id);
      } catch (_) { /* ignore */ }

      // Remove workspace membership and user record
      await prisma.workspaceMember.deleteMany({ where: { userId: id, workspaceId } });
      
      // Only delete User record if they aren't part of other workspaces
      const otherMemberships = await prisma.workspaceMember.count({ where: { userId: id } });
      if (otherMemberships === 0) {
        await prisma.user.delete({ where: { id } }).catch(() => {});
      }

      // Hard-delete the tenant record
      await prisma.tenant.delete({ where: { tenant_workspace_id: { id, workspaceId } } });
      
      return reply.send({ success: true });
    } catch (e) {
      return reply.status(404).send({ error: 'Tenant not found or could not be deleted' });
    }
  });

  // Assign tenant to property (create lease)
  fastify.post('/:id/leases', { preHandler: requireManager }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const { propertyId, unitId, startDate, endDate, yearlyRent } = request.body as any;

    if (!propertyId || !startDate) {
      return reply.status(400).send({ error: 'Property ID and start date are required' });
    }

    // Verify the property belongs to the same workspace
    const property = await prisma.property.findFirst({
      where: { id: propertyId, workspaceId, deletedAt: null }
    });
    if (!property) return reply.status(404).send({ error: 'Property not found in this workspace' });

    // If unitId is provided, verify it belongs to this property
    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, propertyId, workspaceId }
      });
      if (!unit) return reply.status(404).send({ error: 'Unit not found in this property' });
    }

    const lease = await prisma.lease.create({
      data: {
        tenantId: id,
        propertyId,
        unitId: unitId || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        yearlyRent: yearlyRent ? parseFloat(yearlyRent) : 0
      },
      include: { 
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } }
      }
    });

    // Update unit status to OCCUPIED if applicable
    if (unitId) {
      await prisma.unit.update({
        where: { id: unitId },
        data: { status: 'OCCUPIED' }
      });
    }

    return reply.status(201).send({ lease });
  });
}
