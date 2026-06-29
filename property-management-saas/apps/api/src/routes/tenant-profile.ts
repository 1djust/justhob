import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
// import { RemitaService } from '../services/remita';
import { authenticate } from "../lib/middleware";
import { Prisma } from "@prisma/client";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const DashboardQuery = Type.Object({ status: Type.Optional(Type.String()) });
const MaintenanceBody = Type.Object({
  propertyId: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  imageUrl: Type.Optional(Type.String()),
});
const PaymentBody = Type.Object({
  amount: Type.Optional(Type.Union([Type.String(), Type.Number()])),
  amountPaid: Type.Optional(Type.Union([Type.String(), Type.Number()])),
  promiseDate: Type.Optional(Type.String()),
  leaseId: Type.Optional(Type.String()),
  note: Type.Optional(Type.String()),
});
const SubmitProofParams = Type.Object({ id: Type.String() });
const SubmitProofBody = Type.Object({
  proofUrl: Type.Optional(Type.String()),
  note: Type.Optional(Type.String()),
  amountPaid: Type.Optional(Type.Union([Type.String(), Type.Number()])),
  promiseDate: Type.Optional(Type.String()),
});
const RequestPaymentPlanBody = Type.Object({
  proposal: Type.String(),
});
const MaintenanceIdParams = Type.Object({ id: Type.String() });
const MessageBody = Type.Object({ content: Type.Optional(Type.String()) });
const OfferParams = Type.Object({
  leaseId: Type.String(),
  offerId: Type.String(),
});
const OfferBody = Type.Object({ accept: Type.Boolean() });

const LeaseIdParams = Type.Object({ leaseId: Type.String() });
const ApproveLeaseBody = Type.Object({ signatureUrl: Type.String() });
const RejectLeaseBody = Type.Object({ reason: Type.String() });

