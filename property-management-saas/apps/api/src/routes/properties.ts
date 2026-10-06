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
import { sendEmail } from "../lib/mailer";
import { renderEmailLayout, escapeHtml } from "../lib/email-template";

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

/**
 * Notifies the assigned landlord when a property is registered or reassigned to them
 * via in-app notification, real-time WebSocket event, and branded transactional email.
 */
export async function notifyLandlordOfPropertyAssignment(params: {
  fastify: FastifyInstance;
  workspaceId: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  unitsCount: number;
  ownerId: string;
  managerId: string;
  frontendUrl: string;
  isUpdate?: boolean;
}) {
  const {
    fastify,
    workspaceId,
    propertyId,
    propertyName,
    propertyAddress,
    unitsCount,
    ownerId,
    managerId,
    frontendUrl,
    isUpdate = false,
  } = params;

  // 1. Fetch Landlord, Manager, and Workspace info in parallel
  const [landlord, manager, workspace] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: managerId },
      select: { name: true, email: true },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    }),
  ]);

  if (!landlord || !landlord.email) {
    return;
  }

  const managerName = manager?.name || "Your Property Manager";
  const workspaceName = workspace?.name || "PropertyStack Workspace";
  const title = isUpdate
    ? `Property Reassigned: ${propertyName}`
    : `New Property Added: ${propertyName}`;
  const message = isUpdate
    ? `Manager "${managerName}" reassigned the property "${propertyName}" (${propertyAddress}) to your portfolio in "${workspaceName}".`
    : `Manager "${managerName}" added "${propertyName}" (${propertyAddress}) with ${unitsCount} unit${unitsCount === 1 ? "" : "s"} to your portfolio in "${workspaceName}".`;

  // 2. In-App Notification record in DB
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: landlord.id,
        title,
        message,
        type: "PROPERTY_ASSIGNED",
      },
    });

    // Real-time socket event to the landlord
    fastify.io.to(`user:${landlord.id}`).emit("NOTIFICATION_CREATED", {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.createdAt,
    });
  } catch (notifErr) {
    fastify.log.error(
      notifErr,
      `[Properties] Failed to create in-app notification for landlord ${landlord.id}`,
    );
  }

  // 3. Branded Transactional Email
  try {
    const publicBaseUrl =
      frontendUrl &&
      !frontendUrl.includes("localhost") &&
      !frontendUrl.includes("127.0.0.1")
        ? frontendUrl.replace(/\/$/, "")
        : "https://propertystack.vercel.app";

    const propertiesUrl = `${publicBaseUrl}/dashboard?view=properties`;
    const subject = `New Property Assigned: ${propertyName} - ${workspaceName}`;
    const displayName = landlord.name?.trim() || "there";

    const bodyHtml = `
      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">
        ${isUpdate ? "Property Reassigned to You" : "New Property Added to Your Portfolio"}
      </h2>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
        Hi <strong>${escapeHtml(displayName)}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
        Your property manager, <strong>${escapeHtml(managerName)}</strong>, has ${isUpdate ? "reassigned" : "registered and assigned"} the following property to your landlord portfolio in <strong>${escapeHtml(workspaceName)}</strong>:
      </p>

      <!-- PROPERTY DETAILS BOX -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0066FF; border-radius: 8px; padding: 18px 20px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
          Property Details
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
          <tr>
            <td style="padding: 6px 0; font-weight: 600; width: 140px; color: #64748b;">Property Name:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${escapeHtml(propertyName)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Address:</td>
            <td style="padding: 6px 0;">${escapeHtml(propertyAddress)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Configured Units:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0066FF;">${unitsCount} unit${unitsCount === 1 ? "" : "s"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Managed By:</td>
            <td style="padding: 6px 0;">${escapeHtml(managerName)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Date Assigned:</td>
            <td style="padding: 6px 0;">${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
          </tr>
        </table>
      </div>

      <!-- ACTION BUTTON -->
      <div style="margin: 0 0 24px 0; text-align: center;">
        <a href="${propertiesUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0, 102, 255, 0.25);">
          View Property in Portfolio &rarr;
        </a>
      </div>
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b; text-align: center;">
        You can also monitor this property, review tenant occupancy, and track rent collection from your PropertyStack Landlord Mobile App.
      </p>
    `;

    const html = renderEmailLayout({
      title: subject,
      badge: "PROPERTY ASSIGNED",
      bodyHtml,
      recipientEmail: landlord.email,
      preheader: `Property ${propertyName} (${unitsCount} units) has been assigned to your landlord portfolio in ${workspaceName}.`,
    });

    const plainText = `Hi ${displayName},\n\nYour property manager, ${managerName}, has assigned ${propertyName} (${propertyAddress}) with ${unitsCount} units to your portfolio in ${workspaceName}.\n\nView Property in Portfolio:\n${propertiesUrl}\n\nBest regards,\nThe PropertyStack Team`;

    await sendEmail(landlord.email, subject, plainText, html);
  } catch (emailErr) {
    fastify.log.error(
      emailErr,
      `[Properties] Failed to send property assignment email to landlord ${landlord.email}`,
    );
  }
}

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
        .$transaction(
          async (tx: Prisma.TransactionClient) => {
            // Lock the workspace record to prevent race conditions on limit checks (parameterized with Prisma.sql)
            await tx.$executeRaw(Prisma.sql`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`);

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
          },
          { maxWait: 10000, timeout: 20000 },
        )
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
      fastify.io
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
        req: request,
      });

      clearWorkspaceCache(workspaceId);

      const frontendUrl =
        process.env.FRONTEND_URL &&
        !process.env.FRONTEND_URL.includes("localhost") &&
        !process.env.FRONTEND_URL.includes("127.0.0.1")
          ? process.env.FRONTEND_URL
          : "https://propertystack.vercel.app";

      // If assigned to a landlord, notify them via in-app notification, socket event, and email
      if (property.ownerId) {
        notifyLandlordOfPropertyAssignment({
          fastify,
          workspaceId,
          propertyId: property.id,
          propertyName: property.name,
          propertyAddress: property.address,
          unitsCount: property.units?.length || 0,
          ownerId: property.ownerId,
          managerId: request.userId!,
          frontendUrl,
          isUpdate: false,
        }).catch((err) => {
          request.log.error(
            { err },
            `[Create Property] Failed to notify landlord ${property.ownerId}`,
          );
        });
      }

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
        const existingProperty = await prisma.property.findUnique({
          where: { property_workspace_id: { id, workspaceId } },
          select: { ownerId: true, name: true, address: true },
        });

        const property = await prisma.property.update({
          where: { property_workspace_id: { id, workspaceId } },
          data: {
            name,
            address,
            ...(imageUrl !== undefined ? { imageUrl } : {}),
            ...(ownerId !== undefined ? { ownerId: ownerId || null } : {}),
          },
          include: { units: true },
        });

        await logAction({
          userId: request.userId!,
          action: "UPDATE_PROPERTY",
          entityType: "PROPERTY",
          entityId: property.id,
          details: `Updated property settings for "${property.name}".`,
          workspaceId,
          req: request,
        });

        clearWorkspaceCache(workspaceId);

        const frontendUrl =
          process.env.FRONTEND_URL &&
          !process.env.FRONTEND_URL.includes("localhost") &&
          !process.env.FRONTEND_URL.includes("127.0.0.1")
            ? process.env.FRONTEND_URL
            : "https://propertystack.vercel.app";

        // If owner was newly assigned or changed, notify the new landlord
        if (ownerId && ownerId !== existingProperty?.ownerId) {
          notifyLandlordOfPropertyAssignment({
            fastify,
            workspaceId,
            propertyId: property.id,
            propertyName: property.name,
            propertyAddress: property.address,
            unitsCount: property.units?.length || 0,
            ownerId,
            managerId: request.userId!,
            frontendUrl,
            isUpdate: true,
          }).catch((err) => {
            request.log.error(
              { err },
              `[Update Property] Failed to notify reassigned landlord ${ownerId}`,
            );
          });
        }

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
      }),
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
        return reply
          .status(400)
          .send({ error: "At least one unit must be specified" });
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

      fastify.io
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
        req: request,
      });

      clearWorkspaceCache(workspaceId);

      const updatedProperty = await prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          units: { orderBy: { unitNumber: "asc" } },
        },
      });

      return reply.send({ property: updatedProperty });
    },
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
        fastify.io
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
          req: request,
        });

        clearWorkspaceCache(workspaceId);

        return reply.send({ success: true });
      } catch (e) {
        return reply.status(404).send({ error: "Property not found" });
      }
    },
  );
}
