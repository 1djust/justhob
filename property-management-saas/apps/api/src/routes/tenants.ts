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
import { tenantsCache, clearWorkspaceCache, CACHE_TTL } from "../lib/cache";
import { logAction } from "../lib/audit";

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
  allowPartialPayments: Type.Optional(
    Type.Union([Type.Boolean(), Type.Null()]),
  ),
});
const CreateLeaseBody = Type.Object({
  propertyId: Type.Optional(Type.String()),
  unitId: Type.Optional(Type.String()),
  startDate: Type.Optional(Type.String()),
  endDate: Type.Optional(Type.String()),
  yearlyRent: Type.Optional(Type.Union([Type.String(), Type.Number()])),
  agreementText: Type.Optional(Type.String()),
  managerSignature: Type.Optional(Type.String()),
  legalDocUrl: Type.Optional(Type.String()),
});
const EndTenancyBody = Type.Object({
  leaseId: Type.String(),
  reason: Type.Optional(Type.String()),
});

const CreateLegalLeaseRequestBody = Type.Object({
  propertyId: Type.String(),
  unitId: Type.Optional(Type.String()),
  startDate: Type.String(),
  endDate: Type.Optional(Type.String()),
  yearlyRent: Type.Union([Type.String(), Type.Number()]),
  managerSignature: Type.String(),
  tenantName: Type.String(),
  tenantAddress: Type.String(),
  landlordName: Type.String(),
  landlordAddress: Type.String(),
  proofUrl: Type.String(),
});

const UploadLegalDocParams = Type.Object({
  workspaceId: Type.String(),
  id: Type.String(),
  leaseId: Type.String(),
});

