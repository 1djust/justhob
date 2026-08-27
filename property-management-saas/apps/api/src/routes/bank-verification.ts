import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
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
   * Resolves a 10-digit account number via Paystack or verified workspace records.
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
      const paystackKey = process.env.PAYSTACK_SECRET_KEY;

      if (paystackKey && !paystackKey.includes("mock")) {
        try {
          const res = await fetch(
            `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
            {
              headers: {
                Authorization: `Bearer ${paystackKey}`,
              },
            }
          );

          if (res.ok) {
            const data = (await res.json()) as { status: boolean; data?: { account_name?: string; account_number?: string } };
            if (data.status && data.data?.account_name) {
              return reply.send({
                accountName: data.data.account_name,
                accountNumber: data.data.account_number || accountNumber,
                verified: true,
              });
            }
          }
        } catch (err) {
          request.log.error({ err }, "[Paystack Resolve Error]");
        }
      }

      // Check if this account number already exists in workspace records
      const existingMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: request.params.workspaceId,
          accountNumber,
          accountName: { not: null },
        },
        select: { accountName: true },
      });

      if (existingMember?.accountName) {
        return reply.send({
          accountName: existingMember.accountName,
          verified: true,
        });
      }

      return reply.send({
        accountName: "",
        verified: false,
        message: "Account name could not be automatically resolved. Please enter account name manually.",
      });
    },
  );
}
