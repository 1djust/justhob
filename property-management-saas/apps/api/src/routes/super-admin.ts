import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database";
import { authenticate, requireSuperAdmin } from "../lib/middleware";
import { supabaseAdmin } from "../lib/supabase";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors";
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

const VerifyLegalLeaseBody = Type.Object({
  status: Type.Union([Type.Literal("VERIFIED"), Type.Literal("REJECTED")]),
  reason: Type.Optional(Type.String({ maxLength: 500 })),
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

const AuditLogsQuery = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  workspaceId: Type.Optional(Type.String()),
  actorId: Type.Optional(Type.String()),
  action: Type.Optional(Type.String()),
  search: Type.Optional(Type.String({ maxLength: 200 })),
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
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Batch 1: Basic dashboard counts & aggregates (16 queries)
    const [
      totalUsers,
      activeUsers,
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

    const inactiveUsers = totalUsers - activeUsers;

    // Batch 2: Advanced target, charts YTD data and sparkline lists (8 queries to prevent pool exhaustion)
    const [
      monthlyTargetPayments,
      recentOverduePaymentsList,
      recentWorkspacesList,
      recentPropertiesList,
      recentLeasesList,
      recentErrorsList,
      paidPaymentsInYear,
      usersInYear,
    ] = await Promise.all([
      prisma.payment.findMany({
        where: {
          dueDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        select: { amount: true },
      }),
      prisma.payment.findMany({
        where: { status: "OVERDUE", updatedAt: { gte: sevenDaysAgo } },
        select: { updatedAt: true },
      }),
      prisma.workspace.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
      prisma.property.findMany({
        where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null },
        select: { createdAt: true },
      }),
      prisma.lease.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
      prisma.errorLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
      prisma.payment.findMany({
        where: { status: "PAID", paidDate: { gte: startOfYear } },
        select: { paidDate: true, amount: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: startOfYear } },
        select: { createdAt: true, isActive: true, updatedAt: true },
      }),
    ]);

    // Calculate monthly target and collected metrics
    const monthlyTarget = monthlyTargetPayments.reduce(
      (sum, p) => sum + p.amount,
      0,
    );

    // In-memory filters to reduce query count and prevent database pool timeouts
    const monthlyCollectedPayments = paidPaymentsInYear.filter(
      (p) =>
        p.paidDate && p.paidDate >= startOfMonth && p.paidDate <= endOfMonth,
    );
    const todayPayments = paidPaymentsInYear.filter(
      (p) =>
        p.paidDate && p.paidDate >= startOfToday && p.paidDate <= endOfToday,
    );
    const recentPaidPaymentsList = paidPaymentsInYear.filter(
      (p) => p.paidDate && p.paidDate >= sevenDaysAgo,
    );
    const recentUsersList = usersInYear.filter(
      (u) => u.createdAt >= sevenDaysAgo,
    );
    const recentBannedUsersList = usersInYear.filter(
      (u) => !u.isActive && u.updatedAt >= sevenDaysAgo,
    );

    const monthlyRevenueCollected = monthlyCollectedPayments.reduce(
      (sum, p) => sum + p.amount,
      0,
    );
    const todayRevenue = todayPayments.reduce((sum, p) => sum + p.amount, 0);

    // Helper to bucket dates into 7 days (index 0 is 6 days ago, index 6 is today)
    const getDailyBuckets = (dates: Date[], values?: number[]) => {
      const buckets = Array(7).fill(0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      dates.forEach((date, i) => {
        if (!date) return;
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - d.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) {
          const index = 6 - diffDays;
          buckets[index] += values ? values[i] : 1;
        }
      });
      return buckets;
    };

    const trends = {
      users: getDailyBuckets(recentUsersList.map((u) => u.createdAt)),
      workspaces: getDailyBuckets(recentWorkspacesList.map((w) => w.createdAt)),
      properties: getDailyBuckets(recentPropertiesList.map((p) => p.createdAt)),
      leases: getDailyBuckets(recentLeasesList.map((l) => l.createdAt)),
      revenue: getDailyBuckets(
        recentPaidPaymentsList
          .filter((p) => p.paidDate !== null)
          .map((p) => p.paidDate as Date),
        recentPaidPaymentsList
          .filter((p) => p.paidDate !== null)
          .map((p) => p.amount),
      ),
      overdue: getDailyBuckets(
        recentOverduePaymentsList.map((p) => p.updatedAt),
      ),
      banned: getDailyBuckets(recentBannedUsersList.map((u) => u.updatedAt)),
      errors: getDailyBuckets(recentErrorsList.map((e) => e.createdAt)),
    };

    // Monthly aggregation
    const MONTH_NAMES = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const monthlyRevenueArr = Array(12).fill(0);
    paidPaymentsInYear.forEach((p) => {
      if (p.paidDate) {
        const month = p.paidDate.getMonth();
        monthlyRevenueArr[month] += p.amount;
      }
    });
    const monthlyRevenueData = MONTH_NAMES.map((name, index) => ({
      month: name,
      revenue: monthlyRevenueArr[index],
    }));

    const monthlySignups = Array(12).fill(0);
    usersInYear.forEach((u) => {
      const month = u.createdAt.getMonth();
      monthlySignups[month]++;
    });
    const monthlySignupsData = MONTH_NAMES.map((name, index) => ({
      month: name,
      count: monthlySignups[index],
    }));

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
        monthlyTarget,
        monthlyRevenueCollected,
        todayRevenue,
        trends,
        monthlyRevenue: monthlyRevenueData,
        monthlySignups: monthlySignupsData,
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

      const where: Record<string, any> = {
        role: "PROPERTY_MANAGER",
      };
      if (search) {
        where.AND = [
          {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          },
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
  // GET /users/:id/hierarchy — Get Landlords and Tenants hierarchy for a manager
  // =====================================================================
  server.get<{ Params: { id: string } }>(
    "/users/:id/hierarchy",
    { schema: {} },
    async (request) => {
      const { id } = request.params;

      const manager = await prisma.user.findUnique({
        where: { id },
        include: {
          workspaces: {
            where: { role: "PROPERTY_MANAGER" },
            select: { workspaceId: true },
          },
        },
      });

      if (!manager) {
        throw new NotFoundError("Manager user not found");
      }

      const workspaceIds = manager.workspaces.map((w) => w.workspaceId);

      // 1. Fetch all landlords in these workspaces
      const landlordMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          role: "LANDLORD",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
            },
          },
        },
      });

      // 2. Fetch all properties owned by these landlords in these workspaces
      const properties = await prisma.property.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          ownerId: { in: landlordMembers.map((lm) => lm.userId) },
          deletedAt: null,
        },
        include: {
          leases: {
            where: { status: "ACTIVE" },
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      // 3. Construct the response hierarchy: Landlord -> Tenants
      const hierarchy = landlordMembers.map((lm) => {
        const landlordUser = lm.user;
        const landlordProperties = properties.filter(
          (p) => p.ownerId === landlordUser.id,
        );

        // Extract unique tenants across all properties owned by this landlord
        const tenantMap = new Map<string, any>();
        for (const prop of landlordProperties) {
          for (const lease of prop.leases) {
            if (lease.tenant) {
              tenantMap.set(lease.tenant.id, {
                id: lease.tenant.id,
                name: lease.tenant.name,
                email: lease.tenant.email,
                phone: lease.tenant.phone,
                propertyName: prop.name,
                unitNumber: lease.unitId,
              });
            }
          }
        }

        return {
          landlord: {
            id: landlordUser.id,
            name: landlordUser.name,
            email: landlordUser.email,
            createdAt: landlordUser.createdAt,
          },
          propertiesCount: landlordProperties.length,
          tenants: Array.from(tenantMap.values()),
        };
      });

      return { hierarchy };
    },
  );

  // =====================================================================
  // GET /users/:id/profile — Get full profile details for any user role
  // =====================================================================
  server.get<{ Params: { id: string } }>(
    "/users/:id/profile",
    { schema: {} },
    async (request) => {
      const { id } = request.params;

      let user = await prisma.user.findUnique({
        where: { id },
        include: {
          workspaces: {
            include: {
              workspace: true,
            },
          },
          propertiesOwned: true,
        },
      });

      let tenantRecord = null;
      if (!user) {
        tenantRecord = await prisma.tenant.findUnique({
          where: { id },
          include: {
            workspace: true,
            leases: {
              include: {
                property: true,
                unit: true,
                payments: {
                  orderBy: { dueDate: "desc" },
                },
              },
            },
            maintenanceRequests: {
              orderBy: { createdAt: "desc" },
            },
          },
        });

        if (tenantRecord && tenantRecord.email) {
          user = await prisma.user.findUnique({
            where: { email: tenantRecord.email },
            include: {
              workspaces: {
                include: {
                  workspace: true,
                },
              },
              propertiesOwned: true,
            },
          });
        }
      } else {
        tenantRecord = await prisma.tenant.findFirst({
          where: { email: user.email },
          include: {
            workspace: true,
            leases: {
              include: {
                property: true,
                unit: true,
                payments: {
                  orderBy: { dueDate: "desc" },
                },
              },
            },
            maintenanceRequests: {
              orderBy: { createdAt: "desc" },
            },
          },
        });
      }

      if (!user && !tenantRecord) {
        throw new NotFoundError("Profile not found");
      }

      return {
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        } : {
          id: tenantRecord!.id,
          name: tenantRecord!.name,
          email: tenantRecord!.email || "No email",
          role: "TENANT",
          isActive: true,
          createdAt: tenantRecord!.createdAt,
          updatedAt: tenantRecord!.updatedAt,
        },
        workspaces: user ? user.workspaces.map((w) => ({
          workspaceId: w.workspaceId,
          name: w.workspace.name,
          role: w.role,
          plan: w.workspace.plan,
        })) : [{
          workspaceId: tenantRecord!.workspaceId,
          name: tenantRecord!.workspace?.name || "Unknown Workspace",
          role: "TENANT",
          plan: tenantRecord!.workspace?.plan || "FREE",
        }],
        propertiesOwned: user ? user.propertiesOwned.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
        })) : [],
        tenantDetails: tenantRecord ? {
          id: tenantRecord.id,
          workspace: tenantRecord.workspace,
          leases: tenantRecord.leases.map((l) => ({
            id: l.id,
            property: l.property.name,
            unit: l.unit?.unitNumber || "None",
            startDate: l.startDate,
            endDate: l.endDate,
            yearlyRent: l.yearlyRent,
            status: l.status,
            payments: l.payments,
          })),
          maintenanceRequests: tenantRecord.maintenanceRequests,
        } : null,
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

  // GET /legal-lease-requests - Get all legal lease requests
  server.get("/legal-lease-requests", async () => {
    const requests = await prisma.legalLeaseRequest.findMany({
      include: {
        workspace: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true, email: true } },
        lease: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            yearlyRent: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, requests };
  });

  // POST /legal-lease-requests/:id/verify - Verify a legal lease request
  server.post<{
    Params: { id: string };
    Body: Static<typeof VerifyLegalLeaseBody>;
  }>(
    "/legal-lease-requests/:id/verify",
    {
      schema: { body: VerifyLegalLeaseBody },
    },
    async (request) => {
      const { id } = request.params;
      const { status, reason } = request.body;

      const legalRequest = await prisma.legalLeaseRequest.findUnique({
        where: { id },
        include: {
          lease: true,
          workspace: true,
        },
      });

      if (!legalRequest)
        throw new NotFoundError("Legal lease request not found");
      if (legalRequest.status !== "PENDING") {
        throw new ValidationError(
          "Legal lease request has already been processed",
        );
      }

      const updatedRequest = await prisma.legalLeaseRequest.update({
        where: { id },
        data: {
          status,
          rejectionReason: status === "REJECTED" ? reason || null : null,
        },
      });

      // Update associated lease status
      const newLeaseStatus =
        status === "VERIFIED" ? "PENDING_LEGAL_UPLOAD" : "REJECTED";
      await prisma.lease.update({
        where: { id: legalRequest.leaseId },
        data: {
          status: newLeaseStatus,
          rejectionReason: status === "REJECTED" ? reason || null : null,
        },
      });

      // Try to send automated email notification to the manager
      const managerMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: legalRequest.workspaceId,
          role: "PROPERTY_MANAGER",
        },
        include: { user: true },
      });

      if (managerMember?.user?.email) {
        const { sendEmail } = await import("../lib/mailer");
        if (status === "VERIFIED") {
          await sendEmail(
            managerMember.user.email,
            "Legal Lease Payment Verified - Action Required",
            `Hello ${managerMember.user.name || "Manager"},\n\n` +
              `Your payment for the legal lease agreement of tenant "${legalRequest.tenantName}" has been verified.\n\n` +
              `The legal team will email the final drafted PDF/JPG document to your email (${managerMember.user.email}) within 48 hours.\n` +
              `Once you receive the document, please log into the application, expand the tenant details row, and upload the file to make it available for the tenant to sign.\n\n` +
              `Best regards,\nPropertyStack Support Team`,
          );
        } else {
          await sendEmail(
            managerMember.user.email,
            "Legal Lease Payment Verification Rejected",
            `Hello ${managerMember.user.name || "Manager"},\n\n` +
              `Your request for a legal lease agreement of tenant "${legalRequest.tenantName}" was rejected.\n` +
              (reason ? `Reason provided: "${reason}"\n\n` : "") +
              `Please check that your uploaded proof of payment image matches the transaction or contact support for help.\n\n` +
              `Best regards,\nPropertyStack Support Team`,
          );
        }
      }

      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${legalRequest.workspaceId}`)
        .emit("LEASE_UPDATED", {
          leaseId: legalRequest.leaseId,
          message: "Lease status changed",
        });

      return {
        success: true,
        legalLeaseRequest: updatedRequest,
      };
    },
  );

  // =====================================================================
  // GET /audit-logs — Retrieve platform-wide manager audit logs
  // =====================================================================
  server.get<{ Querystring: Static<typeof AuditLogsQuery> }>(
    "/audit-logs",
    {
      schema: { querystring: AuditLogsQuery },
    },
    async (request, reply) => {
      const {
        workspaceId,
        actorId,
        action,
        search,
        limit = 50,
        page = 1,
      } = request.query || {};

      const skip = (page - 1) * limit;

      const where = {
        ...(workspaceId ? { workspaceId } : {}),
        ...(actorId ? { actorId } : {}),
        ...(action ? { action } : {}),
        ...(search
          ? {
              OR: [
                { actorName: { contains: search, mode: "insensitive" as const } },
                { actorEmail: { contains: search, mode: "insensitive" as const } },
                { details: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [logs, totalCount] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return reply.send({
        logs,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          page,
          limit,
        },
      });
    },
  );
}
