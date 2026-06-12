import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/database";
import { authenticate } from "../lib/middleware";
import { supabaseAdmin } from "../lib/supabase";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { PayoutStrategy } from "@prisma/client";

const WorkspaceParams = Type.Object({ workspaceId: Type.String() });
const CreateOwnerBody = Type.Object({
  name: Type.String(),
  email: Type.String(),
  password: Type.Optional(Type.String()),
  payoutStrategy: Type.Optional(Type.Enum(PayoutStrategy)),
  bankCode: Type.Optional(Type.String()),
  accountNumber: Type.Optional(Type.String()),
  accountName: Type.Optional(Type.String()),
});
const DeleteOwnerParams = Type.Object({
  workspaceId: Type.String(),
  ownerId: Type.String(),
});

const verifyPropertyManager = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.userId!;
  const { workspaceId } = request.params as { workspaceId: string };

  if (!workspaceId)
    return reply.status(400).send({ error: "Workspace ID required" });

  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });

  if (!member || member.role !== "PROPERTY_MANAGER") {
    return reply
      .status(403)
      .send({ error: "Only Property Managers can manage owners" });
  }
};

export default async function ownerRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", verifyPropertyManager);

  // List all Landlords (Owners) in a workspace
  server.get<{ Params: Static<typeof WorkspaceParams> }>(
    "/",
    {
      schema: { params: WorkspaceParams },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const owners = await prisma.workspaceMember.findMany({
        where: { workspaceId, role: "LANDLORD" },
        include: {
          user: {
            select: { id: true, name: true, email: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const formatted = owners.map((o) => ({
        id: o.user.id,
        name: o.user.name,
        email: o.user.email,
        joinedAt: o.createdAt,
        memberId: o.id,
        payoutStrategy: o.payoutStrategy,
        bankCode: o.bankCode,
        accountNumber: o.accountNumber,
        accountName: o.accountName,
      }));

      return reply.send({ owners: formatted });
    },
  );

  // Add a new Landlord (Owner) to the workspace
  server.post<{
    Params: Static<typeof WorkspaceParams>;
    Body: Static<typeof CreateOwnerBody>;
  }>(
    "/",
    {
      preHandler: verifyPropertyManager,
      schema: { params: WorkspaceParams, body: CreateOwnerBody },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { name, email, password } = request.body;

      if (!name || !email) {
        return reply.status(400).send({ error: "Name and email are required" });
      }

      try {
        // Limit enforcement logic
        const result = await prisma.$transaction(
          async (tx: import("@prisma/client").Prisma.TransactionClient) => {
            // 1. Get workspace and lock it
            const workspace = await tx.workspace.findUnique({
              where: { id: workspaceId },
              select: { id: true, plan: true },
            });

            if (!workspace) throw new Error("Workspace not found");

            // 2. Count current owners (LANDLORD role)
            const ownerCount = await tx.workspaceMember.count({
              where: { workspaceId, role: "LANDLORD" },
            });

            if (workspace.plan === "FREE" && ownerCount >= 1) {
              throw new Error(
                "Owner limit reached for Free Plan. Maximum 1 owner allowed.",
              );
            }

            if (workspace.plan === "PRO" && ownerCount >= 3) {
              throw new Error(
                "Owner limit reached for Pro Plan. Maximum 3 owners allowed.",
              );
            }

            let user = await tx.user.findUnique({ where: { email } });
            if (user) {
              const existingMember = await tx.workspaceMember.findUnique({
                where: { userId_workspaceId: { userId: user.id, workspaceId } },
              });

              if (existingMember) {
                throw new Error("User is already a member of this workspace");
              }

              const { payoutStrategy, bankCode, accountNumber, accountName } =
                request.body;

              const member = await tx.workspaceMember.create({
                data: {
                  userId: user.id,
                  workspaceId,
                  role: "LANDLORD",
                  payoutStrategy: payoutStrategy as
                    | import("@prisma/client").PayoutStrategy
                    | undefined,
                  bankCode,
                  accountNumber,
                  accountName,
                },
              });
              return { user, member };
            }

            return { user: null, limitReached: false };
          },
        );

        let user = result.user;
        let inviteLink = null;

        if (!user) {
          // User doesn't exist, need to create in Supabase then Prisma
          // Note: We do this outside the transaction to avoid long locks during network calls
          const tempPassword = password || "TempPass123!";
          const { data: linkData, error: linkError } =
            await supabaseAdmin.auth.admin.generateLink({
              type: "invite",
              email,
              options: {
                data: { name },
                redirectTo: "https://justhob.vercel.app/login",
              },
            });

          const linkDataAny = linkData as unknown as {
            user: { id: string };
            properties?: { action_link?: string };
          };
          if (
            linkError ||
            !linkDataAny ||
            !linkDataAny.properties?.action_link
          ) {
            return reply
              .status(400)
              .send({
                error: linkError?.message || "Failed to generate invite link",
              });
          }

          user = await prisma.user.create({
            data: { id: linkDataAny.user.id, email, name },
          });

          inviteLink = linkDataAny.properties.action_link;

          const { payoutStrategy, bankCode, accountNumber, accountName } =
            request.body;

          await prisma.workspaceMember.create({
            data: {
              userId: user.id,
              workspaceId,
              role: "LANDLORD",
              payoutStrategy: payoutStrategy as
                | import("@prisma/client").PayoutStrategy
                | undefined,
              bankCode,
              accountNumber,
              accountName,
            },
          });
        } else {
          // User already exists — generate a magic link so they can log in
          try {
            const { data: mlData } =
              await supabaseAdmin.auth.admin.generateLink({
                type: "magiclink",
                email,
                options: { redirectTo: "https://justhob.vercel.app/login" },
              });
            const mlAny = mlData as unknown as {
              properties?: { action_link?: string };
            };
            if (mlAny?.properties?.action_link) {
              inviteLink = mlAny.properties.action_link;
            }
          } catch (_e) {
            // Non-critical: link generation failed but owner was still added
          }
        }

        return reply.status(201).send({
          owner: { id: user.id, name: user.name, email: user.email },
          inviteLink: inviteLink || null,
        });
      } catch (error: unknown) {
        const errMessage = (error as Error).message;
        if (errMessage && errMessage.includes("Owner limit reached")) {
          return reply.status(402).send({ error: errMessage });
        }
        return reply.status(500).send(error);
      }
    },
  );

  // Remove a Landlord from the workspace
  server.delete<{ Params: Static<typeof DeleteOwnerParams> }>(
    "/:ownerId",
    {
      schema: { params: DeleteOwnerParams },
    },
    async (request, reply) => {
      const { workspaceId, ownerId } = request.params;

      try {
        await prisma.workspaceMember.deleteMany({
          where: { userId: ownerId, workspaceId, role: "LANDLORD" },
        });
        await prisma.property.updateMany({
          where: { workspaceId, ownerId },
          data: { ownerId: null },
        });
        return reply.send({ success: true });
      } catch (e) {
        return reply.status(404).send({ error: "Owner not found" });
      }
    },
  );
}
