import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import {
  authenticate,
  verifyWorkspaceAccess,
  requireManager,
} from "../lib/middleware";
import { supabaseAdmin } from "../lib/supabase";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const WorkspaceParams = Type.Object({ workspaceId: Type.String() });
const WorkspaceQuery = Type.Object({
  page: Type.Optional(Type.String()),
  limit: Type.Optional(Type.String()),
});
const TenantIdParams = Type.Object({
  workspaceId: Type.String(),
  id: Type.String(),
});
const CreateTenantBody = Type.Object({
  name: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  phone: Type.Optional(Type.String()),
  password: Type.Optional(Type.String()),
});
const UpdateTenantBody = Type.Object({
  name: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  phone: Type.Optional(Type.String()),
  allowPartialPayments: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
});
const CreateLeaseBody = Type.Object({
  propertyId: Type.Optional(Type.String()),
  unitId: Type.Optional(Type.String()),
  startDate: Type.Optional(Type.String()),
  endDate: Type.Optional(Type.String()),
  yearlyRent: Type.Optional(Type.Union([Type.String(), Type.Number()])),
});
const EndTenancyBody = Type.Object({
  leaseId: Type.String(),
  reason: Type.Optional(Type.String()),
});

export default async function tenantRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", verifyWorkspaceAccess);

  // List tenants with active lease info
  server.get<{
    Params: Static<typeof WorkspaceParams>;
    Querystring: Static<typeof WorkspaceQuery>;
  }>(
    "/",
    {
      schema: { params: WorkspaceParams, querystring: WorkspaceQuery },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { page = "1", limit = "20" } = request.query || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const whereClause = { workspaceId, deletedAt: null };

      const [tenants, total] = await prisma.$transaction([
        prisma.tenant.findMany({
          where: whereClause,
          include: {
            leases: {
              include: {
                property: { select: { id: true, name: true } },
                unit: { select: { id: true, unitNumber: true, type: true } },
                payments: {
                  select: { id: true, status: true, dueDate: true },
                  orderBy: { dueDate: "desc" },
                  take: 1, // Only need the most recent payment to determine status
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.tenant.count({ where: whereClause }),
      ]);

      return reply.send({
        tenants,
        pagination: {
          total,
          page: pageNum,
          pageSize: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    },
  );

  // Get single tenant profile
  server.get<{ Params: Static<typeof TenantIdParams> }>(
    "/:id",
    {
      schema: { params: TenantIdParams },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const tenant = await prisma.tenant.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: {
          leases: {
            include: {
              property: { select: { id: true, name: true, address: true } },
              unit: { select: { id: true, unitNumber: true, type: true } },
            },
            orderBy: { startDate: "desc" },
          },
        },
      });
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });
      return reply.send({ tenant });
    },
  );

  // Create tenant
  server.post<{
    Params: Static<typeof WorkspaceParams>;
    Body: Static<typeof CreateTenantBody>;
  }>(
    "/",
    {
      preHandler: requireManager,
      schema: { params: WorkspaceParams, body: CreateTenantBody },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { name, email, phone, password } = request.body;
      if (!name)
        return reply.status(400).send({ error: "Tenant name is required" });

      // Subscription Limits and Tenant Creation in Transaction to prevent race conditions
      const result = await prisma
        .$transaction(async (tx: Prisma.TransactionClient) => {
          // Lock the workspace record to prevent race conditions on limit checks
          await tx.$executeRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;

          const workspace = await tx.workspace.findUnique({
            where: { id: workspaceId },
          });
          const plan = workspace?.plan || "FREE";

          if (plan === "FREE" || plan === "PRO") {
            const tenantCount = await tx.tenant.count({
              where: { workspaceId, deletedAt: null },
            });
            const limit = plan === "FREE" ? 3 : 50;
            if (tenantCount >= limit) {
              throw new Error(`LIMIT_REACHED:${limit}`);
            }
          }

          let supabaseUserId = null;
          let inviteLink = null;
          const tempPassword =
            password || randomBytes(12).toString("hex") + "A!1";

          // If email is provided, create a Supabase Auth account for the mobile app
          if (email) {
            const { data: linkData, error: linkError } =
              await supabaseAdmin.auth.admin.generateLink({
                type: "invite",
                email,
                options: {
                  data: { name, role: "TENANT", mustChangePassword: true },
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
              const authError =
                linkError || new Error("Failed to generate invite link");
              if (
                authError.message.includes("already") &&
                authError.message.includes("registered")
              ) {
                const { data: listData } =
                  await supabaseAdmin.auth.admin.listUsers();
                const existingUser = listData.users.find(
                  (u) => u.email === email,
                );
                supabaseUserId = existingUser?.id || null;
                if (!supabaseUserId) {
                  throw new Error("AUTH_ERR:Could not find existing account");
                }
              } else {
                throw new Error(`AUTH_ERR:${authError.message}`);
              }
            } else {
              supabaseUserId = linkDataAny.user.id;
              inviteLink = linkDataAny.properties.action_link;
            }

            // Actually set the temp password on the Supabase account so the tenant can log in
            if (supabaseUserId) {
              await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
                password: tempPassword,
                email_confirm: true,
              });
            }

            if (supabaseUserId) {
              const existingDbUser = await tx.user.findUnique({
                where: { email },
              });
              if (existingDbUser && existingDbUser.id !== supabaseUserId) {
                await tx.workspaceMember.deleteMany({
                  where: { userId: existingDbUser.id },
                });
                await tx.user.delete({ where: { id: existingDbUser.id } });
                await tx.user.create({
                  data: { id: supabaseUserId, email, name },
                });
              } else if (!existingDbUser) {
                await tx.user.create({
                  data: { id: supabaseUserId, email, name },
                });
              } else {
                await tx.user.update({
                  where: { id: supabaseUserId },
                  data: { email, name },
                });
              }

              await tx.workspaceMember.upsert({
                where: {
                  userId_workspaceId: { userId: supabaseUserId, workspaceId },
                },
                update: { role: "TENANT" },
                create: { userId: supabaseUserId, workspaceId, role: "TENANT" },
              });
            }
          }

          const tenantId = supabaseUserId || undefined;
          const tenant = tenantId
            ? await tx.tenant.upsert({
                where: { tenant_workspace_id: { id: tenantId, workspaceId } },
                update: { name, email, phone, workspaceId, deletedAt: null },
                create: { id: tenantId, name, email, phone, workspaceId },
              })
            : await tx.tenant.create({
                data: { name, email, phone, workspaceId },
              });

          return { tenant, tempPassword, inviteLink };
        }, { timeout: 15000 })
        .catch((err: unknown) => {
          const errorMsg = (err as Error).message;
          if (errorMsg?.startsWith("LIMIT_REACHED")) {
            const limit = errorMsg.split(":")[1];
            throw {
              statusCode: 402,
              message: `Plan limit reached: Maximum ${limit} tenants allowed. Please upgrade your plan.`,
            };
          }
          if (errorMsg?.startsWith("AUTH_ERR:")) {
            throw { statusCode: 400, message: errorMsg.split(":")[1] };
          }
          throw err;
        });

      // Emit real-time update to the workspace room
      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${workspaceId}`)
        .emit("TENANT_CREATED", {
          tenantId: (result as { tenant: { id: string } }).tenant.id,
          message: "A new tenant has been created.",
        });

      return reply.status(201).send({
        tenant: (result as { tenant: unknown }).tenant,
        credentials: email
          ? {
              email,
              tempPassword: (result as { tempPassword?: string }).tempPassword,
              inviteLink: (result as { inviteLink?: string }).inviteLink,
            }
          : null,
      });
    },
  );

  // Update tenant
  server.put<{
    Params: Static<typeof TenantIdParams>;
    Body: Static<typeof UpdateTenantBody>;
  }>(
    "/:id",
    {
      preHandler: requireManager,
      schema: { params: TenantIdParams, body: UpdateTenantBody },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const { name, email, phone, allowPartialPayments } = request.body;

      try {
        const tenant = await prisma.tenant.update({
          where: { tenant_workspace_id: { id, workspaceId } },
          data: { name, email, phone, allowPartialPayments },
        });
        return reply.send({ tenant });
      } catch (e) {
        return reply.status(404).send({ error: "Tenant not found" });
      }
    },
  );

  // Delete tenant (full cleanup including Supabase Auth)
  server.delete<{ Params: Static<typeof TenantIdParams> }>(
    "/:id",
    {
      preHandler: requireManager,
      schema: { params: TenantIdParams },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      try {
        // Find the tenant first to get their details
        const tenant = await prisma.tenant.findUnique({
          where: { tenant_workspace_id: { id, workspaceId } },
        });
        if (!tenant)
          return reply.status(404).send({ error: "Tenant not found" });

        // Clean up Supabase Auth user so the email can be reused
        try {
          await supabaseAdmin.auth.admin.deleteUser(id);
        } catch (_) {
          /* ignore */
        }

        // Remove workspace membership and user record
        await prisma.workspaceMember.deleteMany({
          where: { userId: id, workspaceId },
        });

        // Only delete User record if they aren't part of other workspaces
        const otherMemberships = await prisma.workspaceMember.count({
          where: { userId: id },
        });
        if (otherMemberships === 0) {
          await prisma.user.delete({ where: { id } }).catch(() => {});
        }

        // Hard-delete the tenant record
        await prisma.tenant.delete({
          where: { tenant_workspace_id: { id, workspaceId } },
        });

        // Emit real-time update to the workspace room
        (fastify as unknown as { io: import("socket.io").Server }).io
          .to(`workspace:${workspaceId}`)
          .emit("TENANT_DELETED", {
            tenantId: id,
            message: "A tenant has been deleted.",
          });

        return reply.send({ success: true });
      } catch (e) {
        return reply
          .status(404)
          .send({ error: "Tenant not found or could not be deleted" });
      }
    },
  );

  // Assign tenant to property (create lease)
  server.post<{
    Params: Static<typeof TenantIdParams>;
    Body: Static<typeof CreateLeaseBody>;
  }>(
    "/:id/leases",
    {
      preHandler: requireManager,
      schema: { params: TenantIdParams, body: CreateLeaseBody },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const { propertyId, unitId, startDate, endDate, yearlyRent } =
        request.body;

      if (!propertyId || !startDate) {
        return reply
          .status(400)
          .send({ error: "Property ID and start date are required" });
      }

      // Verify the property belongs to the same workspace
      const property = await prisma.property.findFirst({
        where: { id: propertyId, workspaceId, deletedAt: null },
      });
      if (!property)
        return reply
          .status(404)
          .send({ error: "Property not found in this workspace" });

      // If unitId is provided, verify it belongs to this property
      if (unitId) {
        const unit = await prisma.unit.findFirst({
          where: { id: unitId, propertyId, workspaceId },
        });
        if (!unit)
          return reply
            .status(404)
            .send({ error: "Unit not found in this property" });
      }

      const lease = await prisma.lease.create({
        data: {
          tenantId: id,
          propertyId,
          unitId: unitId || null,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          yearlyRent: yearlyRent ? Number(yearlyRent) : 0,
        },
        include: {
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
        },
      });

      // Update unit status to OCCUPIED if applicable
      if (unitId) {
        await prisma.unit.update({
          where: { id: unitId },
          data: { status: "OCCUPIED" },
        });
      }

      return reply.status(201).send({ lease });
    },
  );

  // End tenancy - Only allowed after 3-month grace period, expired, or voluntary
  server.post<{
    Params: Static<typeof TenantIdParams>;
    Body: Static<typeof EndTenancyBody>;
  }>(
    "/:id/end-tenancy",
    {
      preHandler: requireManager,
      schema: { params: TenantIdParams, body: EndTenancyBody },
    },
    async (request, reply) => {
      const { workspaceId, id } = request.params;
      const { leaseId, reason } = request.body;

      if (!leaseId) {
        return reply.status(400).send({ error: "Lease ID is required" });
      }

      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, tenantId: id, tenant: { workspaceId } },
        include: {
          payments: { orderBy: { dueDate: "desc" } },
          tenant: true,
          property: true,
        },
      });

      if (!lease) {
        return reply.status(404).send({ error: "Lease not found" });
      }

      const now = new Date();
      const hasOverdueGraceEnded = lease.payments.some(
        (p) => p.gracePeriodEnd && p.gracePeriodEnd <= now,
      );

      if (
        !hasOverdueGraceEnded &&
        lease.status !== "EXPIRED" &&
        reason !== "VOLUNTARY_LEAVE"
      ) {
        return reply
          .status(403)
          .send({
            error: "Cannot end tenancy: 3-month grace period has not ended.",
          });
      }

      const updatedLease = await prisma.lease.update({
        where: { id: leaseId },
        data: { status: "TERMINATED", endDate: now },
      });

      if (lease.unitId) {
        await prisma.unit.update({
          where: { id: lease.unitId },
          data: { status: "VACANT" },
        });
      }

      const tenantUser = await prisma.user.findUnique({
        where: { email: lease.tenant.email || "" },
      });
      if (tenantUser) {
        await prisma.notification.create({
          data: {
            userId: tenantUser.id,
            title: "Tenancy Ended",
            message: `Your tenancy at ${lease.property.name} has been ended.`,
            type: "TENANCY_ENDED",
          },
        });
      }

      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${workspaceId}`)
        .emit("TENANT_DELETED", {
          tenantId: id,
          message: "A tenancy has been ended.",
        });

      return reply.send({ success: true, lease: updatedLease });
    },
  );
}
