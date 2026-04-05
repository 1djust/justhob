import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess } from '../lib/middleware';
import { supabaseAdmin } from '../lib/supabase';

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
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { name, email, phone, password } = request.body as any;
    if (!name) return reply.status(400).send({ error: 'Tenant name is required' });

    let supabaseUserId = null;
    const tempPassword = password || 'JustHub123!';

    // If email is provided, create a Supabase Auth account for the mobile app
    if (email) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name, role: 'TENANT' }
      });

      if (authError) {
        // If user already exists in Supabase, we just link them
        if (authError.message.includes('already has been registered')) {
          const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
          const user = existingUser.users.find(u => u.email === email);
          supabaseUserId = user?.id;
        } else {
          return reply.status(400).send({ error: authError.message });
        }
      } else {
        supabaseUserId = authData.user.id;
      }

      // Also ensure they exist in the User table and WorkspaceMember table
      if (supabaseUserId) {
        await prisma.user.upsert({
          where: { id: supabaseUserId },
          update: { email, name },
          create: { id: supabaseUserId, email, name }
        });

        await prisma.workspaceMember.upsert({
          where: { userId_workspaceId: { userId: supabaseUserId, workspaceId } },
          update: { role: 'TENANT' },
          create: { userId: supabaseUserId, workspaceId, role: 'TENANT' }
        });
      }
    }

    const tenant = await prisma.tenant.create({
      data: { 
        id: supabaseUserId || undefined, // Use Supabase ID if available
        name, 
        email, 
        phone, 
        workspaceId 
      }
    });

    // Return credentials once so the manager can share them with the tenant
    return reply.status(201).send({ 
      tenant,
      credentials: email ? { email, tempPassword } : null
    });
  });

  // Update tenant
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    const { name, email, phone } = request.body as any;

    try {
      const tenant = await prisma.tenant.update({
        where: { id },
        data: { name, email, phone }
      });
      return reply.send({ tenant });
    } catch (e) {
      return reply.status(404).send({ error: 'Tenant not found' });
    }
  });

  // Delete tenant (full cleanup including Supabase Auth)
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, id } = request.params as { workspaceId: string; id: string };
    try {
      // Find the tenant first to get their details
      const tenant = await prisma.tenant.findFirst({
        where: { id, workspaceId }
      });
      if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

      // Clean up Supabase Auth user so the email can be reused
      try {
        await supabaseAdmin.auth.admin.deleteUser(id);
        console.log(`[Tenant Delete] Supabase Auth user ${id} removed`);
      } catch (authErr) {
        // If auth user doesn't exist, that's fine — continue cleanup
        console.log(`[Tenant Delete] No Supabase Auth user for ${id}, skipping`);
      }

      // Remove workspace membership
      try {
        await prisma.workspaceMember.deleteMany({
          where: { userId: id, workspaceId }
        });
      } catch (_) { /* ignore if not found */ }

      // Remove user record
      try {
        await prisma.user.delete({ where: { id } });
      } catch (_) { /* ignore if not found */ }

      // Hard-delete the tenant record so the ID/email is fully freed
      await prisma.tenant.delete({ where: { id } });

      console.log(`[Tenant Delete] Tenant ${tenant.name} (${tenant.email}) fully removed`);
      return reply.send({ success: true });
    } catch (e) {
      console.error('[Tenant Delete Error]', e);
      return reply.status(404).send({ error: 'Tenant not found or could not be deleted' });
    }
  });

  // Assign tenant to property (create lease)
  fastify.post('/:id/leases', async (request: FastifyRequest, reply: FastifyReply) => {
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
