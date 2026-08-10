import { FastifyInstance } from "fastify";
import { authenticate, verifyWorkspaceAccess } from "../lib/middleware";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const ResolveParams = Type.Object({
  workspaceId: Type.String({ minLength: 1, maxLength: 100 }),
});

const ResolveBody = Type.Object({
  accountNumber: Type.String({
    minLength: 10,
    maxLength: 10,
    pattern: "^[0-9]{10}$",
    description: "10-digit Nigerian bank account number",
  }),
  bankCode: Type.String({
    minLength: 1,
    maxLength: 20,
    pattern: "^[0-9a-zA-Z_-]+$",
    description: "Bank code identifier",
  }),
});

export default async function bankVerificationRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", verifyWorkspaceAccess);

  /**
   * Resolves a 10-digit account number to a mock name with strict validation.
   * Input: { accountNumber, bankCode }
   */
  server.post<{
    Params: Static<typeof ResolveParams>;
    Body: Static<typeof ResolveBody>;
  }>(
    "/resolve",
    {
      schema: {
        params: ResolveParams,
        body: ResolveBody,
      },
    },
    async (request, reply) => {
      const { accountNumber, bankCode } = request.body;

      // Simulate network delay for a "real-time" feel
      await new Promise((resolve) => setTimeout(resolve, 300));

      // For demo purposes, we generate deterministic plausible names
      const names = [
        "Justus Ogunduyi",
        "Ibrahim Abubakar",
        "Chinelo Eze",
        "Olukayode Arowosegbe",
        "Blessing Okon",
        "Tunde Balogun",
      ];

      // Seed randomness based on account number for consistency
      const seed = parseInt(accountNumber[0] + accountNumber[9], 10);
      const accountName = names[seed % names.length];

      return reply.send({
        accountName,
        verified: true,
      });
    },
  );
}
