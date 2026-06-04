import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/database';
import { RemitaService } from '../services/remita';
import { Type, Static } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

export default async function webhookRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  // Receive Remita Payment Webhooks
  server.post('/remita', { schema: {} }, async (request, reply) => {
    try {
      // Remita usually sends an array of payment notifications
      const notifications = request.body as Record<string, any>[];

      if (!Array.isArray(notifications)) {
        return reply.status(400).send({ error: 'Invalid payload format' });
      }

      for (const notification of notifications) {
        const { rrr, orderId } = notification;
        
        if (!rrr || !orderId) continue;

        // Idempotency Check
        const existingEvent = await prisma.webhookEvent.findUnique({
          where: { eventId: rrr }
        });

        if (existingEvent) {
          request.log.info(`[Webhook] Skipping already processed Remita event RRR: ${rrr}`);
          continue;
        }

        // Verify the transaction with Remita to prevent spoofing
        const isSuccessful = await RemitaService.verifyTransaction(rrr);

        if (isSuccessful) {
          // Find the pending payment
          const payment = await prisma.payment.findUnique({
            where: { rrr }
          });

          if (payment && payment.status !== 'PAID') {
            await prisma.$transaction(async (tx) => {
              const updatedPayment = await tx.payment.update({
                where: { id: payment.id },
                data: {
                  status: 'PAID',
                  amountPaid: payment.amount,
                  paidDate: new Date(),
                  transactionId: orderId
                }
              });

              await tx.paymentTransaction.create({
                data: {
                  paymentId: payment.id,
                  amount: payment.amount - (payment.amountPaid || 0),
                  status: 'COMPLETED',
                  note: 'Automated Remita Webhook Settlement',
                  receiptId: orderId
                }
              });

              await tx.webhookEvent.create({
                data: {
                  source: 'REMITA',
                  eventId: rrr,
                  payload: notification,
                  status: 'PROCESSED'
                }
              });
            });
            request.log.info(`[Webhook] Payment ${payment.id} marked as PAID via Remita (RRR: ${rrr})`);
          } else {
             // Record event even if payment is not found or already paid
             await prisma.webhookEvent.create({
                data: {
                  source: 'REMITA',
                  eventId: rrr,
                  payload: notification,
                  status: 'PROCESSED'
                }
             });
          }
        }
      }

      return reply.send({ success: true, message: 'Webhooks processed successfully' });
    } catch (error: unknown) {
      request.log.error({ err: error }, '[Webhook Error]');
      return reply.status(500).send({ error: 'Webhook processing failed' });
    }
  });
}