export default async function tenantProfileRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);

  server.get("/dashboard", { schema: {} }, async (request, reply) => {
    const userId = request.userId!;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: "User not found" });

    // Find the first workspace where this user is a TENANT
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId, role: "TENANT" },
    });

    if (!membership) {
      return reply.status(200).send({ tenant: null }); // No tenant profile
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        workspaceId: membership.workspaceId,
        email: user.email,
        deletedAt: null,
      },
      include: {
        workspace: { select: { allowPartialPayments: true } },
        leases: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                address: true,
                owner: { select: { id: true, name: true, email: true } },
              },
            },
            renewalOffers: {
              where: { status: "PENDING" },
              orderBy: { sentAt: "desc" },
            },
          },
          where: {
            status: {
              in: [
                "ACTIVE",
                "PENDING_RENEWAL",
                "PENDING_SIGNATURE",
                "REJECTED",
                "PENDING_LEGAL_UPLOAD",
                "PENDING_LEGAL_VERIFICATION",
              ],
            },
            NOT: {
              legalLeaseRequest: {
                status: "REJECTED",
              },
            },
          },
        },
        maintenanceRequests: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!tenant)
      return reply.status(404).send({ error: "Tenant profile not found" });

    // For each lease, look up the landlord's bank info from WorkspaceMember
    const leasesWithPaymentInfo = await Promise.all(
      (tenant.leases || []).map(async (lease) => {
        let paymentInfo = null;
        if (lease.property?.owner?.id) {
          const member = await prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: lease.property.owner.id,
                workspaceId: membership.workspaceId,
              },
            },
            select: {
              payoutStrategy: true,
              bankCode: true,
              accountNumber: true,
              accountName: true,
            },
          });
          if (member) {
            paymentInfo = {
              payoutStrategy: member.payoutStrategy,
              bankCode: member.bankCode,
              accountNumber: member.accountNumber,
              accountName: member.accountName,
            };
          }
        }
        return {
          ...lease,
          paymentInfo,
        };
      }),
    );

    const globalAllow = tenant.workspace?.allowPartialPayments ?? true;
    const effectiveAllowPartialPayments =
      globalAllow || tenant.allowPartialPayments === true;

    return reply.send({
      tenant: {
        ...tenant,
        allowPartialPayments: effectiveAllowPartialPayments,
        leases: leasesWithPaymentInfo,
      },
    });
  });

  // List maintenance requests for the authenticated tenant
  server.get<{ Querystring: Static<typeof DashboardQuery> }>(
    "/maintenance",
    {
      schema: { querystring: DashboardQuery },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.status(401).send({ error: "User not found" });

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: "TENANT" },
      });
      if (!membership)
        return reply.status(403).send({ error: "No tenant profile found" });

      const tenant = await prisma.tenant.findFirst({
        where: {
          workspaceId: membership.workspaceId,
          email: user.email,
          deletedAt: null,
        },
      });
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const { status } = request.query;

      const requests = await prisma.maintenanceRequest.findMany({
        where: {
          tenantId: tenant.id,
          workspaceId: membership.workspaceId,
          ...(status
            ? { status: status as import("@prisma/client").MaintenanceStatus }
            : {}),
        },
        include: {
          property: { select: { id: true, name: true, address: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ requests });
    },
  );

  // Create a maintenance request for the authenticated tenant
  server.post<{ Body: Static<typeof MaintenanceBody> }>(
    "/maintenance",
    {
      schema: { body: MaintenanceBody },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.status(401).send({ error: "User not found" });

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: "TENANT" },
      });
      if (!membership)
        return reply.status(403).send({ error: "No tenant profile found" });

      const tenant = await prisma.tenant.findFirst({
        where: {
          workspaceId: membership.workspaceId,
          email: user.email,
          deletedAt: null,
        },
      });
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const { propertyId, description, imageUrl } = request.body;

      if (!propertyId || !description) {
        return reply
          .status(400)
          .send({ error: "Property ID and description are required" });
      }

      const maintenanceRequest = await prisma
        .$transaction(async (tx: Prisma.TransactionClient) => {
          // Lock the workspace record to prevent race conditions on limit checks
          await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${membership.workspaceId} FOR UPDATE`;

          const workspace = await tx.workspace.findUnique({
            where: { id: membership.workspaceId },
          });
          if (workspace?.plan === "FREE") {
            const activeCount = await tx.maintenanceRequest.count({
              where: {
                workspaceId: membership.workspaceId,
                status: { in: ["PENDING", "IN_PROGRESS"] },
              },
            });

            if (activeCount >= 3) {
              throw new Error("LIMIT_MAINTENANCE");
            }
          }

          return await tx.maintenanceRequest.create({
            data: {
              tenantId: tenant.id,
              propertyId,
              workspaceId: membership.workspaceId,
              description,
              imageUrl,
              status: "PENDING",
            },
          });
        })
        .catch((err: unknown) => {
          if ((err as Error).message === "LIMIT_MAINTENANCE") {
            throw {
              statusCode: 402,
              message:
                "Free plan limit reached: Maximum 3 active maintenance tickets allowed. Please upgrade your plan.",
            };
          }
          throw err;
        });

      // Emit real-time update to the workspace room
      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${membership.workspaceId}`)
        .emit("MAINTENANCE_CREATED", {
          requestId: maintenanceRequest.id,
          propertyId,
          message: "A new maintenance request has been submitted.",
        });

      // Notify all managers in this workspace persistently
      const managers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: membership.workspaceId,
          role: "PROPERTY_MANAGER",
        },
        select: { userId: true },
      });

      const notifications = managers.map((m) => ({
        userId: m.userId,
        title: "New Maintenance Request",
        message: `A new maintenance request has been submitted.`,
        type: "MAINTENANCE_CREATED",
      }));

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }

      return reply.status(201).send({ request: maintenanceRequest });
    },
  );

  // List payments for the authenticated tenant
  server.get("/payments", { schema: {} }, async (request, reply) => {
    const userId = request.userId!;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(401).send({ error: "User not found" });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId, role: "TENANT" },
    });
    if (!membership)
      return reply.status(403).send({ error: "No tenant profile found" });

    const tenant = await prisma.tenant.findFirst({
      where: {
        workspaceId: membership.workspaceId,
        email: user.email,
        deletedAt: null,
      },
    });
    if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

    const payments = await prisma.payment.findMany({
      where: {
        lease: {
          tenantId: tenant.id,
        },
      },
      include: {
        lease: {
          include: {
            property: { select: { id: true, name: true, address: true } },
          },
        },
        transactions: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { dueDate: "desc" },
    });

    return reply.send({ payments });
  });

  // Create a payment for the authenticated tenant
  server.post<{ Body: Static<typeof PaymentBody> }>(
    "/payments",
    {
      schema: { body: PaymentBody },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.status(401).send({ error: "User not found" });

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: "TENANT" },
      });
      if (!membership)
        return reply.status(403).send({ error: "No tenant profile found" });

      const tenant = await prisma.tenant.findFirst({
        where: {
          workspaceId: membership.workspaceId,
          email: user.email,
          deletedAt: null,
        },
      });
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const { amount, amountPaid, promiseDate, leaseId, note } = request.body;

      if (!leaseId || !amount) {
        return reply
          .status(400)
          .send({ error: "Lease ID and amount are required" });
      }

      // Verify lease belongs to this tenant
      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, tenantId: tenant.id },
        include: {
          property: { select: { id: true, name: true } },
        },
      });

      if (!lease) return reply.status(404).send({ error: "Lease not found" });

      // Note: Bank details check removed — not needed for proof-of-payment flow.
      // Will be re-enabled when Remita gateway integration goes live.

      // Generate unique order ID
      const orderId = `RENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      try {
        // Enforce limits and create payment record
        const workspace = await prisma.workspace.findUnique({
          where: { id: membership.workspaceId },
        });

        if (amountPaid && Number(amountPaid) < Number(amount)) {
          const globalAllow = workspace?.allowPartialPayments ?? true;
          const canPartial =
            globalAllow || tenant.allowPartialPayments === true;
          if (!canPartial) {
            return reply.status(403).send({
              error: "Partial payments are not enabled for this account",
            });
          }
          if (!promiseDate) {
            return reply
              .status(400)
              .send({ error: "Promise date is required for partial payments" });
          }
        }

        if (workspace?.plan === "FREE") {
          const startOfMonth = new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          );
          const paymentCount = await prisma.payment.count({
            where: {
              workspaceId: membership.workspaceId,
              createdAt: { gte: startOfMonth },
            },
          });

          if (paymentCount >= 5) {
            throw {
              statusCode: 402,
              message: "Free plan limit reached: Maximum 5 invoices per month.",
            };
          }
        }

        const payment = await prisma.payment.create({
          data: {
            leaseId,
            workspaceId: membership.workspaceId,
            amount: Number(amount),
            balancePromise: promiseDate ? new Date(promiseDate) : null,
            dueDate: new Date(),
            status: "PENDING",
            note,
            transactionId: orderId,
          },
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

        return reply.status(201).send({
          message: "Payment record created (Gateway Bypass)",
          paymentId: payment.id,
        });
      } catch (e: unknown) {
        const errorMsg = (e as Error).message;
        request.log.error({ err: errorMsg }, "[Payment Sync Error]");
        return reply
          .status(500)
          .send({ error: "Failed to create payment record: " + errorMsg });
      }
    },
  );

  // Submit proof of manual payment
  server.post<{
    Params: Static<typeof SubmitProofParams>;
    Body: Static<typeof SubmitProofBody>;
  }>(
    "/payments/:id/submit-proof",
    {
      schema: { params: SubmitProofParams, body: SubmitProofBody },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const { proofUrl, note, amountPaid, promiseDate } = request.body;

      if (!proofUrl) {
        return reply
          .status(400)
          .send({ error: "Proof image URL (or Base64 string) is required" });
      }

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: "TENANT" },
      });
      if (!membership)
        return reply.status(403).send({ error: "No tenant profile found" });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.status(401).send({ error: "User not found" });

      const tenant = await prisma.tenant.findFirst({
        where: {
          workspaceId: membership.workspaceId,
          email: user.email,
          deletedAt: null,
        },
      });
      if (!tenant)
        return reply.status(404).send({ error: "Tenant profile not found" });

      try {
        const payment = await prisma.payment.findFirst({
          where: { id, lease: { tenantId: tenant.id } },
          include: {
            lease: {
              include: {
                property: { select: { workspaceId: true, name: true } },
              },
            },
          },
        });

        if (!payment)
          return reply.status(404).send({ error: "Payment not found" });

        const updatedPayment = await prisma.payment.update({
          where: { id },
          data: {
            status: "UNDER_REVIEW",
            proofUrl,
            ...(note ? { note } : {}),
            ...(promiseDate ? { balancePromise: new Date(promiseDate) } : {}),
          },
        });

        // Record the claimed amount as a PENDING transaction
        await prisma.paymentTransaction.create({
          data: {
            paymentId: id,
            amount:
              amountPaid !== undefined && amountPaid !== null
                ? Number(amountPaid)
                : payment.amount - (payment.amountPaid || 0),
            status: "PENDING",
            proofUrl,
            note: note || "Proof of payment submitted",
          },
        });

        // Notify all managers in this workspace
        const managers = await prisma.workspaceMember.findMany({
          where: {
            workspaceId: membership.workspaceId,
            role: "PROPERTY_MANAGER",
          },
          select: { userId: true },
        });

        const notifications = managers.map((m) => ({
          userId: m.userId,
          title: "Payment Proof Submitted",
          message: `Tenant has submitted proof of payment for ${payment.lease.property.name}.`,
          type: "PAYMENT_SUBMITTED",
        }));

        if (notifications.length > 0) {
          await prisma.notification.createMany({ data: notifications });
        }

        // Emit real-time update to the workspace room
        (fastify as unknown as { io: import("socket.io").Server }).io
          .to(`workspace:${membership.workspaceId}`)
          .emit("PAYMENT_UPDATED", {
            paymentId: id,
            status: "UNDER_REVIEW",
            message: "A tenant has submitted proof of payment.",
          });

        return reply.send({ success: true, payment: updatedPayment });
      } catch (error: unknown) {
        const errorMsg = (error as Error).message;
        request.log.error({ err: errorMsg }, "[SubmitProofError]");
        return reply
          .status(500)
          .send({ error: "Internal Server Error: " + errorMsg });
      }
    },
  );

  // Request Payment Plan
  server.post<{
    Params: Static<typeof SubmitProofParams>;
    Body: Static<typeof RequestPaymentPlanBody>;
  }>(
    "/payments/:id/request-payment-plan",
    {
      schema: { params: SubmitProofParams, body: RequestPaymentPlanBody },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const { proposal } = request.body;

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: "TENANT" },
      });
      if (!membership)
        return reply.status(403).send({ error: "No tenant profile found" });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.status(401).send({ error: "User not found" });

      const tenant = await prisma.tenant.findFirst({
        where: {
          workspaceId: membership.workspaceId,
          email: user.email,
          deletedAt: null,
        },
      });
      if (!tenant)
        return reply.status(404).send({ error: "Tenant profile not found" });

      try {
        const payment = await prisma.payment.findFirst({
          where: { id, lease: { tenantId: tenant.id } },
          include: {
            lease: {
              include: {
                property: { select: { workspaceId: true, name: true } },
              },
            },
          },
        });

        if (!payment)
          return reply.status(404).send({ error: "Payment not found" });

        const updatedPayment = await prisma.payment.update({
          where: { id },
          data: {
            paymentPlanRequested: true,
            paymentPlanStatus: "PENDING",
            balanceNote: proposal,
          },
        });

        // Notify property manager
        const managers = await prisma.workspaceMember.findMany({
          where: {
            workspaceId: membership.workspaceId,
            role: "PROPERTY_MANAGER",
          },
          include: { user: true },
        });
        for (const manager of managers) {
          if (manager.userId) {
            const notif = await prisma.notification.create({
              data: {
                userId: manager.userId,
                title: "Payment Plan Requested",
                message: `Tenant ${tenant.name} requested a payment plan for ${payment.lease.property.name}.`,
                type: "PAYMENT_PLAN_REQUEST",
              },
            });
            (fastify as any).io
              ?.to(`user:${manager.userId}`)
              .emit("NOTIFICATION_CREATED", notif);
          }
        }

        return reply.send({
          message: "Payment plan requested",
          payment: updatedPayment,
        });
      } catch (e: unknown) {
        const errorMsg = (e as Error).message;
        return reply
          .status(500)
          .send({ error: "Failed to request payment plan: " + errorMsg });
      }
    },
  );

  // Get maintenance request conversation history for the authenticated tenant
  server.get<{ Params: Static<typeof MaintenanceIdParams> }>(
    "/maintenance/:id/messages",
    {
      schema: { params: MaintenanceIdParams },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: "TENANT" },
      });
      if (!membership)
        return reply.status(403).send({ error: "No tenant profile found" });

      const messages = await prisma.maintenanceMessage.findMany({
        where: {
          requestId: id,
          workspaceId: membership.workspaceId,
        },
        include: {
          sender: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return reply.send({ messages });
    },
  );

  // Send a message in a maintenance request for the authenticated tenant
  server.post<{
    Params: Static<typeof MaintenanceIdParams>;
    Body: Static<typeof MessageBody>;
  }>(
    "/maintenance/:id/messages",
    {
      schema: { params: MaintenanceIdParams, body: MessageBody },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const { content } = request.body;

      if (!content)
        return reply.status(400).send({ error: "Message content is required" });

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: "TENANT" },
      });
      if (!membership)
        return reply.status(403).send({ error: "No tenant profile found" });

      const message = await prisma.maintenanceMessage.create({
        data: {
          content,
          requestId: id,
          workspaceId: membership.workspaceId,
          senderId: userId,
          type: "USER",
        },
        include: {
          sender: {
            select: { id: true, name: true },
          },
        },
      });

      // Broadcast to the maintenance room
      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`maintenance:${id}`)
        .emit("maintenance-message", message);

      // Notify the workspace (managers) for unread badges
      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${membership.workspaceId}`)
        .emit("maintenance-notification", {
          requestId: id,
          message: content,
        });

      return reply.status(201).send({ message });
    },
  );

  // Respond to lease renewal offer
  server.put<{
    Params: Static<typeof OfferParams>;
    Body: Static<typeof OfferBody>;
  }>(
    "/leases/:leaseId/renewal-offers/:offerId/respond",
    {
      schema: { params: OfferParams, body: OfferBody },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { leaseId, offerId } = request.params;
      const { accept } = request.body;

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: "TENANT" },
      });
      if (!membership)
        return reply.status(403).send({ error: "No tenant profile found" });

      const tenant = await prisma.tenant.findFirst({
        where: {
          workspaceId: membership.workspaceId,
          deletedAt: null,
          leases: { some: { id: leaseId } },
        },
      });
      if (!tenant)
        return reply.status(404).send({ error: "Tenant or lease not found" });

      const offer = await prisma.leaseRenewalOffer.findUnique({
        where: { id: offerId },
        include: { lease: { include: { tenant: true } } },
      });

      if (!offer || offer.leaseId !== leaseId) {
        return reply.status(404).send({ error: "Offer not found" });
      }

      if (offer.status !== "PENDING") {
        return reply
          .status(400)
          .send({ error: "Offer has already been responded to" });
      }

      const updatedOffer = await prisma.leaseRenewalOffer.update({
        where: { id: offerId },
        data: {
          status: accept ? "ACCEPTED" : "REJECTED",
          respondedAt: new Date(),
        },
      });

      if (accept) {
        const newLease = await prisma.lease.create({
          data: {
            tenantId: offer.lease.tenantId,
            propertyId: offer.lease.propertyId,
            unitId: offer.lease.unitId,
            startDate: offer.newStartDate,
            endDate: offer.newEndDate,
            yearlyRent: offer.newRent,
            status: "ACTIVE",
          },
        });

        await prisma.lease.update({
          where: { id: offer.lease.id },
          data: { status: "EXPIRED" },
        });

        // Create notifications for managers
        const managers = await prisma.workspaceMember.findMany({
          where: {
            workspaceId: membership.workspaceId,
            role: { in: ["PROPERTY_MANAGER", "LANDLORD"] },
          },
        });
        for (const m of managers) {
          await prisma.notification.create({
            data: {
              userId: m.userId,
              title: "Lease Renewal Accepted",
              message: `Tenant ${offer.lease.tenant.name} accepted the lease renewal offer.`,
              type: "LEASE_RENEWED",
            },
          });
        }

        const room = `workspace:${membership.workspaceId}`;
        console.log(`[TenantProfile] Emitting LEASE_RENEWED to ${room}`);
        (fastify as unknown as { io: import("socket.io").Server }).io
          .to(room)
          .emit("LEASE_RENEWED", {
            leaseId: newLease.id,
            message: `Tenant ${offer.lease.tenant.name} accepted the lease renewal offer.`,
          });
      } else {
        const otherPendingOffers = await prisma.leaseRenewalOffer.count({
          where: {
            leaseId: offer.lease.id,
            status: "PENDING",
            id: { not: offerId },
          },
        });

        if (otherPendingOffers === 0) {
          await prisma.lease.update({
            where: { id: offer.lease.id },
            data: { status: "ACTIVE" },
          });
        }

        // Create notifications for managers
        const managers = await prisma.workspaceMember.findMany({
          where: {
            workspaceId: membership.workspaceId,
            role: { in: ["PROPERTY_MANAGER", "LANDLORD"] },
          },
        });
        for (const m of managers) {
          await prisma.notification.create({
            data: {
              userId: m.userId,
              title: "Lease Renewal Rejected",
              message: `Tenant ${offer.lease.tenant.name} rejected the lease renewal offer.`,
              type: "LEASE_RENEWAL_REJECTED",
            },
          });
        }

        const room = `workspace:${membership.workspaceId}`;
        console.log(
          `[TenantProfile] Emitting LEASE_RENEWAL_REJECTED to ${room}`,
        );
        (fastify as unknown as { io: import("socket.io").Server }).io
          .to(room)
          .emit("LEASE_RENEWAL_REJECTED", {
            leaseId: offer.lease.id,
            message: `Tenant ${offer.lease.tenant.name} rejected the lease renewal offer.`,
          });
      }

      return reply.send({ offer: updatedOffer });
    },
  );

  // Approve lease agreement
  server.post<{
    Params: Static<typeof LeaseIdParams>;
    Body: Static<typeof ApproveLeaseBody>;
  }>(
    "/leases/:leaseId/approve",
    {
      schema: { params: LeaseIdParams, body: ApproveLeaseBody },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { leaseId } = request.params;
      const { signatureUrl } = request.body;

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: "TENANT" },
      });
      if (!membership)
        return reply.status(403).send({ error: "No tenant profile found" });

      const tenant = await prisma.tenant.findFirst({
        where: {
          workspaceId: membership.workspaceId,
          deletedAt: null,
          leases: { some: { id: leaseId } },
        },
      });
      if (!tenant)
        return reply.status(404).send({ error: "Tenant or lease not found" });

      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, tenantId: tenant.id },
      });
      if (!lease) {
        return reply.status(404).send({ error: "Lease not found" });
      }

      const updatedLease = await prisma.lease.update({
        where: { id: leaseId },
        data: {
          status: "ACTIVE",
          signatureUrl,
          rejectionReason: null,
        },
      });

      // Update unit status to OCCUPIED if unitId exists on the lease
      if (lease.unitId) {
        await prisma.unit.update({
          where: { id: lease.unitId },
          data: { status: "OCCUPIED" },
        });
      }

      // Create notifications for managers
      const managers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: membership.workspaceId,
          role: { in: ["PROPERTY_MANAGER", "LANDLORD"] },
        },
      });
      for (const m of managers) {
        await prisma.notification.create({
          data: {
            userId: m.userId,
            title: "Lease Agreement Signed",
            message: `Tenant ${tenant.name} has signed the lease agreement.`,
            type: "LEASE_RENEWED",
          },
        });
      }

      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${membership.workspaceId}`)
        .emit("LEASE_UPDATED", {
          leaseId,
          message: "Lease status changed",
        });

      return reply.send({ success: true, lease: updatedLease });
    },
  );

  // Reject lease agreement
  server.post<{
    Params: Static<typeof LeaseIdParams>;
    Body: Static<typeof RejectLeaseBody>;
  }>(
    "/leases/:leaseId/reject",
    {
      schema: { params: LeaseIdParams, body: RejectLeaseBody },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { leaseId } = request.params;
      const { reason } = request.body;

      const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: "TENANT" },
      });
      if (!membership)
        return reply.status(403).send({ error: "No tenant profile found" });

      const tenant = await prisma.tenant.findFirst({
        where: {
          workspaceId: membership.workspaceId,
          deletedAt: null,
          leases: { some: { id: leaseId } },
        },
      });
      if (!tenant)
        return reply.status(404).send({ error: "Tenant or lease not found" });

      const updatedLease = await prisma.lease.update({
        where: { id: leaseId },
        data: {
          status: "REJECTED",
          rejectionReason: reason,
        },
      });

      // Create notifications for managers
      const managers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: membership.workspaceId,
          role: { in: ["PROPERTY_MANAGER", "LANDLORD"] },
        },
      });
      for (const m of managers) {
        await prisma.notification.create({
          data: {
            userId: m.userId,
            title: "Lease Agreement Rejected",
            message: `Tenant ${tenant.name} has rejected the lease agreement. Reason: ${reason}`,
            type: "LEASE_RENEWAL_REJECTED",
          },
        });
      }

      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${membership.workspaceId}`)
        .emit("LEASE_UPDATED", {
          leaseId,
          message: "Lease status changed",
        });

      return reply.send({ success: true, lease: updatedLease });
    },
  );
}
