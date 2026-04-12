import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
// import { RemitaService } from '../services/remita';
import { authenticate } from '../lib/middleware';

export default async function tenantProfileRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: 'User not found' });

    // Find the first workspace where this user is a TENANT
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId, role: 'TENANT' }
    });
    
    if (!membership) {
      return reply.status(200).send({ tenant: null }); // No tenant profile
    }

    const tenant = await prisma.tenant.findFirst({
      where: { 
        workspaceId: membership.workspaceId, 
        email: user.email,
        deletedAt: null 
      },
      include: {
        leases: {
          include: { 
            property: { select: { id: true, name: true, address: true } }
          },
          where: { status: 'ACTIVE' }
        },
        maintenanceRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!tenant) return reply.status(404).send({ error: 'Tenant profile not found' });

    return reply.send({ tenant });
  });

  // List maintenance requests for the authenticated tenant
  fastify.get('/maintenance', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: 'User not found' });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId, role: 'TENANT' }
    });
    if (!membership) return reply.status(403).send({ error: 'No tenant profile found' });

    const tenant = await prisma.tenant.findFirst({
      where: { workspaceId: membership.workspaceId, email: user.email, deletedAt: null }
    });
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    const { status } = request.query as { status?: string };

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        tenantId: tenant.id,
        workspaceId: membership.workspaceId,
        ...(status ? { status: status as any } : {})
      },
      include: {
        property: { select: { id: true, name: true, address: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ requests });
  });

  // Create a maintenance request for the authenticated tenant
  fastify.post('/maintenance', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: 'User not found' });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId, role: 'TENANT' }
    });
    if (!membership) return reply.status(403).send({ error: 'No tenant profile found' });

    const tenant = await prisma.tenant.findFirst({
      where: { workspaceId: membership.workspaceId, email: user.email, deletedAt: null }
    });
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    const { propertyId, description, imageUrl } = request.body as any;

    if (!propertyId || !description) {
      return reply.status(400).send({ error: 'Property ID and description are required' });
    }

    const maintenanceRequest = await prisma.maintenanceRequest.create({
      data: {
        tenantId: tenant.id,
        propertyId,
        workspaceId: membership.workspaceId,
        description,
        imageUrl,
        status: 'PENDING'
      }
    });

    return reply.status(201).send({ request: maintenanceRequest });
  });

  // List payments for the authenticated tenant
  fastify.get('/payments', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: 'User not found' });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId, role: 'TENANT' }
    });
    if (!membership) return reply.status(403).send({ error: 'No tenant profile found' });

    const tenant = await prisma.tenant.findFirst({
      where: { workspaceId: membership.workspaceId, email: user.email, deletedAt: null }
    });
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    const payments = await prisma.payment.findMany({
      where: {
        lease: {
          tenantId: tenant.id
        }
      },
      include: {
        lease: {
          include: {
            property: { select: { id: true, name: true, address: true } }
          }
        }
      },
      orderBy: { dueDate: 'desc' }
    });

    return reply.send({ payments });
  });

  // Create a payment for the authenticated tenant
  fastify.post('/payments', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: 'User not found' });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId, role: 'TENANT' }
    });
    if (!membership) return reply.status(403).send({ error: 'No tenant profile found' });

    const tenant = await prisma.tenant.findFirst({
      where: { workspaceId: membership.workspaceId, email: user.email, deletedAt: null }
    });
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    const { amount, leaseId, note } = request.body as any;

    if (!leaseId || !amount) {
      return reply.status(400).send({ error: 'Lease ID and amount are required' });
    }

    // Verify lease belongs to this tenant
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, tenantId: tenant.id },
      include: {
        property: {
          include: { workspace: true }
        }
      }
    });

    if (!lease) return reply.status(404).send({ error: 'Lease not found' });

    const workspace = lease.property.workspace;

    if (!workspace.bankCode || !workspace.accountNumber) {
      return reply.status(400).send({ error: 'Landlord has not configured a bank account for payouts. Please contact management.' });
    }

    // Generate unique order ID
    const orderId = `RENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      // Create pending payment record
      const payment = await prisma.payment.create({
        data: {
          leaseId,
          amount: parseFloat(amount),
          dueDate: new Date(),
          status: 'PENDING',
          note,
          transactionId: orderId
        }
      });

      /* 
      // Commenting out Remita integration for now
      // Call Remita to generate the RRR
      const remitaResponse = await RemitaService.generateSplitRRR({
        orderId,
        amount: payment.amount,
        payerName: user.name || 'Tenant',
        payerEmail: user.email,
        payerPhone: tenant.phone || '08000000000',
        description: note || `Rent Payment for ${lease.property.name}`,
        landlordBankCode: workspace.bankCode,
        landlordAccountNumber: workspace.accountNumber,
        platformFeePercentage: 2.0 // Configured 2% platform flat rate
      });

      // Remita Standard Checkout URL for this RRR
      const paymentUrl = `https://remitademo.net/remita/exapp/api/v1/send/api/echannelsvc/merchant/api/paymentinit/${remitaResponse.rrr}`;

      // Update the payment record with the generated RRR
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          rrr: remitaResponse.rrr,
          paymentUrl
        }
      });

      return reply.status(201).send({ paymentUrl, rrr: remitaResponse.rrr, paymentId: payment.id });
      */

      return reply.status(201).send({ message: 'Payment record created (Gateway Bypass)', paymentId: payment.id });

    } catch (e: any) {
      console.error('[Payment Sync Error]', e.message);
      return reply.status(500).send({ error: 'Failed to create payment record: ' + e.message });
    }
  });

  // Submit proof of manual payment
  fastify.post('/payments/:id/submit-proof', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId;
    const { id } = request.params as { id: string };
    const { proofUrl, note } = request.body as any;

    if (!proofUrl) {
      return reply.status(400).send({ error: 'Proof image URL (or Base64 string) is required' });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId, role: 'TENANT' }
    });
    if (!membership) return reply.status(403).send({ error: 'No tenant profile found' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: 'User not found' });

    const tenant = await prisma.tenant.findFirst({
      where: { workspaceId: membership.workspaceId, email: user.email, deletedAt: null }
    });
    if (!tenant) return reply.status(404).send({ error: 'Tenant profile not found' });

    try {
      const payment = await prisma.payment.findFirst({
        where: { id, lease: { tenantId: tenant.id } },
        include: { lease: { include: { property: { select: { workspaceId: true, name: true } } } } }
      });

      if (!payment) return reply.status(404).send({ error: 'Payment not found' });

      const updatedPayment = await prisma.payment.update({
        where: { id },
        data: {
          status: 'UNDER_REVIEW',
          proofUrl,
          ...(note ? { note } : {})
        }
      });

      // Notify all managers in this workspace
      const managers = await prisma.workspaceMember.findMany({
        where: { workspaceId: membership.workspaceId, role: 'PROPERTY_MANAGER' },
        select: { userId: true }
      });

      const notifications = managers.map((m: any) => ({
        userId: m.userId,
        title: 'Payment Proof Submitted',
        message: `Tenant has submitted proof of payment for ${payment.lease.property.name}.`,
        type: 'PAYMENT_SUBMITTED'
      }));

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }

      return reply.send({ success: true, payment: updatedPayment });
    } catch (error: any) {
      console.error('[SubmitProofError]', error);
      return reply.status(500).send({ error: 'Internal Server Error: ' + error.message });
    }
  });

}