const UploadLegalDocBody = Type.Object({
  legalDocUrl: Type.String(),
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

      const userId = request.userId!;
      const cacheKey = `${userId}:${workspaceId}:${pageNum}:${limitNum}`;
      const now = Date.now();
      const cached = tenantsCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return reply.send(cached.response);
      }

      const whereClause = { workspaceId, deletedAt: null };

      const [tenants, total] = await Promise.all([
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

      const responseBody = {
        tenants,
        pagination: {
          total,
          page: pageNum,
          pageSize: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      };

      tenantsCache.set(cacheKey, {
        response: responseBody,
        expiresAt: Date.now() + CACHE_TTL,
      });

      return reply.send(responseBody);
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
              payments: {
                orderBy: { dueDate: "desc" },
              },
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
        .$transaction(
          async (tx: Prisma.TransactionClient) => {
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
              const frontendUrl =
                process.env.FRONTEND_URL || "https://justhob.vercel.app";
              const { data: linkData, error: linkError } =
                await supabaseAdmin.auth.admin.generateLink({
                  type: "invite",
                  email,
                  options: {
                    data: { name, role: "TENANT", mustChangePassword: true },
                    redirectTo: `${frontendUrl}/login`,
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
                    data: { id: supabaseUserId, email, name, role: "TENANT" },
                  });
                } else if (!existingDbUser) {
                  await tx.user.create({
                    data: { id: supabaseUserId, email, name, role: "TENANT" },
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
                  create: {
                    userId: supabaseUserId,
                    workspaceId,
                    role: "TENANT",
                  },
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
          },
          { timeout: 15000 },
        )
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

      await logAction({
        userId: request.userId!,
        action: "CREATE_TENANT",
        entityType: "TENANT",
        entityId: (result as { tenant: { id: string } }).tenant.id,
        details: `Created tenant profile for "${name}" (${email || "no email"}).`,
        workspaceId,
      });

      clearWorkspaceCache(workspaceId);

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

        await logAction({
          userId: request.userId!,
          action: "UPDATE_TENANT",
          entityType: "TENANT",
          entityId: tenant.id,
          details: `Updated tenant profile details for "${tenant.name}".`,
          workspaceId,
        });

        clearWorkspaceCache(workspaceId);
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

        await logAction({
          userId: request.userId!,
          action: "DELETE_TENANT",
          entityType: "TENANT",
          entityId: id,
          details: `Deleted tenant "${tenant.name}" (${tenant.email || "no email"}) and cleaned up auth credentials.`,
          workspaceId,
        });

        // Notify the deleted tenant directly to trigger a dashboard/app reload
        (fastify as any).io.to(`user:${id}`).emit("WORKSPACE_MEMBER_REMOVED", {
          workspaceId,
          message: "You have been removed from this workspace.",
        });

        clearWorkspaceCache(workspaceId);
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
      const {
        propertyId,
        unitId,
        startDate,
        endDate,
        yearlyRent,
        agreementText,
        managerSignature,
        legalDocUrl,
      } = request.body;

      if (!propertyId || !startDate) {
        return reply
          .status(400)
          .send({ error: "Property ID and start date are required" });
      }

      // Check if tenant already has an active or pending lease
      const existingLease = await prisma.lease.findFirst({
        where: {
          tenantId: id,
          status: {
            in: [
              "ACTIVE",
              "PENDING_RENEWAL",
              "PENDING_SIGNATURE",
              "PENDING_LEGAL_VERIFICATION",
              "PENDING_LEGAL_UPLOAD",
            ],
          },
        },
      });

      if (existingLease) {
        return reply
          .status(400)
          .send({ error: "Tenant already has an active or pending lease." });
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
          status: "PENDING_SIGNATURE",
          agreementText: agreementText || null,
          managerSignature: managerSignature || null,
          legalDocUrl: legalDocUrl || null,
        },
        include: {
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
        },
      });

      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${workspaceId}`)
        .emit("LEASE_UPDATED", {
          workspaceId,
          message: "Lease status changed",
        });

      await logAction({
        userId: request.userId!,
        action: "CREATE_LEASE",
        entityType: "LEASE",
        entityId: lease.id,
        details: `Created lease agreement for tenant ID "${id}" in property "${lease.property.name}" (Unit ${lease.unit?.unitNumber || "N/A"}).`,
        workspaceId,
      });

      clearWorkspaceCache(workspaceId);
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
        return reply.status(403).send({
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

      await logAction({
        userId: request.userId!,
        action: "TERMINATE_LEASE",
        entityType: "LEASE",
        entityId: leaseId,
        details: `Ended tenancy early/terminated lease for tenant "${lease.tenant.name}" at property "${lease.property.name}" due to reason: "${reason}".`,
        workspaceId,
      });

      clearWorkspaceCache(workspaceId);
      return reply.send({ success: true, lease: updatedLease });
    },
  );

  // Submit legal lease request
  server.post<{
    Params: Static<typeof TenantIdParams>;
    Body: Static<typeof CreateLegalLeaseRequestBody>;
  }>(
    "/:id/legal-lease-request",
    {
      preHandler: requireManager,
      schema: { params: TenantIdParams, body: CreateLegalLeaseRequestBody },
    },
    async (request, reply) => {
      const { workspaceId, id: tenantId } = request.params;
      const {
        propertyId,
        unitId,
        startDate,
        endDate,
        yearlyRent,
        managerSignature,
        tenantName,
        tenantAddress,
        landlordName,
        landlordAddress,
        proofUrl,
      } = request.body;

      // Check if tenant already has an active or pending lease
      const existingLease = await prisma.lease.findFirst({
        where: {
          tenantId,
          status: {
            in: [
              "ACTIVE",
              "PENDING_RENEWAL",
              "PENDING_SIGNATURE",
              "PENDING_LEGAL_VERIFICATION",
              "PENDING_LEGAL_UPLOAD",
            ],
          },
        },
      });

      if (existingLease) {
        return reply.status(400).send({
          error: "Tenant already has an active or pending lease request.",
        });
      }

      // Verify workspace, tenant & property access
      const property = await prisma.property.findFirst({
        where: { id: propertyId, workspaceId, deletedAt: null },
      });
      if (!property) {
        return reply.status(404).send({ error: "Property not found" });
      }

      if (unitId) {
        const unit = await prisma.unit.findFirst({
          where: { id: unitId, propertyId, workspaceId },
        });
        if (!unit) {
          return reply.status(404).send({ error: "Unit not found" });
        }
      }

      const rentNum = Number(yearlyRent) || 0;
      const feeAmount = rentNum * 0.1; // 10% fee

      // Generate default legal lease agreement text to save
      const agreementText = `LEGAL LEASE AGREEMENT

This Agreement is made on ${new Date().toLocaleDateString()} between ${landlordName} (Landlord) of ${landlordAddress} and ${tenantName} (Tenant) of ${tenantAddress}.

1. PROPERTY & UNIT: The Landlord agrees to rent to the Tenant, and the Tenant agrees to lease, the property located at ${property.name}, specifically Unit ${
        unitId
          ? (await prisma.unit.findUnique({ where: { id: unitId } }))
              ?.unitNumber || ""
          : "the assigned unit"
      }.

2. TERM: The lease term begins on ${new Date(startDate).toLocaleDateString()}${
        endDate
          ? ` and ends on ${new Date(endDate).toLocaleDateString()}`
          : " and will run continuously until terminated"
      }.

3. RENT: The Tenant agrees to pay a yearly rent of ₦${rentNum.toLocaleString()}, payable in advance.

4. TENANT RESPONSIBILITIES:
   - The Tenant shall keep the premises clean and in good repair.
   - The Tenant shall notify the landlord of any maintenance issues promptly.
   - The Tenant shall comply with all building rules and regulations.

5. SIGNATURES: By signing below, both parties agree to the terms and conditions outlined in this lease agreement.

____________________________________
Landlord/Property Manager: ${landlordName}

____________________________________
Tenant: ${tenantName}`;

      // Create the lease first with status PENDING_LEGAL_VERIFICATION
      const lease = await prisma.lease.create({
        data: {
          tenantId,
          propertyId,
          unitId: unitId || null,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          yearlyRent: rentNum,
          status: "PENDING_LEGAL_VERIFICATION",
          agreementText,
          managerSignature,
        },
      });

      // Create the legal lease request record
      const legalRequest = await prisma.legalLeaseRequest.create({
        data: {
          workspaceId,
          tenantId,
          leaseId: lease.id,
          tenantName,
          tenantAddress,
          landlordName,
          landlordAddress,
          feeAmount,
          proofUrl,
          status: "PENDING",
        },
      });

      // Send automated email to the manager
      const managerUser = await prisma.user.findUnique({
        where: { id: request.userId },
      });
      if (managerUser && managerUser.email) {
        const { sendEmail } = await import("../lib/mailer");
        await sendEmail(
          managerUser.email,
          "Legal Lease Request Submitted - Verification Pending",
          `Hello ${managerUser.name || "Manager"},\n\n` +
            `Your request for a legal lease agreement document for tenant "${tenantName}" has been successfully submitted.\n` +
            `- Property: ${property.name}\n` +
            `- Yearly Rent: ₦${rentNum.toLocaleString()}\n` +
            `- Service Fee (10%): ₦${feeAmount.toLocaleString()}\n\n` +
            `Our admin team is currently verifying your proof of payment. Once verified, the legal lease agreement document will be sent to your email (${managerUser.email}) within 48 hours.\n\n` +
            `Best regards,\nPropertyStack Support Team`,
        );
      }

      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${workspaceId}`)
        .emit("LEASE_UPDATED", {
          leaseId: lease.id,
          message: "Lease status changed",
        });

      await logAction({
        userId: request.userId!,
        action: "REQUEST_LEGAL_LEASE",
        entityType: "LEASE",
        entityId: lease.id,
        details: `Requested a legal lease draft for tenant ID "${tenantId}" (Drafting fee: ₦${feeAmount.toLocaleString()}).`,
        workspaceId,
      });

      clearWorkspaceCache(workspaceId);
      return reply.status(201).send({ success: true, lease, legalRequest });
    },
  );

  // Upload legal agreement document
  server.post<{
    Params: Static<typeof UploadLegalDocParams>;
    Body: Static<typeof UploadLegalDocBody>;
  }>(
    "/:id/leases/:leaseId/upload-legal-document",
    {
      preHandler: requireManager,
      schema: { params: UploadLegalDocParams, body: UploadLegalDocBody },
    },
    async (request, reply) => {
      const { workspaceId, id: tenantId, leaseId } = request.params;
      const { legalDocUrl } = request.body;

      const lease = await prisma.lease.findFirst({
        where: {
          id: leaseId,
          tenantId,
          status: "PENDING_LEGAL_UPLOAD",
        },
        include: {
          tenant: true,
        },
      });

      if (!lease) {
        return reply
          .status(404)
          .send({ error: "Lease not found or not in pending upload status" });
      }

      const updatedLease = await prisma.lease.update({
        where: { id: leaseId },
        data: {
          legalDocUrl,
          status: "PENDING_SIGNATURE",
        },
      });

      // Send email to tenant that lease is ready to sign
      if (lease.tenant.email) {
        const { sendEmail } = await import("../lib/mailer");
        await sendEmail(
          lease.tenant.email,
          "Your Legal Lease Agreement is Ready for Signature",
          `Hello ${lease.tenant.name || "Resident"},\n\n` +
            `Your landlord has uploaded the custom legal lease agreement document for your tenancy.\n\n` +
            `Please open the PropertyStack tenant mobile app, view the document, and type your name to sign the agreement.\n\n` +
            `Best regards,\nPropertyStack Support Team`,
        );
      }

      (fastify as unknown as { io: import("socket.io").Server }).io
        .to(`workspace:${workspaceId}`)
        .emit("LEASE_UPDATED", {
          leaseId,
          message: "Lease status changed",
        });

      await logAction({
        userId: request.userId!,
        action: "UPLOAD_LEASE_DOCUMENT",
        entityType: "LEASE",
        entityId: leaseId,
        details: `Uploaded lease agreement terms document for tenant "${lease.tenant.name}".`,
        workspaceId,
      });

      clearWorkspaceCache(workspaceId);
      return reply.send({ success: true, lease: updatedLease });
    },
  );
}
