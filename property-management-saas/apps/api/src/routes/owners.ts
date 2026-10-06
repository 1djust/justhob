import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/database";
import { authenticate } from "../lib/middleware";
import { supabaseAdmin } from "../lib/supabase";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { PayoutStrategy } from "@prisma/client";
import { logAction } from "../lib/audit";
import { randomBytes } from "crypto";
import { sendEmail } from "../lib/mailer";
import { renderEmailLayout, escapeHtml } from "../lib/email-template";

const WorkspaceParams = Type.Object({ workspaceId: Type.String() });
const CreateOwnerBody = Type.Object({
  name: Type.String(),
  email: Type.String(),
  password: Type.Optional(Type.String()),
  payoutStrategy: Type.Optional(Type.Enum(PayoutStrategy)),
  bankCode: Type.Optional(Type.String()),
  accountNumber: Type.Optional(Type.String()),
  accountName: Type.Optional(Type.String()),
});
const DeleteOwnerParams = Type.Object({
  workspaceId: Type.String(),
  ownerId: Type.String(),
});
const OwnerActionParams = Type.Object({
  workspaceId: Type.String(),
  ownerId: Type.String(),
});

const verifyPropertyManager = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.userId!;
  const { workspaceId } = request.params as { workspaceId: string };

  if (!workspaceId)
    return reply.status(400).send({ error: "Workspace ID required" });

  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });

  if (!member || member.role !== "PROPERTY_MANAGER") {
    return reply
      .status(403)
      .send({ error: "Only Property Managers can manage owners" });
  }
};

/**
 * Dispatches an official branded invitation email to a newly created landlord.
 */
