import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, verifyWorkspaceAccess } from '../lib/middleware';

export default async function bankVerificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', verifyWorkspaceAccess);

  /**
   * Resolves a 10-digit account number to a mock name.
   * Input: { accountNumber, bankCode }
   */
  fastify.post('/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountNumber, bankCode } = request.body as { accountNumber: string; bankCode: string };

    if (!accountNumber || !bankCode) {
      return reply.status(400).send({ error: 'Account number and bank code are required' });
    }

    if (accountNumber.length !== 10) {
      return reply.status(400).send({ error: 'Invalid account number (10 digits required)' });
    }

    // Simulate network delay for a "real-time" feel
    await new Promise(resolve => setTimeout(resolve, 800));

    // For demo purposes, we generate some plausible names
    const names = [
      'Justus Ogunduyi',
      'Ibrahim Abubakar',
      'Chinelo Eze',
      'Olukayode Arowosegbe',
      'Blessing Okon',
      'Tunde Balogun'
    ];

    // Seed randomness based on account number for consistency
    const seed = parseInt(accountNumber[0] + accountNumber[9]);
    const accountName = names[seed % names.length];

    return reply.send({ 
      accountName, 
      verified: true 
    });
  });
}
