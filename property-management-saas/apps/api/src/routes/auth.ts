import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/database";
import { supabaseAdmin } from "../lib/supabase";
import {
  AppError,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from "../lib/errors";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { meCache } from "../lib/cache";

const SyncBody = Type.Object({ name: Type.Optional(Type.String()) });
const LoginBody = Type.Object({
  email: Type.String(),
  password: Type.String(),
});
const ChangePasswordBody = Type.Object({
  newPassword: Type.String({
    minLength: 8,
    pattern:
      "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{}|;:,.<>?])[A-Za-z\\d!@#$%^&*()_+\\-=\\[\\]{}|;:,.<>?]{8,}$",
  }),
});
const ResetPasswordBody = Type.Object({ email: Type.String() });
const CheckEmailBody = Type.Object({ email: Type.String() });

function getPrimaryWorkspace(workspaces?: Array<{ role: string; workspaceId: string }>) {
  if (!workspaces || workspaces.length === 0) return null;
  
  const priority: Record<string, number> = {
    PROPERTY_MANAGER: 1,
    LANDLORD: 2,
    TENANT: 3,
    SUPER_ADMIN: 4,
  };

  const sorted = [...workspaces].sort((a, b) => {
    const pA = priority[a.role] ?? 99;
    const pB = priority[b.role] ?? 99;
    return pA - pB;
  });

  return sorted[0];
}

export default async function authRoutes(fastify: FastifyInstance) {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Sync Supabase user to Prisma (called after frontend login/register)
  server.post<{ Body: Static<typeof SyncBody> }>(
    "/sync",
    { schema: { body: SyncBody } },
    async (request, reply) => {
      const token = request.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        throw new UnauthorizedError("Authentication required. Please sign in.");
      }

      if (!prisma) {
        throw new AppError("Database client failed to initialize.", 500);
      }

      const { data: supaData, error: supaError } =
        await supabaseAdmin.auth.getUser(token);

      if (supaError || !supaData || !supaData.user) {
        throw new UnauthorizedError(supaError?.message || "Invalid session.");
      }

      const supaUser = supaData.user;
      const { name } = request.body || {};

      // Check if Prisma user already exists
      let user = await prisma.user.findUnique({
        where: { id: supaUser.id },
        include: {
          workspaces: {
            include: { workspace: true },
          },
        },
      });

      let isNewUser = false;
      if (!user) {
        isNewUser = true;
        // Auto-Healing: Check if email already exists with different ID
        const existingByEmail = await prisma.user.findUnique({
          where: { email: supaUser.email || "" },
          include: {
            workspaces: {
              include: { workspace: true },
            },
          },
        });

        if (existingByEmail) {
          const isEmailVerified =
            !!supaUser.email_confirmed_at ||
            supaUser.user_metadata?.email_verified === true;

          if (isEmailVerified) {
            // Auto-Heal: The user exists in Prisma with a different ID (e.g. desynced local db).
            // Since the Supabase token is verified, this email is owned by the current request.
            // We safely update their User ID in Prisma to the new Supabase ID.
            console.log(
              `[AUTH/SYNC] Mismatch detected: email ${supaUser.email} has Prisma ID ${existingByEmail.id} but Supabase ID ${supaUser.id}. Healing...`,
            );
            await prisma.$executeRaw`UPDATE "User" SET id = ${supaUser.id} WHERE email = ${supaUser.email || ""}`;

            // Fetch the updated user
            user = await prisma.user.findUnique({
              where: { id: supaUser.id },
              include: {
                workspaces: {
                  include: { workspace: true },
                },
              },
            });
          } else {
            // Security: Do NOT delete or update existing users if email is not verified.
            // This prevents account takeover via duplicate email registration.
            throw new AppError(
              "An account with this email already exists. Please contact support if you believe this is an error.",
              409,
              "DUPLICATE_EMAIL",
            );
          }
        }

        try {
          const userMetadata: any = supaUser.user_metadata || {};
          const userName = name || userMetadata.name || null;
          let userRole = userMetadata.role || "PROPERTY_MANAGER";
          if (userRole === "SUPER_ADMIN") {
            userRole = "PROPERTY_MANAGER";
          }

          // Check if this user already has workspace memberships (e.g. created as tenant by manager)
          const existingMemberships = await prisma.workspaceMember.findMany({
            where: { userId: supaUser.id },
          });

          if (existingMemberships.length > 0) {
            // User was pre-created (e.g. as a tenant) — use the role from their existing membership
            const memberRole = existingMemberships[0].role;
            user = await prisma.user.create({
              data: {
                id: supaUser.id,
                email: supaUser.email || "",
                name: userName,
                role: memberRole,
              },
              include: {
                workspaces: {
                  include: { workspace: true },
                },
              },
            });
          } else {
            // Brand new user — create with default PROPERTY_MANAGER workspace
            user = await prisma.user.create({
              data: {
                id: supaUser.id,
                email: supaUser.email || "",
                name: userName,
                role: userRole,
                workspaces: {
                  create: {
                    role: userRole,
                    workspace: { create: { name: "My Properties" } },
                  },
                },
              },
              include: {
                workspaces: {
                  include: { workspace: true },
                },
              },
            });
          }
        } catch (createErr: any) {
          throw new AppError(
            "Database profile setup failed.",
            500,
            "SYNC_DB_ERROR",
            createErr.message,
          );
        }

        if (isNewUser && user) {
          try {
            if ((fastify as any).io) {
              (fastify as any).io.emit("USER_REGISTERED", {
                id: user.id,
                email: user.email,
                name: user.name,
              });
              console.log(`[AUTH/SYNC] Broadcasted USER_REGISTERED event for user ${user.id}`);
            }
          } catch (ioErr) {
            console.error("[AUTH/SYNC] Failed to emit USER_REGISTERED socket event:", ioErr);
          }
        }
      }

      const u = user as unknown as {
        workspaces?: Array<{ role: string; workspaceId: string }>;
        role: string;
      };

      const mustChange = supaUser?.user_metadata?.mustChangePassword === true;
      const primaryWS = getPrimaryWorkspace(u.workspaces);
      const userWithWorkspaces = {
        ...user,
        role: primaryWS?.role || "USER",
        globalRole: u.role,
        workspaceId: primaryWS?.workspaceId || null,
        mustChangePassword: mustChange,
      };

      return { user: userWithWorkspaces };
    },
  );

  // Get current user
  server.get("/me", { schema: {} }, async (request, reply) => {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) throw new UnauthorizedError();

    const tokenShort = token.substring(0, 15);
    console.log(`[AUTH/ME DEBUG] Token: ${tokenShort}...`);
    const now = Date.now();
    const cached = meCache.get(token);
    if (cached && cached.expiresAt > now) {
      console.log(`[AUTH/ME DEBUG] CACHE HIT! returning cached profile`);
      return reply.send(cached.response);
    }
    console.log(`[AUTH/ME DEBUG] CACHE MISS! performing user database fetch`);

    // First verify the token is valid
    const { data: supaData, error: supaError } =
      await supabaseAdmin.auth.getUser(token);
    const supaUser = supaData?.user;
    if (supaError || !supaUser) throw new UnauthorizedError("Invalid token");

    // Fetch profile from Prisma
    const user = await prisma.user.findUnique({
      where: { id: supaUser.id },
      include: { workspaces: { include: { workspace: true } } },
    });

    const freshMeta = supaUser.user_metadata;
    const mustChange = freshMeta?.mustChangePassword === true;
    const primaryWS = getPrimaryWorkspace(user?.workspaces as any);
    let role = primaryWS?.role || freshMeta.role || "TENANT";
    if (role === "SUPER_ADMIN" && user?.role !== "SUPER_ADMIN") {
      role = "TENANT";
    }
    const workspaceId = primaryWS?.workspaceId || null;

    const responseBody = {
      user: user
        ? {
            ...user,
            role,
            globalRole: user.role,
            workspaceId,
            mustChangePassword: mustChange,
          }
        : null,
    };

    // Cache user profile response for 30 seconds
    console.log(`[AUTH/ME DEBUG] Caching user profile for token ${tokenShort}`);
    meCache.set(token, {
      response: responseBody,
      expiresAt: now + 30 * 1000,
    });

    return reply.send(responseBody);
  });

  // Login (called by mobile app)
  server.post<{ Body: Static<typeof LoginBody> }>(
    "/login",
    { schema: { body: LoginBody } },
    async (request, reply) => {
      const { email, password } = request.body;

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user || !data.session) {
        throw new UnauthorizedError(
          error?.message || "Invalid credentials",
          "AUTH_INVALID_CREDENTIALS",
        );
      }

      // Get the user profile from Prisma to include roles/workspaces
      const user = await prisma.user.findUnique({
        where: { id: data.user.id },
        include: {
          workspaces: {
            include: { workspace: true },
          },
        },
      });

      if (!user) {
        // If the user exists in Supabase but not Prisma, sync it now
        // This can happen if they were invited/created via admin but never synced
        let role = data.user.user_metadata.role;
        if (!role) {
          const membership = await prisma.workspaceMember.findFirst({
            where: { userId: data.user.id },
            select: { role: true },
          });
          role = membership?.role || "TENANT";
        }
        if (role === "SUPER_ADMIN") {
          role = "TENANT";
        }
        const newUser = await prisma.user.create({
          data: {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata.name || null,
            role: role,
          },
          include: {
            workspaces: {
              include: { workspace: true },
            },
          },
        });

        const mustChange = data.user.user_metadata?.mustChangePassword === true;
        return reply.send({
          access_token: data.session.access_token,
          user: {
            ...newUser,
            role,
            globalRole: newUser.role,
            mustChangePassword: mustChange,
          },
        });
      }

      const mustChange = data.user.user_metadata?.mustChangePassword === true;
      const primaryWS = getPrimaryWorkspace(user.workspaces as any);
      let role = primaryWS?.role || data.user.user_metadata.role || "USER";
      if (role === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN") {
        role = "USER";
      }
      const workspaceId = primaryWS?.workspaceId || null;

      return reply.send({
        access_token: data.session.access_token,
        user: {
          ...user,
          role,
          globalRole: user.role,
          workspaceId,
          mustChangePassword: mustChange,
        },
      });
    },
  );

  // Change password (for first-login forced password change)
  server.post<{ Body: Static<typeof ChangePasswordBody> }>(
    "/change-password",
    { schema: { body: ChangePasswordBody } },
    async (request, reply) => {
      const token = request.headers.authorization?.replace("Bearer ", "");
      if (!token) throw new UnauthorizedError();

      const { newPassword } = request.body;

      // Verify the token and get the user
      const { data: supaData, error: supaError } =
        await supabaseAdmin.auth.getUser(token);
      if (supaError || !supaData?.user) {
        throw new UnauthorizedError("Invalid session");
      }

      const userEmail = supaData.user.email;

      // Update the password and clear the mustChangePassword flag
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(supaData.user.id, {
          password: newPassword,
          user_metadata: {
            ...supaData.user.user_metadata,
            mustChangePassword: false,
          },
        });

      if (updateError) {
        throw new AppError(updateError.message, 500);
      }

      // Re-authenticate with the new password to get a fresh token
      const { data: loginData, error: loginError } =
        await supabaseAdmin.auth.signInWithPassword({
          email: userEmail!,
          password: newPassword,
        });

      if (loginError || !loginData.session) {
        // Password was changed but re-login failed — user will need to log in manually
        return reply.send({
          success: true,
          message: "Password updated. Please log in again.",
        });
      }

      // Get user profile from Prisma
      const user = await prisma.user.findUnique({
        where: { id: supaData.user.id },
        include: { workspaces: { include: { workspace: true } } },
      });

      const primaryWS = getPrimaryWorkspace(user?.workspaces as any);
      let role =
        primaryWS?.role ||
        supaData.user.user_metadata.role ||
        "TENANT";
      if (role === "SUPER_ADMIN" && user?.role !== "SUPER_ADMIN") {
        role = "TENANT";
      }
      const workspaceId = primaryWS?.workspaceId || null;

      return reply.send({
        success: true,
        access_token: loginData.session.access_token,
        user: {
          ...user,
          role,
          globalRole: user?.role,
          workspaceId,
          mustChangePassword: false,
        },
      });
    },
  );

  // Trigger password reset email
  server.post<{ Body: Static<typeof ResetPasswordBody> }>(
    "/reset-password-request",
    { schema: { body: ResetPasswordBody } },
    async (request, reply) => {
      const { email } = request.body;

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${frontendUrl}/reset-password`,
      });

      if (error) {
        throw new AppError(error.message, 500);
      }

      return reply.send({
        success: true,
        message: "Reset link sent to your email.",
      });
    },
  );

  // Logout (no-op since Supabase handles sessions, but kept for compatibility)
  server.post("/logout", { schema: {} }, async (request, reply) => {
    return reply.send({ success: true });
  });

  // Check if email exists (for smart routing on frontend)
  server.post<{ Body: Static<typeof CheckEmailBody> }>(
    "/check-email",
    { schema: { body: CheckEmailBody } },
    async (request, reply) => {
      const { email } = request.body;
      
      // Security: Prevent email enumeration. Always return true so attackers 
      // cannot use this endpoint to scrape user data.
      return reply.send({ exists: true });
    }
  );
}
