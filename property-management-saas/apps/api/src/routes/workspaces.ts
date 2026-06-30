import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import { authenticate } from "../lib/middleware";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { statsCache, clearWorkspaceCache, CACHE_TTL } from "../lib/cache";

const CreateWorkspaceBody = Type.Object({ name: Type.String() });
const UpdateWorkspaceParams = Type.Object({ id: Type.String() });
const UpdateWorkspaceBody = Type.Object({
  name: Type.Optional(Type.String()),
  bankCode: Type.Optional(Type.String()),
  accountNumber: Type.Optional(Type.String()),
  accountName: Type.Optional(Type.String()),
  allowPartialPayments: Type.Optional(Type.Boolean()),
});
const WorkspaceIdParams = Type.Object({ workspaceId: Type.String() });
const UpgradeRequestBody = Type.Object({
  requestedPlan: Type.Union([Type.Literal("PRO"), Type.Literal("ENTERPRISE")]),
  proofUrl: Type.String(),
});

export default async function workspaceRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);

  // Get all workspaces for the current user
  server.get("/", async (request, reply) => {
    const userId = request.userId!;
    const workspaces = await prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
    });
    return reply.send({ workspaces });
  });

  // Create a new workspace (Current user becomes PROPERTY_MANAGER)
  server.post<{ Body: Static<typeof CreateWorkspaceBody> }>(
    "/",
    {
      schema: { body: CreateWorkspaceBody },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { name } = request.body;

      // Ensure the default "Monthly" rent mapping doesn't conflict during workspace creation
      const workspace = await prisma.workspace.create({
        data: {
          name,
          members: {
            create: {
              userId,
              role: "PROPERTY_MANAGER",
            },
          },
        },
      });

      return reply.status(201).send({ workspace });
    },
  );

  // Update a workspace (e.g. Bank Payout Details)
  server.patch<{
    Params: Static<typeof UpdateWorkspaceParams>;
    Body: Static<typeof UpdateWorkspaceBody>;
  }>(
    "/:id",
    {
      schema: { params: UpdateWorkspaceParams, body: UpdateWorkspaceBody },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const {
        name,
        bankCode,
        accountNumber,
        accountName,
        allowPartialPayments,
      } = request.body;

      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: id, userId, role: "PROPERTY_MANAGER" },
      });

      if (!membership)
        return reply
          .status(403)
          .send({ error: "Only owners can update workspace settings" });

      const workspace = await prisma.workspace.update({
        where: { id },
        data: {
          name,
          bankCode,
          accountNumber,
          accountName,
          allowPartialPayments,
        },
      });

      // If the master partial payments toggle was changed, reset all individual tenant overrides
      // so they fall back to inheriting this new global workspace setting
      if (allowPartialPayments !== undefined) {
        await prisma.tenant.updateMany({
          where: { workspaceId: id },
          data: { allowPartialPayments: null },
        });
      }

      clearWorkspaceCache(id);

      return reply.send({ workspace });
    },
  );

  // Join a workspace (requires being pre-added by a manager)
  // Security: Open join was removed — users must be invited by a workspace admin
  server.post<{ Params: Static<typeof WorkspaceIdParams> }>(
    "/:workspaceId/join",
    {
      schema: { params: WorkspaceIdParams },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { workspaceId } = request.params;

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (!workspace)
        return reply.status(404).send({ error: "Workspace not found" });

      // Security: Check if the user was pre-added as a member by a workspace admin
      // (e.g., when a manager creates a tenant, a WorkspaceMember record is created)
      const existingMember = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
      });

      if (!existingMember) {
        return reply.status(403).send({
          error:
            "You have not been invited to this workspace. Please ask the workspace administrator to add you.",
        });
      }

      // User was already pre-added — just confirm
      return reply.status(200).send({ member: existingMember });
    },
  );

  // Get workspace stats
  server.get<{ Params: Static<typeof WorkspaceIdParams> }>(
    "/:workspaceId/stats",
    {
      schema: { params: WorkspaceIdParams },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { workspaceId } = request.params;

      const cacheKey = `${userId}:${workspaceId}`;
      const nowTime = Date.now();
      const cached = statsCache.get(cacheKey);
      if (cached && cached.expiresAt > nowTime) {
        return reply.send(cached.response);
      }

      const member = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
      });
      if (!member) return reply.status(403).send({ error: "Forbidden" });

      let propertyWhere: import("@prisma/client").Prisma.PropertyWhereInput = {
        workspaceId,
      };
      if (member.role === "LANDLORD") {
        propertyWhere.ownerId = userId;
      }

      let tenantWhere: import("@prisma/client").Prisma.TenantWhereInput = {
        workspaceId,
        deletedAt: null,
      };
      if (member.role === "LANDLORD") {
        // Find tenants that have leases in this landlord's properties
        tenantWhere.leases = { some: { property: { ownerId: userId } } };
      }

      let maintenanceWhere: import("@prisma/client").Prisma.MaintenanceRequestWhereInput =
        { workspaceId, status: "PENDING" };
      if (member.role === "LANDLORD") {
        maintenanceWhere.property = { ownerId: userId };
      }

      let paymentWhere: import("@prisma/client").Prisma.PaymentWhereInput = {
        status: "PAID",
        lease: { property: { workspaceId } },
      };
      if (member.role === "LANDLORD") {
        paymentWhere.lease = { property: { workspaceId, ownerId: userId } };
      }

      let underReviewWhere: import("@prisma/client").Prisma.PaymentWhereInput =
        { workspaceId, status: "UNDER_REVIEW" };
      if (member.role === "LANDLORD") {
        underReviewWhere.lease = { property: { ownerId: userId } };
      }

      let overdueWhere: import("@prisma/client").Prisma.PaymentWhereInput = {
        workspaceId,
        status: { in: ["OVERDUE", "PARTIALLY_PAID"] },
      };
      if (member.role === "LANDLORD") {
        overdueWhere.lease = { property: { ownerId: userId } };
      }

      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      let expiringLeaseWhere: import("@prisma/client").Prisma.LeaseWhereInput =
        {
          status: "ACTIVE",
          endDate: { gte: now, lte: thirtyDaysFromNow },
          tenant: { workspaceId },
        };
      if (member.role === "LANDLORD") {
        expiringLeaseWhere.property = { ownerId: userId };
      }

      const [
        totalProperties,
        totalTenants,
        pendingMaintenance,
        paidPayments,
        underReviewPayments,
        overduePaymentsCount,
        expiringLeasesCount,
      ] = await Promise.all([
        prisma.property.count({ where: propertyWhere }),
        prisma.tenant.count({ where: tenantWhere }),
        prisma.maintenanceRequest.count({ where: maintenanceWhere }),
        prisma.payment.findMany({
          where: paymentWhere,
          select: { amount: true, paidDate: true },
        }),
        prisma.payment.count({ where: underReviewWhere }),
        prisma.payment.count({ where: overdueWhere }),
        prisma.lease.count({ where: expiringLeaseWhere }),
      ]);

      const rentCollected = paidPayments.reduce(
        (sum: number, p) => sum + p.amount,
        0,
      );

      // Simple revenue chart data: last 6 months
      const revenueByMonth: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = d.toLocaleString("default", { month: "short" });
        revenueByMonth[month] = 0;
      }

      paidPayments.forEach((p) => {
        if (p.paidDate) {
          const month = new Date(p.paidDate).toLocaleString("default", {
            month: "short",
          });
          if (revenueByMonth[month] !== undefined) {
            revenueByMonth[month] += p.amount;
          }
        }
      });

      const chartData = Object.keys(revenueByMonth).map((month) => ({
        name: month,
        revenue: revenueByMonth[month],
      }));

      const responseBody = {
        stats: {
          totalProperties,
          totalTenants,
          rentCollected,
          pendingMaintenance,
          underReviewPayments,
          overduePaymentsCount,
          expiringLeasesCount,
        },
        chartData,
      };

      // Save stats to cache for 5 seconds
      statsCache.set(cacheKey, {
        response: responseBody,
        expiresAt: Date.now() + CACHE_TTL,
      });

      return reply.send(responseBody);
    },
  );

  // Submit manual workspace plan upgrade request
  server.post<{
    Params: Static<typeof WorkspaceIdParams>;
    Body: Static<typeof UpgradeRequestBody>;
  }>(
    "/:workspaceId/upgrade-requests",
    {
      schema: {
        params: WorkspaceIdParams,
        body: UpgradeRequestBody,
      },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { workspaceId } = request.params;
      const { requestedPlan, proofUrl } = request.body;

      // Security: Check workspace membership + role = PROPERTY_MANAGER
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId,
          role: "PROPERTY_MANAGER",
        },
      });

      if (!membership) {
        return reply.status(403).send({
          error: "Only workspace managers can request subscription upgrades.",
        });
      }

      // Check if there is already a PENDING upgrade request
      const existingPending = await prisma.upgradeRequest.findFirst({
        where: {
          workspaceId,
          status: "PENDING",
        },
      });

      if (existingPending) {
        return reply.status(400).send({
          error:
            "You already have a pending upgrade request. Please wait for the admin to verify it.",
        });
      }

      const upgradeRequest = await prisma.upgradeRequest.create({
        data: {
          workspaceId,
          userId,
          requestedPlan,
          proofUrl,
          status: "PENDING",
        },
      });

      return reply.status(201).send({ upgradeRequest });
    },
  );

  // Fetch upgrade request logs/status for a workspace
  server.get<{
    Params: Static<typeof WorkspaceIdParams>;
  }>(
    "/:workspaceId/upgrade-requests",
    {
      schema: {
        params: WorkspaceIdParams,
      },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { workspaceId } = request.params;

      // Security: Check workspace membership
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId,
        },
      });

      if (!membership) {
        return reply.status(403).send({
          error: "Unauthorized access to workspace information.",
        });
      }

      const upgradeRequests = await prisma.upgradeRequest.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ upgradeRequests });
    },
  );
}
