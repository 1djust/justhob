import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@property-management/database';
// import { RemitaService } from '../services/remita';

export default async function webhookRoutes(fastify: FastifyInstance) {
  // Receive Remita Payment Webhooks
  fastify.post('/remita', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      /*
      // Commenting out Remita logic
      // Remita usually sends an array of payment notifications
      const notifications = request.body as any[];

      if (!Array.isArray(notifications)) {
        return reply.status(400).send({ error: 'Invalid payload format' });
      }

      for (const notification of notifications) {
        const { rrr, orderId } = notification;
        
        if (!rrr || !orderId) continue;

        // Verify the transaction with Remita to prevent spoofing
        const isSuccessful = await RemitaService.verifyTransaction(rrr);

        if (isSuccessful) {
          // Find the pending payment
          const payment = await prisma.payment.findUnique({
            where: { rrr }
          });

          if (payment && payment.status !== 'PAID') {
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'PAID',
                paidDate: new Date(),
                transactionId: orderId
              }
            });
            console.log(`[Webhook] Payment ${payment.id} marked as PAID via Remita (RRR: ${rrr})`);
          }
        }
      }
      */

      return reply.send({ success: true, message: 'Webhooks disabled for Remita' });
    } catch (error: any) {
      console.error('[Webhook Error]', error.message);
      return reply.status(500).send({ error: 'Webhook processing failed' });
    }
  });
}
