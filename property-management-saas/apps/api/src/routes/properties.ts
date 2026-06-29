import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import {
  authenticate,
  verifyWorkspaceAccess,
  requireManager,
} from "../lib/middleware";
import { Prisma, PropertyType } from "@prisma/client";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { propertiesCache, clearWorkspaceCache, CACHE_TTL } from "../lib/cache";
import { logAction } from "../lib/audit";

const WorkspaceParams = Type.Object({ workspaceId: Type.String() });
const PropertyIdParams = Type.Object({
  workspaceId: Type.String(),
  id: Type.String(),
});

const CreatePropertyBody = Type.Object({
  name: Type.Optional(Type.String()),
  address: Type.Optional(Type.String()),
  ownerId: Type.Optional(Type.String()),
  imageUrl: Type.Optional(Type.String()),
  units: Type.Optional(
    Type.Array(
      Type.Object({
        unitNumber: Type.String(),
        type: Type.Enum(PropertyType),
      }),
    ),
  ),
});

const UpdatePropertyBody = Type.Object({
  name: Type.Optional(Type.String()),
  address: Type.Optional(Type.String()),
  ownerId: Type.Optional(Type.String()),
  imageUrl: Type.Optional(Type.String()),
});

export default async function propertiesRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", verifyWorkspaceAccess);

  // List Properties
  server.get<{ Params: Static<typeof WorkspaceParams> }>(
    "/",
    {
      schema: { params: WorkspaceParams },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const userRole = request.userRole!;
      const userId = request.userId!;

      const cacheKey = `${userId}:${workspaceId}`;
      const now = Date.now();
      const cached = propertiesCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return reply.send(cached.response);
      }

      const whereClause: import("@prisma/client").Prisma.PropertyWhereInput = {
        workspaceId,
        deletedAt: null,
      };
      if (userRole === "LANDLORD") {
        whereClause.ownerId = userId;
      }

      const properties = await prisma.property.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          units: { orderBy: { unitNumber: "asc" } },
          leases: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              yearlyRent: true,
              tenant: { select: { id: true, name: true } },
              unit: { select: { id: true, unitNumber: true } },
            },
          },
        },
      });

      const responseBody = { properties };
      propertiesCache.set(cacheKey, {
        response: responseBody,
        expiresAt: Date.now() + CACHE_TTL,
      });

      return reply.send(responseBody);
    },
  );

  // Create Property
  server.post<{
    Params: Static<typeof WorkspaceParams>;
    Body: Static<typeof CreatePropertyBody>;
  }>(
    "/",
    {
      preHandler: requireManager,
      schema: { params: WorkspaceParams, body: CreatePropertyBody },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { name, address, ownerId, units, imageUrl } = request.body;

      if (!name || !address) {
        return reply
          .status(400)
          .send({ error: "Name and address are required" });
      }

      // Atomic subscription limit check and creation with row-level locking
      const property = await prisma
        .$transaction(async (tx: Prisma.TransactionClient) => {
          // Lock the workspace record to prevent race conditions on limit checks
          await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;

          const workspace = await tx.workspace.findUnique({
            where: { id: workspaceId },
          });
          const plan = workspace?.plan || "FREE";

          // Enforcement of tier limits
          if (plan === "FREE" || plan === "PRO") {
            const propertiesCount = await tx.property.count({
              where: { workspaceId, deletedAt: null },
            });

            const limitProps = plan === "FREE" ? 1 : 10;
            if (propertiesCount >= limitProps) {
              throw new Error(`LIMIT_PROPERTIES:${limitProps}`);
            }

            const newUnitsCount = units ? units.length : 0;
            const currentUnitsCount = await tx.unit.count({
              where: { workspaceId },
            });

            const limitUnits = plan === "FREE" ? 3 : 50;
            if (currentUnitsCount + newUnitsCount > limitUnits) {
              throw new Error(`LIMIT_UNITS:${limitUnits}`);
            }
          }

          return await tx.property.create({
            data: {
              name,
              address,
              imageUrl,
              ownerId: ownerId || null,
              workspaceId,
              units: {
                create: (units || []).map((u) => ({
                  unitNumber: u.unitNumber,
                  type: u.type,
                  workspace: { connect: { id: workspaceId } },
                })),
              },
            },
            include: { units: true },
          });
        })
        .catch((err: unknown) => {
          const errorMsg = (err as Error).message;
          if (errorMsg?.startsWith("LIMIT_PROPERTIES")) {
            const limit = errorMsg.split(":")[1];
            throw {
              statusCode: 402,
              message: `Plan limit reached: Maximum ${limit} property allowed. Please upgrade your plan.`,
            };
          }
          if (errorMsg?.startsWith("LIMIT_UNITS")) {
            const limit = errorMsg.split(":")[1];
            throw {
              statusCode: 402,
              message: `Plan limit reached: Maximum ${limit} units allowed. Please upgrade your plan.`,
            };
          }
          throw err;
        });

      // Emit real-time update to the workspace room
      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${workspaceId}`)
        .emit("PROPERTY_CREATED", {
          propertyId: property.id,
          message: "A new property has been created.",
        });

      await logAction({
        userId: request.userId!,
        action: "CREATE_PROPERTY",
        entityType: "PROPERTY",
        entityId: property.id,
        details: `Created property "${property.name}" with ${units?.length || 0} units.`,
        workspaceId,
      });

      clearWorkspaceCache(workspaceId);

      return reply.status(201).send({ property });
    },
  );

  // Update Property
  server.put<{
    Params: Static<typeof PropertyIdParams>;
    Body: Static<typeof UpdatePropertyBody>;
  }>(
    "/:id",
    {
      preHandler: requireManager,
      schema: { params: PropertyIdParams, body: UpdatePropertyBody },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const { name, address, ownerId, imageUrl } = request.body;

      try {
        const property = await prisma.property.update({
          where: { property_workspace_id: { id, workspaceId } },
          data: {
            name,
            address,
            ...(imageUrl !== undefined ? { imageUrl } : {}),
            ...(ownerId !== undefined ? { ownerId: ownerId || null } : {}),
          },
        });

        await logAction({
          userId: request.userId!,
          action: "UPDATE_PROPERTY",
          entityType: "PROPERTY",
          entityId: property.id,
          details: `Updated property settings for "${property.name}".`,
          workspaceId,
        });

        clearWorkspaceCache(workspaceId);

        return reply.send({ property });
      } catch (e) {
        return reply.status(404).send({ error: "Property not found" });
      }
    },
  );

  // Add Units to Property
  const AddUnitsParams = Type.Object({
    workspaceId: Type.String(),
    propertyId: Type.String(),
  });

  const AddUnitsBody = Type.Object({
    units: Type.Array(
      Type.Object({
        unitNumber: Type.String(),
        type: Type.Union([
          Type.Literal("ROOM_SELF_CONTAIN"),
          Type.Literal("MINI_FLAT"),
          Type.Literal("ROOM_PARLOUR_SELF_CONTAIN"),
          Type.Literal("SINGLE_ROOM"),
          Type.Literal("TWO_BEDROOM_FLAT"),
          Type.Literal("THREE_BEDROOM_FLAT"),
          Type.Literal("DUPLEX"),
          Type.Literal("OTHERS"),
        ]),
      })
    ),
  });

  server.post<{
    Params: Static<typeof AddUnitsParams>;
    Body: Static<typeof AddUnitsBody>;
  }>(
    "/:propertyId/units",
    {
      preHandler: requireManager,
      schema: { params: AddUnitsParams, body: AddUnitsBody },
    },
    async (request, reply) => {
      const { workspaceId, propertyId } = request.params;
      const { units } = request.body;

      if (!units || units.length === 0) {
        return reply.status(400).send({ error: "At least one unit must be specified" });
      }

      const property = await prisma.property.findFirst({
        where: { id: propertyId, workspaceId, deletedAt: null },
      });
      if (!property) {
        return reply.status(404).send({ error: "Property not found" });
      }

      try {
        await prisma.$transaction(async (tx) => {
          const workspace = await tx.workspace.findUnique({
            where: { id: workspaceId },
          });
          const plan = workspace?.plan || "FREE";

          const newUnitsCount = units.length;
          const currentUnitsCount = await tx.unit.count({
            where: { workspaceId },
          });

          const limitUnits = plan === "FREE" ? 3 : 50;
          if (currentUnitsCount + newUnitsCount > limitUnits) {
            throw new Error(`LIMIT_UNITS:${limitUnits}`);
          }

          await tx.unit.createMany({
            data: units.map((u) => ({
              unitNumber: u.unitNumber,
              type: u.type,
              propertyId,
              workspaceId,
              status: "VACANT",
            })),
          });
        });
      } catch (err: unknown) {
        const errorMsg = (err as Error).message;
        if (errorMsg?.startsWith("LIMIT_UNITS")) {
          const limit = errorMsg.split(":")[1];
          return reply.status(402).send({
            error: `Plan limit reached: Maximum ${limit} units allowed. Please upgrade your plan.`,
          });
        }
        throw err;
      }

      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${workspaceId}`)
        .emit("PROPERTY_CREATED", {
          propertyId,
          message: "New units have been added.",
        });

      await logAction({
        userId: request.userId!,
        action: "ADD_UNITS",
        entityType: "PROPERTY",
        entityId: propertyId,
        details: `Added ${units.length} units to property "${property.name}".`,
        workspaceId,
      });

      clearWorkspaceCache(workspaceId);

      const updatedProperty = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          units: { orderBy: { unitNumber: "asc" } },
        },
      });

      return reply.send({ property: updatedProperty });
    }
  );

  // Delete Property (Soft Delete)
  server.delete<{ Params: Static<typeof PropertyIdParams> }>(
    "/:id",
    {
      preHandler: requireManager,
      schema: { params: PropertyIdParams },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;

      try {
        await prisma.property.update({
          where: { property_workspace_id: { id, workspaceId } },
          data: { deletedAt: new Date() },
        });

        // Emit real-time update to the workspace room
        (fastify as unknown as { io: import("socket.io").Server }).io
          .to(`workspace:${workspaceId}`)
          .emit("PROPERTY_DELETED", {
            propertyId: id,
            message: "A property has been deleted.",
          });

        await logAction({
          userId: request.userId!,
          action: "DELETE_PROPERTY",
          entityType: "PROPERTY",
          entityId: id,
          details: `Soft-deleted property ID "${id}".`,
          workspaceId,
        });

        clearWorkspaceCache(workspaceId);

        return reply.send({ success: true });
      } catch (e) {
        return reply.status(404).send({ error: "Property not found" });
      }
    },
  );
}
