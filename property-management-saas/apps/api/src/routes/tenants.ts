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
import { sanitizePromptInput } from "../lib/ai-guardrails";
import { sendEmail } from "../lib/mailer";
import { renderEmailLayout, escapeHtml } from "../lib/email-template";

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

/**
 * Dispatches an official branded welcome and onboarding email to a newly created tenant.
 */
export async function sendTenantWelcomeEmail(params: {
  tenantEmail: string;
  tenantName?: string | null;
  managerName?: string;
  workspaceName?: string;
  tempPassword?: string;
  inviteLink?: string | null;
  frontendUrl: string;
}) {
  const {
    tenantEmail,
    tenantName = "there",
    managerName = "Your Property Manager",
    workspaceName = "PropertyStack Workspace",
    tempPassword,
    inviteLink,
    frontendUrl,
  } = params;

  // Ensure public links in emails never contain localhost or unencrypted http
  const publicBaseUrl =
    frontendUrl &&
    !frontendUrl.includes("localhost") &&
    !frontendUrl.includes("127.0.0.1")
      ? frontendUrl.replace(/\/$/, "")
      : "https://propertystack.vercel.app";

  const displayName =
    tenantName && tenantName.trim().length > 0 ? tenantName.trim() : "there";
  // Always use the official branded web portal URL for the primary action button.
  // Never pass external third-party backend links (*.supabase.co) into email CTA buttons,
  // as email security scanners (Gmail, Outlook) immediately classify mismatched authentication links as phishing.
  const actionUrl = `${publicBaseUrl}/login?email=${encodeURIComponent(tenantEmail)}`;
  const appDownloadUrl = `${publicBaseUrl}/download`;
  const subject = `Welcome to ${workspaceName} on PropertyStack`;

  const bodyHtml = `
    <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">
      Welcome to your resident portal
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Hi <strong>${escapeHtml(displayName)}</strong>,
    </p>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
      <strong>${escapeHtml(managerName)}</strong> has created your resident profile for <strong>${escapeHtml(workspaceName)}</strong> on PropertyStack. You can now access your tenancy details, review lease agreements, and manage rent payments directly online or on mobile.
    </p>

    <!-- SINGLE PRIMARY CALL TO ACTION -->
    <div style="margin: 0 0 28px 0; text-align: center;">
      <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 13px 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 102, 255, 0.25);">
        Sign In to Your Account
      </a>
    </div>

    <!-- CLEAN ACCOUNT DETAILS BOX -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 0 0 24px 0;">
      <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
        Account Sign-In Details
      </p>
      <p style="margin: 0 0 6px 0; font-size: 14px; color: #1e293b;">
        <strong>Email:</strong> ${escapeHtml(tenantEmail)}
      </p>
      ${
        tempPassword
          ? `
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b;">
        <strong>Temporary Password:</strong> <code style="font-family: monospace; background-color: #ffffff; padding: 3px 8px; border-radius: 4px; border: 1px solid #cbd5e1; font-weight: 600; color: #0066FF;">${escapeHtml(tempPassword)}</code>
      </p>
      <p style="margin: 0; font-size: 12px; color: #64748b;">
        Sign in with this temporary password. You can change your password at any time in your profile settings.
      </p>
      `
          : ""
      }
    </div>

    <!-- MOBILE APP ACCESS NOTE -->
    <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #64748b;">
      Prefer mobile? You can also <a href="${appDownloadUrl}" style="color: #0066FF; font-weight: 600; text-decoration: underline;">download the PropertyStack app</a> to manage your tenancy on the go.
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    badge: "TENANT ONBOARDING",
    bodyHtml,
    recipientEmail: tenantEmail,
    preheader: `Welcome to your resident portal for ${workspaceName} on PropertyStack. View your tenancy details and sign in.`,
  });

  const plainText = `Hi ${displayName},\n\n${managerName} has created your resident profile for ${workspaceName} on PropertyStack.\n\nSign in to your account:\n${actionUrl}\n\nAccount Sign-In Details:\n- Email: ${tenantEmail}\n${tempPassword ? `- Temporary Password: ${tempPassword}\n` : ""}\nPrefer mobile? Download the PropertyStack app:\n${appDownloadUrl}\n\nBest regards,\nThe PropertyStack Team`;

  await sendEmail(tenantEmail, subject, plainText, html);
}

/**
 * Notifies all landlords associated with a workspace (via WorkspaceMember or Property ownership)
 * about the creation of a new tenant profile via both in-app notification and email.
 */
export async function notifyLandlordsOfNewTenant(params: {
  fastify: FastifyInstance;
  workspaceId: string;
  tenantName: string;
  tenantEmail?: string | null;
  tenantPhone?: string | null;
  managerName?: string;
  workspaceName?: string;
  frontendUrl: string;
}) {
  const {
    fastify,
    workspaceId,
    tenantName,
    tenantEmail,
    tenantPhone,
    managerName = "Your Property Manager",
    workspaceName = "PropertyStack Workspace",
    frontendUrl,
  } = params;

  // 1. Find all landlords in this workspace:
  // - Workspace members with role "LANDLORD"
  // - Property owners who have properties in this workspace
  const [landlordMembers, propertyOwners] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId, role: "LANDLORD" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.property.findMany({
      where: { workspaceId, ownerId: { not: null }, deletedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const landlordMap = new Map<
    string,
    { id: string; name: string | null; email: string }
  >();

  for (const m of landlordMembers) {
    if (m.user && m.user.email) {
      landlordMap.set(m.user.id, {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
      });
    }
  }

  for (const p of propertyOwners) {
    if (p.owner && p.owner.email) {
      landlordMap.set(p.owner.id, {
        id: p.owner.id,
        name: p.owner.name,
        email: p.owner.email,
      });
    }
  }

  const landlords = Array.from(landlordMap.values());
  if (landlords.length === 0) return;

  const publicBaseUrl =
    frontendUrl &&
    !frontendUrl.includes("localhost") &&
    !frontendUrl.includes("127.0.0.1")
      ? frontendUrl.replace(/\/$/, "")
      : "https://propertystack.vercel.app";

  const subject = `New Tenant Profile Created: ${tenantName} - ${workspaceName}`;
  const landlordHubUrl = `${publicBaseUrl}/landlord/tenants`;

  await Promise.all(
    landlords.map(async (landlord) => {
      // 1. In-App Notification record in DB
      try {
        const notification = await prisma.notification.create({
          data: {
            userId: landlord.id,
            title: "New Tenant Created",
            message: `Manager ${managerName} created a profile for tenant "${tenantName}" in "${workspaceName}".`,
            type: "TENANT_CREATED",
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
          `Failed to create in-app notification for landlord ${landlord.id}`,
        );
      }

      // 2. Official email notification to landlord
      try {
        const displayName =
          landlord.name && landlord.name.trim().length > 0
            ? landlord.name.trim()
            : "Landlord";
        const bodyHtml = `
          <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">
            New Tenant Profile Created
          </h2>
          <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
            Hi <strong>${escapeHtml(displayName)}</strong>,
          </p>
          <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
            Your property manager, <strong>${escapeHtml(managerName)}</strong>, has registered a new tenant profile in <strong>"${escapeHtml(workspaceName)}"</strong>.
          </p>

          <!-- TENANT DETAILS BOX -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0066FF; border-radius: 8px; padding: 18px 20px; margin: 0 0 24px 0;">
            <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
              Tenant Information
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
              <tr>
                <td style="padding: 6px 0; font-weight: 600; width: 140px; color: #64748b;">Full Name:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${escapeHtml(tenantName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Email Address:</td>
                <td style="padding: 6px 0;">${tenantEmail ? escapeHtml(tenantEmail) : "<em>Not provided</em>"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Phone Number:</td>
                <td style="padding: 6px 0;">${tenantPhone ? escapeHtml(tenantPhone) : "<em>Not provided</em>"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Date Registered:</td>
                <td style="padding: 6px 0;">${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
              </tr>
            </table>
          </div>

          <!-- ACTION BUTTON -->
          <div style="margin: 0 0 24px 0;">
            <a href="${landlordHubUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 26px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0, 102, 255, 0.25);">
              View Landlord Tenants Hub &rarr;
            </a>
          </div>
          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
            You can also monitor this tenant and view occupancy status in real-time from your PropertyStack Landlord Mobile App.
          </p>
        `;

        const html = renderEmailLayout({
          title: subject,
          badge: "TENANT NOTIFICATION",
          bodyHtml,
          recipientEmail: landlord.email,
          preheader: `New tenant profile created for ${tenantName} in ${workspaceName}.`,
        });

        const plainText = `Hi ${displayName},\n\nYour property manager, ${managerName}, has created a new tenant profile in ${workspaceName}.\n\nTenant Details:\n- Name: ${tenantName}\n- Email: ${tenantEmail || "Not provided"}\n- Phone: ${tenantPhone || "Not provided"}\n- Date: ${new Date().toLocaleDateString()}\n\nView details in your Landlord Tenants Hub:\n${landlordHubUrl}\n\nBest regards,\nThe PropertyStack Team`;

        await sendEmail(landlord.email, subject, plainText, html);
      } catch (emailErr) {
        fastify.log.error(
          emailErr,
          `Failed to send tenant creation email to landlord ${landlord.email}`,
        );
      }
    }),
  );
}

/**
 * Notifies a tenant when a lease agreement has been prepared and assigned to them,
 * triggering an in-app notification, WebSocket update, and branded email to review and sign.
 */
export async function notifyTenantOfLeaseReadyToSign(params: {
  fastify: FastifyInstance;
  workspaceId: string;
  tenantId: string;
  leaseId: string;
  propertyName: string;
  unitNumber?: string | null;
  startDate: string | Date;
  endDate?: string | Date | null;
  yearlyRent?: number;
  managerName?: string;
  workspaceName?: string;
  frontendUrl: string;
}) {
  const {
    fastify,
    workspaceId,
    tenantId,
    leaseId,
    propertyName,
    unitNumber,
    startDate,
    endDate,
    yearlyRent,
    managerName = "Your Property Manager",
    workspaceName = "PropertyStack Workspace",
    frontendUrl,
  } = params;

  // 1. Fetch Tenant details
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, email: true },
  });

  if (!tenant) return;

  const displayName =
    tenant.name && tenant.name.trim().length > 0 ? tenant.name.trim() : "there";
  const unitLabel = unitNumber ? `Unit ${unitNumber}` : "Main Unit";
  const startFormatted = new Date(startDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const endFormatted = endDate
    ? new Date(endDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Ongoing";
  const rentFormatted = yearlyRent ? `₦${yearlyRent.toLocaleString()}` : null;

  // 2. In-App Notification record in DB
  try {
    let targetUserId: string | null = null;
    const directUser = await prisma.user.findUnique({
      where: { id: tenant.id },
      select: { id: true },
    });
    if (directUser) {
      targetUserId = directUser.id;
    } else if (tenant.email) {
      const emailUser = await prisma.user.findUnique({
        where: { email: tenant.email },
        select: { id: true },
      });
      if (emailUser) {
        targetUserId = emailUser.id;
      }
    }

    if (targetUserId) {
      const notification = await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: "Lease Agreement Ready for Signature",
          message: `Manager "${managerName}" prepared your lease agreement for ${unitLabel}, "${propertyName}" in "${workspaceName}". Please review and sign the agreement to activate your tenancy.`,
          type: "LEASE_READY_TO_SIGN",
        },
      });

      // Real-time socket event to the tenant
      fastify.io.to(`user:${targetUserId}`).emit("NOTIFICATION_CREATED", {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt,
      });
    }
  } catch (notifErr) {
    fastify.log.error(
      notifErr,
      `[Lease] Failed to create in-app notification for tenant ${tenant.id}`,
    );
  }

  // 3. Branded Transactional Email
  if (!tenant.email) return;

  try {
    const publicBaseUrl =
      frontendUrl &&
      !frontendUrl.includes("localhost") &&
      !frontendUrl.includes("127.0.0.1")
        ? frontendUrl.replace(/\/$/, "")
        : "https://propertystack.vercel.app";

    const subject = `Lease Agreement Ready for Signature: ${propertyName} - ${workspaceName}`;
    const appDownloadUrl = `${publicBaseUrl}/download`;

    const bodyHtml = `
      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">
        Your Lease Agreement is Ready for Signature
      </h2>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
        Hi <strong>${escapeHtml(displayName)}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
        <strong>${escapeHtml(managerName)}</strong> has prepared your official lease agreement for <strong>${escapeHtml(propertyName)}</strong> in <strong>${escapeHtml(workspaceName)}</strong>.
      </p>

      <!-- TENANCY TERMS SUMMARY BOX -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0066FF; border-radius: 8px; padding: 18px 20px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
          Tenancy Agreement Details
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
          <tr>
            <td style="padding: 6px 0; font-weight: 600; width: 140px; color: #64748b;">Property:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${escapeHtml(propertyName)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Assigned Unit:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0066FF;">${escapeHtml(unitLabel)}</td>
          </tr>
          ${
            rentFormatted
              ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Yearly Rent:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${escapeHtml(rentFormatted)}</td>
          </tr>
          `
              : ""
          }
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Lease Period:</td>
            <td style="padding: 6px 0;">${startFormatted} &ndash; ${endFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Managed By:</td>
            <td style="padding: 6px 0;">${escapeHtml(managerName)}</td>
          </tr>
        </table>
      </div>

      <!-- CALL TO ACTION: MOBILE APP / DOWNLOAD -->
      <div style="margin: 0 0 24px 0; text-align: center;">
        <a href="${appDownloadUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 13px 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 102, 255, 0.25);">
          Open App & Sign Agreement &rarr;
        </a>
      </div>

      <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #64748b; text-align: center;">
        Open the <strong>PropertyStack Mobile App</strong> on your Android device to review the terms, verify the manager's signature, and apply your digital signature.
      </p>
      <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
        Need to log in or download the app first? Visit the <a href="${appDownloadUrl}" style="color: #0066FF; text-decoration: underline;">PropertyStack Mobile Download Center</a>.
      </p>
    `;

    const html = renderEmailLayout({
      title: subject,
      badge: "LEASE AGREEMENT",
      bodyHtml,
      recipientEmail: tenant.email,
      preheader: `Your lease agreement for ${unitLabel}, ${propertyName} in ${workspaceName} is ready for digital signature.`,
    });

    const plainText = `Hi ${displayName},\n\nYour property manager, ${managerName}, has prepared your lease agreement for ${unitLabel}, ${propertyName} in ${workspaceName}.\n\nTenancy Details:\n- Property: ${propertyName}\n- Unit: ${unitLabel}\n${rentFormatted ? `- Yearly Rent: ${rentFormatted}\n` : ""}- Period: ${startFormatted} to ${endFormatted}\n\nPlease open the PropertyStack mobile app on your phone to review the terms and apply your signature:\n${appDownloadUrl}\n\nBest regards,\nThe PropertyStack Team`;

    await sendEmail(tenant.email, subject, plainText, html);
  } catch (emailErr) {
    fastify.log.error(
      emailErr,
      `[Lease] Failed to send lease agreement email to tenant ${tenant.email}`,
    );
  }
}

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
      const userRole = request.userRole!;
      const cacheKey = `${userId}:${workspaceId}:${pageNum}:${limitNum}`;
      const now = Date.now();
      const cached = tenantsCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return reply.send(cached.response);
      }

      const whereClause: Prisma.TenantWhereInput = {
        workspaceId,
        deletedAt: null,
      };

      if (userRole === "LANDLORD") {
        whereClause.leases = { some: { property: { ownerId: userId } } };
      }

      const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
          where: whereClause,
          include: {
            leases: {
              where:
                userRole === "LANDLORD"
                  ? { property: { ownerId: userId } }
                  : undefined,
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
      const userRole = request.userRole || "";
      const userId = request.userId || "";

      const tenantWhere: Prisma.TenantWhereInput = {
        id,
        workspaceId,
        deletedAt: null,
      };

      if (userRole === "LANDLORD") {
        tenantWhere.leases = { some: { property: { ownerId: userId } } };
      }

      const tenant = await prisma.tenant.findFirst({
        where: tenantWhere,
        include: {
          leases: {
            where:
              userRole === "LANDLORD"
                ? { property: { ownerId: userId } }
                : undefined,
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
            // Lock the workspace record to prevent race conditions on limit checks (parameterized with Prisma.sql)
            await tx.$executeRaw(Prisma.sql`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`);

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
                process.env.FRONTEND_URL &&
                !process.env.FRONTEND_URL.includes("localhost") &&
                !process.env.FRONTEND_URL.includes("127.0.0.1")
                  ? process.env.FRONTEND_URL
                  : "https://propertystack.vercel.app";
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
                  const oldId = existingDbUser.id;
                  const newId = supabaseUserId;
                  await tx.$executeRaw(Prisma.sql`UPDATE "WorkspaceMember" SET "userId" = ${newId} WHERE "userId" = ${oldId}`);
                  await tx.$executeRaw(Prisma.sql`UPDATE "Notification" SET "userId" = ${newId} WHERE "userId" = ${oldId}`);
                  await tx.$executeRaw(Prisma.sql`UPDATE "MaintenanceMessage" SET "senderId" = ${newId} WHERE "senderId" = ${oldId}`);
                  await tx.$executeRaw(Prisma.sql`UPDATE "Property" SET "ownerId" = ${newId} WHERE "ownerId" = ${oldId}`);
                  await tx.$executeRaw(Prisma.sql`UPDATE "User" SET id = ${newId} WHERE id = ${oldId}`);
                } else if (!existingDbUser) {
                  await tx.user.create({
                    data: { id: supabaseUserId, email, name, role: "TENANT" },
                  });
                } else {
                  await tx.user.update({
                    where: { id: supabaseUserId },
                    data: { email, name: name || existingDbUser.name },
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
          { maxWait: 10000, timeout: 20000 },
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
      fastify.io
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
        req: request,
      });

      clearWorkspaceCache(workspaceId);

      const frontendUrl =
        process.env.FRONTEND_URL &&
        !process.env.FRONTEND_URL.includes("localhost") &&
        !process.env.FRONTEND_URL.includes("127.0.0.1")
          ? process.env.FRONTEND_URL
          : "https://propertystack.vercel.app";

      // Fetch manager and workspace details for notifications & emails
      const [manager, workspace] = await Promise.all([
        prisma.user.findUnique({
          where: { id: request.userId },
          select: { name: true, email: true },
        }),
        prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        }),
      ]);

      const managerName = manager?.name || "Your Property Manager";
      const workspaceName = workspace?.name || "PropertyStack Workspace";
      const tempPassword = (result as { tempPassword?: string }).tempPassword;
      const inviteLink = (result as { inviteLink?: string }).inviteLink;

      // 1. Send welcome email and in-app welcome notification to the new tenant
      if (email) {
        sendTenantWelcomeEmail({
          tenantEmail: email,
          tenantName: name,
          managerName,
          workspaceName,
          tempPassword,
          inviteLink,
          frontendUrl,
        }).catch((emailErr) => {
          request.log.error(
            { err: emailErr },
            `[Create Tenant] Failed to send welcome email to tenant ${email}`,
          );
        });

        // In-app welcome notification for tenant
        const tenantUserId = (result as { tenant: { id: string } }).tenant.id;
        if (tenantUserId) {
          prisma.notification
            .create({
              data: {
                userId: tenantUserId,
                title: "Welcome to PropertyStack!",
                message: `Your tenant account is active in "${workspaceName}". You can view your lease, pay rent, and submit maintenance requests right here.`,
                type: "WELCOME",
              },
            })
            .catch(() => {});
        }
      }

      // 2. Notify all landlords in this workspace (In-App Notification + Email)
      notifyLandlordsOfNewTenant({
        fastify,
        workspaceId,
        tenantName: name,
        tenantEmail: email || null,
        tenantPhone: phone || null,
        managerName,
        workspaceName,
        frontendUrl,
      }).catch((notifErr) => {
        request.log.error(
          { err: notifErr },
          `[Create Tenant] Failed to notify landlords in workspace ${workspaceId}`,
        );
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

        await logAction({
          userId: request.userId!,
          action: "UPDATE_TENANT",
          entityType: "TENANT",
          entityId: tenant.id,
          details: `Updated tenant profile details for "${tenant.name}".`,
          workspaceId,
          req: request,
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

        // Release any units currently assigned to this tenant's leases back to VACANT
        const tenantLeases = await prisma.lease.findMany({
          where: { tenantId: id, unitId: { not: null } },
          select: { unitId: true },
        });
        const unitIds = tenantLeases
          .map((l) => l.unitId)
          .filter(Boolean) as string[];
        if (unitIds.length > 0) {
          await prisma.unit
            .updateMany({
              where: { id: { in: unitIds } },
              data: { status: "VACANT" },
            })
            .catch(() => {});
        }

        // Hard-delete the tenant record
        await prisma.tenant.delete({
          where: { tenant_workspace_id: { id, workspaceId } },
        });

        // Emit real-time update to the workspace room
        fastify.io
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
          req: request,
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

      if (
        yearlyRent !== undefined &&
        (Number(yearlyRent) < 0 || isNaN(Number(yearlyRent)))
      ) {
        return reply
          .status(400)
          .send({ error: "Yearly rent cannot be negative" });
      }

      // Check if tenant already has an active or pending lease
      const existingLease = await prisma.lease.findFirst({
        where: {
          tenantId: id,
          tenant: { workspaceId },
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

      fastify.io
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
        req: request,
      });

      clearWorkspaceCache(workspaceId);

      const frontendUrl =
        process.env.FRONTEND_URL &&
        !process.env.FRONTEND_URL.includes("localhost") &&
        !process.env.FRONTEND_URL.includes("127.0.0.1")
          ? process.env.FRONTEND_URL
          : "https://propertystack.vercel.app";

      // Asynchronously fetch manager and workspace details to dispatch notification & email
      Promise.all([
        prisma.user.findUnique({
          where: { id: request.userId },
          select: { name: true, email: true },
        }),
        prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        }),
      ])
        .then(([manager, workspace]) => {
          return notifyTenantOfLeaseReadyToSign({
            fastify,
            workspaceId,
            tenantId: id,
            leaseId: lease.id,
            propertyName: lease.property.name,
            unitNumber: lease.unit?.unitNumber || null,
            startDate: lease.startDate,
            endDate: lease.endDate,
            yearlyRent: lease.yearlyRent,
            managerName: manager?.name || "Your Property Manager",
            workspaceName: workspace?.name || "PropertyStack Workspace",
            frontendUrl,
          });
        })
        .catch((notifErr) => {
          request.log.error(
            { err: notifErr },
            `[Create Lease] Failed to dispatch lease ready notification to tenant ${id}`,
          );
        });

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

      fastify.io
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
        req: request,
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
          tenant: { workspaceId },
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

      // Security: Sanitize template inputs to prevent format string, markdown, or delimiter injection
      const cleanLandlord = sanitizePromptInput(landlordName || "", 100).replace(/[\r\n]+/g, " ");
      const cleanLandlordAddr = sanitizePromptInput(landlordAddress || "", 150).replace(/[\r\n]+/g, " ");
      const cleanTenant = sanitizePromptInput(tenantName || "", 100).replace(/[\r\n]+/g, " ");
      const cleanTenantAddr = sanitizePromptInput(tenantAddress || "", 150).replace(/[\r\n]+/g, " ");
      const cleanPropName = sanitizePromptInput(property.name || "", 100).replace(/[\r\n]+/g, " ");

      // Generate default legal lease agreement text to save
      const agreementText = `LEGAL LEASE AGREEMENT

This Agreement is made on ${new Date().toLocaleDateString()} between ${cleanLandlord} (Landlord) of ${cleanLandlordAddr} and ${cleanTenant} (Tenant) of ${cleanTenantAddr}.

1. PROPERTY & UNIT: The Landlord agrees to rent to the Tenant, and the Tenant agrees to lease, the property located at ${cleanPropName}, specifically Unit ${
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
Landlord/Property Manager: ${cleanLandlord}

____________________________________
Tenant: ${cleanTenant}`;

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

      fastify.io
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
        req: request,
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
          tenant: { workspaceId },
          status: "PENDING_LEGAL_UPLOAD",
        },
        include: {
          tenant: true,
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
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

      // Send branded email and in-app notification to tenant that lease is ready to sign
      const frontendUrl =
        process.env.FRONTEND_URL &&
        !process.env.FRONTEND_URL.includes("localhost") &&
        !process.env.FRONTEND_URL.includes("127.0.0.1")
          ? process.env.FRONTEND_URL
          : "https://propertystack.vercel.app";

      Promise.all([
        prisma.user.findUnique({
          where: { id: request.userId },
          select: { name: true },
        }),
        prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        }),
      ])
        .then(([manager, workspace]) => {
          return notifyTenantOfLeaseReadyToSign({
            fastify,
            workspaceId,
            tenantId,
            leaseId,
            propertyName: lease.property.name,
            unitNumber: lease.unit?.unitNumber || null,
            startDate: lease.startDate,
            endDate: lease.endDate,
            yearlyRent: lease.yearlyRent,
            managerName: manager?.name || "Your Property Manager",
            workspaceName: workspace?.name || "PropertyStack Workspace",
            frontendUrl,
          });
        })
        .catch((notifErr) => {
          fastify.log.error(
            notifErr,
            `[Upload Legal Doc] Failed to notify tenant ${tenantId} of signed document ready`,
          );
        });

      fastify.io
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
        req: request,
      });

      clearWorkspaceCache(workspaceId);
      return reply.send({ success: true, lease: updatedLease });
    },
  );
}
