import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import {
  authenticate,
  verifyWorkspaceAccess,
  requireManager,
} from "../lib/middleware";
import { logAction } from "../lib/audit";
import { Prisma, PaymentStatus } from "@prisma/client";
import { generateReceiptPDF } from "../lib/pdf";
import { sendEmail } from "../lib/mailer";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { paymentsCache, clearWorkspaceCache, CACHE_TTL } from "../lib/cache";

const WorkspaceParams = Type.Object({ workspaceId: Type.String() });
const WorkspaceQuery = Type.Object({
  status: Type.Optional(Type.String()),
  page: Type.Optional(Type.String()),
  limit: Type.Optional(Type.String()),
});
const RecordPaymentBody = Type.Object({
  leaseId: Type.String(),
  amount: Type.Union([Type.String(), Type.Number()]),
  dueDate: Type.String(),
  paidDate: Type.Optional(Type.String()),
  status: Type.Optional(Type.Enum(PaymentStatus)),
  note: Type.Optional(Type.String()),
});

const PayPaymentBody = Type.Object({
  approvedAmountPaid: Type.Optional(Type.Number()),
});
const PaymentIdParams = Type.Object({
  workspaceId: Type.String(),
  id: Type.String(),
});
const LeaseIdParams = Type.Object({
  workspaceId: Type.String(),
  leaseId: Type.String(),
});
const PartialPayBody = Type.Object({
  amountPaid: Type.Union([Type.String(), Type.Number()]),
  balancePromise: Type.Optional(Type.String()),
  balanceNote: Type.Optional(Type.String()),
});
const ReviewPaymentBody = Type.Object({
  status: Type.Optional(Type.String()),
  rejectionReason: Type.Optional(Type.String()),
  approvedAmountPaid: Type.Optional(Type.Number()),
});

