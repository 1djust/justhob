import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import { authenticate, requireSuperAdmin } from "../lib/middleware";
import { supabaseAdmin } from "../lib/supabase";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

// --- Request Schemas ---
const ApproveWorkspaceBody = Type.Object({
  plan: Type.Union([
    Type.Literal("FREE"),
    Type.Literal("PRO"),
    Type.Literal("ENTERPRISE"),
  ]),
  durationMonths: Type.Optional(Type.Number({ minimum: 1, maximum: 60 })),
});

const DeactivateWorkspaceBody = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500 })),
});

const ToggleUserAccessBody = Type.Object({
  isActive: Type.Boolean(),
});

const UpgradeRequestsQuery = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  status: Type.Optional(
    Type.Union([
      Type.Literal("PENDING"),
      Type.Literal("APPROVED"),
      Type.Literal("REJECTED"),
    ]),
  ),
});

const RejectUpgradeBody = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 500 }),
});

const ApproveUpgradeBody = Type.Object({
  durationMonths: Type.Optional(Type.Number({ minimum: 1, maximum: 60 })),
});

// Security: All string inputs are bounded to prevent ReDoS and DB performance attacks
const PaginationQuery = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  search: Type.Optional(Type.String({ maxLength: 200 })),
});

// Security: status and plan filters restricted to known enum values only
const VALID_WORKSPACE_STATUSES = [
  "ACTIVE",
  "PENDING",
  "INACTIVE",
  "REJECTED",
] as const;
const VALID_PLANS = ["FREE", "PRO", "ENTERPRISE"] as const;
const VALID_PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "OVERDUE",
  "UNDER_REVIEW",
  "PARTIALLY_PAID",
] as const;
const VALID_LOG_LEVELS = ["error", "warn", "info"] as const;

const WorkspaceFilterQuery = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  search: Type.Optional(Type.String({ maxLength: 200 })),
  status: Type.Optional(
    Type.Union(VALID_WORKSPACE_STATUSES.map((s) => Type.Literal(s))),
  ),
  plan: Type.Optional(Type.Union(VALID_PLANS.map((s) => Type.Literal(s)))),
});

const ErrorLogQuery = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  level: Type.Optional(
    Type.Union(VALID_LOG_LEVELS.map((s) => Type.Literal(s))),
  ),
});

const PaymentsQuery = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  status: Type.Optional(
    Type.Union(VALID_PAYMENT_STATUSES.map((s) => Type.Literal(s))),
  ),
});

