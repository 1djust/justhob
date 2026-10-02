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

  const displayName = landlordName && landlordName.trim().length > 0 ? landlordName.trim() : "there";

  const loginUrl =
    inviteLink ||
    `${frontendUrl.replace(/\/$/, "")}/login?email=${encodeURIComponent(landlordEmail)}`;
  const apkDownloadUrl = `${frontendUrl.replace(/\/$/, "")}/downloads/propertystack-tenant.apk`;
  const subject = `Welcome to PropertyStack: Landlord Account Created by ${managerName}`;

  const bodyHtml = `
    <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">
      Welcome to PropertyStack
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Hi <strong>${escapeHtml(displayName)}</strong>,
    </p>
    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
      <strong>${escapeHtml(managerName)}</strong> has created a landlord profile for you in the workspace <strong>"${escapeHtml(workspaceName)}"</strong> on PropertyStack.
    </p>

    <!-- CREDENTIALS BOX -->
    ${
      tempPassword
        ? `
    <div style="background-color: #f1f5f9; border-left: 4px solid #0066FF; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0;">
      <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
        🔑 Your Login Credentials
      </p>
      <p style="margin: 0 0 6px 0; font-size: 14px; color: #334155;">
        <strong>Login Email:</strong> <span style="font-family: monospace; background-color: #ffffff; padding: 3px 8px; border-radius: 4px; border: 1px solid #cbd5e1; font-weight: 600;">${escapeHtml(landlordEmail)}</span>
      </p>
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;">
        <strong>Temporary Password:</strong> <span style="font-family: monospace; background-color: #ffffff; padding: 3px 8px; border-radius: 4px; border: 1px solid #cbd5e1; font-weight: 600; color: #0066FF;">${escapeHtml(tempPassword)}</span>
      </p>
      <p style="margin: 0; font-size: 12px; color: #64748b;">
        You will use these credentials to sign in on mobile or web.
      </p>
    </div>
    `
        : ""
    }

    <!-- MOBILE APP GUIDE (RECOMMENDED) -->
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-top: 4px solid #10b981; border-radius: 8px; padding: 22px 20px; margin: 0 0 26px 0;">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 18px; margin-right: 8px;">📱</span>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">
          How to Get & Use the Mobile App (Recommended)
        </h3>
      </div>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #475569;">
        PropertyStack is built mobile-first so you can track your properties, review rent payments, and approve tenant receipts directly from your phone.
      </p>

      <!-- STEP 1 -->
      <div style="margin-bottom: 14px;">
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #1e293b;">
          1. Download & Install the Mobile App
        </p>
        <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
          Download the official PropertyStack Android app directly to your phone:
        </p>
        <a href="${apkDownloadUrl}" download style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
          📥 Download PropertyStack Mobile App (.apk)
        </a>
        <p style="margin: 6px 0 0 0; font-size: 11px; color: #94a3b8;">
          Note: If your phone displays an install prompt, tap "Settings" and enable "Allow from this source".
        </p>
      </div>

      <!-- STEP 2 -->
      <div style="margin-bottom: 14px; border-top: 1px dashed #e2e8f0; padding-top: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1e293b;">
          2. Sign In with Your Credentials
        </p>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
          Open the app on your phone and enter your <strong>Login Email</strong> and <strong>Temporary Password</strong> shown above.
        </p>
      </div>

      <!-- STEP 3 -->
      <div style="margin-bottom: 14px; border-top: 1px dashed #e2e8f0; padding-top: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1e293b;">
          3. Set Your Personal Password
        </p>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
          The app will immediately guide you to create your secure, personal password on your first sign-in.
        </p>
      </div>

      <!-- STEP 4 -->
      <div style="border-top: 1px dashed #e2e8f0; padding-top: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1e293b;">
          4. Enjoy Easy On-the-Go Management
        </p>
        <ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #475569;">
          <li><strong>Real-time Dashboard:</strong> Track active units and occupancy rates at a glance.</li>
          <li><strong>1-Tap Approvals:</strong> View tenant payment proofs and verify rent directly on your screen.</li>
          <li><strong>Always Signed In:</strong> Stay logged in on your phone for quick daily access.</li>
        </ul>
      </div>
    </div>

    <!-- WEB PORTAL ACCESS -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 0 0 24px 0;">
      <h3 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #1e293b;">
        💻 Prefer Using a Computer?
      </h3>
      <p style="margin: 0 0 14px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
        You can also access your landlord workspace using any web browser on your laptop or desktop:
      </p>
      <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: #0066FF; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 22px; border-radius: 6px;">
        Open Web Dashboard →
      </a>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #94a3b8;">
        Web Link: <a href="${loginUrl}" style="color: #0066FF; word-break: break-all;">${loginUrl}</a>
      </p>
    </div>
  `;

  const html = renderEmailLayout({
    title: subject,
    badge: "LANDLORD INVITATION",
    bodyHtml,
    recipientEmail: landlordEmail,
  });

  const plainText = `Hi ${displayName},\n\n${managerName} has created a landlord profile for you in the workspace "${workspaceName}" on PropertyStack.\n\n=== YOUR LOGIN CREDENTIALS ===\nLogin Email: ${landlordEmail}\n${tempPassword ? `Temporary Password: ${tempPassword}\n` : ""}\n=== HOW TO GET & USE THE MOBILE APP ===\n1. Download Mobile App (Android APK):\n${apkDownloadUrl}\n(Tap the link on your phone to download and install)\n\n2. Open PropertyStack and log in using your email and temporary password.\n3. Create your secure personal password when prompted.\n4. Access your Landlord Hub to track occupancy and approve rent payments on the go.\n\n=== WEB ACCESS ===\nIf you prefer using a desktop browser:\n${loginUrl}\n\nBest regards,\nThe PropertyStack Team`;

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
