import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/database";
import { supabaseAdmin } from "../lib/supabase";
import { AppError, UnauthorizedError } from "../lib/errors";
import { Type, Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { meCache } from "../lib/cache";
import { SecurityService } from "../services/security";
import { checkNameSimilarity, checkEmailSimilarity } from "../lib/string-similarity";

const SyncBody = Type.Object({ name: Type.Optional(Type.String()) });
const CheckNameBody = Type.Object({ name: Type.String({ minLength: 1 }) });
const RegisterBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  email: Type.String(),
  password: Type.String({ minLength: 8 }),
});
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
const VerifyOtpBody = Type.Object({
  email: Type.String(),
  token: Type.String({ minLength: 4 }),
  type: Type.Optional(Type.String()),
});
const ResendOtpBody = Type.Object({
  email: Type.String(),
  type: Type.Optional(Type.String()),
});
const UpdateProfileBody = Type.Object({
  name: Type.Optional(Type.String()),
  bankCode: Type.Optional(Type.String()),
  accountNumber: Type.Optional(Type.String()),
  accountName: Type.Optional(Type.String()),
});
const OnboardManagerBody = Type.Object({
  workspaceName: Type.String({ minLength: 2 }),
  bankCode: Type.Optional(Type.String()),
  accountNumber: Type.Optional(Type.String()),
  accountName: Type.Optional(Type.String()),
  phone: Type.Optional(Type.String()),
});