export default async function superAdminRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Security: All routes require authentication + SUPER_ADMIN role
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", requireSuperAdmin);

  // =====================================================================
  // GET /stats — Platform-wide aggregated metrics
  // =====================================================================
  server.get("/stats", { schema: {} }, async () => {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalWorkspaces,
      activeWorkspaces,
      pendingWorkspaces,
      inactiveWorkspaces,
      totalProperties,
      totalUnits,
      totalTenants,
      totalLeases,
      activeLeases,
      totalRevenue,
      pendingPayments,
      overduePayments,
      recentUsers,
      recentErrors,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.workspace.count(),
      prisma.workspace.count({ where: { status: "ACTIVE" } }),
      prisma.workspace.count({ where: { status: "PENDING" } }),
      prisma.workspace.count({ where: { status: "INACTIVE" } }),
      prisma.property.count({ where: { deletedAt: null } }),
      prisma.unit.count(),
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.lease.count(),
      prisma.lease.count({ where: { status: "ACTIVE" } }),
      prisma.payment.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: { status: "PENDING" } }),
      prisma.payment.count({ where: { status: "OVERDUE" } }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      }),
      prisma.errorLog.count(),
    ]);

    return {
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalWorkspaces,
        activeWorkspaces,
        pendingWorkspaces,
        inactiveWorkspaces,
        totalProperties,
        totalUnits,
        totalTenants,
        totalLeases,
        activeLeases,
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingPayments,
        overduePayments,
        recentErrors,
      },
      recentUsers,
    };
  });

  // =====================================================================
  // GET /workspaces — Full workspace audit with owners
  // =====================================================================
  server.get<{ Querystring: Static<typeof WorkspaceFilterQuery> }>(
    "/workspaces",
    {
      schema: { querystring: WorkspaceFilterQuery },
    },
    async (request) => {
      const { page = 1, limit = 20, search, status, plan } = request.query;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          {
            members: {
              some: {
                user: { email: { contains: search, mode: "insensitive" } },
              },
            },
          },
        ];
      }
      if (status) where.status = status;
      if (plan) where.plan = plan;

      const [workspaces, total] = await Promise.all([
        prisma.workspace.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    isActive: true,
                  },
                },
              },
            },
            _count: {
              select: {
                properties: true,
                tenants: true,
                units: true,
                payments: true,
              },
            },
          },
        }),
        prisma.workspace.count({ where }),
      ]);

      return {
        workspaces,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
  );

  // =====================================================================
  // POST /workspaces/:id/approve — Approve workspace payment
  // =====================================================================
  server.post<{
    Params: { id: string };
    Body: Static<typeof ApproveWorkspaceBody>;
  }>(
    "/workspaces/:id/approve",
    {
      schema: { body: ApproveWorkspaceBody },
    },
    async (request) => {
      const { id } = request.params;
      const { plan, durationMonths = 12 } = request.body;

      const workspace = await prisma.workspace.findUnique({ where: { id } });
      if (!workspace) throw new NotFoundError("Workspace not found");

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

      const updated = await prisma.workspace.update({
        where: { id },
        data: {
          status: "ACTIVE",
          plan,
          subscriptionExpiresAt: expiresAt,
        },
      });

      return { success: true, workspace: updated };
    },
  );

  // =====================================================================
  // POST /workspaces/:id/deactivate — Deactivate expired workspace
  // =====================================================================
  server.post<{
    Params: { id: string };
    Body: Static<typeof DeactivateWorkspaceBody>;
  }>(
    "/workspaces/:id/deactivate",
    {
      schema: { body: DeactivateWorkspaceBody },
    },
    async (request) => {
      const { id } = request.params;

      const workspace = await prisma.workspace.findUnique({ where: { id } });
      if (!workspace) throw new NotFoundError("Workspace not found");

      const updated = await prisma.workspace.update({
        where: { id },
        data: { status: "INACTIVE" },
      });

      return { success: true, workspace: updated };
    },
  );

  // =====================================================================
  // POST /workspaces/:id/reject — Reject a workspace
  // =====================================================================
  server.post<{ Params: { id: string } }>(
    "/workspaces/:id/reject",
    {
      schema: {},
    },
    async (request) => {
      const { id } = request.params;

      const workspace = await prisma.workspace.findUnique({ where: { id } });
      if (!workspace) throw new NotFoundError("Workspace not found");

      const updated = await prisma.workspace.update({
        where: { id },
        data: { status: "REJECTED" },
      });

      return { success: true, workspace: updated };
    },
  );

  // =====================================================================
  // GET /users — Full user audit list
  // =====================================================================
  server.get<{ Querystring: Static<typeof PaginationQuery> }>(
    "/users",
    {
      schema: { querystring: PaginationQuery },
    },
    async (request) => {
      const { page = 1, limit = 20, search } = request.query;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (search) {
        where.OR = [
          { email: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            workspaces: {
              include: {
                workspace: {
                  select: {
                    id: true,
                    name: true,
                    plan: true,
                    status: true,
                    subscriptionExpiresAt: true,
                  },
                },
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
  );

  // =====================================================================
  // POST /users/:id/toggle-access — Ban / Unban a user globally
  // =====================================================================
  server.post<{
    Params: { id: string };
    Body: Static<typeof ToggleUserAccessBody>;
  }>(
    "/users/:id/toggle-access",
    {
      schema: { body: ToggleUserAccessBody },
    },
    async (request) => {
      const { id } = request.params;
      const { isActive } = request.body;

      // Security: Prevent self-deactivation
      if (id === request.userId) {
        throw new ForbiddenError("Cannot deactivate your own account");
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundError("User not found");

      // Security: Prevent banning other Super Admins (privilege escalation protection)
      if (user.role === "SUPER_ADMIN") {
        throw new ForbiddenError(
          "Cannot modify access for another Super Admin",
        );
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive },
      });

      // If deactivating, also disable in Supabase so they can't get new tokens
      if (!isActive) {
        await supabaseAdmin.auth.admin.updateUserById(id, {
          ban_duration: "876000h", // ~100 years = permanent ban
          user_metadata: { banned: true },
        });
      } else {
        await supabaseAdmin.auth.admin.updateUserById(id, {
          ban_duration: "none", // Remove ban
          user_metadata: { banned: false },
        });
      }

      return {
        success: true,
        user: {
          id: updated.id,
          email: updated.email,
          isActive: updated.isActive,
        },
      };
    },
  );



  // =====================================================================
  // GET /errors — System error log viewer
  // =====================================================================
  server.get<{ Querystring: Static<typeof ErrorLogQuery> }>(
    "/errors",
    {
      schema: { querystring: ErrorLogQuery },
    },
    async (request) => {
      const { page = 1, limit = 50, level } = request.query;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (level) where.level = level;

      const [errors, total] = await Promise.all([
        prisma.errorLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            level: true,
            message: true,
            source: true,
            createdAt: true,
            // Security: Context is fetched but sanitized below before returning
            context: true,
          },
        }),
        prisma.errorLog.count({ where }),
      ]);

      // Security: Sanitize error messages AND context to remove potential secrets
      const SECRET_PATTERNS = [
        /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
        /password["\s:=]+[^\s,}"]+/gi,
        /(?:api[_-]?key|secret|token|authorization)["\s:=]+[^\s,}"]+/gi,
        /postgres(?:ql)?:\/\/[^\s"]+/gi,
        /mongodb(?:\+srv)?:\/\/[^\s"]+/gi,
        /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT tokens
      ];

      const sanitizeString = (str: string): string => {
        let result = str;
        for (const pattern of SECRET_PATTERNS) {
          result = result.replace(pattern, "[REDACTED]");
        }
        return result;
      };

      const sanitizeContext = (ctx: unknown): unknown => {
        if (typeof ctx === "string") return sanitizeString(ctx);
        if (Array.isArray(ctx)) return ctx.map(sanitizeContext);
        if (ctx && typeof ctx === "object") {
          const result: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(ctx)) {
            // Completely redact keys that look like secrets
            if (
              /(?:password|secret|token|key|authorization|credential)/i.test(
                key,
              )
            ) {
              result[key] = "[REDACTED]";
            } else {
              result[key] = sanitizeContext(value);
            }
          }
          return result;
        }
        return ctx;
      };

      const sanitizedErrors = errors.map((err) => ({
        ...err,
        message: sanitizeString(err.message),
        context: sanitizeContext(err.context),
      }));

      return {
        errors: sanitizedErrors,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
  );

  // =====================================================================
  // GET /payments — Global payment feed across all workspaces
  // =====================================================================
  server.get<{ Querystring: Static<typeof PaymentsQuery> }>(
    "/payments",
    {
      schema: { querystring: PaymentsQuery },
    },
    async (request) => {
      const { page = 1, limit = 20, status } = request.query;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (status) where.status = status;

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            lease: {
              include: {
                tenant: { select: { id: true, name: true, email: true } },
                property: { select: { id: true, name: true, address: true } },
              },
            },
            workspace: { select: { id: true, name: true } },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      return {
        payments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
  );

  // =====================================================================
  // GET /upgrade-requests — List manual upgrade requests
  // =====================================================================
  server.get<{ Querystring: Static<typeof UpgradeRequestsQuery> }>(
    "/upgrade-requests",
    {
      schema: { querystring: UpgradeRequestsQuery },
    },
    async (request) => {
      const { page = 1, limit = 20, status } = request.query;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (status) where.status = status;

      const [requests, total] = await Promise.all([
        prisma.upgradeRequest.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                plan: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        }),
        prisma.upgradeRequest.count({ where }),
      ]);

      return {
        requests,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
  );

  // =====================================================================
  // POST /upgrade-requests/:id/approve — Approve manual upgrade request
  // =====================================================================
  server.post<{
    Params: { id: string };
    Body: Static<typeof ApproveUpgradeBody>;
  }>(
    "/upgrade-requests/:id/approve",
    {
      schema: { body: ApproveUpgradeBody },
    },
    async (request) => {
      const { id } = request.params;
      const { durationMonths = 12 } = request.body;

      const upgradeRequest = await prisma.upgradeRequest.findUnique({
        where: { id },
      });

      if (!upgradeRequest) throw new NotFoundError("Upgrade request not found");
      if (upgradeRequest.status !== "PENDING") {
        throw new ValidationError("Upgrade request is already processed");
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

      // Upgrade the workspace and request status in a transaction
      const [updatedRequest, updatedWorkspace] = await prisma.$transaction([
        prisma.upgradeRequest.update({
          where: { id },
          data: { status: "APPROVED" },
        }),
        prisma.workspace.update({
          where: { id: upgradeRequest.workspaceId },
          data: {
            plan: upgradeRequest.requestedPlan,
            subscriptionExpiresAt: expiresAt,
            status: "ACTIVE",
          },
        }),
      ]);

      return {
        success: true,
        upgradeRequest: updatedRequest,
        workspace: updatedWorkspace,
      };
    },
  );

  // =====================================================================
  // POST /upgrade-requests/:id/reject — Reject manual upgrade request
  // =====================================================================
  server.post<{
    Params: { id: string };
    Body: Static<typeof RejectUpgradeBody>;
  }>(
    "/upgrade-requests/:id/reject",
    {
      schema: { body: RejectUpgradeBody },
    },
    async (request) => {
      const { id } = request.params;
      const { reason } = request.body;

      const upgradeRequest = await prisma.upgradeRequest.findUnique({
        where: { id },
      });

      if (!upgradeRequest) throw new NotFoundError("Upgrade request not found");
      if (upgradeRequest.status !== "PENDING") {
        throw new ValidationError("Upgrade request is already processed");
      }

      const updatedRequest = await prisma.upgradeRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: reason,
        },
      });

      return {
        success: true,
        upgradeRequest: updatedRequest,
      };
    },
  );
}
