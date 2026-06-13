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

      if (!user) {
        // Auto-Healing: Check if email already exists with different ID
        const existingByEmail = await prisma.user.findUnique({
          where: { email: supaUser.email || "" },
        });

        if (existingByEmail) {
          // Security: Do NOT delete existing users. This prevents account takeover
          // via duplicate email registration.
          throw new AppError(
            "An account with this email already exists. Please contact support if you believe this is an error.",
            409,
            "DUPLICATE_EMAIL",
          );
        }

        try {
          const userMetadata: any = supaUser.user_metadata || {};
          const userName = name || userMetadata.name || null;

          // Check if this user already has workspace memberships (e.g. created as tenant by manager)
          const existingMemberships = await prisma.workspaceMember.findMany({
            where: { userId: supaUser.id },
          });

          if (existingMemberships.length > 0) {
            // User was pre-created (e.g. as a tenant) — just create the User record, don't add a new workspace
            user = await prisma.user.create({
              data: {
                id: supaUser.id,
                email: supaUser.email || "",
                name: userName,
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
                workspaces: {
                  create: {
                    role: "PROPERTY_MANAGER",
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
      }

      const u = user as unknown as {
        workspaces?: Array<{ role: string; workspaceId: string }>;
        role: string;
      };

      const mustChange = supaUser?.user_metadata?.mustChangePassword === true;
      const userWithWorkspaces = {
        ...user,
        role: u.workspaces?.[0]?.role || "USER",
        globalRole: u.role,
        workspaceId: u.workspaces?.[0]?.workspaceId || null,
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
    const role = user?.workspaces?.[0]?.role || freshMeta.role || "TENANT";

    const responseBody = {
      user: user
        ? {
            ...user,
            role,
            globalRole: user.role,
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
        const newUser = await prisma.user.create({
          data: {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata.name || null,
          },
          include: {
            workspaces: {
              include: { workspace: true },
            },
          },
        });

        const role = data.user.user_metadata.role || "TENANT";
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
      const role =
        user.workspaces?.[0]?.role || data.user.user_metadata.role || "USER";

      return reply.send({
        access_token: data.session.access_token,
        user: {
          ...user,
          role,
          globalRole: user.role,
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

      const role =
        user?.workspaces?.[0]?.role ||
        supaData.user.user_metadata.role ||
        "TENANT";

      return reply.send({
        success: true,
        access_token: loginData.session.access_token,
        user: {
          ...user,
          role,
          globalRole: user?.role,
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