function getPrimaryWorkspace(
  workspaces?: Array<{ role: string; workspaceId: string }>,
) {
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

      // Security Gatekeeper: Ensure email has been confirmed via OTP or link before provisioning access
      const isEmailConfirmed =
        Boolean(supaUser.email_confirmed_at) ||
        Boolean(supaUser.confirmed_at);

      if (!isEmailConfirmed) {
        throw new UnauthorizedError(
          "Please verify your email address with the 6-digit OTP code before logging in.",
          "AUTH_EMAIL_NOT_CONFIRMED",
        );
      }

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

        if (name) {
          const nameCheck = await checkNameSimilarity(name, supaUser.id);
          if (nameCheck.isSimilar) {
            throw new AppError(
              `The full name "${name}" is too similar to an existing account (${nameCheck.highestMatchPercent}% match). For identity security, please use your distinct full name or include your middle initial.`,
              400,
              "DUPLICATE_NAME_SIMILARITY",
            );
          }
        }

        if (supaUser.email) {
          const emailCheck = await checkEmailSimilarity(supaUser.email, supaUser.id);
          if (emailCheck.isSimilar) {
            throw new AppError(
              `The email "${supaUser.email}" is too similar to an existing account (${emailCheck.highestMatchPercent}% match). If this is your account, please sign in. Otherwise, please use a distinct email address.`,
              400,
              "DUPLICATE_EMAIL_SIMILARITY",
            );
          }
        }

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
            // CRITICAL: Must update ALL FK references in a transaction BEFORE changing User.id
            // to prevent onDelete:Cascade from silently deleting workspace memberships.
            const oldId = existingByEmail.id;
            const newId = supaUser.id;
            console.log(
              `[AUTH/SYNC] Mismatch detected: email ${supaUser.email} has Prisma ID ${oldId} but Supabase ID ${newId}. Healing with FK cascade...`,
            );
            await prisma.$transaction(async (tx) => {
              // Update all FK references FIRST to prevent cascade delete
              await tx.$executeRaw`UPDATE "WorkspaceMember" SET "userId" = ${newId} WHERE "userId" = ${oldId}`;
              await tx.$executeRaw`UPDATE "Notification" SET "userId" = ${newId} WHERE "userId" = ${oldId}`;
              await tx.$executeRaw`UPDATE "MaintenanceMessage" SET "senderId" = ${newId} WHERE "senderId" = ${oldId}`;
              await tx.$executeRaw`UPDATE "Property" SET "ownerId" = ${newId} WHERE "ownerId" = ${oldId}`;
              // Now safe to update the User ID
              await tx.$executeRaw`UPDATE "User" SET id = ${newId} WHERE email = ${supaUser.email || ""}`;
            });

            // Security: Log auto-heal to audit trail — this is a high-risk operation
            // that could indicate an account takeover attempt if triggered unexpectedly.
            await SecurityService.logEvent(
              request.ip,
              "AUTO_HEAL_IDENTITY_MERGE",
              {
                email: supaUser.email,
                oldId,
                newId,
                emailVerified: true,
                action: "FK references migrated and User.id updated",
              },
            ).catch((err) => console.error("[AUTH/SYNC] Failed to log auto-heal event:", err));

            console.log(
              `[AUTH/SYNC] Healed user ${supaUser.email}: ${oldId} → ${newId} (all FK references updated)`,
            );

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
            // GATEKEEPER: If Supabase metadata indicates TENANT or LANDLORD,
            // this user must have been pre-registered by a manager with workspace
            // memberships. Since they have none, reject — do NOT create a default workspace.
            if (userRole === "TENANT" || userRole === "LANDLORD") {
              console.warn(
                `[AUTH/SYNC] REJECTED: ${supaUser.email} (${supaUser.id}) has role ${userRole} in metadata but no workspace memberships. Not registered by any manager.`,
              );
              throw new AppError(
                "Your account has not been set up by a property manager yet. Please contact your property manager to register your access.",
                403,
                "ACCOUNT_NOT_REGISTERED",
              );
            }
            // Brand new PROPERTY_MANAGER user — create without workspace (onboarding required)
            user = await prisma.user.create({
              data: {
                id: supaUser.id,
                email: supaUser.email || "",
                name: userName,
                role: userRole,
              },
              include: {
                workspaces: {
                  include: { workspace: true },
                },
              },
            });
          }
        } catch (createErr: any) {
          if (createErr instanceof AppError) {
            throw createErr;
          }
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
              // Security: Emit only to admin room, not all connected sockets.
              // Stripped email to prevent PII broadcast.
              (fastify as any).io.to("super-admin").emit("USER_REGISTERED", {
                id: user.id,
                name: user.name,
              });
              console.log(
                `[AUTH/SYNC] Emitted USER_REGISTERED event for user ${user.id} to admin room`,
              );
            }
          } catch (ioErr) {
            console.error(
              "[AUTH/SYNC] Failed to emit USER_REGISTERED socket event:",
              ioErr,
            );
          }
        }
      }

      // GATEKEEPER: Reject existing TENANT/LANDLORD users with 0 workspace memberships
      if (user && (user.role === "TENANT" || user.role === "LANDLORD")) {
        const wsCount =
          (user as unknown as { workspaces?: unknown[] }).workspaces?.length ||
          0;
        if (wsCount === 0) {
          console.warn(
            `[AUTH/SYNC] REJECTED: Existing ${user.role} user ${user.email} (${user.id}) has 0 workspace memberships.`,
          );
          throw new AppError(
            "Your account has not been set up by a property manager yet. Please contact your property manager to register your access.",
            403,
            "ACCOUNT_NOT_REGISTERED",
          );
        }
      }

      const u = user as unknown as {
        workspaces?: Array<{ role: string; workspaceId: string }>;
        role: string;
      };

      const mustChange = supaUser?.user_metadata?.mustChangePassword === true;
      const primaryWS = getPrimaryWorkspace(u.workspaces);
      const isOnboarded = Boolean(u.workspaces && u.workspaces.length > 0);
      const userWithWorkspaces = {
        ...user,
        role: primaryWS?.role || user.role || "PROPERTY_MANAGER",
        globalRole: u.role,
        workspaceId: primaryWS?.workspaceId || null,
        isOnboarded,
        mustChangePassword: mustChange,
      };

      return { user: userWithWorkspaces };
    },
  );

  // Get current user
  server.get("/me", { schema: {} }, async (request, reply) => {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) throw new UnauthorizedError();

    const now = Date.now();
    const cached = meCache.get(token);
    if (cached && cached.expiresAt > now) {
      return reply.send(cached.response);
    }

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
    const isOnboarded = Boolean(user?.workspaces && user.workspaces.length > 0);

    const responseBody = {
      user: user
        ? {
            ...user,
            role,
            globalRole: user.role,
            workspaceId,
            isOnboarded,
            mustChangePassword: mustChange,
          }
        : null,
    };

    meCache.set(token, {
      response: responseBody,
      expiresAt: now + 30 * 1000,
    });

    return reply.send(responseBody);
  });

  // Register Property Manager (called by mobile app)
  server.post<{ Body: Static<typeof RegisterBody> }>(
    "/register",
    {
      schema: { body: RegisterBody },
      config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { name, email, password } = request.body;

      const hasMinLength = password.length >= 8;
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[!@#$%^&*()_+\[\]{};':"\\|,.<>\/?]/.test(password);

      if (
        !hasMinLength ||
        !hasUppercase ||
        !hasLowercase ||
        !hasNumber ||
        !hasSpecial
      ) {
        throw new AppError(
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
          400,
          "INVALID_PASSWORD",
        );
      }

      // Check if email is already registered in Prisma
      const existingPrismaUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (existingPrismaUser) {
        throw new AppError(
          "An account with this email already exists. Please sign in instead.",
          400,
          "USER_ALREADY_EXISTS",
        );
      }

      // Check Full Name similarity (80% - 100% duplicate protection)
      const nameCheck = await checkNameSimilarity(name);
      if (nameCheck.isSimilar) {
        throw new AppError(
          `The full name "${name}" is too similar to an existing account (${nameCheck.highestMatchPercent}% match). For identity security, please use your distinct full name or include your middle initial.`,
          400,
          "DUPLICATE_NAME_SIMILARITY",
        );
      }

      // Check Email similarity (80% - 100% duplicate protection)
      const emailCheck = await checkEmailSimilarity(email);
      if (emailCheck.isSimilar) {
        throw new AppError(
          `The email "${email}" is too similar to an existing account (${emailCheck.highestMatchPercent}% match). If this is your account, please sign in. Otherwise, please use a distinct email address.`,
          400,
          "DUPLICATE_EMAIL_SIMILARITY",
        );
      }

      const { data, error } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: "PROPERTY_MANAGER",
          },
        },
      });

      if (error) {
        throw new AppError(
          error.message || "Registration failed. Please try again.",
          400,
          "REGISTRATION_FAILED",
        );
      }

      if (!data.user) {
        throw new AppError("Failed to create user account.", 500);
      }

      // Manager Registration: Email confirmation is mandatory before gaining access
      return reply.send({
        success: true,
        requiresEmailConfirmation: true,
        message:
          "Registration Successful! Please enter the 6-digit OTP code sent to your email to verify your account.",
      });
    },
  );

  // Real-time Name Similarity Check
  server.post<{ Body: Static<typeof CheckNameBody> }>(
    "/check-name",
    { schema: { body: CheckNameBody } },
    async (request, reply) => {
      const { name } = request.body;
      const result = await checkNameSimilarity(name);
      return reply.send({
        available: !result.isSimilar,
        matchPercent: result.highestMatchPercent,
        message: result.isSimilar
          ? `The full name "${name}" is too similar to an existing account (${result.highestMatchPercent}% match).`
          : "Name is available.",
      });
    },
  );

  // Real-time Email Similarity Check
  server.post<{ Body: Static<typeof CheckEmailBody> }>(
    "/check-email-similarity",
    { schema: { body: CheckEmailBody } },
    async (request, reply) => {
      const { email } = request.body;
      const result = await checkEmailSimilarity(email);
      return reply.send({
        available: !result.isSimilar,
        matchPercent: result.highestMatchPercent,
        message: result.isSimilar
          ? `The email "${email}" is too similar to an existing account (${result.highestMatchPercent}% match).`
          : "Email is available.",
      });
    },
  );

  // Verify OTP for Signup or Email confirmation (called by mobile app or web)
  server.post<{ Body: Static<typeof VerifyOtpBody> }>(
    "/verify-otp",
    {
      schema: { body: VerifyOtpBody },
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { email, token, type } = request.body;
      const cleanEmail = email.toLowerCase().trim();
      const cleanToken = token.trim();

      const otpType = (type as any) || "signup";

      const { data, error } = await supabaseAdmin.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: otpType,
      });

      if (error || !data.user) {
        throw new AppError(
          error?.message || "Invalid or expired OTP verification code.",
          400,
          "INVALID_OTP",
        );
      }

      // Ensure user profile exists in Prisma
      let user = await prisma.user.findUnique({
        where: { id: data.user.id },
      });

      if (!user) {
        let role =
          (data.user.user_metadata?.role as any) || "PROPERTY_MANAGER";
        // Security: Prevent privilege escalation via client-controlled metadata
        if (role === "SUPER_ADMIN") {
          role = "PROPERTY_MANAGER";
        }
        const name =
          data.user.user_metadata?.name || cleanEmail.split("@")[0];

        user = await prisma.user.create({
          data: {
            id: data.user.id,
            email: cleanEmail,
            name,
            role,
            isActive: true,
          },
        });
      }

      return reply.send({
        success: true,
        message: "Email verified successfully! You can now log into your account.",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        session: data.session,
        access_token: data.session?.access_token,
      });
    },
  );

  // Resend OTP code to registered email
  server.post<{ Body: Static<typeof ResendOtpBody> }>(
    "/resend-otp",
    {
      schema: { body: ResendOtpBody },
      config: { rateLimit: { max: 2, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { email, type } = request.body;
      const cleanEmail = email.toLowerCase().trim();
      const resendType = (type as any) || "signup";

      const { error } = await supabaseAdmin.auth.resend({
        type: resendType,
        email: cleanEmail,
      });

      if (error) {
        throw new AppError(
          error.message || "Failed to resend OTP verification code.",
          400,
          "RESEND_OTP_FAILED",
        );
      }

      return reply.send({
        success: true,
        message: "A fresh 6-digit OTP code has been sent to your email.",
      });
    },
  );

  // Login (called by mobile app)
  server.post<{ Body: Static<typeof LoginBody> }>(
    "/login",
    {
      schema: { body: LoginBody },
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      // 1. Check Active Lockout Shield
      const lockout = SecurityService.isAccountOrIpLockedOut(email, request.ip);
      if (lockout.isLocked) {
        return reply.status(429).send({
          error: "Account Locked",
          code: "ACCOUNT_LOCKED_OUT",
          message: lockout.reason,
          remainingSeconds: lockout.remainingSeconds,
        });
      }

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user || !data.session) {
        // Record failed attempt and trigger lockout if threshold exceeded
        const failureResult = await SecurityService.recordFailedLogin(
          email,
          request.ip,
          error?.message || "Invalid credentials",
        );

        if (failureResult.isLocked) {
          return reply.status(429).send({
            error: "Account Locked",
            code: "ACCOUNT_LOCKED_OUT",
            message: "Too many failed login attempts. Your access is temporarily locked for 15 minutes for security protection.",
            remainingSeconds: 900,
          });
        }

        throw new UnauthorizedError(
          `Invalid credentials. ${failureResult.attemptsRemaining} attempts remaining before temporary lockout.`,
          "AUTH_INVALID_CREDENTIALS",
        );
      }

      // Security: Reset failure counter on successful authentication
      SecurityService.recordSuccessfulLogin(email, request.ip);

      // Security: Enforce that email must be confirmed before mobile app access is granted
      const isEmailConfirmed =
        Boolean(data.user.email_confirmed_at) ||
        Boolean(data.user.confirmed_at) ||
        data.user.user_metadata?.email_verified === true;

      if (!isEmailConfirmed) {
        throw new UnauthorizedError(
          "Please verify your email address before logging in. Check your inbox for the confirmation link.",
          "AUTH_EMAIL_NOT_CONFIRMED",
        );
      }

      // Get the user profile from Prisma to include roles/workspaces
      let user = await prisma.user.findUnique({
        where: { id: data.user.id },
        include: {
          workspaces: {
            include: { workspace: true },
          },
        },
      });

      if (!user) {
        // GATEKEEPER: Mobile app is for TENANT, LANDLORD, and PROPERTY_MANAGER users. Check Supabase metadata first.
        const metadataRole =
          data.user.user_metadata?.role || "PROPERTY_MANAGER";
        if (
          metadataRole !== "TENANT" &&
          metadataRole !== "LANDLORD" &&
          metadataRole !== "PROPERTY_MANAGER"
        ) {
          console.warn(
            `[AUTH/LOGIN] REJECTED: Unregistered user ${data.user.email} (${data.user.id}) has metadata role ${metadataRole} attempting mobile login.`,
          );
          throw new AppError(
            "This mobile app is for tenants, landlords, and property managers only.",
            403,
            "TENANT_ONLY_APP",
          );
        }

        // Check if this user was properly registered by a manager
        // (i.e., has a WorkspaceMember record created during tenant/landlord invitation)
        const existingMembership = await prisma.workspaceMember.findFirst({
          where: { userId: data.user.id },
          select: { role: true, workspaceId: true },
        });

        if (!existingMembership) {
          // If metadata indicates PROPERTY_MANAGER, create user profile with 0 workspaces (pending onboarding)
          if (metadataRole === "PROPERTY_MANAGER") {
            const newUser = await prisma.user.create({
              data: {
                id: data.user.id,
                email: data.user.email!,
                name: data.user.user_metadata?.name || null,
                role: "PROPERTY_MANAGER",
              },
              include: {
                workspaces: {
                  include: { workspace: true },
                },
              },
            });

            const mustChange =
              data.user.user_metadata?.mustChangePassword === true;
            return reply.send({
              access_token: data.session.access_token,
              user: {
                ...newUser,
                role: "PROPERTY_MANAGER",
                globalRole: newUser.role,
                workspaceId: null,
                isOnboarded: false,
                mustChangePassword: mustChange,
              },
            });
          }

          // GATEKEEPER: Tenants/Landlords without workspace membership must be registered by a manager
          console.warn(
            `[AUTH/LOGIN] REJECTED: ${data.user.email} (${data.user.id}) authenticated but has no workspace membership. Not registered by any manager.`,
          );
          throw new AppError(
            "Your account has not been set up by a property manager yet. Please contact your property manager to register your access.",
            403,
            "ACCOUNT_NOT_REGISTERED",
          );
        }

        // GATEKEEPER: Mobile app is for TENANT, LANDLORD, and PROPERTY_MANAGER users. Reject other roles.
        if (
          existingMembership.role !== "TENANT" &&
          existingMembership.role !== "LANDLORD" &&
          existingMembership.role !== "PROPERTY_MANAGER"
        ) {
          console.warn(
            `[AUTH/LOGIN] REJECTED: New user ${data.user.email} (${data.user.id}) has role ${existingMembership.role} attempting mobile login.`,
          );
          throw new AppError(
            "This mobile app is for tenants, landlords, and property managers only.",
            403,
            "TENANT_ONLY_APP",
          );
        }

        // User WAS registered by a manager (has membership) but their Prisma
        // profile doesn't exist yet — safe to create it now.
        let role = (existingMembership.role ||
          data.user.user_metadata?.role ||
          "TENANT") as string;
        // Security: Prevent privilege escalation via client-controlled metadata
        if (role === "SUPER_ADMIN") {
          role = "TENANT";
        }
        const newUser = await prisma.user.create({
          data: {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.name || null,
            role: role as any,
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
            workspaceId: existingMembership.workspaceId,
            mustChangePassword: mustChange,
          },
        });
      }

      // GATEKEEPER: Mobile app is for TENANT, LANDLORD, and PROPERTY_MANAGER users.
      // Rejects super admins and tenants/managers with 0 memberships.
      if (
        user.role !== "TENANT" &&
        user.role !== "LANDLORD" &&
        user.role !== "PROPERTY_MANAGER"
      ) {
        console.warn(
          `[AUTH/LOGIN] REJECTED: ${user.email} (${user.id}) is ${user.role} — mobile app does not support this role.`,
        );
        throw new AppError(
          "This mobile app is for tenants, landlords, and property managers only.",
          403,
          "TENANT_ONLY_APP",
        );
      }

      let wsCount = (user.workspaces as unknown[])?.length || 0;

      if (wsCount === 0 && user.role !== "PROPERTY_MANAGER") {
        console.warn(
          `[AUTH/LOGIN] REJECTED: User ${user.email} (${user.id}) has role ${user.role} but 0 workspace memberships.`,
        );
        throw new AppError(
          "Your account has not been set up by a property manager yet. Please contact your property manager to register your access.",
          403,
          "ACCOUNT_NOT_REGISTERED",
        );
      }

      const mustChange = data.user.user_metadata?.mustChangePassword === true;
      const primaryWS = getPrimaryWorkspace(user.workspaces as any);
      const role = primaryWS?.role || user.role || "PROPERTY_MANAGER";
      const workspaceId = primaryWS?.workspaceId || null;
      const isOnboarded = wsCount > 0;

      return reply.send({
        access_token: data.session.access_token,
        user: {
          ...user,
          role,
          globalRole: user.role,
          workspaceId,
          isOnboarded,
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
        primaryWS?.role || supaData.user.user_metadata.role || "TENANT";
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

  // Update User & Workspace Profile details
  server.put<{ Body: Static<typeof UpdateProfileBody> }>(
    "/profile",
    { schema: { body: UpdateProfileBody } },
    async (request, reply) => {
      const token = request.headers.authorization?.replace("Bearer ", "");
      if (!token) throw new UnauthorizedError();

      const { data: supaData, error: supaError } =
        await supabaseAdmin.auth.getUser(token);
      if (supaError || !supaData?.user) {
        throw new UnauthorizedError("Invalid session");
      }

      const userId = supaData.user.id;
      const { name, bankCode, accountNumber, accountName } = request.body;

      // Update Prisma User
      if (name) {
        await prisma.user.update({
          where: { id: userId },
          data: { name },
        });

        // Also update Supabase metadata
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...supaData.user.user_metadata,
            name,
          },
        });
      }

      // Update primary workspace bank payout details if provided
      const userWithWorkspaces = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { include: { workspace: true } } },
      });

      const primaryWS = getPrimaryWorkspace(userWithWorkspaces?.workspaces as any);

      if (primaryWS?.workspaceId && (bankCode || accountNumber || accountName)) {
        await prisma.workspace.update({
          where: { id: primaryWS.workspaceId },
          data: {
            ...(bankCode && { bankCode }),
            ...(accountNumber && { accountNumber }),
            ...(accountName && { accountName }),
          },
        });
      }

      // Invalidate cache
      meCache.delete(token);

      // Re-fetch updated user profile
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { include: { workspace: true } } },
      });

      const role = primaryWS?.role || supaData.user.user_metadata?.role || "TENANT";

      return reply.send({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser
          ? {
              ...updatedUser,
              role,
              globalRole: updatedUser.role,
              workspaceId: primaryWS?.workspaceId || null,
            }
          : null,
      });
    },
  );

  // Trigger password reset email
  server.post<{ Body: Static<typeof ResetPasswordBody> }>(
    "/reset-password-request",
    {
      schema: { body: ResetPasswordBody },
      config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
    },
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
  // Security: Always returns a consistent response to prevent user enumeration.
  server.post<{ Body: Static<typeof CheckEmailBody> }>(
    "/check-email",
    { schema: { body: CheckEmailBody } },
    async (request, reply) => {
      const { email } = request.body;

      if (!prisma) {
        throw new AppError("Database client failed to initialize.", 500);
      }

      // Security: Perform the lookup but NEVER reveal the result to the client.
      // The frontend should treat all responses identically and attempt login regardless.
      await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: { id: true },
      });

      // Security: Uniform response — no enumeration possible
      return reply.send({
        message: "If this email is registered, you will be directed to sign in.",
      });
    },
  );

  // Complete Onboarding for Property Manager (called by mobile and web onboarding screens)
  server.post<{ Body: Static<typeof OnboardManagerBody> }>(
    "/onboard-manager",
    { schema: { body: OnboardManagerBody } },
    async (request, reply) => {
      const token = request.headers.authorization?.replace("Bearer ", "");
      if (!token) throw new UnauthorizedError("Authentication required.");

      const { data: supaData, error: supaError } =
        await supabaseAdmin.auth.getUser(token);
      if (supaError || !supaData?.user) {
        throw new UnauthorizedError("Invalid session.");
      }

      const supaUser = supaData.user;
      const { workspaceName, bankCode, accountNumber, accountName, phone } =
        request.body;

      if (!workspaceName || workspaceName.trim().length < 2) {
        throw new AppError("Workspace or Company name must be at least 2 characters.", 400);
      }

      let user = await prisma.user.findUnique({
        where: { id: supaUser.id },
        include: { workspaces: { include: { workspace: true } } },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: supaUser.id,
            email: supaUser.email!,
            name: supaUser.user_metadata?.name || null,
            role: "PROPERTY_MANAGER",
          },
          include: { workspaces: { include: { workspace: true } } },
        });
      }

      // Create new workspace
      const workspace = await prisma.workspace.create({
        data: {
          name: workspaceName.trim(),
          bankCode: bankCode?.trim() || null,
          accountNumber: accountNumber?.trim() || null,
          accountName: accountName?.trim() || null,
        },
      });

      // Create workspace membership
      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "PROPERTY_MANAGER",
          bankCode: bankCode?.trim() || null,
          accountNumber: accountNumber?.trim() || null,
          accountName: accountName?.trim() || null,
        },
      });

      // Invalidate cache
      meCache.delete(token);

      // Re-fetch updated user profile
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { workspaces: { include: { workspace: true } } },
      });

      return reply.send({
        success: true,
        message: "Onboarding completed successfully!",
        user: {
          ...updatedUser,
          role: "PROPERTY_MANAGER",
          globalRole: updatedUser!.role,
          workspaceId: workspace.id,
          isOnboarded: true,
        },
      });
    },
  );
}
