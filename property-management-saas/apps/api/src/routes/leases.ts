import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import { authenticate, verifyWorkspaceAccess } from "../lib/middleware";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const WorkspaceParams = Type.Object({ workspaceId: Type.String() });
const LeaseIdParams = Type.Object({ workspaceId: Type.String(), id: Type.String() });

const UpdateLeaseBody = Type.Object({
  startDate: Type.Optional(Type.String()),
  endDate: Type.Optional(Type.String()),
  yearlyRent: Type.Optional(Type.Number()),
  status: Type.Optional(Type.String()),
});

export default async function leaseRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", verifyWorkspaceAccess);

  // List all leases in a workspace
  server.get<{ Params: Static<typeof WorkspaceParams> }>(
    "/",
    {
      schema: { params: WorkspaceParams },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const leases = await prisma.lease.findMany({
        where: {
          property: { workspaceId },
        },
        include: {
          tenant: { select: { id: true, name: true } },
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ leases });
    },
  );

  // Update lease
  server.patch<{
    Params: Static<typeof LeaseIdParams>;
    Body: Static<typeof UpdateLeaseBody>;
  }>(
    "/:id",
    {
      schema: { params: LeaseIdParams, body: UpdateLeaseBody },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const { startDate, endDate, yearlyRent, status } = request.body;

      // Ensure the lease belongs to the workspace
      const existingLease = await prisma.lease.findFirst({
        where: { id, property: { workspaceId } },
      });

      if (!existingLease) {
        return reply.status(404).send({ error: "Lease not found in this workspace" });
      }

      const dataToUpdate: any = {};
      if (startDate !== undefined) dataToUpdate.startDate = new Date(startDate);
      if (endDate !== undefined) dataToUpdate.endDate = endDate ? new Date(endDate) : null;
      if (yearlyRent !== undefined) dataToUpdate.yearlyRent = yearlyRent;
      if (status !== undefined) dataToUpdate.status = status;

      const lease = await prisma.lease.update({
        where: { id },
        data: dataToUpdate,
      });

      return reply.send({ lease });
    },
  );
}
