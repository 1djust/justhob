import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import { RemitaService } from "../services/remita";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import crypto from "crypto";
import { SecurityService } from "../services/security";

export default async function webhookRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Receive Supabase Auth Database Webhooks
  server.post("/supabase-auth", { schema: {} }, async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET;

      if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = request.body as any;
      if (body?.type === "INSERT" && body?.table === "audit_log_entries") {
        const record = body.record;

        // Supabase logs errors here
        if (record?.payload?.error || record?.payload?.code) {
          await SecurityService.logEvent(
            record.ip_address || "unknown",
            "FAILED_LOGIN",
            record.payload,
          );
        }
      }

      return reply.send({ success: true });
    } catch (err) {
      request.log.error({ err }, "[Supabase Webhook Error]");
      return reply.status(500).send({ error: "Webhook processing failed" });
    }
  });

  // Receive Remita Payment Webhooks
  server.post("/remita", { schema: {} }, async (request, reply) => {
    try {
      // Security: Verify HMAC signature to prevent webhook spoofing
      const signature =
        request.headers["x-remita-signature"] ||
        request.headers["x-paystack-signature"]; // depending on exact header used by provider
      const rawBody = JSON.stringify(request.body);
      const secret = process.env.REMITA_SECRET || process.env.WEBHOOK_SECRET;

      if (!signature || !secret) {
        request.log.warn("[Webhook] Missing signature or secret key");
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const expectedSignature = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        request.log.warn("[Webhook] Invalid HMAC signature");
        return reply.status(401).send({ error: "Invalid signature" });
      }

      // Remita usually sends an array of payment notifications
      const notifications = request.body as Record<string, any>[];

      if (!Array.isArray(notifications)) {
        return reply.status(400).send({ error: "Invalid payload format" });
      }

      for (const notification of notifications) {
        const { rrr, orderId } = notification;

        if (!rrr || !orderId) continue;

        // Idempotency Check
        const existingEvent = await prisma.webhookEvent.findUnique({
          where: { eventId: rrr },
        });

        if (existingEvent) {
          request.log.info(
            `[Webhook] Skipping already processed Remita event RRR: ${rrr}`,
          );
          continue;
        }

        // Verify the transaction with Remita to prevent spoofing
        const isSuccessful = await RemitaService.verifyTransaction(rrr);

        if (isSuccessful) {
          // Find the pending payment
          const payment = await prisma.payment.findUnique({
            where: { rrr },
          });

          if (payment && payment.status !== "PAID") {
            await prisma.$transaction(async (tx) => {
              const updatedPayment = await tx.payment.update({
                where: { id: payment.id },
                data: {
                  status: "PAID",
                  amountPaid: payment.amount,
                  paidDate: new Date(),
                  transactionId: orderId,
                },
              });

              await tx.paymentTransaction.create({
                data: {
                  paymentId: payment.id,
                  amount: payment.amount - (payment.amountPaid || 0),
                  status: "COMPLETED",
                  note: "Automated Remita Webhook Settlement",
                  receiptId: orderId,
                },
              });

              await tx.webhookEvent.create({
                data: {
                  source: "REMITA",
                  eventId: rrr,
                  payload: notification,
                  status: "PROCESSED",
                },
              });
            });
            request.log.info(
              `[Webhook] Payment ${payment.id} marked as PAID via Remita (RRR: ${rrr})`,
            );
          } else {
            // Record event even if payment is not found or already paid
            await prisma.webhookEvent.create({
              data: {
                source: "REMITA",
                eventId: rrr,
                payload: notification,
                status: "PROCESSED",
              },
            });
          }
        }
      }

      return reply.send({
        success: true,
        message: "Webhooks processed successfully",
      });
    } catch (error: unknown) {
      request.log.error({ err: error }, "[Webhook Error]");
      return reply.status(500).send({ error: "Webhook processing failed" });
    }
  });
}
