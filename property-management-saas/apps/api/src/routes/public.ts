import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import { Prisma } from "@prisma/client";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { authenticate } from "../lib/middleware";

const TenantParams = Type.Object({ tenantId: Type.String() });
const MaintenanceBody = Type.Object({
  propertyId: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  imageUrl: Type.Optional(Type.String()),
});

export default async function publicRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Get tenant public profile (for the portal)
  server.get<{ Params: Static<typeof TenantParams> }>(
    "/tenants/:tenantId",
    {
      preHandler: authenticate, // Security: Enforce authentication to prevent scraping
      schema: { params: TenantParams },
    },
    async (request, reply) => {
      const { tenantId } = request.params;

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId, deletedAt: null },
        include: {
          leases: {
            where: { status: "ACTIVE" },
            include: {
              property: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  owner: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          workspace: { select: { name: true, id: true, members: { where: { userId: request.userId } } } },
          maintenanceRequests: {
            orderBy: { createdAt: "desc" },
            include: { property: { select: { id: true, name: true } } },
          },
        },
      });

      if (!tenant) {
        return reply
          .status(404)
          .send({ error: "Tenant not found or has been deactivated" });
      }

      // Security Check: User must either be the tenant themselves (by email) OR a member of the workspace
      const isSelf = false; // We can't definitively check this without joining on User by email, but workspace member check handles manager access
      const isWorkspaceMember = tenant.workspace?.members && tenant.workspace.members.length > 0;
      
      if (!isSelf && !isWorkspaceMember && request.userRole !== 'SUPER_ADMIN') {
        return reply.status(403).send({ error: "Unauthorized to view this tenant profile" });
      }

      // Security: Strip sensitive data from public response — no PII, no bank details
      const sanitizedLeases = (tenant.leases || []).map((lease) => ({
        id: lease.id,
        status: lease.status,
        startDate: lease.startDate,
        endDate: lease.endDate,
        property: lease.property
          ? {
              id: lease.property.id,
              name: lease.property.name,
              address: lease.property.address,
            }
          : null,
        // Bank details intentionally excluded from public endpoint
      }));

      return reply.send({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          // email and phone intentionally excluded from public endpoint
          workspace: tenant.workspace
            ? { name: tenant.workspace.name, id: tenant.workspace.id }
            : null,
          leases: sanitizedLeases,
          // maintenanceRequests intentionally excluded from public endpoint
        },
      });
    },
  );

  // Submit a new maintenance request from the tenant portal
  server.post<{
    Params: Static<typeof TenantParams>;
    Body: Static<typeof MaintenanceBody>;
  }>(
    "/tenants/:tenantId/maintenance",
    {
      schema: { params: TenantParams, body: MaintenanceBody },
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const { propertyId, description, imageUrl } = request.body;

      if (!propertyId || !description) {
        return reply
          .status(400)
          .send({ error: "Property ID and description are required" });
      }

      if (description.length > 2000) {
        return reply.status(400).send({ error: "Description is too long" });
      }

      // Verify tenant exists
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId, deletedAt: null },
      });

      if (!tenant) {
        return reply.status(404).send({ error: "Tenant not found" });
      }

      // Determine the workspace
      const workspaceId = tenant.workspaceId;

      const maintenanceRequest = await prisma
        .$transaction(async (tx: Prisma.TransactionClient) => {
          // Lock the workspace record to prevent race conditions on limit checks
          await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;

          const workspace = await tx.workspace.findUnique({
            where: { id: workspaceId },
          });
          if (workspace?.plan === "FREE") {
            const activeCount = await tx.maintenanceRequest.count({
              where: {
                workspaceId,
                status: { in: ["PENDING", "IN_PROGRESS"] },
              },
            });

            if (activeCount >= 3) {
              throw new Error("LIMIT_MAINTENANCE");
            }
          }

          return await tx.maintenanceRequest.create({
            data: {
              tenantId,
              propertyId,
              workspaceId,
              description,
              imageUrl,
              status: "PENDING",
            },
          });
        })
        .catch((err: unknown) => {
          if ((err as Error).message === "LIMIT_MAINTENANCE") {
            throw {
              statusCode: 402,
              message:
                "Free plan limit reached: Maximum 3 active maintenance tickets allowed. Please upgrade your plan.",
            };
          }
          throw err;
        });

      return reply.status(201).send({ request: maintenanceRequest });
    },
  );
}
