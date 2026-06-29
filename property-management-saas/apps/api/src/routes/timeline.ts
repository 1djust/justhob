import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import { authenticate, verifyWorkspaceAccess } from "../lib/middleware";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const WorkspaceParams = Type.Object({ workspaceId: Type.String() });

export default async function timelineRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Apply auth and workspace access middleware to all routes in this plugin
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", verifyWorkspaceAccess);

  // Get hierarchical timeline data: Properties -> Units -> Leases
  server.get<{
    Params: Static<typeof WorkspaceParams>;
    Querystring: { year?: string };
  }>(
    "/",
    {
      schema: { params: WorkspaceParams },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { year } = request.query || {};

      const targetYear = parseInt(
        year || new Date().getFullYear().toString(),
        10,
      );
      const startOfYear = new Date(targetYear, 0, 1);
      const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

      // Fetch all properties for the workspace, including units, and active leases for the year
      const properties = await prisma.property.findMany({
        where: {
          workspaceId,
          deletedAt: null,
        },
        include: {
          units: {
            include: {
              leases: {
                where: {
                  // Only include leases that overlap with the target year
                  // They start before end of year AND (end after start of year OR have no end date)
                  startDate: { lte: endOfYear },
                  OR: [{ endDate: { gte: startOfYear } }, { endDate: null }],
                  status: { in: ["ACTIVE", "PENDING_RENEWAL"] },
                },
                include: {
                  tenant: {
                    select: { id: true, name: true, email: true, phone: true },
                  },
                },
                orderBy: { startDate: "asc" },
              },
            },
            orderBy: { unitNumber: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      return reply.send({ properties, year: targetYear });
    },
  );
}