export async function sendLandlordInviteEmail(params: {
  landlordEmail: string;
  landlordName?: string | null;
  managerName?: string;
  workspaceName?: string;
  tempPassword?: string;
  inviteLink?: string | null;
  frontendUrl: string;
}) {
  const {
    landlordEmail,
    landlordName = "there",
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
    landlordName && landlordName.trim().length > 0 ? landlordName.trim() : "there";
  // Always use the official branded web portal URL for the primary action button.
  const actionUrl = `${publicBaseUrl}/login?email=${encodeURIComponent(landlordEmail)}`;
  const appDownloadUrl = `${publicBaseUrl}/download`;
  const subject = `Welcome to ${workspaceName} on PropertyStack`;

  const bodyHtml = `
    <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">
      Welcome to your landlord portal
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Hi <strong>${escapeHtml(displayName)}</strong>,
    </p>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
      <strong>${escapeHtml(managerName)}</strong> has created a landlord profile for you in <strong>${escapeHtml(workspaceName)}</strong> on PropertyStack. You can now monitor occupancy, review rent payments, and approve tenant receipts online or on mobile.
    </p>

    <!-- SINGLE PRIMARY CALL TO ACTION -->
    <div style="margin: 0 0 28px 0; text-align: center;">
      <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 13px 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 102, 255, 0.25);">
        Access Your Landlord Workspace
      </a>
    </div>

    <!-- CLEAN ACCOUNT DETAILS BOX -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 0 0 24px 0;">
      <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
        Account Sign-In Details
      </p>
      <p style="margin: 0 0 6px 0; font-size: 14px; color: #1e293b;">
        <strong>Email:</strong> ${escapeHtml(landlordEmail)}
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
      Prefer mobile? You can also <a href="${appDownloadUrl}" style="color: #0066FF; font-weight: 600; text-decoration: underline;">download the PropertyStack app</a> to track your properties on the go.
    </p>
  `;

  const html = renderEmailLayout({
    title: subject,
    badge: "LANDLORD ONBOARDING",
    bodyHtml,
    recipientEmail: landlordEmail,
    preheader: `Welcome to your landlord portal for ${workspaceName} on PropertyStack. View your portfolio and sign in.`,
  });

  const plainText = `Hi ${displayName},\n\n${managerName} has created a landlord profile for you in ${workspaceName} on PropertyStack.\n\nAccess your workspace:\n${actionUrl}\n\nAccount Sign-In Details:\n- Email: ${landlordEmail}\n${tempPassword ? `- Temporary Password: ${tempPassword}\n` : ""}\nPrefer mobile? Download the PropertyStack app:\n${appDownloadUrl}\n\nBest regards,\nThe PropertyStack Team`;

  await sendEmail(landlordEmail, subject, plainText, html);
}

export default async function ownerRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", verifyPropertyManager);

  // List all Landlords (Owners) in a workspace
  server.get<{ Params: Static<typeof WorkspaceParams> }>(
    "/",
    {
      schema: { params: WorkspaceParams },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const owners = await prisma.workspaceMember.findMany({
        where: { workspaceId, role: "LANDLORD" },
        include: {
          user: {
            select: { id: true, name: true, email: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const formatted = await Promise.all(
        owners.map(async (o) => {
          let inviteAccepted = true;
          try {
            const { data: supaData } =
              await supabaseAdmin.auth.admin.getUserById(o.user.id);
            if (supaData?.user) {
              const mustChange =
                supaData.user.user_metadata?.mustChangePassword === true;
              inviteAccepted = !mustChange;
            }
          } catch {
            inviteAccepted = true;
          }

          return {
            id: o.user.id,
            name: o.user.name,
            email: o.user.email,
            joinedAt: o.createdAt,
            memberId: o.id,
            payoutStrategy: o.payoutStrategy,
            bankCode: o.bankCode,
            accountNumber: o.accountNumber,
            accountName: o.accountName,
            status: inviteAccepted ? ("ACTIVE" as const) : ("PENDING" as const),
            inviteAccepted,
          };
        }),
      );

      return reply.send({ owners: formatted });
    },
  );

  // Add a new Landlord (Owner) to the workspace
  server.post<{
    Params: Static<typeof WorkspaceParams>;
    Body: Static<typeof CreateOwnerBody>;
  }>(
    "/",
    {
      preHandler: verifyPropertyManager,
      schema: { params: WorkspaceParams, body: CreateOwnerBody },
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { name, email, password } = request.body;

      if (!name || !email) {
        return reply.status(400).send({ error: "Name and email are required" });
      }

      try {
        // Limit enforcement logic
        const result = await prisma.$transaction(
          async (tx: import("@prisma/client").Prisma.TransactionClient) => {
            // 1. Get workspace and lock it
            const workspace = await tx.workspace.findUnique({
              where: { id: workspaceId },
              select: { id: true, plan: true },
            });

            if (!workspace) throw new Error("Workspace not found");

            // 2. Count current owners (LANDLORD role)
            const ownerCount = await tx.workspaceMember.count({
              where: { workspaceId, role: "LANDLORD" },
            });

            if (workspace.plan === "FREE" && ownerCount >= 1) {
              throw new Error(
                "Owner limit reached for Free Plan. Maximum 1 owner allowed.",
              );
            }

            if (workspace.plan === "PRO" && ownerCount >= 3) {
              throw new Error(
                "Owner limit reached for Pro Plan. Maximum 3 owners allowed.",
              );
            }

            let user = await tx.user.findUnique({ where: { email } });
            if (user) {
              const existingMember = await tx.workspaceMember.findUnique({
                where: { userId_workspaceId: { userId: user.id, workspaceId } },
              });

              if (existingMember) {
                throw new Error("User is already a member of this workspace");
              }

              const { payoutStrategy, bankCode, accountNumber, accountName } =
                request.body;

              const member = await tx.workspaceMember.create({
                data: {
                  userId: user.id,
                  workspaceId,
                  role: "LANDLORD",
                  payoutStrategy: payoutStrategy as
                    | import("@prisma/client").PayoutStrategy
                    | undefined,
                  bankCode,
                  accountNumber,
                  accountName,
                },
              });
              return { user, member };
            }

            return { user: null, limitReached: false };
          },
        );

        let user = result.user;
        let inviteLink: string | null = null;
        let tempPassword: string | undefined = undefined;
        const frontendUrl =
          process.env.PUBLIC_FRONTEND_URL ||
          (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes("localhost")
            ? process.env.FRONTEND_URL
            : "https://justhob.vercel.app");

        if (!user) {
          tempPassword =
            password || randomBytes(12).toString("hex") + "A!1";

          // 1. Create confirmed user with temp password in Supabase Auth
          let supabaseUserId: string | null = null;
          const { data: createData, error: createError } =
            await supabaseAdmin.auth.admin.createUser({
              email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: {
                name,
                role: "LANDLORD",
                mustChangePassword: true,
              },
            });

          if (createError) {
            if (
              createError.message.includes("already") ||
              createError.message.includes("exists")
            ) {
              const { data: listData } =
                await supabaseAdmin.auth.admin.listUsers();
              const existingUser = listData?.users?.find(
                (u) => u.email?.toLowerCase() === email.toLowerCase(),
              );
              if (existingUser) {
                supabaseUserId = existingUser.id;
              } else {
                return reply.status(400).send({
                  error: `Failed to create landlord account: ${createError.message}`,
                });
              }
            } else {
              return reply.status(400).send({
                error: `Failed to create landlord account: ${createError.message}`,
              });
            }
          } else if (createData?.user) {
            supabaseUserId = createData.user.id;
          }

          if (!supabaseUserId) {
            return reply.status(400).send({
              error: "Could not create or locate landlord Supabase user",
            });
          }

          // 2. Generate a valid magic login link for this confirmed user
          try {
            const { data: mlData } =
              await supabaseAdmin.auth.admin.generateLink({
                type: "magiclink",
                email,
                options: { redirectTo: `${frontendUrl}/login` },
              });
            const mlAny = mlData as unknown as {
              properties?: { action_link?: string };
            };
            if (mlAny?.properties?.action_link) {
              inviteLink = mlAny.properties.action_link;
            }
          } catch (_e) {
            // Non-critical if magic link fails
          }

          // 3. Atomically create User + WorkspaceMember in Prisma
          const { payoutStrategy, bankCode, accountNumber, accountName } =
            request.body;

          const txResult = await prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.upsert({
              where: { email },
              update: { name, role: "LANDLORD" },
              create: { id: supabaseUserId!, email, name, role: "LANDLORD" },
            });

            await tx.workspaceMember.create({
              data: {
                userId: createdUser.id,
                workspaceId,
                role: "LANDLORD",
                payoutStrategy: payoutStrategy as
                  | import("@prisma/client").PayoutStrategy
                  | undefined,
                bankCode,
                accountNumber,
                accountName,
              },
            });

            return createdUser;
          });

          user = txResult;
        } else {
          // User already exists in Prisma — generate a magic link so they can log in
          try {
            const { data: mlData } =
              await supabaseAdmin.auth.admin.generateLink({
                type: "magiclink",
                email,
                options: { redirectTo: `${frontendUrl}/login` },
              });
            const mlAny = mlData as unknown as {
              properties?: { action_link?: string };
            };
            if (mlAny?.properties?.action_link) {
              inviteLink = mlAny.properties.action_link;
            }
          } catch (_e) {
            // Non-critical
          }
        }

        // Fetch property manager and workspace info for email
        const managerUser = await prisma.user.findUnique({
          where: { id: request.userId! },
          select: { name: true },
        });

        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        });

        // Dispatch official landlord invitation email
        sendLandlordInviteEmail({
          landlordEmail: user.email,
          landlordName: user.name,
          managerName: managerUser?.name || "Your Property Manager",
          workspaceName: workspace?.name || "PropertyStack Workspace",
          tempPassword,
          inviteLink,
          frontendUrl,
        }).catch((emailErr) => {
          request.log.error(
            { err: emailErr },
            "[Add Landlord] Failed to send landlord invitation email",
          );
        });

        await logAction({
          userId: request.userId!,
          action: "ADD_LANDLORD",
          entityType: "LANDLORD",
          entityId: user.id,
          details: `Added landlord "${user.name}" (${user.email}) to the workspace.`,
          workspaceId,
          req: request,
        });

        return reply.status(201).send({
          owner: { id: user.id, name: user.name, email: user.email },
          inviteLink: inviteLink || null,
        });
      } catch (error: unknown) {
        const errMessage = (error as Error).message;
        if (errMessage && errMessage.includes("Owner limit reached")) {
          return reply.status(402).send({ error: errMessage });
        }
        request.log.error({ err: error }, "[Add Landlord Error]");
        return reply
          .status(500)
          .send({ error: "Failed to add landlord to workspace" });
      }
    },
  );

  // Update Landlord Details
  const UpdateOwnerParams = Type.Object({
    workspaceId: Type.String(),
    ownerId: Type.String(),
  });

  const UpdateOwnerBody = Type.Object({
    payoutStrategy: Type.Optional(
      Type.Union([Type.Enum(PayoutStrategy), Type.Null()]),
    ),
    bankCode: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    accountNumber: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    accountName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  });

  server.put<{
    Params: Static<typeof UpdateOwnerParams>;
    Body: Static<typeof UpdateOwnerBody>;
  }>(
    "/:ownerId",
    {
      schema: { params: UpdateOwnerParams, body: UpdateOwnerBody },
    },
    async (request, reply) => {
      const { workspaceId, ownerId } = request.params;
      const { payoutStrategy, bankCode, accountNumber, accountName } =
        request.body;

      try {
        const workspaceMember = await prisma.workspaceMember.findFirst({
          where: { userId: ownerId, workspaceId, role: "LANDLORD" },
        });

        if (!workspaceMember) {
          return reply.status(404).send({ error: "Landlord member not found" });
        }

        const updatedMember = await prisma.workspaceMember.update({
          where: { id: workspaceMember.id },
          data: {
            ...(payoutStrategy !== undefined ? { payoutStrategy } : {}),
            ...(bankCode !== undefined ? { bankCode } : {}),
            ...(accountNumber !== undefined ? { accountNumber } : {}),
            ...(accountName !== undefined ? { accountName } : {}),
          },
        });

        (fastify as any).io
          .to(`workspace:${workspaceId}`)
          .emit("OWNER_UPDATED", {
            ownerId,
            workspaceId,
          });

        await logAction({
          userId: request.userId!,
          action: "UPDATE_LANDLORD",
          entityType: "LANDLORD",
          entityId: ownerId,
          details: `Updated bank settlement/payout settings for landlord ID "${ownerId}".`,
          workspaceId,
          req: request,
        });

        return reply.send({ success: true, member: updatedMember });
      } catch (e) {
        return reply.status(500).send({ error: "Failed to update landlord" });
      }
    },
  );

  // Remove a Landlord from the workspace
  server.delete<{ Params: Static<typeof DeleteOwnerParams> }>(
    "/:ownerId",
    {
      schema: { params: DeleteOwnerParams },
    },
    async (request, reply) => {
      const { workspaceId, ownerId } = request.params;

      try {
        await prisma.workspaceMember.deleteMany({
          where: { userId: ownerId, workspaceId, role: "LANDLORD" },
        });
        await prisma.property.updateMany({
          where: { workspaceId, ownerId },
          data: { ownerId: null },
        });

        // Notify workspace members of the change
        (fastify as any).io
          .to(`workspace:${workspaceId}`)
          .emit("OWNER_DELETED", {
            ownerId,
            workspaceId,
          });

        // Notify the deleted owner directly to trigger a dashboard reload
        (fastify as any).io
          .to(`user:${ownerId}`)
          .emit("WORKSPACE_MEMBER_REMOVED", {
            workspaceId,
            message: "You have been removed from this workspace.",
          });

        await logAction({
          userId: request.userId!,
          action: "REMOVE_LANDLORD",
          entityType: "LANDLORD",
          entityId: ownerId,
          details: `Removed landlord ID "${ownerId}" from the workspace.`,
          workspaceId,
          req: request,
        });

        return reply.send({ success: true });
      } catch (e) {
        return reply.status(404).send({ error: "Owner not found" });
      }
    },
  );

  // Resend invitation email with fresh credentials to a landlord who hasn't accepted yet
  server.post<{ Params: Static<typeof OwnerActionParams> }>(
    "/:ownerId/resend-invite",
    {
      preHandler: verifyPropertyManager,
      schema: { params: OwnerActionParams },
    },
    async (request, reply) => {
      const { workspaceId, ownerId } = request.params;

      try {
        const member = await prisma.workspaceMember.findFirst({
          where: {
            workspaceId,
            role: "LANDLORD",
            OR: [{ userId: ownerId }, { id: ownerId }],
          },
          include: {
            user: true,
            workspace: true,
          },
        });

        if (!member) {
          return reply.status(404).send({ error: "Landlord member not found in this workspace" });
        }

        // 1. Check if landlord has already accepted the invitation
        const { data: supaData } = await supabaseAdmin.auth.admin.getUserById(member.userId);
        if (supaData?.user) {
          const mustChange = supaData.user.user_metadata?.mustChangePassword === true;
          if (!mustChange) {
            return reply.status(400).send({
              error: "This landlord has already accepted the invitation and activated their account.",
              code: "ALREADY_ACCEPTED",
            });
          }
        }

        // 2. Generate a fresh temporary password and update Supabase auth
        const tempPassword = `Lnd-${randomBytes(3).toString("hex")}!`;
        await supabaseAdmin.auth.admin.updateUserById(member.userId, {
          password: tempPassword,
          user_metadata: {
            ...(supaData?.user?.user_metadata || {}),
            name: member.user.name,
            role: "LANDLORD",
            mustChangePassword: true,
          },
        });

        // 3. Generate a fresh magic login link
        const frontendUrl =
          process.env.PUBLIC_FRONTEND_URL ||
          (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes("localhost")
            ? process.env.FRONTEND_URL
            : "https://justhob.vercel.app");

        let inviteLink: string | null = null;
        try {
          const { data: mlData } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: member.user.email,
            options: { redirectTo: `${frontendUrl}/login` },
          });
          const mlAny = mlData as unknown as { properties?: { action_link?: string } };
          if (mlAny?.properties?.action_link) {
            inviteLink = mlAny.properties.action_link;
          }
        } catch (_e) {
          // Non-critical if magic link generation fails
        }

        // 4. Fetch manager's display name
        const managerUser = await prisma.user.findUnique({
          where: { id: request.userId! },
          select: { name: true },
        });

        // 5. Send the enhanced invitation email
        await sendLandlordInviteEmail({
          landlordEmail: member.user.email,
          landlordName: member.user.name,
          managerName: managerUser?.name || "Your Property Manager",
          workspaceName: member.workspace.name,
          tempPassword,
          inviteLink,
          frontendUrl,
        });

        // 6. Audit log
        await logAction({
          userId: request.userId!,
          action: "RESEND_LANDLORD_INVITE",
          entityType: "LANDLORD",
          entityId: member.userId,
          details: `Resent invitation email with fresh credentials to landlord ${member.user.email}.`,
          workspaceId,
          req: request,
        });

        return reply.send({
          success: true,
          message: `Invitation email successfully resent to ${member.user.email}`,
          ownerId: member.userId,
          status: "PENDING",
        });
      } catch (err: any) {
        request.log.error(err, "Failed to resend landlord invitation");
        return reply.status(500).send({ error: "Failed to resend landlord invitation" });
      }
    },
  );
}