export default async function paymentRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", verifyWorkspaceAccess);

  // List all payments for a workspace (across all leases)
  server.get<{
    Params: Static<typeof WorkspaceParams>;
    Querystring: Static<typeof WorkspaceQuery>;
  }>(
    "/",
    {
      schema: { params: WorkspaceParams, querystring: WorkspaceQuery },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { status, page = "1", limit = "20" } = request.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const userId = request.userId!;
      const cacheKey = `${userId}:${workspaceId}:${status || "ALL"}:${pageNum}:${limitNum}`;
      const now = Date.now();
      const cached = paymentsCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return reply.send(cached.response);
      }

      const whereClause = {
        OR: [{ workspaceId }, { lease: { tenant: { workspaceId } } }],
        ...(status
          ? { status: status as import("@prisma/client").PaymentStatus }
          : {}),
      };

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where: whereClause,
          include: {
            lease: {
              include: {
                tenant: { select: { id: true, name: true } },
                property: { select: { id: true, name: true } },
              },
            },
            transactions: { orderBy: { paidDate: "desc" } },
          },
          orderBy: { dueDate: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.payment.count({ where: whereClause }),
      ]);

      const responseBody = {
        payments,
        pagination: {
          total,
          page: pageNum,
          pageSize: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      };

      paymentsCache.set(cacheKey, {
        response: responseBody,
        expiresAt: Date.now() + CACHE_TTL,
      });

      return reply.send(responseBody);
    },
  );

  // Record a payment for a specific lease
  server.post<{
    Params: Static<typeof WorkspaceParams>;
    Body: Static<typeof RecordPaymentBody>;
  }>(
    "/",
    {
      preHandler: requireManager,
      schema: { params: WorkspaceParams, body: RecordPaymentBody },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { leaseId, amount, dueDate, paidDate, status, note } = request.body;

      if (!leaseId || !amount || !dueDate) {
        return reply
          .status(400)
          .send({ error: "Lease ID, amount, and due date are required" });
      }

      // Verify lease belongs to this workspace
      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, tenant: { workspaceId } },
      });
      if (!lease)
        return reply
          .status(404)
          .send({ error: "Lease not found in this workspace" });

      try {
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
        });
        if (workspace?.plan === "FREE") {
          const startOfMonth = new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          );
          const paymentCount = await prisma.payment.count({
            where: {
              workspaceId,
              createdAt: { gte: startOfMonth },
            },
          });

          if (paymentCount >= 5) {
            throw {
              statusCode: 402,
              message:
                "Free plan limit reached: Maximum 5 invoices per month. Please upgrade your plan.",
            };
          }
        }

        const result = await prisma.payment.create({
          data: {
            leaseId,
            workspaceId,
            amount: Number(amount),
            dueDate: new Date(dueDate),
            paidDate: paidDate ? new Date(paidDate) : null,
            status: status || "PENDING",
            note,
          },
          include: {
            lease: {
              include: {
                tenant: { select: { id: true, name: true } },
                property: { select: { id: true, name: true } },
              },
            },
          },
        });

        await logAction({
          userId: request.userId!,
          action: "CREATE_INVOICE",
          entityType: "PAYMENT",
          entityId: result.id,
          details: `Generated invoice of ₦${result.amount.toLocaleString()} for tenant "${result.lease.tenant.name}" in property "${result.lease.property.name}".`,
          workspaceId,
        });

        clearWorkspaceCache(workspaceId);

        return reply.status(201).send({ payment: result });
      } catch (err: unknown) {
        const errorObj = err as { statusCode?: number };
        if (errorObj.statusCode === 402) throw err;
        throw err;
      }
    },
  );

  // Mark payment as paid
  server.put<{
    Params: Static<typeof PaymentIdParams>;
    Body: Static<typeof PayPaymentBody>;
  }>(
    "/:id/pay",
    {
      preHandler: requireManager,
      schema: { params: PaymentIdParams, body: PayPaymentBody },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const { approvedAmountPaid } = request.body || {};

      try {
        const existingPayment = await prisma.payment.findUnique({
          where: { payment_workspace_id: { id, workspaceId } },
        });

        if (!existingPayment)
          return reply.status(404).send({ error: "Payment not found" });

        // Calculate amount to settle based on manager's approval or full amount
        const amountReceived =
          approvedAmountPaid !== undefined
            ? approvedAmountPaid
            : existingPayment.amount - (existingPayment.amountPaid || 0);
        const newTotalAmountPaid =
          (existingPayment.amountPaid || 0) + amountReceived;

        // Is it a true partial payment?
        const isPartial = newTotalAmountPaid < existingPayment.amount;
        const newStatus = isPartial ? "PARTIALLY_PAID" : "PAID";

        const payment = await prisma.payment.update({
          where: { payment_workspace_id: { id, workspaceId } },
          data: {
            status: newStatus,
            paidDate: !isPartial ? new Date() : existingPayment.paidDate,
            amountPaid: newTotalAmountPaid,
            dueDate:
              isPartial && existingPayment.balancePromise
                ? existingPayment.balancePromise
                : existingPayment.dueDate,
            transactions: {
              create: {
                amount: amountReceived,
                status: "COMPLETED",
                note: isPartial
                  ? "Partial payment approved manually"
                  : "Payment marked as settled manually",
              },
            },
          },
        });

        // Emit real-time update to all members in the workspace room
        (fastify as unknown as { io: import("socket.io").Server }).io
          .to(`workspace:${workspaceId}`)
          .emit("PAYMENT_UPDATED", {
            paymentId: id,
            status: newStatus,
            message: isPartial
              ? "A partial payment has been approved."
              : "A payment has been marked as settled.",
          });

        await logAction({
          userId: request.userId!,
          action: "APPROVE_PAYMENT",
          entityType: "PAYMENT",
          entityId: id,
          details: `Approved payment of ₦${amountReceived.toLocaleString()} for invoice ID "${id}" (New status: ${newStatus}).`,
          workspaceId,
        });

        clearWorkspaceCache(workspaceId);

        return reply.send({ payment });
      } catch (e) {
        return reply.status(404).send({ error: "Payment not found" });
      }
    },
  );

  // Get payment history for a specific lease
  server.get<{ Params: Static<typeof LeaseIdParams> }>(
    "/lease/:leaseId",
    {
      schema: { params: LeaseIdParams },
    },
    async (request, reply) => {
      const { workspaceId, leaseId } = request.params;

      const payments = await prisma.payment.findMany({
        where: { leaseId, lease: { tenant: { workspaceId } } }, // Security: Prevent cross-workspace IDOR
        include: { transactions: { orderBy: { paidDate: "desc" } } },
        orderBy: { dueDate: "desc" },
      });

      return reply.send({ payments });
    },
  );

  // Get overdue summary for a workspace
  server.get<{ Params: Static<typeof WorkspaceParams> }>(
    "/overdue-summary",
    {
      preHandler: requireManager,
      schema: { params: WorkspaceParams },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const now = new Date();

      const overduePayments = await prisma.payment.findMany({
        where: {
          workspaceId,
          status: { in: ["OVERDUE", "PARTIALLY_PAID"] },
        },
      });

      const summary = {
        totalOverdueCount: overduePayments.length,
        totalOverdueAmount: 0,
        brackets: {
          "0-30": { count: 0, amount: 0 },
          "30-60": { count: 0, amount: 0 },
          "60-90": { count: 0, amount: 0 },
          "90+": { count: 0, amount: 0 },
        },
      };

      overduePayments.forEach((payment) => {
        // Determine what constitutes an overdue payment. If not overdue yet but partially paid, should it count?
        // Since we query OVERDUE and PARTIALLY_PAID, let's include if dueDate < now.
        if (payment.dueDate > now && payment.status === "PARTIALLY_PAID")
          return;

        const remainingAmount = payment.amount - (payment.amountPaid || 0);
        summary.totalOverdueAmount += remainingAmount;

        const daysOverdue = Math.floor(
          (now.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysOverdue <= 30) {
          summary.brackets["0-30"].count++;
          summary.brackets["0-30"].amount += remainingAmount;
        } else if (daysOverdue <= 60) {
          summary.brackets["30-60"].count++;
          summary.brackets["30-60"].amount += remainingAmount;
        } else if (daysOverdue <= 90) {
          summary.brackets["60-90"].count++;
          summary.brackets["60-90"].amount += remainingAmount;
        } else {
          summary.brackets["90+"].count++;
          summary.brackets["90+"].amount += remainingAmount;
        }
      });

      return reply.send({ summary });
    },
  );

  // Record a partial payment
  server.post<{
    Params: Static<typeof PaymentIdParams>;
    Body: Static<typeof PartialPayBody>;
  }>(
    "/:id/partial-pay",
    {
      preHandler: requireManager, // Security: Only managers can manually record partial payments
      schema: { params: PaymentIdParams, body: PartialPayBody },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const { amountPaid, balancePromise, balanceNote } = request.body;

      if (!amountPaid || Number(amountPaid) <= 0) {
        return reply
          .status(400)
          .send({ error: "Valid partial amount is required" });
      }

      const payment = await prisma.payment.findUnique({
        where: { payment_workspace_id: { id, workspaceId } },
        include: { lease: { include: { tenant: true } } },
      });

      if (!payment)
        return reply.status(404).send({ error: "Payment not found" });

      const newAmountPaid =
        (payment.amountPaid || 0) + parseFloat(amountPaid.toString());

      if (newAmountPaid >= payment.amount) {
        const updated = await prisma.payment.update({
          where: { id },
          data: {
            status: "PAID",
            amountPaid: payment.amount,
            paidDate: new Date(),
            transactions: {
              create: {
                amount: parseFloat(amountPaid.toString()),
                status: "COMPLETED",
                note: "Final partial payment recorded manually",
              },
            },
          },
        });
        clearWorkspaceCache(workspaceId);
        return reply.send({ payment: updated, fullyPaid: true });
      }

      const updated = await prisma.payment.update({
        where: { id },
        data: {
          status: "PARTIALLY_PAID",
          amountPaid: newAmountPaid,
          balancePromise: balancePromise ? new Date(balancePromise) : null,
          balanceNote,
          transactions: {
            create: {
              amount: parseFloat(amountPaid.toString()),
              status: "COMPLETED",
              note: "Partial payment recorded manually",
            },
          },
        },
      });

      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${workspaceId}`)
        .emit("PAYMENT_UPDATED", {
          paymentId: id,
          status: "PARTIALLY_PAID",
          message: `A partial payment of ₦${amountPaid} was recorded.`,
        });

      clearWorkspaceCache(workspaceId);
      return reply.send({ payment: updated, fullyPaid: false });
    },
  );

  // Review a submitted proof of payment (Manager only)
  server.patch<{
    Params: Static<typeof PaymentIdParams>;
    Body: Static<typeof ReviewPaymentBody>;
  }>(
    "/:id/review",
    {
      preHandler: requireManager,
      schema: { params: PaymentIdParams, body: ReviewPaymentBody },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const { status, rejectionReason, approvedAmountPaid } = request.body; // status expected: 'PAID' or 'REJECTED'

      if (status !== "PAID" && status !== "REJECTED") {
        return reply
          .status(400)
          .send({ error: "Status must be PAID or REJECTED" });
      }

      const payment = await prisma.payment.findUnique({
        where: { payment_workspace_id: { id, workspaceId } },
        include: {
          lease: { include: { tenant: { select: { id: true, email: true } } } },
          workspace: { select: { plan: true } },
        },
      });

      if (!payment)
        return reply.status(404).send({ error: "Payment not found" });

      const tenantEmail = payment?.lease?.tenant?.email;
      const tenantUser = tenantEmail
        ? await prisma.user.findUnique({ where: { email: tenantEmail } })
        : null;

      const isPro = payment.workspace?.plan !== "FREE";

      // Clear any PENDING transactions for this payment so we don't duplicate them
      await prisma.paymentTransaction.deleteMany({
        where: { paymentId: id, status: "PENDING" },
      });

      let updatedPayment;

      if (status === "PAID") {
        const receiptId =
          `RCPT-${Date.now()}-${id.substring(0, 4)}`.toUpperCase();

        // Handle true partial approval
        const amountReceived =
          approvedAmountPaid !== undefined
            ? approvedAmountPaid
            : payment.amount - (payment.amountPaid || 0);
        const newTotalAmountPaid = (payment.amountPaid || 0) + amountReceived; // Add the newly received amount to the previously paid amount

        const isPartial = newTotalAmountPaid < payment.amount;
        const newStatus = isPartial ? "PARTIALLY_PAID" : "PAID";

        updatedPayment = await prisma.payment.update({
          where: { payment_workspace_id: { id, workspaceId } },
          data: {
            status: newStatus,
            paidDate: !isPartial ? new Date() : payment.paidDate,
            receiptId,
            amountPaid: newTotalAmountPaid,
            dueDate:
              isPartial && payment.balancePromise
                ? payment.balancePromise
                : payment.dueDate,
            transactions: {
              create: {
                amount: amountReceived,
                status: "COMPLETED",
                note: isPartial
                  ? "Proof of partial payment approved"
                  : "Proof of payment approved",
                receiptId,
                proofUrl: payment.proofUrl,
              },
            },
          },
        });

        if (tenantUser) {
          await prisma.notification.create({
            data: {
              userId: tenantUser.id,
              title: isPartial
                ? "Partial Payment Approved"
                : "Payment Approved",
              message: `Your payment of ₦${amountReceived.toLocaleString()} has been approved. Receipt ID: ${receiptId}`,
              type: "PAYMENT_APPROVED",
            },
          });

          // Trigger email notification ONLY for PRO/ENTERPRISE
          if (isPro) {
            await sendEmail(
              tenantEmail!,
              isPartial
                ? "Partial Payment Approved - PropertyStack"
                : "Payment Approved - PropertyStack",
              `Your payment of ₦${amountReceived.toLocaleString()} has been approved. Your Receipt ID is ${receiptId}. You can download your official receipt from the tenant portal.`,
            );
          }
        }
      } else {
        // REJECTED
        if (!rejectionReason) {
          return reply
            .status(400)
            .send({ error: "Rejection reason is required" });
        }
        const isOverdue = payment.dueDate < new Date();
        updatedPayment = await prisma.payment.update({
          where: { payment_workspace_id: { id, workspaceId } },
          data: {
            status: isOverdue ? "OVERDUE" : "PENDING",
            rejectionReason,
            proofUrl: null,
          },
        });

        if (tenantUser) {
          await prisma.notification.create({
            data: {
              userId: tenantUser.id,
              title: "Payment Proof Rejected",
              message: `Your submitted proof of payment was rejected. Reason: ${rejectionReason}`,
              type: "PAYMENT_REJECTED",
            },
          });

          // Trigger email notification ONLY for PRO/ENTERPRISE
          if (isPro) {
            await sendEmail(
              tenantEmail!,
              "Payment Proof Rejected - PropertyStack",
              `Your submitted proof of payment for your rent has been rejected. \n\nReason: ${rejectionReason}\n\nPlease review the feedback and upload a valid proof of payment from the portal.`,
            );
          }
        }
      }

      // Emit real-time update to all members in the workspace room (Manager, Tenant, Landlord)
      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${workspaceId}`)
        .emit("PAYMENT_UPDATED", {
          paymentId: id,
          status: updatedPayment.status,
          message:
            status === "PAID" ? "Payment approved" : "Payment proof rejected",
        });

      if (status === "PAID") {
        const amountReceived =
          approvedAmountPaid !== undefined
            ? approvedAmountPaid
            : payment.amount - (payment.amountPaid || 0);

        await logAction({
          userId: request.userId!,
          action: "APPROVE_PAYMENT",
          entityType: "PAYMENT",
          entityId: id,
          details: `Approved proof of payment of ₦${amountReceived.toLocaleString()} for invoice ID "${id}".`,
          workspaceId,
        });
      } else {
        await logAction({
          userId: request.userId!,
          action: "REJECT_PAYMENT",
          entityType: "PAYMENT",
          entityId: id,
          details: `Rejected proof of payment for invoice ID "${id}". Reason: "${rejectionReason}".`,
          workspaceId,
        });
      }

      clearWorkspaceCache(workspaceId);

      return reply.send({ payment: updatedPayment });
    },
  );

  // Download PDF Receipt
  server.get<{ Params: Static<typeof PaymentIdParams> }>(
    "/:id/receipt",
    {
      schema: { params: PaymentIdParams },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;

      const payment = await prisma.payment.findUnique({
        where: { payment_workspace_id: { id, workspaceId } },
        include: {
          lease: {
            include: {
              tenant: true,
              property: true,
            },
          },
          workspace: true,
        },
      });

      if (!payment || !payment.receiptId || !payment.paidDate) {
        return reply
          .status(404)
          .send({ error: "Receipt not found or payment not settled" });
      }

      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        `attachment; filename=receipt-${payment.receiptId}.pdf`,
      );

      generateReceiptPDF(
        {
          receiptId: payment.receiptId,
          amount: payment.amount,
          paidDate: payment.paidDate,
          tenantName: payment.lease.tenant.name,
          propertyName: payment.lease.property.name,
          workspaceName: payment.workspace?.name || "PropertyStack Workspace",
          note: payment.note || undefined,
        },
        reply.raw as NodeJS.WritableStream,
      );

      return reply;
    },
  );

  // Send reminder for a specific payment
  server.post<{ Params: Static<typeof PaymentIdParams> }>(
    "/:id/remind",
    {
      preHandler: requireManager,
      schema: { params: PaymentIdParams },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const payment = await prisma.payment.findUnique({
        where: { payment_workspace_id: { id, workspaceId } },
        include: {
          lease: {
            include: {
              tenant: true,
              property: true,
            },
          },
        },
      });

      if (!payment) {
        return reply.status(404).send({ error: "Payment not found" });
      }

      const tenant = payment.lease.tenant;
      if (!tenant.email) {
        return reply
          .status(400)
          .send({ error: "Tenant has no registered email address" });
      }

      await sendEmail(
        tenant.email,
        `Rent Payment Reminder - ${payment.lease.property.name}`,
        `Dear ${tenant.name},\n\nThis is a friendly reminder that your rent payment of ₦${payment.amount.toLocaleString()} for ${payment.lease.property.name} is due on ${new Date(payment.dueDate).toLocaleDateString()}.\n\nPlease log in to the tenant portal to view and complete your payment.\n\nBest regards,\nProperty Management Team`,
      );

      // Create a database notification for the tenant
      await prisma.notification.create({
        data: {
          userId: tenant.id,
          title: "Rent Payment Reminder",
          message: `Your payment of ₦${payment.amount.toLocaleString()} is due on ${new Date(payment.dueDate).toLocaleDateString()}.`,
          type: "PAYMENT_REMINDER",
        },
      });

      return reply.send({ success: true });
    },
  );
}
